-- Pick'em: the audit of the closing cache, and the padrón the ranking agrees on.
--
-- Two things 0023 left open, and neither is a feature — both are the kind of
-- gap that only shows up as somebody's ranking being wrong in a way nobody can
-- reproduce.
--
--   1. `pickem_entries.hits` and `.points` are a closing cache. 03-MODELO-DATOS
--      says so and says what has to exist beside it: "Debe existir una función
--      de auditoría que recalcule desde los picks y compare — si difiere, es un
--      bug y hay que verlo, no repararlo en silencio." Until now there was no
--      way to ask whether the cache still matched the picks.
--
--   2. `pickem_leaderboard` filters `phone_verified_at is not null` on the
--      season scope (0023:624) and not on the week scope (0023:637-641). The
--      same table, two different answers to "who is in the padrón". An
--      unverified number cannot save picks — `pickem_save_picks` refuses — but
--      an entry written by staff, a seed, or a settle that ran before a
--      verification was revoked lands in the weekly table and can hold first
--      place in it.
--
-- Style follows 0023: security definer, search_path pinned, and the invariant
-- written down next to the code that keeps it.

-- ===========================================================================
-- The audit
-- ===========================================================================
--
-- WHY IT DOES NOT REPAIR.
--
-- The obvious version of this function updates the row it finds wrong. It must
-- not. A cache that disagrees with the picks is one of a small number of
-- things, and every one of them is worse than the wrong number: a bug in the
-- scorer, a score captured wrong and corrected after the week settled, a game
-- voided after the fact, mechanics re-configured mid-season. Silently rewriting
-- `points` destroys the evidence of all four and makes the ledger — which was
-- paid from the original number and is append-only — disagree with the entry
-- instead. The correction path already exists and is a new `adjustment` entry
-- with a note and an author (0011, and the runbook in 07-OPERACION-SEMANAL).
--
-- `stable` is doing work here, not decoration: PostgreSQL refuses DML inside a
-- stable function, so "never repairs" is enforced rather than promised.
--
-- WHY IT CALLS pickem_score_entry INSTEAD OF RE-DERIVING.
--
-- 0023's first rule: ONE PLACE COMPUTES A SCORE. An audit that re-implemented
-- the arithmetic would be a second scorer, and the first thing it would find is
-- its own disagreement with the first one. So the recomputation runs through
-- the same function the settle ran through, and what is being compared is the
-- scorer applied to today's inputs against the number frozen at closing time.
--
-- TWO COMPARISONS, AND THEY MEAN DIFFERENT THINGS.
--
--   desglose_vs_cache   — `breakdown ->> 'points'` against `points`. These were
--                         written by the same UPDATE in the same transaction.
--                         A difference here is unambiguously a bug; nothing
--                         about the world can have changed between them.
--   recalculo_vs_cache  — the scorer run today against `points`. May be a bug,
--                         or may be a legitimate change of inputs: a corrected
--                         score, a late void, re-configured mechanics. It is
--                         the operator's job to say which, which is why the
--                         function reports both numbers instead of a verdict.
--
-- Returns ONLY the entries that disagree. An audit whose clean output is 450
-- rows is an audit nobody reads.
create or replace function public.pickem_audit_entries(
  p_campaign_slug text,
  p_week int default null
)
returns table (
  entry_id uuid,
  week int,
  participant_id uuid,
  alias text,
  cached_points int,
  cached_hits int,
  told_points int,
  recomputed_points int,
  recomputed_hits int,
  finding text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns;
  v_row record;
  v_score jsonb;
  v_told int;
  v_re_points int;
  v_re_hits int;
  v_finding text;
begin
  select * into v_campaign
  from public.campaigns where slug = p_campaign_slug and module = 'pickem';
  if not found then
    raise exception 'campaign_not_found';
  end if;

  -- Settled entries only. An open week has no cache to audit — `points` is
  -- null by design until the transaction that closes the week writes it, and
  -- reporting every unplayed week as a discrepancy would bury the real ones.
  for v_row in
    select e.id, e.week as wk, e.participant_id as pid, e.points as pts,
           e.hits as hts, e.breakdown as bd, p.alias as al
    from public.pickem_entries e
    join public.participants p on p.id = e.participant_id
    where e.campaign_id = v_campaign.id
      and e.settled_at is not null
      and (p_week is null or e.week = p_week)
    order by e.week, e.points desc nulls last
  loop
    v_told := (v_row.bd ->> 'points')::int;
    v_score := public.pickem_score_entry(v_row.id);
    v_re_points := (v_score ->> 'points')::int;
    v_re_hits := (v_score ->> 'hits')::int;

    v_finding := case
      -- Settled without a number. The settle wrote `settled_at` and not
      -- `points`, which no code path should be able to do.
      when v_row.pts is null then 'cache_vacio'
      -- Settled without the breakdown the player is shown. 10-MECANICAS calls
      -- the breakdown obligatory: a score nobody can follow is a ranking
      -- nobody believes.
      when v_row.bd is null or v_told is null then 'sin_desglose'
      when v_told <> v_row.pts then 'desglose_vs_cache'
      -- The scorer declines: some game of that week lost its score, or was
      -- voided in a way that leaves the week unscorable. Not a mismatch, but
      -- not something to leave unsaid either.
      when v_score is null then 'no_recalculable'
      when v_re_points <> v_row.pts or v_re_hits is distinct from v_row.hts
        then 'recalculo_vs_cache'
      else null
    end;

    if v_finding is not null then
      entry_id := v_row.id;
      week := v_row.wk;
      participant_id := v_row.pid;
      alias := v_row.al;
      cached_points := v_row.pts;
      cached_hits := v_row.hts;
      told_points := v_told;
      recomputed_points := v_re_points;
      recomputed_hits := v_re_hits;
      finding := v_finding;
      return next;
    end if;
  end loop;
end;
$$;

comment on function public.pickem_audit_entries(text, int) is
  'Recalcula cada entrada cerrada con pickem_score_entry y la compara contra el cache de pickem_entries. Devuelve SOLO las discrepancias y NUNCA repara: un cache que no cuadra es evidencia de un bug, de un marcador corregido despues del cierre o de mecanicas reconfiguradas, y sobrescribirlo destruye las tres. La correccion es un asiento adjustment en points_entries, nunca un update. Es stable, asi que PostgreSQL le prohibe escribir.';

-- ===========================================================================
-- The leaderboard, symmetric at last
-- ===========================================================================
--
-- Replaces the body of 0023's function. Everything is as it was except the
-- week branch, which now asks the same question of the padrón that the season
-- branch already asked: is this a number that answered a code?
--
-- WHY IT MATTERS EVEN THOUGH pickem_save_picks REFUSES UNVERIFIED NUMBERS.
-- Because that is one door, and the table is downstream of several: a seed, a
-- staff correction, a settle that ran before somebody's verification was
-- cleared. The rule "only verified numbers appear in a ranking that pays
-- prizes" belongs at the read, where it is true regardless of how the row got
-- there — the same reason 0022 put the legal frame in a column instead of in
-- a WHERE clause somebody has to remember.
--
-- One number, one player, and the number answered. Anything less and the
-- ranking stops being worth reading, which costs more than the prizes do.
create or replace function public.pickem_leaderboard(
  p_campaign_slug text,
  p_week int default null,
  p_scope text default 'week',
  p_limit int default 50
)
returns table (
  rank bigint,
  alias text,
  venue text,
  points bigint,
  participant_id uuid
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns;
begin
  select * into v_campaign
  from public.campaigns where slug = p_campaign_slug and module = 'pickem';
  if not found then
    raise exception 'campaign_not_found';
  end if;

  if p_scope = 'season' then
    -- The season total is a SUM of the ledger, never a stored column — 0011's
    -- rule, and the reason it is safe to correct a week with an `adjustment`
    -- entry instead of editing history.
    --
    -- `currency = 'points'` is the legal frame, not an optimisation: loyalty
    -- tokens earned by spending must never reach this sum. See the column
    -- comment in 0022, and scripts/probes/pickem-legal.mjs, which proves it.
    return query
      select
        rank() over (order by t.total desc),
        t.alias,
        t.venue,
        t.total,
        t.id
      from (
        select
          p.id,
          p.alias,
          -- Where they played most recently, not where they registered.
          (select e.venue from public.pickem_entries e
            where e.participant_id = p.id and e.venue is not null
            order by e.week desc limit 1) as venue,
          coalesce(sum(pe.points), 0)::bigint as total
        from public.participants p
        left join public.points_entries pe
          on pe.participant_id = p.id and pe.currency = 'points'
        where p.campaign_id = v_campaign.id and p.phone_verified_at is not null
        group by p.id, p.alias
      ) t
      order by t.total desc
      limit p_limit;
  else
    return query
      select
        rank() over (order by e.points desc nulls last),
        p.alias,
        e.venue,
        coalesce(e.points, 0)::bigint,
        p.id
      from public.pickem_entries e
      join public.participants p on p.id = e.participant_id
      where e.campaign_id = v_campaign.id
        and e.week = p_week
        -- The line 0023 has on the season scope and not on this one. Without
        -- it the two scopes disagree about who is in the programme, and the
        -- one that pays a weekly prize is the loose one.
        and p.phone_verified_at is not null
      order by e.points desc nulls last
      limit p_limit;
  end if;
end;
$$;

comment on function public.pickem_leaderboard(text, int, text, int) is
  'Ranking por jornada o acumulado. Expone alias, sucursal y puntos; nunca telefono, correo ni nombre real. Ambos alcances suman solo currency = points y ambos exigen phone_verified_at: la simetria es del padron, no una optimizacion.';

-- ===========================================================================
-- Who may call what
-- ===========================================================================
--
-- `security definer` functions are granted to PUBLIC by default, so revoking
-- from anon and authenticated alone leaves the door open. PUBLIC first, then
-- grant back deliberately. `create or replace` above preserved the existing
-- ACL of pickem_leaderboard; these lines restate it so that applying this
-- migration to a fresh database produces the same permissions as applying
-- 0023 and then this.
revoke all on function public.pickem_audit_entries(text, int) from public;
revoke all on function public.pickem_leaderboard(text, int, text, int) from public;

-- The audit is an operations tool. It reads every player's breakdown, which is
-- exactly what pickem_my_week exists to avoid handing to a browser, so it stays
-- with the role the cron and the staff panel run as.
grant execute on function public.pickem_audit_entries(text, int) to service_role;

-- Unchanged from 0023: the ranking is readable without a session, because
-- somebody who scans the table QR should see it before deciding to play.
grant execute on function public.pickem_leaderboard(text, int, text, int) to anon, authenticated;

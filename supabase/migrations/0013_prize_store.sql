-- Prize store: where accumulated points finally buy something.
--
-- The client's rules (Carrera Alaska) govern the shape:
--   · A new Drop opens every Monday. Each prize has a price in points and a
--     limited inventory.
--   · "El primero en canjear, se lo lleva": strict arrival order, no holds.
--   · Sold out means sold out until next Monday.
--   · "Canjear no te saca de la carrera": the leaderboard ranks on points
--     EARNED (0011 + POINTS_SPEND_KINDS), so spending costs balance, never
--     position. Nothing in this migration touches that.
--
-- Design decisions:
--   · Remaining inventory is DERIVED — `inventory - count(redemptions)`. There
--     is no `claimed` column to drift out of sync, for the same reason the
--     ledger has no balance column: a total that can be edited independently of
--     its history eventually disagrees with it.
--   · Redeeming writes the negative points entry in the SAME transaction that
--     creates the redemption, inside tickets_redeem_prize. Two write paths for
--     one balance is how a ledger stops being an authority.
--   · The weekly cut reuses `tickets_week_start` (0006). Re-deriving "when is
--     Monday" here would be a second answer to a question that already has one.
--   · `status` on a drop is curation, not the clock: even an 'open' drop from a
--     past week is refused by the RPC, so forgetting to close one on Monday
--     cannot hand out last week's prizes.

-- ===========================================================================
-- Tables
-- ===========================================================================

-- One row per campaign per week. The unique key is what makes "this week's
-- Drop" a lookup instead of a judgement call.
create table if not exists public.prize_drops (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  -- Monday 00:00 in the campaign's timezone, always produced by
  -- tickets_week_start. Stored rather than computed so the drop keeps pointing
  -- at its own week after the campaign's timezone is corrected.
  week_start timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'open', 'closed')),
  created_at timestamptz not null default now(),
  -- Who curated it. Same instinct as receipt_reviews: an operational action
  -- nobody signed is an action nobody can explain three weeks later.
  created_by uuid references auth.users(id) on delete set null,
  unique (campaign_id, week_start)
);

create index if not exists prize_drops_campaign_idx
  on public.prize_drops (campaign_id, week_start desc);

create table if not exists public.prize_drop_items (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.prize_drops(id) on delete cascade,
  -- The campaign decides which languages exist (campaigns.locales); Alaska is
  -- es-only, so name_en is nullable and the UI falls back to name_es. A prize
  -- is not dropped for missing a translation the way config prizes are — this
  -- one has inventory behind it.
  name_es text not null check (char_length(btrim(name_es)) between 1 and 120),
  name_en text check (name_en is null or char_length(btrim(name_en)) between 1 and 120),
  kind text not null check (kind in ('product', 'recharge', 'giftcard', 'item', 'cash')),
  points_cost int not null check (points_cost > 0),
  inventory int not null check (inventory >= 0),
  -- Denomination, pickup notes, carrier — everything an operator needs to
  -- hand the prize over, without a column per prize type.
  detail jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists prize_drop_items_drop_idx
  on public.prize_drop_items (drop_id, points_cost);

-- The claim itself. `on delete restrict` on the item: a redemption is a promise
-- made to a person, and deleting the prize row must not be able to erase it.
create table if not exists public.prize_redemptions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  drop_item_id uuid not null references public.prize_drop_items(id) on delete restrict,
  -- Copied from the item at redemption time: re-pricing next week's Drop must
  -- not rewrite what somebody already paid.
  points_spent int not null check (points_spent > 0),
  status text not null default 'confirmed'
    check (status in ('confirmed', 'fulfilled', 'canceled')),
  -- Read out loud at the counter, so no 0/O or 1/I/L. Six characters over a
  -- 31-symbol alphabet is ~887M codes: collisions are handled by the unique
  -- index below, not by hoping.
  redemption_code text not null unique
    check (redemption_code ~ '^[2-9A-HJKMNP-Z]{6}$'),
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  fulfilled_by uuid references auth.users(id) on delete set null
);

create index if not exists prize_redemptions_item_idx
  on public.prize_redemptions (drop_item_id, status);
create index if not exists prize_redemptions_campaign_idx
  on public.prize_redemptions (campaign_id, created_at desc);
create index if not exists prize_redemptions_participant_idx
  on public.prize_redemptions (participant_id, created_at desc);

-- The ledger already reserves kind='redemption' and accepts negatives (0011).
-- What it lacked was the pointer back: without it, "which prize was this -1500
-- for" is answerable only by timestamp guessing.
alter table public.points_entries
  add column if not exists redemption_id uuid
    references public.prize_redemptions(id) on delete restrict;

-- One spending entry per redemption, ever — the mirror of
-- points_entries_one_per_receipt. A retried RPC cannot charge twice.
create unique index if not exists points_entries_one_per_redemption
  on public.points_entries (redemption_id) where kind = 'redemption';

-- ===========================================================================
-- Redemption codes
-- ===========================================================================

-- Ambiguous glyphs removed on purpose: 0/O, 1/I/L. The code is dictated over a
-- counter and typed by a clerk, and every character that can be misheard is a
-- prize handed to the wrong person or refused to the right one.
create or replace function public.tickets_redemption_code()
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text := '';
begin
  for i in 1..6 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;
  return v_code;
end;
$$;

-- ===========================================================================
-- Redeem: the only place a redemption is ever created
-- ===========================================================================

-- Errors are raised as stable machine codes, like tickets_approve_receipt, so
-- the API route can hand the UI something to translate instead of a sentence:
--   campaign_not_found | not_a_participant | item_not_found | item_inactive
--   drop_closed | sold_out | insufficient_points | already_redeemed
--
-- The caller is the participant themselves: this function resolves them from
-- auth.uid(), so it must run with the participant's JWT (the API route uses the
-- cookie-bound client, not the service role). That is the whole authorization
-- model — nobody can spend points that are not theirs, because no argument says
-- whose points to spend.
create or replace function public.tickets_redeem_prize(
  p_campaign_slug text,
  p_drop_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns;
  v_participant public.participants;
  v_item public.prize_drop_items;
  v_drop public.prize_drops;
  v_tz text;
  v_week timestamptz;
  v_claimed int;
  v_balance bigint;
  v_redemption public.prize_redemptions;
begin
  select * into v_campaign
  from public.campaigns
  where slug = p_campaign_slug and module = 'tickets';
  if not found then
    raise exception 'campaign_not_found';
  end if;

  -- Lock the participant BEFORE the item, and always in that order: it is what
  -- stops one person spending the same balance on two different prizes at once,
  -- and a fixed lock order is what stops two people deadlocking each other.
  select * into v_participant
  from public.participants
  where campaign_id = v_campaign.id and auth_user_id = auth.uid()
  for update;
  if not found then
    raise exception 'not_a_participant';
  end if;

  -- The row lock IS the queue. Two people reaching for the last unit serialise
  -- here; the loser reads the winner's committed redemption and gets sold_out.
  select * into v_item
  from public.prize_drop_items
  where id = p_drop_item_id
  for update;
  if not found then
    raise exception 'item_not_found';
  end if;

  -- The foreign key makes the missing case impossible, and it is still checked:
  -- with a NULL drop every comparison below would be NULL, and an `if` that is
  -- neither true nor false is an `if` that lets everything through.
  select * into v_drop from public.prize_drops where id = v_item.drop_id;
  if not found then
    raise exception 'item_not_found';
  end if;
  -- Cross-campaign guess: the item id is opaque, but "not found" is the honest
  -- answer to a prize that does not belong to this campaign.
  if v_drop.campaign_id <> v_campaign.id then
    raise exception 'item_not_found';
  end if;

  if not v_item.active then
    raise exception 'item_inactive';
  end if;

  v_tz := coalesce(v_campaign.config ->> 'timezone', 'America/Denver');
  v_week := public.tickets_week_start(v_tz, now());

  -- Double defence: the curated status AND the calendar. An 'open' drop nobody
  -- closed on Monday is still last week's drop.
  if v_drop.status <> 'open' or v_drop.week_start <> v_week then
    raise exception 'drop_closed';
  end if;

  -- Derived inventory. A canceled redemption releases its unit; v1 has no
  -- cancel action, because undoing one also owes the participant their points
  -- back and that refund belongs in a transaction of its own.
  select count(*) into v_claimed
  from public.prize_redemptions
  where drop_item_id = v_item.id and status <> 'canceled';
  if v_claimed >= v_item.inventory then
    raise exception 'sold_out';
  end if;

  -- One unit of a given prize per participant per Drop. The inventory is the
  -- week's whole stock of that prize: without this, one balance can empty a
  -- three-unit Drop before anybody else opens the app, which is the opposite of
  -- what a weekly Drop is for. Different prizes in the same Drop are fine.
  if exists (
    select 1 from public.prize_redemptions
    where drop_item_id = v_item.id
      and participant_id = v_participant.id
      and status <> 'canceled'
  ) then
    raise exception 'already_redeemed';
  end if;

  -- Balance is the SUM of the ledger, here as everywhere else.
  select coalesce(sum(points), 0) into v_balance
  from public.points_entries
  where participant_id = v_participant.id;
  if v_balance < v_item.points_cost then
    raise exception 'insufficient_points';
  end if;

  -- Retry on the astronomically unlikely code collision instead of failing the
  -- redemption: the unique index is the authority, the loop is the recovery.
  for v_attempt in 1..10 loop
    begin
      insert into public.prize_redemptions (
        campaign_id, participant_id, drop_item_id, points_spent, redemption_code
      ) values (
        v_campaign.id, v_participant.id, v_item.id, v_item.points_cost,
        public.tickets_redemption_code()
      )
      returning * into v_redemption;
      exit;
    exception when unique_violation then
      v_redemption := null;
    end;
  end loop;
  if v_redemption.id is null then
    raise exception 'code_generation_failed';
  end if;

  -- Same transaction, one write path for the balance. If this fails, the
  -- redemption it pays for does not survive either.
  insert into public.points_entries (
    campaign_id, participant_id, kind, points, week_start, redemption_id, note
  ) values (
    v_campaign.id, v_participant.id, 'redemption', -v_item.points_cost, v_week,
    v_redemption.id, v_item.name_es
  );

  return jsonb_build_object(
    'redemption_id', v_redemption.id,
    'redemption_code', v_redemption.redemption_code,
    'points_spent', v_redemption.points_spent,
    'points_balance', v_balance - v_redemption.points_spent,
    'prize_name_es', v_item.name_es,
    'prize_name_en', v_item.name_en,
    'kind', v_item.kind
  );
end;
$$;

-- ===========================================================================
-- Row level security
-- ===========================================================================

alter table public.prize_drops       enable row level security;
alter table public.prize_drop_items  enable row level security;
alter table public.prize_redemptions enable row level security;

-- Supabase hands anon/authenticated full DML on new public tables by default,
-- and RLS alone would not stop a DELETE. Start from zero, then grant reads.
revoke all on public.prize_drops, public.prize_drop_items, public.prize_redemptions
  from anon, authenticated;

grant select on public.prize_drops, public.prize_drop_items, public.prize_redemptions
  to authenticated;

-- A participant sees the drops of the campaigns they joined. Not "any signed-in
-- user": being registered somewhere is not membership everywhere.
drop policy if exists prize_drops_campaign_read on public.prize_drops;
create policy prize_drops_campaign_read on public.prize_drops
  for select to authenticated
  using (exists (
    select 1 from public.participants p
    where p.campaign_id = prize_drops.campaign_id
      and p.auth_user_id = (select auth.uid())
  ));

drop policy if exists prize_drop_items_campaign_read on public.prize_drop_items;
create policy prize_drop_items_campaign_read on public.prize_drop_items
  for select to authenticated
  using (exists (
    select 1
    from public.prize_drops d
    join public.participants p on p.campaign_id = d.campaign_id
    where d.id = prize_drop_items.drop_id
      and p.auth_user_id = (select auth.uid())
  ));

drop policy if exists prize_redemptions_self_read on public.prize_redemptions;
create policy prize_redemptions_self_read on public.prize_redemptions
  for select to authenticated
  using (exists (
    select 1 from public.participants p
    where p.id = prize_redemptions.participant_id
      and p.auth_user_id = (select auth.uid())
  ));

-- No insert/update/delete policy anywhere on purpose: every write is either the
-- SECURITY DEFINER function below or a service_role API route, exactly like the
-- money tables. Remaining inventory is a count of these rows, so a client able
-- to insert one would be a client able to mint prizes.

revoke all on function public.tickets_redemption_code() from public, anon, authenticated;
revoke all on function public.tickets_redeem_prize(text, uuid) from public, anon;
-- `authenticated` and not just service_role, unlike the approval path: this
-- function reads auth.uid() to decide whose points it spends, so it has to run
-- with the participant's JWT. The service role has no uid and would resolve no
-- participant at all. Every rule it enforces is inside it, which is why calling
-- it directly buys an attacker nothing the UI would not have allowed.
grant execute on function public.tickets_redeem_prize(text, uuid) to authenticated, service_role;

-- ===========================================================================
-- Comments
-- ===========================================================================

comment on table public.prize_drops is
  'Drop semanal de la Tienda de Premios. Uno por campaña y semana (lunes 00:00 de la plaza, vía tickets_week_start). status es curaduría: la RPC además exige que la semana sea la actual.';
comment on table public.prize_drop_items is
  'Premios de un Drop: costo en puntos e inventario. El inventario restante NUNCA se guarda, se deriva contando canjes no cancelados.';
comment on table public.prize_redemptions is
  'Canjes confirmados. redemption_code es lo que el participante muestra en tienda; se crea solo dentro de tickets_redeem_prize.';
comment on function public.tickets_redeem_prize(text, uuid) is
  'Única vía para canjear un premio. Bajo lock de participante y de premio: valida drop abierto de la semana en curso, inventario derivado y saldo del ledger, e inserta el canje y su entrada negativa de puntos en la misma transacción.';

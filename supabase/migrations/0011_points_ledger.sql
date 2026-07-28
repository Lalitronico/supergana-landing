-- Points: the accumulation layer that gives a participant a reason to return.
--
-- Legal frame (MODULO_CARRERA_TICKETS_PLAN.md, SUPERGANA_PLATAFORMA_FUNDAMENTOS.md):
-- points are the ACCUMULATION regime — earned by purchase, redeemed against
-- fixed thresholds, no chance anywhere. They must never feed a sweepstake:
-- "comprar no mejora tus probabilidades" is what keeps the campaign out of
-- private-lottery territory.
--
-- Design decisions:
--   · Append-only ledger, like consents and receipt_reviews. A balance is a
--     SUM, never a column — a mutable points column is how balances and
--     history drift apart.
--   · Points are born in tickets_approve_receipt, the same transaction that
--     approves the receipt. A second write path would eventually disagree.
--   · The welcome-reward gates (participant/household/quota/slots/fund) stop
--     failing the approval and instead decide whether the $20 reward is
--     created. A valid receipt over the threshold is always worth its points;
--     the money invariant (never a second welcome reward) moves into a skip,
--     not an exception. Receipt-validity checks still raise.

create table if not exists public.points_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  receipt_id uuid references public.receipts(id) on delete set null,
  kind text not null check (kind in ('purchase', 'adjustment', 'redemption')),
  -- Positive when earning, negative when redeeming or correcting downward.
  points int not null,
  week_start timestamptz,
  note text,
  created_at timestamptz not null default now()
);

-- One purchase entry per receipt, ever: re-running an approval (e.g. after a
-- needs_new_image round-trip) cannot double-earn.
create unique index if not exists points_entries_one_per_receipt
  on public.points_entries (receipt_id) where kind = 'purchase';

create index if not exists points_entries_participant_idx
  on public.points_entries (participant_id, created_at desc);
create index if not exists points_entries_week_idx
  on public.points_entries (campaign_id, week_start);

alter table public.points_entries enable row level security;
grant select on public.points_entries to authenticated;

-- Own rows only, like everything else. The leaderboard will need a wider
-- read some day; per the v2 brief that will be its own scoped view, not a
-- loosening of this policy.
drop policy if exists points_entries_self_read on public.points_entries;
create policy points_entries_self_read on public.points_entries
  for select to authenticated
  using (exists (
    select 1 from public.participants p
    where p.id = points_entries.participant_id and p.auth_user_id = (select auth.uid())
  ));

comment on table public.points_entries is
  'Ledger append-only de puntos. El balance es SUM(points); las entradas de compra nacen dentro de tickets_approve_receipt.';

-- ===========================================================================
-- tickets_approve_receipt v2 — same signature, soft reward gates, points
-- ===========================================================================

create or replace function public.tickets_approve_receipt(
  p_receipt_id uuid,
  p_reviewer uuid,
  p_store_name text,
  p_purchase_date date,
  p_total_cents int,
  p_eligible_cents int,
  p_items jsonb default '[]'::jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt public.receipts;
  v_campaign public.campaigns;
  v_participant public.participants;
  v_config jsonb;
  v_tz text;
  v_reward_cents int;
  v_min_cents int;
  v_week timestamptz;
  v_dedupe text;
  v_reward public.rewards;
  v_used_cents bigint;
  v_reward_skipped text := null;
  v_points_per_dollar int;
  v_points_cap int;
  v_points_earned int := 0;
  v_points_used int;
  v_points_awarded int := 0;
begin
  select * into v_receipt from public.receipts where id = p_receipt_id for update;
  if not found then
    raise exception 'receipt_not_found';
  end if;

  -- Lock the campaign: this is what serialises concurrent approvals.
  select * into v_campaign from public.campaigns where id = v_receipt.campaign_id for update;
  select * into v_participant from public.participants where id = v_receipt.participant_id;

  v_config := v_campaign.config;
  v_tz := coalesce(v_config ->> 'timezone', 'America/Denver');
  v_reward_cents := tickets_config_int(v_config, 'reward_cents', 2000);
  v_min_cents := tickets_config_int(v_config, 'min_purchase_cents', 1000);
  v_week := public.tickets_week_start(v_tz, now());
  v_points_per_dollar := tickets_config_int(v_config, 'points_per_dollar', 10);
  v_points_cap := tickets_config_int(v_config, 'weekly_points_cap', 0);

  -- Receipt-validity checks: these still fail the approval outright. A ticket
  -- below the threshold or already claimed is not worth points either.
  if v_receipt.status not in ('received', 'in_review', 'needs_new_image') then
    raise exception 'bad_status';
  end if;

  if p_eligible_cents < v_min_cents then
    raise exception 'below_threshold';
  end if;

  if p_eligible_cents > p_total_cents then
    raise exception 'eligible_above_total';
  end if;

  v_dedupe := lower(btrim(p_store_name)) || '|' || p_purchase_date::text || '|' || p_total_cents::text;
  if exists (
    select 1 from public.receipts r
    where r.campaign_id = v_receipt.campaign_id
      and r.dedupe_key = v_dedupe
      and r.id <> v_receipt.id
  ) then
    raise exception 'duplicate_receipt';
  end if;

  -- Welcome-reward gates: soft since v2. The first one that trips names the
  -- reason; the receipt is still approved and still earns points.
  if (
    select count(*) from public.rewards
    where participant_id = v_receipt.participant_id and status <> 'canceled'
  ) >= tickets_config_int(v_config, 'per_participant_limit', 1) then
    v_reward_skipped := 'participant_limit';
  elsif (
    select count(*) from public.rewards
    where campaign_id = v_receipt.campaign_id
      and household_key = v_participant.household_key
      and status <> 'canceled'
  ) >= tickets_config_int(v_config, 'per_household_limit', 1) then
    v_reward_skipped := 'household_limit';
  elsif (
    select count(*) from public.rewards
    where campaign_id = v_receipt.campaign_id
      and week_start = v_week
      and status <> 'canceled'
  ) >= tickets_config_int(v_config, 'weekly_quota', 150) then
    v_reward_skipped := 'weekly_quota';
  elsif (
    select count(*) from public.rewards
    where campaign_id = v_receipt.campaign_id and status <> 'canceled'
  ) >= tickets_config_int(v_config, 'total_reward_slots', 1200) then
    v_reward_skipped := 'slots_exhausted';
  else
    select coalesce(sum(amount_cents), 0) into v_used_cents
    from public.rewards
    where campaign_id = v_receipt.campaign_id and status <> 'canceled';

    if v_used_cents + v_reward_cents > tickets_config_int(v_config, 'fund_cents', 3000000) then
      v_reward_skipped := 'fund_exhausted';
    end if;
  end if;

  update public.receipts set
    status = 'approved',
    store_name = btrim(p_store_name),
    purchase_date = p_purchase_date,
    total_cents = p_total_cents,
    eligible_cents = p_eligible_cents,
    dedupe_key = v_dedupe,
    reject_reason = null,
    reviewed_at = now(),
    reviewed_by = p_reviewer
  where id = p_receipt_id;

  delete from public.receipt_items where receipt_id = p_receipt_id;
  insert into public.receipt_items (receipt_id, product_id, alias_matched, line_text, amount_cents)
  select
    p_receipt_id,
    nullif(item ->> 'product_id', '')::uuid,
    nullif(item ->> 'alias_matched', ''),
    item ->> 'line_text',
    (item ->> 'amount_cents')::int
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
  where coalesce(item ->> 'line_text', '') <> '';

  if v_reward_skipped is null then
    insert into public.rewards (
      campaign_id, participant_id, receipt_id, amount_cents,
      provider, status, household_key, week_start, note
    ) values (
      v_receipt.campaign_id, v_receipt.participant_id, p_receipt_id, v_reward_cents,
      coalesce(v_config ->> 'payout_provider', 'manual'), 'reserved',
      v_participant.household_key, v_week, p_note
    )
    returning * into v_reward;
  end if;

  -- Points: floor of eligible dollars × rate, clipped by the weekly cap
  -- (0 = uncapped). All inside the campaign lock, so two same-week approvals
  -- cannot both squeeze under the cap.
  v_points_earned := (p_eligible_cents * v_points_per_dollar) / 100;
  if v_points_cap > 0 then
    select coalesce(sum(points), 0) into v_points_used
    from public.points_entries
    where participant_id = v_receipt.participant_id
      and kind = 'purchase'
      and week_start = v_week;
    v_points_awarded := greatest(0, least(v_points_earned, v_points_cap - v_points_used));
  else
    v_points_awarded := v_points_earned;
  end if;

  if v_points_awarded > 0 then
    insert into public.points_entries (
      campaign_id, participant_id, receipt_id, kind, points, week_start
    ) values (
      v_receipt.campaign_id, v_receipt.participant_id, p_receipt_id,
      'purchase', v_points_awarded, v_week
    )
    on conflict (receipt_id) where kind = 'purchase' do nothing;
  end if;

  insert into public.receipt_reviews (receipt_id, reviewer, decision, reason, snapshot)
  values (
    p_receipt_id, p_reviewer, 'approved', p_note,
    jsonb_build_object(
      'store_name', btrim(p_store_name),
      'purchase_date', p_purchase_date,
      'total_cents', p_total_cents,
      'eligible_cents', p_eligible_cents,
      'items', coalesce(p_items, '[]'::jsonb),
      'reward_skipped', v_reward_skipped,
      'points_awarded', v_points_awarded
    )
  );

  return jsonb_build_object(
    'reward_id', v_reward.id,
    'external_id', v_reward.external_id,
    'amount_cents', v_reward.amount_cents,
    'week_start', v_week,
    'reward_skipped', v_reward_skipped,
    'points_awarded', v_points_awarded
  );
end;
$$;

-- The signature did not change, but re-assert the permission boundary anyway:
-- this function moves money and mints points, and "the grant was already
-- there" is not something a security review should have to assume.
revoke all on function public.tickets_approve_receipt(uuid, uuid, text, date, int, int, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.tickets_approve_receipt(uuid, uuid, text, date, int, int, jsonb, text)
  to service_role;

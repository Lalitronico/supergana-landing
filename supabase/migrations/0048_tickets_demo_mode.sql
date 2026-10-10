-- Demo mode: every receipt photo credits a fixed number of points.
--
-- A sales demo is the one setting where the module's rules work against it.
-- The people holding the phones are executives in a meeting room: they carry no
-- receipt with the client's products on it, they photograph whatever they have,
-- and every "we sent it to a person" is a dead minute in front of the buyer.
-- The reading itself is the part worth showing, so it still runs; what demo mode
-- removes is the verdict. Whatever the photo is, it is approved with
-- `config.demo.fixed_points` and the room moves on to the store.
--
-- Opt-in by data and closed by default: the key is absent on every campaign,
-- and the function below refuses to run unless the campaign carries it. The
-- server cannot mint fixed points on Alaska by calling the wrong RPC.
--
-- What is deliberately NOT here, compared to tickets_approve_receipt:
--   · no dedupe lock — two executives photographing the same printed demo
--     ticket must both get their points; `dedupe_key` stays null so a demo
--     approval can never block a real receipt later either;
--   · no minimum purchase and no eligible-above-total check — there may be no
--     total at all;
--   · no weekly cap and no welcome reward — demo mode is about points.
-- The image-hash unique index still applies: the same file twice is still a
-- duplicate, and that refusal is a fair thing to show in a demo.

create or replace function public.tickets_approve_demo(
  p_receipt_id uuid,
  p_store_name text default null,
  p_purchase_date date default null,
  p_total_cents int default null,
  p_eligible_cents int default null,
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
  v_points int;
  v_week timestamptz;
begin
  select * into v_receipt from public.receipts where id = p_receipt_id for update;
  if not found then
    raise exception 'receipt_not_found';
  end if;

  select * into v_campaign from public.campaigns where id = v_receipt.campaign_id for update;

  -- The gate: no demo key, no demo approval.
  v_points := case
    when jsonb_typeof(v_campaign.config -> 'demo' -> 'fixed_points') = 'number'
      then (v_campaign.config -> 'demo' ->> 'fixed_points')::numeric::int
    else 0
  end;
  if v_points <= 0 then
    raise exception 'demo_off';
  end if;

  if v_receipt.status not in ('received', 'in_review', 'needs_new_image') then
    raise exception 'bad_status';
  end if;

  v_week := public.tickets_week_start(coalesce(v_campaign.config ->> 'timezone', 'America/Denver'), now());

  update public.receipts set
    status = 'approved',
    store_name = nullif(btrim(coalesce(p_store_name, '')), ''),
    purchase_date = p_purchase_date,
    total_cents = case when p_total_cents >= 0 then p_total_cents end,
    eligible_cents = case when p_eligible_cents >= 0 then p_eligible_cents end,
    dedupe_key = null,
    reject_reason = null,
    reviewed_at = now(),
    reviewed_by = null
  where id = p_receipt_id;

  -- Whatever the reading recognised, kept like a real approval keeps it: the
  -- celebration and the live screen show the brands that were on the ticket.
  delete from public.receipt_items where receipt_id = p_receipt_id;
  insert into public.receipt_items (receipt_id, product_id, alias_matched, line_text, amount_cents)
  select
    p_receipt_id,
    nullif(item ->> 'product_id', '')::uuid,
    nullif(item ->> 'alias_matched', ''),
    item ->> 'line_text',
    coalesce((item ->> 'amount_cents')::int, 0)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
  where coalesce(item ->> 'line_text', '') <> '';

  insert into public.points_entries (
    campaign_id, participant_id, receipt_id, kind, points, week_start
  ) values (
    v_receipt.campaign_id, v_receipt.participant_id, p_receipt_id,
    'purchase', v_points, v_week
  )
  on conflict (receipt_id) where kind = 'purchase' do nothing;

  insert into public.receipt_reviews (receipt_id, reviewer, decision, reason, snapshot)
  values (
    p_receipt_id, null, 'approved', p_note,
    jsonb_build_object(
      'demo', true,
      'store_name', p_store_name,
      'purchase_date', p_purchase_date,
      'total_cents', p_total_cents,
      'eligible_cents', p_eligible_cents,
      'items', coalesce(p_items, '[]'::jsonb),
      'points_awarded', v_points
    )
  );

  return jsonb_build_object('points_awarded', v_points, 'week_start', v_week);
end;
$$;

-- Mints points: the server's service role only, never a browser.
revoke all on function public.tickets_approve_demo(uuid, text, date, int, int, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.tickets_approve_demo(uuid, text, date, int, int, jsonb, text)
  to service_role;

-- The Novamex demo (campaign `tanque`, meeting of 2026-10-12): any photo is
-- worth 1,500 points, exactly the $25 gas card, so every executive in the room
-- can go from photo to redeemed prize in one sitting.
update public.campaigns
   set config = config || jsonb_build_object('demo', jsonb_build_object('fixed_points', 1500))
 where slug = 'tanque' and module = 'tickets';

-- A room of executives all redeeming the $25 card would empty a stock of 10.
-- Generous stock on every demo drop so nobody meets "sold out" mid-meeting.
update public.prize_drop_items i
   set inventory = greatest(i.inventory, 200)
  from public.prize_drops d
  join public.campaigns c on c.id = d.campaign_id
 where d.id = i.drop_id
   and c.slug = 'tanque';

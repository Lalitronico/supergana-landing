-- Campaign #3 of the Carrera de Tickets module: "Ticket al Tanque", the sales
-- demo Novamex walks through in its 2026-10-12 meeting.
--
-- It is a NEW campaign under the existing `novamex` org, not a rewrite of
-- `ticket-al-tanque` (0007). That one still carries the threshold mechanic the
-- July deck pitched ($10 → $20, 1,200 slots, $30k fund) and its July test data;
-- the real campaign's config is still waiting on client decisions. A demo is a
-- different object with a different lifetime, and keeping it apart means the
-- day the real one is configured nothing here has to be untangled.
--
-- Mechanic: accumulation (every eligible dollar earns points, the points buy
-- fixed-price prizes in a weekly Drop). No chance anywhere — the prizes are
-- reached by threshold, which keeps the demo inside the "dinero y azar
-- separados" line (SUPERGANA_PLATAFORMA_FUNDAMENTOS.md).
--
-- Catalogue scope decided by the client side on 2026-10-10: Jarritos and
-- Mineragua only. SKUs and UPCs come from `Novamex_USA_Catalogo_UPC.xlsx`,
-- whose own status column says "Pendiente de validación comercial 2026" — they
-- are the client's list, not verified against GS1.

-- ===========================================================================
-- Schema: a product can carry a picture
-- ===========================================================================
-- The home shows the participating products, and a shopper standing at the
-- shelf recognises a bottle faster than a name. Nullable and additive: code
-- that does not know the column keeps working, a product without a picture
-- renders as the text chip it always was. Same validation rule as the theme's
-- assets (lib/tickets/theme.ts: `/brands/...` or https), enforced in code.
alter table public.products add column if not exists image_url text;

-- ===========================================================================
-- Campaign
-- ===========================================================================
insert into public.campaigns (org_id, slug, name, module, status, locales, config)
select
  o.id,
  'tanque',
  'Ticket al Tanque',
  'tickets',
  -- Draft + rehearsal 'anyone' is the Alaska demo pattern (0018): anyone with
  -- an account can upload, nobody was ever given a public QR. Flip rehearsal
  -- back to 'staff' after the meeting.
  'draft',
  array['es', 'en'],
  jsonb_build_object(
    -- Reward layer OFF, the same six-zero switch 0012 documents.
    'min_purchase_cents',    0,
    'reward_cents',          0,
    'total_reward_slots',    0,
    'weekly_quota',          0,
    'per_participant_limit', 0,
    'per_household_limit',   0,
    'fund_cents',            0,

    -- 10 points per eligible dollar: a $30 Jarritos/Mineragua basket = 300 pts.
    'points_per_dollar',     10,
    'weekly_points_cap',     0,

    'review_sla_hours',      48,
    -- Texas is the anchor market of the July brief. Only decides when the
    -- weekly Drop turns over; the Drops below cover five consecutive weeks so
    -- the boundary never lands in the middle of the demo.
    'timezone',              'America/Chicago',
    -- Empty = no state restriction and no state picker (profile_fields below
    -- switches the field off anyway).
    'eligible_states',       jsonb_build_array(),
    'payout_provider',       'manual',
    'rules_version',         '2026-10-12-demo',
    'rules_url',             null,
    'show_grand_prize',      false,
    'prizes',                jsonb_build_array(),

    'brands', jsonb_build_array(
      jsonb_build_object('name', 'Jarritos',  'color', '#FF8A00'),
      jsonb_build_object('name', 'Mineragua', 'color', '#1E90FF')
    ),

    -- Email + password: the identity channel with zero external dependencies
    -- (no WhatsApp, no SMTP — the account is created server-side). The phone
    -- channel is +52-only today (lib/platform/phone.ts) and this is a US
    -- campaign. No household limit, so zip may be off (0015's rule).
    'auth',           jsonb_build_object('channel', 'email'),
    'profile_fields', jsonb_build_object('phone', 'off', 'zip', 'off', 'state', 'off'),
    'rehearsal',      'anyone',

    -- Fictional stores, on purpose: the demo receipts are printed props and
    -- must not carry a real retailer's name. A real receipt from any other
    -- store still works — it falls to the review queue (store_not_listed),
    -- which is the human-in-the-loop path the console demonstrates.
    'stores', jsonb_build_array('Supergana Market', 'Mercado El Tanque'),

    'ocr', jsonb_build_object(
      'enabled',      true,
      'autofill',     true,
      'auto_approve', true,
      'model',        'qwen3.8-max'
    ),
    -- SKU match first, brand as the net (lib/tickets/matching.ts): a printed
    -- "JARRITOS MANDARIN 12.5OZ" that the catalogue does not list still counts.
    'eligibility', 'brand'
  )
from public.organizations o
where o.slug = 'novamex'
on conflict (slug) do nothing;

-- ===========================================================================
-- Catalogue: 5 SKUs, aliases as a US POS would print them, UPC as an alias
-- ===========================================================================
-- Many US POS print the UPC next to the description; matching is substring on
-- the normalised line, so the UPC itself is the most reliable alias there is.
with campaign as (
  select id from public.campaigns where slug = 'tanque'
),
seeded as (
  insert into public.products (campaign_id, brand, name, size, image_url)
  select campaign.id, v.brand, v.name, v.size, v.image_url
  from campaign,
    (values
      ('Jarritos',  'Tamarindo 1.5 L',     '1.5 L',  '/brands/novamex/productos/jarritos-tamarindo.png'),
      ('Jarritos',  'Piña 1.5 L',          '1.5 L',  '/brands/novamex/productos/jarritos-pina.png'),
      ('Jarritos',  'Fresa 1.5 L',         '1.5 L',  '/brands/novamex/productos/jarritos-fresa.png'),
      ('Mineragua', 'Agua mineral 500 ml', '500 ml', '/brands/novamex/productos/mineragua-500ml.png'),
      ('Mineragua', 'Agua mineral 1.5 L',  '1.5 L',  '/brands/novamex/productos/mineragua-1-5l.png')
    ) as v(brand, name, size, image_url)
  where not exists (
    select 1 from public.products p
    where p.campaign_id = campaign.id and p.brand = v.brand and p.name = v.name
  )
  returning id, name
)
insert into public.product_aliases (product_id, retailer, alias_text)
select seeded.id, null, v.alias
from seeded,
  (values
    ('Tamarindo 1.5 L',     'JARRITOS TAMARINDO 1.5L'),
    ('Tamarindo 1.5 L',     'JARRITOS TAMARIND 1.5L'),
    ('Tamarindo 1.5 L',     'JARRITOS TAMAR 1.5L'),
    ('Tamarindo 1.5 L',     '090478216225'),

    ('Piña 1.5 L',          'JARRITOS PINA 1.5L'),
    ('Piña 1.5 L',          'JARRITOS PINEAPPLE 1.5L'),
    ('Piña 1.5 L',          'JARRITOS PINEAP 1.5L'),
    ('Piña 1.5 L',          '090478216270'),

    ('Fresa 1.5 L',         'JARRITOS FRESA 1.5L'),
    ('Fresa 1.5 L',         'JARRITOS STRAWBERRY 1.5L'),
    ('Fresa 1.5 L',         'JARRITOS STRAWB 1.5L'),
    ('Fresa 1.5 L',         '090478216287'),

    ('Agua mineral 500 ml', 'MINERAGUA 500ML'),
    ('Agua mineral 500 ml', 'MINERAGUA 16.9OZ'),
    ('Agua mineral 500 ml', 'MINERAGUA MIN WATER 500ML'),
    ('Agua mineral 500 ml', '090478415512'),

    ('Agua mineral 1.5 L',  'MINERAGUA 1.5L'),
    ('Agua mineral 1.5 L',  'MINERAGUA 50.7OZ'),
    ('Agua mineral 1.5 L',  'MINERAGUA MIN WATER 1.5L'),
    ('Agua mineral 1.5 L',  '090478216805')
  ) as v(name, alias)
where v.name = seeded.name;

-- ===========================================================================
-- Prize store: one open Drop per week, five weeks, from the current one
-- ===========================================================================
-- The store only shows the Drop whose week_start is the current week, so a
-- single Drop dies every Monday (what happened to Alaska's in August). Five
-- consecutive weeks cover the rehearsal, the meeting and the follow-up days
-- when Novamex plays with it on their own.
insert into public.prize_drops (campaign_id, week_start, status)
select
  c.id,
  public.tickets_week_start('America/Chicago', now() + make_interval(weeks => w)),
  'open'
from public.campaigns c
cross join generate_series(0, 4) as w
where c.slug = 'tanque'
on conflict (campaign_id, week_start) do nothing;

-- Prices: 10 pts per dollar, so 300 pts = $30 of Jarritos/Mineragua for a $5
-- gas card (≈17% back). Demo numbers, flagged as such in `detail.demo`; the
-- real ladder is a client decision (feedback: ROI defendible).
-- The gas cards are delivered digitally through Tremendous in the real
-- operation; today payout is manual, which the console says.
insert into public.prize_drop_items (drop_id, name_es, name_en, kind, points_cost, inventory, detail)
select d.id, v.name_es, v.name_en, v.kind, v.points_cost, v.inventory, v.detail
from public.prize_drops d
join public.campaigns c on c.id = d.campaign_id
cross join (
  values
    ('Jarritos 1.5 L gratis'::text, 'Free Jarritos 1.5 L'::text, 'product'::text, 150, 50,
      jsonb_build_object(
        'demo', true,
        'image_url', '/brands/novamex/premios/jarritos-gratis.png',
        'entrega', 'Cupón digital: se canjea en tienda participante mostrando el código.'
      )),
    ('Gift card de gasolina $5', '$5 gas gift card', 'giftcard', 300, 40,
      jsonb_build_object(
        'demo', true,
        'value_cents', 500,
        'provider', 'Tremendous',
        'image_url', '/brands/novamex/premios/gasolina-5.png',
        'entrega', 'Entrega digital al correo registrado, vía Tremendous.'
      )),
    ('Gift card de gasolina $10', '$10 gas gift card', 'giftcard', 600, 25,
      jsonb_build_object(
        'demo', true,
        'value_cents', 1000,
        'provider', 'Tremendous',
        'image_url', '/brands/novamex/premios/gasolina-10.png',
        'entrega', 'Entrega digital al correo registrado, vía Tremendous.'
      )),
    ('Gift card de gasolina $25', '$25 gas gift card', 'giftcard', 1500, 10,
      jsonb_build_object(
        'demo', true,
        'value_cents', 2500,
        'provider', 'Tremendous',
        'image_url', '/brands/novamex/premios/gasolina-25.png',
        'entrega', 'Entrega digital al correo registrado, vía Tremendous.'
      )),
    ('Gift card de gasolina $50', '$50 gas gift card', 'giftcard', 3000, 5,
      jsonb_build_object(
        'demo', true,
        'value_cents', 5000,
        'provider', 'Tremendous',
        'image_url', '/brands/novamex/premios/gasolina-50.png',
        'entrega', 'Entrega digital al correo registrado, vía Tremendous.'
      ))
) as v(name_es, name_en, kind, points_cost, inventory, detail)
where c.slug = 'tanque'
  and not exists (
    select 1 from public.prize_drop_items i
    where i.drop_id = d.id and i.name_es = v.name_es
  );

-- ===========================================================================
-- Staff: the same people who run Carrera Alaska run the demo console
-- ===========================================================================
insert into public.campaign_admins (campaign_id, auth_user_id, role)
select t.id, a.auth_user_id, a.role
from public.campaign_admins a
join public.campaigns src on src.id = a.campaign_id and src.slug = 'carrera-alaska'
cross join public.campaigns t
where t.slug = 'tanque'
on conflict do nothing;

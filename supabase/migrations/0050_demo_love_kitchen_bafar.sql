-- Carrera de Tickets demo #2: Grupo Bafar × Love & Kitchen ("La Parrilla
-- Supergana"), built on the same module as the Novamex demo (`tanque`, 0033+),
-- which this migration does not touch.
--
-- Tenancy. The organisation is Grupo Bafar — who would sign — and the campaign
-- speaks for one of its brands, Love & Kitchen. So the L&K look (logo, red,
-- cast, host poses) is the CAMPAIGN's theme (`config.theme`, merged over the
-- org's by lib/tickets/theme.ts → campaignTheme) and the name on screen is
-- `config.sponsor_name`. A future Bafar campaign for another brand brings its
-- own; nothing here would have to be undone.
--
-- Catalogue. The 25 Love & Kitchen items in the client's sales file
-- (Bafar/VENTAS 2025 - 2026 BAFAR ITEM.xlsx, sheet "Ventas netas", 2025-01 →
-- 2026-10), minus 3209977 (a pallet code for a SKU already listed). Lines are
-- modelled as `brand` so the parade, the colours and the cast can tell a BBQ
-- from a soy sauce; the product name is its presentation ("450 g", "Galón 4 kg"),
-- which productLabel() renders as "Salsa BBQ 450 g". A bare "450 g" can never
-- match a receipt line on its own (matching.ts → isDistinctiveName).
--
-- Aliases are INFERRED, not harvested: no real ticket printing "L&K" was found
-- (Bafar/FORMATO_TICKETS_MX.md). They follow the general Mexican POS pattern
-- (upper case, size glued to the unit, brand abbreviated) in a few spellings.
-- EAN-13s: four are on sams.com.mx listings (gtin13 of 3201512, 3209921,
-- 3209945, 3209969) and all four are "750200627" + the last four digits of the
-- internal code. The same rule yields a valid EAN-13 check digit for 24 of the
-- 25 codes, which is the evidence it is the house rule; 3209980 (BBQ doypack)
-- fails the check and gets no barcode. Derived, not confirmed by the client.
--
-- Mechanic: accumulation, 10 points per eligible peso, prizes by threshold in a
-- weekly Drop. No chance anywhere ("dinero y azar separados"). Demo mode: every
-- photo is read and approved with 15,000 points (0048's tickets_approve_demo).
-- All numbers are demo numbers (feedback: ROI defendible — the real ladder is
-- a client decision).

-- ===========================================================================
-- Organisation
-- ===========================================================================
insert into public.organizations (slug, name, theme)
values (
  'bafar',
  'Grupo Bafar',
  jsonb_build_object('note', 'Sin brand kit de Grupo Bafar. Cada campaña trae el tema de su marca en config.theme.')
)
on conflict (slug) do nothing;

-- ===========================================================================
-- Campaign
-- ===========================================================================
insert into public.campaigns (org_id, slug, name, module, status, locales, config)
select
  o.id,
  'love-kitchen',
  'La Carrera del Sabor',
  'tickets',
  -- Live, not draft: a draft prints a "campaña sin publicar" ribbon on every
  -- screen, wrong for a meeting where the client plays as a participant (same
  -- call as 0034). Nobody outside the meeting has the URL. After the meeting:
  --   update public.campaigns set status = 'paused' where slug = 'love-kitchen';
  'live',
  array['es'],
  jsonb_build_object(
    -- Reward layer off (the six-zero accumulation switch, see 0012/0033).
    'min_purchase_cents',    0,
    'reward_cents',          0,
    'total_reward_slots',    0,
    'weekly_quota',          0,
    'per_participant_limit', 0,
    'per_household_limit',   0,
    'fund_cents',            0,
    'points_per_dollar',     10,
    'weekly_points_cap',     0,
    'review_sla_hours',      48,
    'timezone',              'America/Mexico_City',
    'eligible_states',       jsonb_build_array(),
    'payout_provider',       'manual',
    'rules_version',         '2026-10-22-demo',
    'rules_url',             null,
    'show_grand_prize',      false,
    'prizes',                jsonb_build_array(),

    -- Email + password: zero external dependencies in the room (0033's call).
    'auth',           jsonb_build_object('channel', 'email'),
    'profile_fields', jsonb_build_object('phone', 'off', 'zip', 'off', 'state', 'off'),
    'rehearsal',      'anyone',

    -- Where L&K sells (client's sales file + retailer listings), spelled the way
    -- a receipt prints them, plus the fictional store of the printed demo props.
    'stores', jsonb_build_array(
      'Walmart', 'Bodega Aurrerá', 'Sam''s Club', 'Chedraui', 'Soriana', 'HEB',
      'La Comer', 'City Market', 'Fresko', 'Alsuper', 'Tiendas 3B', 'Carnemart',
      'Súper Supergana'
    ),

    'ocr', jsonb_build_object('enabled', true, 'autofill', true, 'auto_approve', true, 'model', 'qwen3.5-plus'),
    -- SKU mode: the line names ("Salsa BBQ") are generic words every sauce
    -- brand prints, so brand mode would pay for Heinz.
    'eligibility', 'sku',
    'demo', jsonb_build_object('fixed_points', 15000),

    'sponsor_name',   'Love & Kitchen',
    'progress_meter', 'bottle',
    'stage', jsonb_build_object(
      'prop',     '/brands/love-kitchen/props/asador.webp',
      'backdrop', 'red',
      -- The cream thermometer on the grill's lid, as fractions of the picture.
      'readout',  jsonb_build_object('x', 0.55, 'y', 0.13, 'size', 0.34)
    ),

    -- Lines in the client's sales order (the parade and the marquee follow it).
    'brands', jsonb_build_array(
      jsonb_build_object('name', 'Salsa BBQ',            'color', '#8B2E16'),
      jsonb_build_object('name', 'Salsa Habanero Mango', 'color', '#FF9F1C'),
      jsonb_build_object('name', 'Salsa de Soya',        'color', '#2B2118'),
      jsonb_build_object('name', 'Jugo Sazonador',       'color', '#2E8B57'),
      jsonb_build_object('name', 'Salsa BBQ Picante',    'color', '#E63946'),
      jsonb_build_object('name', 'Salsa Inglesa',        'color', '#6B3A1E'),
      jsonb_build_object('name', 'Salsa para Alitas',    'color', '#F25C05'),
      jsonb_build_object('name', 'Hojuelas de Papa',     'color', '#E9C46A'),
      jsonb_build_object('name', 'Mayonesa',             'color', '#F1E3C2'),
      jsonb_build_object('name', 'Catsup',               'color', '#C1121F'),
      jsonb_build_object('name', 'Mostaza',              'color', '#FFC300')
    ),

    -- Love & Kitchen's look, over Grupo Bafar's (empty) org theme.
    -- Red #FF0000 is the wordmark's own colour (loveandkitchen.com): 3.7:1 on
    -- cream, so it reads as the headline word ("dark" tone). brand_ink #C00000
    -- (6:1) is the same hue for small text.
    'theme', jsonb_build_object(
      'logo_url',   '/brands/love-kitchen/logo.png',
      'logo_alt',   'Love & Kitchen',
      'brand',      '#FF0000',
      'brand_ink',  '#C00000',
      'powered_by', true,
      'mascots', jsonb_build_object(
        'greet',     '/brands/love-kitchen/mascota-greet.webp',
        'ticket',    '/brands/love-kitchen/mascota-ticket.webp',
        'celebrate', '/brands/love-kitchen/mascota-celebrate.webp',
        'point',     '/brands/love-kitchen/mascota-point.webp'
      ),
      'cast', jsonb_build_array(
        jsonb_build_object('id','oso',     'name','Oso',     'brand',null,                   'image','/brands/love-kitchen/cast/oso.webp',     'avatar','/brands/love-kitchen/avatars/oso.webp'),
        jsonb_build_object('id','dino',    'name','Dino',    'brand','Salsa BBQ',            'image','/brands/love-kitchen/cast/dino.webp',    'avatar','/brands/love-kitchen/avatars/dino.webp'),
        jsonb_build_object('id','gato',    'name','Gato',    'brand','Salsa Habanero Mango', 'image','/brands/love-kitchen/cast/gato.webp',    'avatar','/brands/love-kitchen/avatars/gato.webp'),
        jsonb_build_object('id','diablo',  'name','Diablo',  'brand','Salsa BBQ Picante',    'image','/brands/love-kitchen/cast/diablo.webp',  'avatar','/brands/love-kitchen/avatars/diablo.webp'),
        jsonb_build_object('id','goblin',  'name','Goblin',  'brand','Salsa de Soya',        'image','/brands/love-kitchen/cast/goblin.webp',  'avatar','/brands/love-kitchen/avatars/goblin.webp'),
        jsonb_build_object('id','cebra',   'name','Cebra',   'brand','Jugo Sazonador',       'image','/brands/love-kitchen/cast/cebra.webp',   'avatar','/brands/love-kitchen/avatars/cebra.webp'),
        jsonb_build_object('id','lince',   'name','Lince',   'brand','Salsa Inglesa',        'image','/brands/love-kitchen/cast/lince.webp',   'avatar','/brands/love-kitchen/avatars/lince.webp'),
        jsonb_build_object('id','bandana', 'name','Bandana', 'brand','Salsa para Alitas',    'image','/brands/love-kitchen/cast/bandana.webp', 'avatar','/brands/love-kitchen/avatars/bandana.webp')
      )
    ),

    'copy', jsonb_build_object('es', jsonb_build_object(
      'accHeroTitle',      '¡Cada ticket le sube al sabor!',
      'accHeroMark',       'sabor',
      'accHeroSub',        'Compra Love & Kitchen, sube tu ticket y cambia tus puntos por premios para tu cocina o tu negocio.',
      'accRateNote',       'De la botella de 450 g al galón de 4 kg: cada ticket con Love & Kitchen abona puntos en cuanto lo validamos.',
      'accProductsNote',   'Cualquier presentación de Love & Kitchen cuenta para tus puntos.',
      'shRoadBuyS',        'Cualquier Love & Kitchen, en cualquier tienda: súper, club de precios o mayoreo.',
      'shParadeTitle',     'Desfile de salsas',
      'shParadeNote',      'Toca una salsa para ver sus presentaciones, de la botella de casa al galón del negocio.',
      'shParadeOne',       '1 presentación',
      'shParadeMany',      '{n} presentaciones',
      'shParadeAria',      '{brand}: ver presentaciones participantes',
      'brandsTitle',       'Salsas participantes',
      'fAliasHint',        'Así aparecerás en el ranking y en la pantalla en vivo.',
      'jrFuelEyebrow',     'Tu botella',
      'jrFuelMissingGift', 'Te faltan {points} pts para tu tarjeta de regalo de {value}',
      'jrFuelReadyGift',   '¡Botella llena! Tu tarjeta de regalo de {value} ya es tuya',
      'jrFuelReadyItem',   '¡Botella llena! Ya puedes canjear {name}',
      'jrFuelNextGift',    'Siguiente meta: tarjeta de regalo de {value} · te faltan {points} pts',
      'jrReadInReview',    'Lo está revisando una persona. Te avisamos en menos de {hours} horas; tu botella se llena en cuanto lo aprueben.'
    ))
  )
from public.organizations o
where o.slug = 'bafar'
on conflict (slug) do nothing;

-- ===========================================================================
-- Catalogue: 25 SKUs, aliases generated from a few POS spellings
-- ===========================================================================
with campaign as (
  select id from public.campaigns where slug = 'love-kitchen'
),
catalogue (code, brand, name, size, image_url, ean, line_tokens, size_tokens) as (
  values
    ('3201758', 'Salsa BBQ', '450 g',          '450 g',   '/brands/love-kitchen/productos/bbq-450g.webp',             '7502006271758', array['SALSA BBQ'],                         array['450G','450 G','450GR']),
    ('3209980', 'Salsa BBQ', 'Doypack 1 kg',   '1 kg',    null,                                                       null,            array['SALSA BBQ'],                         array['1KG','1 KG','DOYPACK']),
    ('3209754', 'Salsa BBQ', 'Galón 4 kg',     '4 kg',    null,                                                       '7502006279754', array['SALSA BBQ'],                         array['4KG','4 KG','GALON']),
    ('3201741', 'Salsa BBQ', 'Cubeta 21.8 kg', '21.8 kg', null,                                                       '7502006271741', array['SALSA BBQ'],                         array['21.8KG','21.8 KG','CUBETA']),

    ('3201772', 'Salsa Habanero Mango', '450 g',        '450 g',   '/brands/love-kitchen/productos/mango-habanero-450g.webp', '7502006271772', array['SALSA HABANERO MANGO','SALSA MANGO HABANERO'], array['450G','450 G','450GR']),
    ('3209945', 'Salsa Habanero Mango', 'Galón 4.15 kg', '4.15 kg', '/brands/love-kitchen/productos/mango-habanero-4kg.webp',  '7502006279945', array['SALSA HABANERO MANGO','SALSA MANGO HABANERO'], array['4.15KG','4.15 KG','4.15 K']),

    ('3201826', 'Salsa de Soya', '250 ml',        '250 ml', '/brands/love-kitchen/productos/soya-250ml.webp', '7502006271826', array['SALSA SOYA','SALSA DE SOYA'], array['250ML','250 ML']),
    ('3201352', 'Salsa de Soya', '1 L',           '1 L',    '/brands/love-kitchen/productos/soya-1l.webp',    '7502006271352', array['SALSA SOYA','SALSA DE SOYA'], array['1L','1 L','1LT','1 LT']),
    ('3201574', 'Salsa de Soya', 'Bidón 3.5 L',   '3.5 L',  '/brands/love-kitchen/productos/soya-3-5l.webp',  '7502006271574', array['SALSA SOYA','SALSA DE SOYA'], array['3.5L','3.5 L','3.5LT']),
    ('3201512', 'Salsa de Soya', 'Garrafa 20 L',  '20 L',   '/brands/love-kitchen/productos/soya-20l.webp',   '7502006271512', array['SALSA SOYA','SALSA DE SOYA'], array['20L','20 L','20LT','GARRAFA']),

    ('3201840', 'Jugo Sazonador', '250 ml',      '250 ml', '/brands/love-kitchen/productos/jugo-sazonador-250ml.webp', '7502006271840', array['JUGO SAZONADOR','JGO SAZONADOR'], array['250ML','250 ML']),
    ('3201369', 'Jugo Sazonador', '1 L',         '1 L',    '/brands/love-kitchen/productos/jugo-sazonador-1l.webp',    '7502006271369', array['JUGO SAZONADOR','JGO SAZONADOR'], array['1L','1 L','1LT','1 LT']),
    ('3209921', 'Jugo Sazonador', 'Bidón 3.5 L', '3.5 L',  '/brands/love-kitchen/productos/jugo-sazonador-3-5l.webp',  '7502006279921', array['JUGO SAZONADOR','JGO SAZONADOR'], array['3.5L','3.5 L','3.5LT']),

    ('3201765', 'Salsa BBQ Picante', '450 g',      '450 g', '/brands/love-kitchen/productos/bbq-picante-450g.webp', '7502006271765', array['SALSA BBQ PICANTE','SALSA BBQ PIC'], array['450G','450 G','450GR']),
    ('3209969', 'Salsa BBQ Picante', 'Galón 4 kg', '4 kg',  '/brands/love-kitchen/productos/bbq-picante-4kg.webp',  '7502006279969', array['SALSA BBQ PICANTE','SALSA BBQ PIC'], array['4KG','4 KG','GALON']),

    ('3201833', 'Salsa Inglesa', '250 ml',      '250 ml', '/brands/love-kitchen/productos/inglesa-250ml.webp', '7502006271833', array['SALSA INGLESA'], array['250ML','250 ML']),
    ('3201482', 'Salsa Inglesa', '1 L',         '1 L',    '/brands/love-kitchen/productos/inglesa-1l.webp',    '7502006271482', array['SALSA INGLESA'], array['1L','1 L','1LT','1 LT']),
    ('3209914', 'Salsa Inglesa', 'Bidón 3.5 L', '3.5 L',  '/brands/love-kitchen/productos/inglesa-3-5l.webp',  '7502006279914', array['SALSA INGLESA'], array['3.5L','3.5 L','3.5LT']),

    ('3201789', 'Salsa para Alitas', '420 g',       '420 g', '/brands/love-kitchen/productos/alitas-420g.webp', '7502006271789', array['SALSA ALITAS','SALSA P/ALITAS','SALSA PARA ALITAS'], array['420G','420 G','420GR']),
    ('3201697', 'Salsa para Alitas', 'Bidón 3.5 L', '3.5 L', null,                                              '7502006271697', array['SALSA ALITAS','SALSA P/ALITAS','SALSA PARA ALITAS'], array['3.5L','3.5 L','3.5LT']),

    ('3171666', 'Hojuelas de Papa', 'Bolsa 2.26 kg', '2.26 kg', null, '7502006271666', array['HOJUELAS PAPA','HOJUELAS DE PAPA','PAPA HOJUELAS'], array['2.26KG','2.26 KG']),

    ('3111802', 'Mayonesa', 'Light 390 g',       '390 g',  '/brands/love-kitchen/productos/mayonesa-390g.webp', '7502006271802', array['MAYONESA LIGHT','MAYONESA RED GRASA','MAYONESA'], array['390G','390 G']),
    ('3111734', 'Mayonesa', 'Light tarro 3.6 kg', '3.6 kg', null,                                               '7502006271734', array['MAYONESA LIGHT','MAYONESA RED GRASA','MAYONESA'], array['3.6KG','3.6 KG']),

    ('3131796', 'Catsup',  '440 g', '440 g', '/brands/love-kitchen/productos/catsup-440g.webp',  '7502006271796', array['CATSUP'],  array['440G','440 G']),
    ('3201819', 'Mostaza', '420 g', '420 g', '/brands/love-kitchen/productos/mostaza-420g.webp', '7502006271819', array['MOSTAZA'], array['420G','420 G'])
),
seeded as (
  insert into public.products (campaign_id, brand, name, size, image_url)
  select campaign.id, c.brand, c.name, c.size, c.image_url
  from campaign, catalogue c
  where not exists (
    select 1 from public.products p
    where p.campaign_id = campaign.id and p.brand = c.brand and p.name = c.name
  )
  returning id, brand, name
),
brand_tokens (token) as (
  values ('L&K'), ('LOVE & KITCHEN'), ('LOVE KITCHEN'), ('LOVE&KITCHEN'), ('LK')
),
aliases (product_id, alias_text) as (
  -- "SALSA BBQ L&K 450G": line, brand, size — the usual POS order.
  select s.id, lt || ' ' || bt.token || ' ' || st
  from seeded s
  join catalogue c on c.brand = s.brand and c.name = s.name
  cross join lateral unnest(c.line_tokens) as lt
  cross join lateral unnest(c.size_tokens) as st
  cross join brand_tokens bt
  union
  -- "L&K SALSA BBQ 450G": brand first, first line spelling only.
  select s.id, bt.token || ' ' || c.line_tokens[1] || ' ' || st
  from seeded s
  join catalogue c on c.brand = s.brand and c.name = s.name
  cross join lateral unnest(c.size_tokens) as st
  cross join brand_tokens bt
  union
  -- The barcode, where there is one.
  select s.id, c.ean
  from seeded s
  join catalogue c on c.brand = s.brand and c.name = s.name
  where c.ean is not null
)
insert into public.product_aliases (product_id, retailer, alias_text)
select product_id, null, alias_text from aliases;

-- Size-less spellings per line ("SALSA BBQ L&K"), hung on the line's first
-- retail SKU: a POS that drops the presentation still counts the line. Sized
-- aliases are longer and win whenever they match (longest first, matching.ts).
insert into public.product_aliases (product_id, retailer, alias_text)
select p.id, null, v.alias
from public.products p
join public.campaigns c on c.id = p.campaign_id and c.slug = 'love-kitchen'
join (values
  ('Salsa BBQ', '450 g', 'SALSA BBQ L&K'), ('Salsa BBQ', '450 g', 'L&K SALSA BBQ'), ('Salsa BBQ', '450 g', 'SALSA BBQ LOVE KITCHEN'),
  ('Salsa Habanero Mango', '450 g', 'SALSA HABANERO MANGO L&K'), ('Salsa Habanero Mango', '450 g', 'L&K SALSA HABANERO'),
  ('Salsa de Soya', '1 L', 'SALSA SOYA L&K'), ('Salsa de Soya', '1 L', 'L&K SALSA SOYA'), ('Salsa de Soya', '1 L', 'SALSA DE SOYA LOVE KITCHEN'),
  ('Jugo Sazonador', '1 L', 'JUGO SAZONADOR L&K'), ('Jugo Sazonador', '1 L', 'L&K JUGO SAZONADOR'),
  ('Salsa BBQ Picante', '450 g', 'SALSA BBQ PICANTE L&K'), ('Salsa BBQ Picante', '450 g', 'L&K SALSA BBQ PICANTE'),
  ('Salsa Inglesa', '1 L', 'SALSA INGLESA L&K'), ('Salsa Inglesa', '1 L', 'L&K SALSA INGLESA'),
  ('Salsa para Alitas', '420 g', 'SALSA ALITAS L&K'), ('Salsa para Alitas', '420 g', 'L&K SALSA ALITAS'),
  ('Hojuelas de Papa', 'Bolsa 2.26 kg', 'HOJUELAS PAPA L&K'),
  ('Mayonesa', 'Light 390 g', 'MAYONESA L&K'), ('Mayonesa', 'Light 390 g', 'L&K MAYONESA'),
  ('Catsup', '440 g', 'CATSUP L&K'), ('Catsup', '440 g', 'L&K CATSUP'),
  ('Mostaza', '420 g', 'MOSTAZA L&K'), ('Mostaza', '420 g', 'L&K MOSTAZA')
) as v(brand, name, alias) on v.brand = p.brand and v.name = p.name
where not exists (
  select 1 from public.product_aliases a where a.product_id = p.id and a.alias_text = v.alias
);

-- ===========================================================================
-- Prize store: one open Drop per week, ten weeks from the current one
-- ===========================================================================
-- The meeting has no date yet; ten weeks keep a Drop open through December.
insert into public.prize_drops (campaign_id, week_start, status)
select c.id, public.tickets_week_start('America/Mexico_City', now() + make_interval(weeks => w)), 'open'
from public.campaigns c
cross join generate_series(0, 9) as w
where c.slug = 'love-kitchen'
on conflict (campaign_id, week_start) do nothing;

-- 10 pts per peso: a $39 bottle of BBQ is 390 pts; the free bottle costs
-- 3,000 (≈ $300 of L&K), the $300 card 30,000 (10 % back). Demo stock: 200 of
-- each so nobody meets "agotado" mid-meeting.
insert into public.prize_drop_items (drop_id, name_es, name_en, kind, points_cost, inventory, detail)
select d.id, v.name_es, v.name_en, v.kind, v.points_cost, 200, v.detail
from public.prize_drops d
join public.campaigns c on c.id = d.campaign_id
cross join (
  values
    ('Salsa Love & Kitchen 450 g gratis'::text, 'Free Love & Kitchen 450 g sauce'::text, 'product'::text, 3000,
      jsonb_build_object('demo', true, 'image_url', '/brands/love-kitchen/premios/salsa-gratis.webp',
        'entrega', 'Muestra este código en la caja de una tienda participante y llévate tu salsa Love & Kitchen de 450 g favorita.')),
    ('Kit Alitero Love & Kitchen', 'Love & Kitchen wings kit', 'product', 10000,
      jsonb_build_object('demo', true, 'image_url', '/brands/love-kitchen/premios/kit-alitero.webp',
        'entrega', 'Salsa BBQ, BBQ Picante, Habanero Mango y para Alitas de 450 g. Te lo enviamos a domicilio en cuanto confirmamos tu canje.')),
    ('Galón Salsa BBQ 4 kg', '4 kg BBQ sauce gallon', 'product', 15000,
      jsonb_build_object('demo', true, 'image_url', '/brands/love-kitchen/premios/galon-bbq.webp',
        'entrega', 'El galón de los negocios. Muestra este código en una tienda participante y llévatelo.')),
    ('Tarjeta de regalo $300', '$300 gift card', 'giftcard', 30000,
      jsonb_build_object('demo', true, 'value_cents', 30000, 'image_url', '/brands/love-kitchen/premios/tarjeta-300.webp',
        'entrega', 'Te llega por correo en cuanto confirmamos tu canje.')),
    ('Kit Parrillero Love & Kitchen', 'Love & Kitchen grill kit', 'product', 60000,
      jsonb_build_object('demo', true, 'image_url', '/brands/love-kitchen/premios/kit-parrillero.webp',
        'entrega', 'Asador portátil, pinzas, espátula, mandil y dos salsas Love & Kitchen. Te lo enviamos a domicilio.'))
) as v(name_es, name_en, kind, points_cost, detail)
where c.slug = 'love-kitchen'
  and not exists (
    select 1 from public.prize_drop_items i where i.drop_id = d.id and i.name_es = v.name_es
  );

-- ===========================================================================
-- Staff: the same seats that run the Novamex demo console
-- ===========================================================================
insert into public.campaign_admins (campaign_id, auth_user_id, role)
select t.id, a.auth_user_id, a.role
from public.campaign_admins a
join public.campaigns src on src.id = a.campaign_id and src.slug = 'tanque'
cross join public.campaigns t
where t.slug = 'love-kitchen'
on conflict do nothing;

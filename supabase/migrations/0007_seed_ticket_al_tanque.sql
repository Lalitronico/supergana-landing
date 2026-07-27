-- Campaign #1 of the Carrera de Tickets module: Novamex "Ticket al Tanque".
--
-- Seeded as status='draft' on purpose. Several values below are placeholders
-- that only Novamex can settle (brief §17): eligible states, the final SKU
-- list, and whether the $30,000 is prizes-only or the whole budget. Flipping
-- the campaign to 'live' should be a deliberate act after those answers land,
-- not a side effect of running a migration.
--
-- Economics follow Escenario 1 of the brief ($10 → $20, 1,200 claims), which
-- is what the deck and both demos show. Escenario 2 ($10 → $10, 2,000 claims)
-- is a config edit, not a code change:
--   update public.campaigns
--      set config = config || '{"reward_cents":1000,"total_reward_slots":2000}'
--    where slug = 'ticket-al-tanque';

insert into public.organizations (slug, name, theme)
values (
  'novamex',
  'Novamex',
  jsonb_build_object(
    'accent', '#FFD93D',
    'note', 'Colores de marca por confirmar con Novamex; hoy usa el sistema Supergana.'
  )
)
on conflict (slug) do nothing;

insert into public.campaigns (org_id, slug, name, module, status, locales, config)
select
  o.id,
  'ticket-al-tanque',
  'Ticket al Tanque',
  'tickets',
  'draft',
  array['es', 'en'],
  jsonb_build_object(
    -- Mechanics (brief §3.1)
    'min_purchase_cents',    1000,      -- $10 elegible en una sola transacción
    'reward_cents',          2000,      -- $20 de recompensa digital
    'total_reward_slots',    1200,      -- primeros 1,200 reclamos válidos
    'weekly_quota',          150,       -- liberación escalonada, lunes
    'per_participant_limit', 1,
    'per_household_limit',   1,         -- hogar = apellido + ZIP
    'fund_cents',            3000000,   -- $30,000 (PENDIENTE: ¿solo premios?)
    'review_sla_hours',      48,
    -- El Paso es el mercado ancla del piloto; define cuándo cae el lunes.
    'timezone',              'America/Denver',
    -- PLACEHOLDER. Brief §17 pregunta 2 sigue sin respuesta.
    'eligible_states',       jsonb_build_array('TX', 'NM', 'AZ'),
    'payout_provider',       'manual',
    'rules_version',         '2026-07-24-draft',
    'rules_url',             null,
    -- La v1 no incluye puntos, misiones, leaderboard ni sorteo. El premio
    -- mayor arrastra AMOE y registro estatal (NY/FL sobre $5,000) y no puede
    -- anunciarse antes de que existan reglas oficiales: mostrarlo sin ellas
    -- es peor que no mostrarlo. Se enciende en la v1.1.
    'show_grand_prize',      false,
    -- Lista ilustrativa de marcas para el home, tal cual el demo la rotula.
    -- No es el catálogo de validación: ese vive en products/product_aliases.
    'brands', jsonb_build_array(
      jsonb_build_object('name', 'Jarritos',          'color', '#FF8A00'),
      jsonb_build_object('name', 'La Perrona',        'color', '#D62828'),
      jsonb_build_object('name', 'Camaronazo',        'color', '#E4572E'),
      jsonb_build_object('name', 'D''Gari',           'color', '#FF6B9D'),
      jsonb_build_object('name', 'Chocolate Ibarra',  'color', '#8A4B24'),
      jsonb_build_object('name', 'Mineragua',         'color', '#1E90FF'),
      jsonb_build_object('name', 'Sangría Señorial',  'color', '#8E2043')
    )
  )
from public.organizations o
where o.slug = 'novamex'
on conflict (slug) do nothing;

-- Validation catalogue. Only the five products whose retailer descriptors are
-- documented in the admin demo are seeded — a product with no alias can never
-- match a printed line, so inventing SKUs would look like coverage we do not
-- have. Mineragua and Sangría Señorial appear in the brand chips but are
-- absent here until Novamex hands over the descriptor dictionary (brief §17
-- pregunta 4: "¿Novamex conserva el diccionario de descriptores por retailer?").
with campaign as (
  select id from public.campaigns where slug = 'ticket-al-tanque'
),
seeded as (
  insert into public.products (campaign_id, brand, name, size)
  select campaign.id, v.brand, v.name, v.size
  from campaign,
    (values
      ('Jarritos',   'Tamarindo',        '1.5 L'),
      ('La Perrona', 'Salsa',            '250 g'),
      ('Camaronazo', 'Camaronazo',       '32 oz'),
      ('D''Gari',    'Gelatina fresa',   null),
      ('Ibarra',     'Chocolate',        '540 g')
    ) as v(brand, name, size)
  where not exists (
    select 1 from public.products p
    where p.campaign_id = campaign.id and p.brand = v.brand and p.name = v.name
  )
  returning id, brand
)
insert into public.product_aliases (product_id, retailer, alias_text)
select seeded.id, null, v.alias
from seeded,
  (values
    ('Jarritos',   'JARRITOS TAMAR'),
    ('Jarritos',   'JARR TAM 1.5'),
    ('Jarritos',   'JTOS TAMARINDO'),
    ('La Perrona', 'SALSA LA PERRONA'),
    ('La Perrona', 'LA PERRONA HOT'),
    ('La Perrona', 'PERRONA 250'),
    ('Camaronazo', 'CAMARONAZO 32OZ'),
    ('Camaronazo', 'CAMARONAZO TOM'),
    ('D''Gari',    'DGARI FRESA'),
    ('D''Gari',    'D GARI GEL FRSA'),
    ('Ibarra',     'IBARRA CHOCOLATE'),
    ('Ibarra',     'CHOC IBARRA 540')
  ) as v(brand, alias)
where v.brand = seeded.brand;

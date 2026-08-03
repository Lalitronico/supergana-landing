-- Campaign #2 of the Carrera de Tickets module: Agua Alaska "Carrera Alaska".
-- Second tenant of the platform, and the first one that is not a US campaign.
--
-- Seeded as status='draft' for the same reason Novamex was (0007): several
-- values below are placeholders only the client can settle — campaign dates,
-- the plaza that decides when Monday starts, the participating-store list, and
-- the contents of the first weekly Drop. Flipping to 'live' is a deliberate act
-- after those answers land, never a side effect of running a migration.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
--
-- The client's rules promise five things this module cannot do yet: a redemption
-- store with weekly drops and limited inventory, a 100-point welcome bonus, a
-- 250-point 4-week streak bonus, a ranking that survives spending points, and
-- automatic validation. None of them has a config key, so none of them appears
-- below — inventing keys nobody reads would make the campaign look configured
-- when it is not. They are itemised, with evidence, in `alaska-gaps.md`.
--
-- Every key in `config` below is read by real code:
--   min_purchase_cents .. fund_cents, timezone, payout_provider
--       → 0011_points_ledger.sql:109-171 (tickets_approve_receipt)
--   points_per_dollar, weekly_points_cap
--       → 0011_points_ledger.sql:113-114
--   review_sla_hours, eligible_states, rules_version, rules_url,
--   show_grand_prize, prizes
--       → lib/tickets/config.ts:142-160 (parseCampaignConfig)

-- `theme` is not read by anything yet — lib/tickets/campaigns.ts:29 selects
-- only organizations(name, slug). Seeded anyway so the brand answer has a home
-- the day the shell learns to read it, and so nobody invents colours meanwhile.
insert into public.organizations (slug, name, theme)
values (
  'agua-alaska',
  'Agua Alaska',
  jsonb_build_object(
    'note', 'Colores de marca por confirmar con Agua Alaska; hoy usa el sistema Supergana.'
  )
)
on conflict (slug) do nothing;

insert into public.campaigns (org_id, slug, name, module, status, locales, config)
select
  o.id,
  'carrera-alaska',
  'Carrera Alaska',
  'tickets',
  'draft',
  -- Campaña mexicana: solo español. (El selector ES/EN del shell está
  -- hardcodeado en app/c/[campana]/TicketsShell.tsx:112 y va a mostrar el botón
  -- EN de todos modos; ver alaska-gaps.md §K.)
  array['es'],
  jsonb_build_object(
    -- === Capa de recompensa: APAGADA ======================================
    -- Ticket al Tanque es "$10 en una transacción → $20 de recompensa".
    -- Alaska es acumulación pura: cada peso suma puntos y no hay pago por
    -- ticket. Poner los cinco gates en 0 es la única forma de apagar la
    -- recompensa sin tocar código: el primero que se cumple corta la creación
    -- de la fila en `rewards` (0011_points_ledger.sql:140-174) y el ticket
    -- igual se aprueba y igual gana puntos. Con per_participant_limit = 0 el
    -- primer gate se cumple siempre, así que cada aprobación va a registrar
    -- reward_skipped='participant_limit' en la bitácora — es ruido, no un
    -- error. Prender la recompensa algún día exige mover los seis juntos.
    'min_purchase_cents',    0,         -- sin umbral: 0 < 0 es falso, nunca lanza below_threshold
    'reward_cents',          0,
    'total_reward_slots',    0,
    'weekly_quota',          0,
    'per_participant_limit', 0,
    'per_household_limit',   0,
    'fund_cents',            0,

    -- === Puntos: el corazón de esta campaña ===============================
    -- $1 MXN = 10 puntos. La RPC calcula (eligible_cents * rate) / 100, así que
    -- 10 reproduce exacto el catálogo del cliente cuando el revisor captura el
    -- monto en pesos: $11.00 → 1100 * 10 / 100 = 110 pts, $51.50 → 515 pts.
    -- Cuidado: los puntos salen del monto que teclea el revisor, NO del precio
    -- del producto — `products` no tiene columna de precio (ver §J de gaps).
    'points_per_dollar',     10,
    -- 0 = sin tope semanal. Las reglas del cliente no ponen techo y el modelo
    -- es de compra frecuente. Clave leída solo por SQL (0011:114); parseCampaignConfig
    -- no la conoce, así que no aparece en la consola de operación.
    'weekly_points_cap',     0,

    -- === Operación ========================================================
    -- La regla del cliente dice "la plataforma valida y abona automáticamente".
    -- Hoy es una cola manual sin OCR (0006_tickets_module.sql:148-149). 48 h es
    -- el SLA que ya cita el correo de confirmación; el copy de la campaña no
    -- puede prometer "automático" mientras esto sea cierto (gaps §G).
    'review_sla_hours',      48,
    -- PLACEHOLDER: confirmar plaza de operación
    -- Decide cuándo cae el lunes del Drop semanal. Ciudad Juárez es el único
    -- mercado que la plataforma ya conoce; si la campaña opera en otra plaza
    -- (Chihuahua capital, por ejemplo) esto cambia el corte de la semana.
    -- Verificar que Postgres tenga la zona antes de publicar:
    --   select now() at time zone 'America/Ciudad_Juarez';
    -- (existe desde tzdata 2022g; si falla, 'America/Chihuahua' es el respaldo).
    'timezone',              'America/Ciudad_Juarez',
    -- VACÍO A PROPÓSITO, no por pendiente. `eligible_states` filtra una lista
    -- de estados de EE.UU. (lib/tickets/states.ts:9-71): meter códigos
    -- mexicanos aquí deja el selector del registro VACÍO y nadie puede
    -- registrarse. Lista vacía = sin restricción (app/api/tickets/[campana]/me/route.ts:127).
    -- El choque completo está en alaska-gaps.md §E.
    'eligible_states',       jsonb_build_array(),
    'payout_provider',       'manual',
    'rules_version',         '2026-08-03-draft',
    'rules_url',             null,      -- PENDIENTE: bases legales publicadas
    -- Las reglas hablan de "premios en efectivo en semanas de cierre" y de un
    -- ranking. Mientras no existan bases escritas esto se queda apagado, por la
    -- misma razón que en Novamex: anunciar un premio sin reglas es peor que no
    -- anunciarlo.
    'show_grand_prize',      false,
    -- Catálogo de la Tienda de Premios. Vacío porque el primer Drop todavía no
    -- existe: precios en puntos e inventario son pregunta abierta al cliente.
    -- Forma que el parser acepta (lib/tickets/config.ts:109-126) — un premio al
    -- que le falte name_es o name_en se descarta entero:
    --   {"id":"agua-1-mes","points":5000,"name_es":"...","name_en":"..."}
    -- Ojo: `prizes` NO tiene inventario ni semana de Drop. Con la lista vacía el
    -- panel simplemente no muestra la sección (app/c/[campana]/panel/page.tsx:55).
    'prizes',                jsonb_build_array()
    -- `brands` se omite: es una campaña de una sola marca y el home ya cae al
    -- catálogo real cuando la lista está vacía (app/c/[campana]/HomeScreen.tsx:51-62).
  )
from public.organizations o
where o.slug = 'agua-alaska'
on conflict (slug) do nothing;

-- Catálogo de validación. Los 7 productos con precio de lista del cliente:
--
--   Botella   600 ml    $11.00  → 110 pts
--   Botella   1 L       $16.50  → 165 pts
--   Botella   1.5 L     $19.00  → 190 pts
--   Galón     3.785 L   $30.00  → 300 pts
--   Garrafa   6 L       $45.00  → 450 pts
--   Garrafa   10 L      $61.50  → 615 pts
--   Garrafón  19 L      $51.50  → 515 pts
--
-- Los precios viven en este comentario y en ningún otro lado: `products` tiene
-- brand, name, size y active, y nada más (0006_tickets_module.sql:108-116). No
-- se inventa una columna aquí. Consecuencia operativa real: el revisor teclea
-- el monto elegible del ticket y de ahí salen los puntos, así que el precio de
-- lista es documentación, no una regla que el sistema pueda hacer cumplir.
--
-- `name` carga la presentación porque el alias se une por nombre y (brand, name)
-- tiene que ser único dentro de la campaña — las 7 filas comparten la marca.
with campaign as (
  select id from public.campaigns where slug = 'carrera-alaska'
),
seeded as (
  insert into public.products (campaign_id, brand, name, size)
  select campaign.id, v.brand, v.name, v.size
  from campaign,
    (values
      ('Alaska', 'Botella 600 ml',  '600 ml'),
      ('Alaska', 'Botella 1 L',     '1 L'),
      ('Alaska', 'Botella 1.5 L',   '1.5 L'),
      ('Alaska', 'Galón 3.785 L',   '3.785 L'),
      ('Alaska', 'Garrafa 6 L',     '6 L'),
      ('Alaska', 'Garrafa 10 L',    '10 L'),
      ('Alaska', 'Garrafón 19 L',   '19 L')
    ) as v(brand, name, size)
  where not exists (
    select 1 from public.products p
    where p.campaign_id = campaign.id and p.brand = v.brand and p.name = v.name
  )
  returning id, name
)
-- SUPOSICIÓN A VALIDAR — ninguno de estos alias viene del cliente.
--
-- El alias es lo único que hace que la validación funcione: el revisor escribe
-- la línea tal como está impresa y el match es por substring, sin acentos y en
-- minúsculas, con el alias más largo ganando (app/admin/[campana]/ReviewPanel.tsx:43-62).
-- Por eso cada producto lleva tres variantes: el nombre largo, la abreviatura
-- de punto de venta y la forma corta con volumen. Están escritos como suele
-- imprimir un ticket mexicano de abarrote/OXXO (mayúsculas, sin acentos, sin
-- espacio antes de la unidad), pero son inferencia, no dato.
--
-- Novamex enseñó que esto no se adivina bien: Mineragua y Sangría Señorial
-- llevan un año en el home sin poder validarse porque nunca llegó su
-- diccionario. La primera semana de tickets reales de Alaska es la que manda:
-- hay que leer las líneas que de verdad se imprimen y corregir esta tabla.
-- `retailer` va en null (aplica a toda tienda) hasta saber si Alaska se vende
-- en cadenas con descriptores propios.
insert into public.product_aliases (product_id, retailer, alias_text)
select seeded.id, null, v.alias
from seeded,
  (values
    ('Botella 600 ml', 'AGUA ALASKA 600ML'),
    ('Botella 600 ml', 'ALASKA 600ML'),
    ('Botella 600 ml', 'AG ALASKA 600'),

    ('Botella 1 L',    'AGUA ALASKA 1L'),
    ('Botella 1 L',    'ALASKA 1LT'),
    ('Botella 1 L',    'AG ALASKA 1 LT'),

    ('Botella 1.5 L',  'AGUA ALASKA 1.5L'),
    ('Botella 1.5 L',  'ALASKA 1.5LT'),
    ('Botella 1.5 L',  'AG ALASKA 1500ML'),

    ('Galón 3.785 L',  'AGUA ALASKA GALON'),
    ('Galón 3.785 L',  'ALASKA GALON'),
    ('Galón 3.785 L',  'ALASKA GAL 3.785'),

    ('Garrafa 6 L',    'AGUA ALASKA 6L'),
    ('Garrafa 6 L',    'ALASKA GARRAFA 6L'),
    ('Garrafa 6 L',    'ALASKA 6LT'),

    ('Garrafa 10 L',   'AGUA ALASKA 10L'),
    ('Garrafa 10 L',   'ALASKA GARRAFA 10L'),
    ('Garrafa 10 L',   'ALASKA 10LT'),

    ('Garrafón 19 L',  'GARRAFON ALASKA 19L'),
    ('Garrafón 19 L',  'ALASKA GARRAFON'),
    ('Garrafón 19 L',  'GFON ALASKA 19L')
  ) as v(name, alias)
where v.name = seeded.name;

-- Publicar, cuando las respuestas del cliente lleguen:
--   update public.campaigns set status = 'live' where slug = 'carrera-alaska';
--
-- Antes de eso, leer alaska-gaps.md: la pantalla de inicio del participante
-- todavía anuncia "Compra $0 … recibe $0" y se muestra como agotada, porque el
-- home está escrito alrededor de la mecánica umbral→recompensa y esa parte no
-- es configuración. Es el único bloqueante de código para arrancar.

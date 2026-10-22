-- Love & Kitchen demo: a dictionary a person can read.
--
-- 0050 generated every combination of line × brand spelling × size spelling,
-- ~40 aliases per product and 1,047 in all. Matching did not mind; the
-- console's "Catálogo y reglas" did — a wall of near-identical strings is not
-- something to put in front of a client, and none of them came from a real
-- ticket anyway (they are inferred, see 0050). This keeps a short, deliberate
-- set per product:
--   1. LINE L&K SIZE            SALSA BBQ L&K 450G      (the usual POS order)
--   2. LINE L&K SIZE-SPACED     SALSA BBQ L&K 450 G
--   3. L&K LINE SIZE            L&K SALSA BBQ 450G
--   4. LINE LOVE KITCHEN SIZE   SALSA BBQ LOVE KITCHEN 450G
--   5. LINE LOVE & KITCHEN SIZE SALSA BBQ LOVE & KITCHEN 450G
--   6. ALT-LINE L&K SIZE        SALSA MANGO HABANERO L&K 450G (where a line has a 2nd spelling)
--   7. the EAN-13
-- plus the size-less per-line aliases 0050 hung on each line's retail SKU.
-- The printed demo receipts (scripts/make-lk-receipt.mjs) only print forms
-- 1, 3, 4 and 5. Real tickets will grow the dictionary the way it should
-- grow: from what stores actually print.

with cat (brand, name, l1, l2, s1, s2) as (
  values
    ('Salsa BBQ', '450 g',          'SALSA BBQ', null, '450G',   '450 G'),
    ('Salsa BBQ', 'Doypack 1 kg',   'SALSA BBQ', null, '1KG',    '1 KG'),
    ('Salsa BBQ', 'Galón 4 kg',     'SALSA BBQ', null, '4KG',    '4 KG'),
    ('Salsa BBQ', 'Cubeta 21.8 kg', 'SALSA BBQ', null, '21.8KG', '21.8 KG'),
    ('Salsa Habanero Mango', '450 g',         'SALSA HABANERO MANGO', 'SALSA MANGO HABANERO', '450G',   '450 G'),
    ('Salsa Habanero Mango', 'Galón 4.15 kg', 'SALSA HABANERO MANGO', 'SALSA MANGO HABANERO', '4.15KG', '4.15 KG'),
    ('Salsa de Soya', '250 ml',       'SALSA SOYA', 'SALSA DE SOYA', '250ML', '250 ML'),
    ('Salsa de Soya', '1 L',          'SALSA SOYA', 'SALSA DE SOYA', '1L',    '1 L'),
    ('Salsa de Soya', 'Bidón 3.5 L',  'SALSA SOYA', 'SALSA DE SOYA', '3.5L',  '3.5 L'),
    ('Salsa de Soya', 'Garrafa 20 L', 'SALSA SOYA', 'SALSA DE SOYA', '20L',   '20 L'),
    ('Jugo Sazonador', '250 ml',      'JUGO SAZONADOR', 'JGO SAZONADOR', '250ML', '250 ML'),
    ('Jugo Sazonador', '1 L',         'JUGO SAZONADOR', 'JGO SAZONADOR', '1L',    '1 L'),
    ('Jugo Sazonador', 'Bidón 3.5 L', 'JUGO SAZONADOR', 'JGO SAZONADOR', '3.5L',  '3.5 L'),
    ('Salsa BBQ Picante', '450 g',      'SALSA BBQ PICANTE', 'SALSA BBQ PIC', '450G', '450 G'),
    ('Salsa BBQ Picante', 'Galón 4 kg', 'SALSA BBQ PICANTE', 'SALSA BBQ PIC', '4KG',  '4 KG'),
    ('Salsa Inglesa', '250 ml',      'SALSA INGLESA', null, '250ML', '250 ML'),
    ('Salsa Inglesa', '1 L',         'SALSA INGLESA', null, '1L',    '1 L'),
    ('Salsa Inglesa', 'Bidón 3.5 L', 'SALSA INGLESA', null, '3.5L',  '3.5 L'),
    ('Salsa para Alitas', '420 g',       'SALSA ALITAS', 'SALSA P/ALITAS', '420G', '420 G'),
    ('Salsa para Alitas', 'Bidón 3.5 L', 'SALSA ALITAS', 'SALSA P/ALITAS', '3.5L', '3.5 L'),
    ('Hojuelas de Papa', 'Bolsa 2.26 kg', 'HOJUELAS PAPA', 'HOJUELAS DE PAPA', '2.26KG', '2.26 KG'),
    ('Mayonesa', 'Light 390 g',        'MAYONESA LIGHT', 'MAYONESA RED GRASA', '390G',  '390 G'),
    ('Mayonesa', 'Light tarro 3.6 kg', 'MAYONESA LIGHT', 'MAYONESA RED GRASA', '3.6KG', '3.6 KG'),
    ('Catsup',  '440 g', 'CATSUP',  null, '440G', '440 G'),
    ('Mostaza', '420 g', 'MOSTAZA', null, '420G', '420 G')
),
generic (brand, name, alias) as (
  -- The size-less spellings from 0050, kept as they are.
  values
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
),
lk as (
  select p.id, p.brand, p.name
  from public.products p
  join public.campaigns c on c.id = p.campaign_id
  where c.slug = 'love-kitchen'
),
keep (product_id, alias) as (
  select lk.id, f.alias
  from lk
  join cat on cat.brand = lk.brand and cat.name = lk.name
  cross join lateral (values
    (cat.l1 || ' L&K ' || cat.s1),
    (cat.l1 || ' L&K ' || cat.s2),
    ('L&K ' || cat.l1 || ' ' || cat.s1),
    (cat.l1 || ' LOVE KITCHEN ' || cat.s1),
    (cat.l1 || ' LOVE & KITCHEN ' || cat.s1),
    (case when cat.l2 is not null then cat.l2 || ' L&K ' || cat.s1 end)
  ) as f(alias)
  where f.alias is not null
  union
  select lk.id, g.alias
  from lk
  join generic g on g.brand = lk.brand and g.name = lk.name
)
delete from public.product_aliases a
using lk
where a.product_id = lk.id
  -- The barcodes stay, all of them.
  and a.alias_text !~ '^[0-9]{13}$'
  and not exists (
    select 1 from keep k where k.product_id = a.product_id and k.alias = a.alias_text
  );

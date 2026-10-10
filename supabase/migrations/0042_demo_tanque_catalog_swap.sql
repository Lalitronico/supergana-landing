-- Ticket al Tanque demo: the catalogue the client actually asked for.
--
-- 0033 seeded Jarritos and Mineragua on a misread of the brief. The instruction
-- was the opposite: "de esta no pongas Jarritos o Mineragua". The demo covers
-- the REST of Novamex_USA_Catalogo_UPC.xlsx — 7 brands, 32 SKUs, every UPC/EAN
-- as the client listed it ("pendiente de validación comercial 2026": the
-- client's data, not checked against GS1).
--
-- Names carry the presentation and never the brand, so productLabel() renders
-- "Sidral Mundet Manzana vidrio 355 ml" and not "Sidral Mundet Sidral...".
-- Aliases are written the way a US POS prints: upper case, no accents, size
-- glued to the unit, plus the UPC (many POS print it on the line).

-- Out with the two brands the client excluded. Their aliases cascade; their
-- receipt_items went with the participants purged on 2026-10-10.
delete from public.products p
 using public.campaigns c
 where c.id = p.campaign_id
   and c.slug = 'tanque'
   and p.brand in ('Jarritos', 'Mineragua');

with campaign as (
  select id from public.campaigns where slug = 'tanque'
),
catalogue (brand, name, size, aliases) as (
  values
    ('Sangría Señorial', 'Vidrio 330 ml', '330 ml', array['SANGRIA SENORIAL 330ML', 'SANGRIA SENORIAL 11.2OZ', 'SANGRIA SEN 330ML', '090478321004']),
    ('Sangría Señorial', 'PET 1.5 L',     '1.5 L',  array['SANGRIA SENORIAL 1.5L', 'SANGRIA SENORIAL 50.7OZ', 'SANGRIA SEN 1.5L', '090478321103']),

    ('Sidral Mundet', 'Manzana vidrio 355 ml', '355 ml', array['SIDRAL MUNDET 355ML', 'SIDRAL MUNDET APPLE 12OZ', 'SIDRAL MUNDET MANZANA 355', '090478331003']),
    ('Sidral Mundet', 'Manzana verde 355 ml',  '355 ml', array['SIDRAL MUNDET VERDE 355ML', 'SIDRAL MUNDET GREEN APPLE 12OZ', 'SIDRAL VERDE 355', '090478331300']),
    ('Sidral Mundet', 'Manzana 1.5 L',         '1.5 L',  array['SIDRAL MUNDET 1.5L', 'SIDRAL MUNDET APPLE 1.5L', 'SIDRAL MUNDET 50.7OZ', '090478331102']),

    ('Chocolate Ibarra', 'Chocolate de mesa', null, array['CHOCOLATE IBARRA', 'IBARRA CHOCOLATE', 'IBARRA CHOC MESA', '030467000015']),

    ('Camaronazo', 'Picante 32 oz', '32 oz', array['CAMARONAZO PICANTE 32OZ', 'CAMARONAZO 32OZ', 'CAMARONAZO PICANTE', '899541001016']),

    ('D''Gari', 'Gelatina fresa (agua) 4.2 oz',  '4.2 oz', array['DGARI GEL FRESA AGUA 4.2OZ', 'D GARI GELATINA FRESA AGUA', '735257013106']),
    ('D''Gari', 'Gelatina limón 4.2 oz',         '4.2 oz', array['DGARI GEL LIMON 4.2OZ', 'D GARI GELATINA LIMON', '735257013137']),
    ('D''Gari', 'Gelatina naranja 4.2 oz',       '4.2 oz', array['DGARI GEL NARANJA 4.2OZ', 'D GARI GELATINA NARANJA', '735257013151']),
    ('D''Gari', 'Gelatina piña 4.2 oz',          '4.2 oz', array['DGARI GEL PINA 4.2OZ', 'D GARI GELATINA PINA', '735257013168']),
    ('D''Gari', 'Gelatina mango 4.2 oz',         '4.2 oz', array['DGARI GEL MANGO 4.2OZ', 'D GARI GELATINA MANGO', '735257013144']),
    ('D''Gari', 'Gelatina uva 4.2 oz',           '4.2 oz', array['DGARI GEL UVA 4.2OZ', 'D GARI GELATINA UVA', '735257013175']),
    ('D''Gari', 'Gelatina durazno 4.2 oz',       '4.2 oz', array['DGARI GEL DURAZNO 4.2OZ', 'D GARI GELATINA DURAZNO', '735257013083']),
    ('D''Gari', 'Gelatina cereza 4.2 oz',        '4.2 oz', array['DGARI GEL CEREZA 4.2OZ', 'D GARI GELATINA CEREZA', '735257013113']),
    ('D''Gari', 'Gelatina mora 4.2 oz',          '4.2 oz', array['DGARI GEL MORA 4.2OZ', 'D GARI GELATINA MORA', '735257013120']),
    ('D''Gari', 'Gelatina jerez 4.2 oz',         '4.2 oz', array['DGARI GEL JEREZ 4.2OZ', 'D GARI GELATINA JEREZ', '735257013090']),
    ('D''Gari', 'Gelatina coco 4.2 oz',          '4.2 oz', array['DGARI GEL COCO 4.2OZ', 'D GARI GELATINA COCO', '735257013199']),
    ('D''Gari', 'Gelatina cristalina 4.2 oz',    '4.2 oz', array['DGARI GEL CRISTALINA 4.2OZ', 'D GARI GELATINA CRISTALINA', '735257013267']),
    ('D''Gari', 'Gelatina fresa (leche) 4.2 oz', '4.2 oz', array['DGARI GEL FRESA LECHE 4.2OZ', 'D GARI GELATINA FRESA LECHE', '735257013205']),
    ('D''Gari', 'Gelatina nuez 4.2 oz',          '4.2 oz', array['DGARI GEL NUEZ 4.2OZ', 'D GARI GELATINA NUEZ', '735257013212']),
    ('D''Gari', 'Gelatina rompope 4.2 oz',       '4.2 oz', array['DGARI GEL ROMPOPE 4.2OZ', 'D GARI GELATINA ROMPOPE', '735257013236']),
    ('D''Gari', 'Gelatina vainilla 4.2 oz',      '4.2 oz', array['DGARI GEL VAINILLA 4.2OZ', 'D GARI GELATINA VAINILLA', '735257013243']),
    ('D''Gari', 'Flan caramelo 4.7 oz',          '4.7 oz', array['DGARI FLAN CARAMELO 4.7OZ', 'D GARI FLAN CARAMELO', '735257005057']),
    ('D''Gari', 'Grenetina sin sabor 1 oz',      '1 oz',   array['DGARI GRENETINA 1OZ', 'D GARI GRENETINA SIN SABOR', '735257013014']),

    -- EAN-13, kept whole: the client's own note says not to truncate it to UPC-A.
    ('La Perrona', 'Salsa original roja 5 fl oz', '5 fl oz', array['LA PERRONA SALSA ROJA', 'LA PERRONA ORIGINAL 5OZ', 'PERRONA ROJA 148ML', '7503016555074']),
    ('La Perrona', 'Salsa verde 5 fl oz',         '5 fl oz', array['LA PERRONA SALSA VERDE', 'LA PERRONA VERDE 5OZ', 'PERRONA VERDE 148ML', '7503016555098']),
    ('La Perrona', 'Salsa negra 5 fl oz',         '5 fl oz', array['LA PERRONA SALSA NEGRA', 'LA PERRONA NEGRA 5OZ', 'PERRONA NEGRA 148ML', '7503016555111']),

    ('Tepachito', 'Piña original 12 oz',  '12 oz', array['TEPACHITO PINA 12OZ', 'TEPACHITO ORIGINAL 355ML', 'TEPACHITO PINA ORIG', '831384002102']),
    ('Tepachito', 'Piña y mango 12 oz',   '12 oz', array['TEPACHITO PINA MANGO 12OZ', 'TEPACHITO MANGO 355ML', '831384002300']),
    ('Tepachito', 'Piña y coco 12 oz',    '12 oz', array['TEPACHITO PINA COCO 12OZ', 'TEPACHITO COCO 355ML', '831384002201']),
    ('Tepachito', 'Piña y guayaba 12 oz', '12 oz', array['TEPACHITO PINA GUAYABA 12OZ', 'TEPACHITO GUAYABA 355ML', '831384002409'])
),
seeded as (
  insert into public.products (campaign_id, brand, name, size)
  select campaign.id, cat.brand, cat.name, cat.size
  from campaign, catalogue cat
  where not exists (
    select 1 from public.products p
    where p.campaign_id = campaign.id and p.brand = cat.brand and p.name = cat.name
  )
  returning id, brand, name
)
insert into public.product_aliases (product_id, retailer, alias_text)
select seeded.id, null, alias
from seeded
join catalogue cat on cat.brand = seeded.brand and cat.name = seeded.name
cross join lateral unnest(cat.aliases) as alias;

-- The seven brands, each with its logo slot (files in public/brands/novamex/logos/).
-- Colours are first approximations until sampled from the official logos.
update public.campaigns
   set config = config || jsonb_build_object(
         'brands', jsonb_build_array(
           jsonb_build_object('name', 'Sidral Mundet',    'color', '#D7282F', 'logo_url', '/brands/novamex/logos/sidral-mundet.png'),
           jsonb_build_object('name', 'Sangría Señorial', 'color', '#7A1F3D', 'logo_url', '/brands/novamex/logos/sangria-senorial.png'),
           jsonb_build_object('name', 'Chocolate Ibarra', 'color', '#E4A700', 'logo_url', '/brands/novamex/logos/chocolate-ibarra.png'),
           jsonb_build_object('name', 'Camaronazo',       'color', '#E4572E', 'logo_url', '/brands/novamex/logos/camaronazo.png'),
           jsonb_build_object('name', 'D''Gari',          'color', '#FF6B9D', 'logo_url', '/brands/novamex/logos/dgari.png'),
           jsonb_build_object('name', 'La Perrona',       'color', '#D62828', 'logo_url', '/brands/novamex/logos/la-perrona.png'),
           jsonb_build_object('name', 'Tepachito',        'color', '#F4B400', 'logo_url', '/brands/novamex/logos/tepachito.png')
         )
       )
 where slug = 'tanque' and module = 'tickets';

update public.campaigns
   set config = jsonb_set(jsonb_set(config,
         '{copy,es,accHeroSub}', '"Compra tus marcas Novamex favoritas, sube tu ticket y cambia tus puntos por gasolina."'),
         '{copy,en,accHeroSub}', '"Buy your favourite Novamex brands, snap your receipt and trade your points for gas."')
 where slug = 'tanque' and module = 'tickets';

-- The product prize follows the catalogue: a free Sidral Mundet 1.5 L.
update public.prize_drop_items i
   set name_es = 'Sidral Mundet 1.5 L gratis',
       name_en = 'Free Sidral Mundet 1.5 L',
       detail  = i.detail || jsonb_build_object(
         'image_url',  '/brands/novamex/premios/sidral-gratis.webp',
         'entrega',    'Muestra este código en la caja de una tienda participante y llévate tu Sidral Mundet 1.5 L.',
         'entrega_en', 'Show this code at the register of a participating store and take your Sidral Mundet 1.5 L home.')
  from public.prize_drops d
  join public.campaigns c on c.id = d.campaign_id
 where d.id = i.drop_id
   and c.slug = 'tanque'
   and i.kind = 'product';

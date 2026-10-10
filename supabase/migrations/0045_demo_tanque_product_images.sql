-- Ticket al Tanque demo: pictures and real colours for the corrected catalogue.
-- Product photos from the brands' own sites and Kroger/Walmart catalogue
-- shots (placeholders until the client's brand kit), 400×800 WebP at a common
-- physical scale. Colours sampled from each official logo; Chocolate Ibarra
-- takes the gold of its box rather than the red of its logo so the parade is
-- not three red cards in a row (Sidral Mundet and La Perrona are red).
-- Gelatina fresa (leche) has no picture on purpose: the only catalogue shot
-- found was the water-based one, and a wrong flavour is worse than none.
with pics (brand, name, file) as (
  values
    ('Sidral Mundet',    'Manzana vidrio 355 ml',        'sidral-mundet-manzana-355'),
    ('Sidral Mundet',    'Manzana verde 355 ml',         'sidral-mundet-manzana-verde-355'),
    ('Sidral Mundet',    'Manzana 1.5 L',                'sidral-mundet-1-5l'),
    ('Sangría Señorial', 'Vidrio 330 ml',                'sangria-senorial-330'),
    ('Sangría Señorial', 'PET 1.5 L',                    'sangria-senorial-1-5l'),
    ('Chocolate Ibarra', 'Chocolate de mesa',            'chocolate-ibarra'),
    ('Camaronazo',       'Picante 32 oz',                'camaronazo-32oz'),
    ('La Perrona',       'Salsa original roja 5 fl oz',  'la-perrona-roja'),
    ('La Perrona',       'Salsa verde 5 fl oz',          'la-perrona-verde'),
    ('La Perrona',       'Salsa negra 5 fl oz',          'la-perrona-negra'),
    ('Tepachito',        'Piña original 12 oz',          'tepachito-original'),
    ('Tepachito',        'Piña y mango 12 oz',           'tepachito-mango'),
    ('Tepachito',        'Piña y coco 12 oz',            'tepachito-coco'),
    ('Tepachito',        'Piña y guayaba 12 oz',         'tepachito-guayaba'),
    ('D''Gari',          'Gelatina fresa (agua) 4.2 oz', 'dgari-gelatina-fresa'),
    ('D''Gari',          'Gelatina limón 4.2 oz',        'dgari-gelatina-limon'),
    ('D''Gari',          'Gelatina naranja 4.2 oz',      'dgari-gelatina-naranja'),
    ('D''Gari',          'Gelatina piña 4.2 oz',         'dgari-gelatina-pina'),
    ('D''Gari',          'Gelatina mango 4.2 oz',        'dgari-gelatina-mango'),
    ('D''Gari',          'Gelatina uva 4.2 oz',          'dgari-gelatina-uva'),
    ('D''Gari',          'Gelatina durazno 4.2 oz',      'dgari-gelatina-durazno'),
    ('D''Gari',          'Gelatina cereza 4.2 oz',       'dgari-gelatina-cereza'),
    ('D''Gari',          'Gelatina mora 4.2 oz',         'dgari-gelatina-mora'),
    ('D''Gari',          'Gelatina jerez 4.2 oz',        'dgari-gelatina-jerez'),
    ('D''Gari',          'Gelatina coco 4.2 oz',         'dgari-gelatina-coco'),
    ('D''Gari',          'Gelatina cristalina 4.2 oz',   'dgari-gelatina-cristalina'),
    ('D''Gari',          'Gelatina nuez 4.2 oz',         'dgari-gelatina-nuez'),
    ('D''Gari',          'Gelatina rompope 4.2 oz',      'dgari-gelatina-rompope'),
    ('D''Gari',          'Gelatina vainilla 4.2 oz',     'dgari-gelatina-vainilla'),
    ('D''Gari',          'Flan caramelo 4.7 oz',         'dgari-flan-caramelo'),
    ('D''Gari',          'Grenetina sin sabor 1 oz',     'dgari-grenetina')
)
update public.products p
   set image_url = '/brands/novamex/productos/' || pics.file || '.webp'
  from pics, public.campaigns c
 where c.id = p.campaign_id and c.slug = 'tanque'
   and p.brand = pics.brand and p.name = pics.name;

update public.campaigns
   set config = config || jsonb_build_object('brands', jsonb_build_array(
         jsonb_build_object('name', 'Sidral Mundet',    'color', '#DF2827', 'logo_url', '/brands/novamex/logos/sidral-mundet.png'),
         jsonb_build_object('name', 'Sangría Señorial', 'color', '#9F1B4F', 'logo_url', '/brands/novamex/logos/sangria-senorial.png'),
         jsonb_build_object('name', 'Chocolate Ibarra', 'color', '#DBA500', 'logo_url', '/brands/novamex/logos/chocolate-ibarra.png'),
         jsonb_build_object('name', 'Camaronazo',       'color', '#2B2C6C', 'logo_url', '/brands/novamex/logos/camaronazo.png'),
         jsonb_build_object('name', 'D''Gari',          'color', '#F36A23', 'logo_url', '/brands/novamex/logos/dgari.png'),
         jsonb_build_object('name', 'La Perrona',       'color', '#EC1F2B', 'logo_url', '/brands/novamex/logos/la-perrona.png'),
         jsonb_build_object('name', 'Tepachito',        'color', '#FAC119', 'logo_url', '/brands/novamex/logos/tepachito.png')))
 where slug = 'tanque' and module = 'tickets';

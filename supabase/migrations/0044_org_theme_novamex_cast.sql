-- Novamex cast: one Supergana character per Novamex brand, plus the bear as
-- the host of the gas station. Files in public/brands/novamex/cast/ (full
-- body) and avatars/ (bust). First committed as placeholders cut from
-- public/characters/v2 so the screens can be built; the final art (each
-- character holding its brand's product, no logos on the props) replaces the
-- files in place, so this row does not change.
update public.organizations
   set theme = theme || jsonb_build_object('cast', jsonb_build_array(
     jsonb_build_object('id','oso',     'name','Oso',     'brand',null,               'image','/brands/novamex/cast/oso.webp',     'avatar','/brands/novamex/avatars/oso.webp'),
     jsonb_build_object('id','dino',    'name','Dino',    'brand','Sidral Mundet',    'image','/brands/novamex/cast/dino.webp',    'avatar','/brands/novamex/avatars/dino.webp'),
     jsonb_build_object('id','lince',   'name','Lince',   'brand','Sangría Señorial', 'image','/brands/novamex/cast/lince.webp',   'avatar','/brands/novamex/avatars/lince.webp'),
     jsonb_build_object('id','cebra',   'name','Cebra',   'brand','Chocolate Ibarra', 'image','/brands/novamex/cast/cebra.webp',   'avatar','/brands/novamex/avatars/cebra.webp'),
     jsonb_build_object('id','bandana', 'name','Bandana', 'brand','Camaronazo',       'image','/brands/novamex/cast/bandana.webp', 'avatar','/brands/novamex/avatars/bandana.webp'),
     jsonb_build_object('id','goblin',  'name','Goblin',  'brand','D''Gari',          'image','/brands/novamex/cast/goblin.webp',  'avatar','/brands/novamex/avatars/goblin.webp'),
     jsonb_build_object('id','diablo',  'name','Diablo',  'brand','La Perrona',       'image','/brands/novamex/cast/diablo.webp',  'avatar','/brands/novamex/avatars/diablo.webp'),
     jsonb_build_object('id','gato',    'name','Gato',    'brand','Tepachito',        'image','/brands/novamex/cast/gato.webp',    'avatar','/brands/novamex/avatars/gato.webp')
   ))
 where slug = 'novamex';

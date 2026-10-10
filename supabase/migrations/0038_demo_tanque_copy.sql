-- Ticket al Tanque demo: the campaign says its own concept.
--
-- `config.copy` (lib/tickets/config.ts → parseCopyOverrides) overrides any key
-- of the participant dictionary for this campaign only. The generic home says
-- "¡Gana premios con {org}!"; this one says what the demo is about — every
-- receipt fills a fuel tank that pays out in gas gift cards.
update public.campaigns
   set config = config || jsonb_build_object(
         'copy', jsonb_build_object(
           'es', jsonb_build_object(
             'accHeroTitle', '¡Cada ticket llena tu tanque!',
             'accHeroMark',  'tanque',
             'accHeroSub',   'Compra Jarritos o Mineragua, sube tu ticket y cambia tus puntos por gasolina.'
           ),
           'en', jsonb_build_object(
             'accHeroTitle', 'Every receipt fills your tank!',
             'accHeroMark',  'tank',
             'accHeroSub',   'Buy Jarritos or Mineragua, snap your receipt and trade your points for gas.'
           )
         )
       )
 where slug = 'tanque'
   and module = 'tickets';

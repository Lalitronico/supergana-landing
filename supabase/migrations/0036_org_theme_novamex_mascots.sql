-- Novamex mascots: Supergana's bear in Jarritos orange and Mineragua blue,
-- the Chapa precedent (a platform character wearing the client's colours, no
-- logos on the clothes). Generated with Codex on 2026-10-10; files in
-- public/brands/novamex/. `point` exists for the screens that want it; a pose a
-- screen does not ask for costs nothing.
update public.organizations
   set theme = theme || jsonb_build_object(
         'mascots', jsonb_build_object(
           'greet',     '/brands/novamex/mascota-greet.png',
           'ticket',    '/brands/novamex/mascota-ticket.png',
           'celebrate', '/brands/novamex/mascota-celebrate.png',
           'point',     '/brands/novamex/mascota-point.png'
         )
       )
 where slug = 'novamex';

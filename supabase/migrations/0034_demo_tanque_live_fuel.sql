-- Ticket al Tanque demo: go live, draw progress as a fuel tank, give each
-- brand its logo.
--
-- `live` rather than draft + rehearsal: a draft campaign prints a "Borrador ·
-- campaña sin publicar" ribbon across every screen (TicketsShell), which is
-- right for a client preview and wrong for the meeting where the client plays
-- it as a participant. Live changes nothing else for an accumulation campaign
-- — there is no fund to reserve and no reward to pay — and nobody outside the
-- meeting has the URL. Pause it after the meeting:
--   update public.campaigns set status = 'paused' where slug = 'tanque';
--
-- `progress_meter` and `brands[].logo_url` are read by lib/tickets/config.ts
-- (ProgressMeter, Brand.logoUrl). The logo files live in
-- public/brands/novamex/logos/ and ship with the same deploy.
update public.campaigns
   set status = 'live',
       config = config || jsonb_build_object(
         'progress_meter', 'fuel',
         'brands', jsonb_build_array(
           jsonb_build_object('name', 'Jarritos',  'color', '#FF8A00',
                              'logo_url', '/brands/novamex/logos/jarritos.png'),
           jsonb_build_object('name', 'Mineragua', 'color', '#1E90FF',
                              'logo_url', '/brands/novamex/logos/mineragua.png')
         )
       )
 where slug = 'tanque'
   and module = 'tickets';

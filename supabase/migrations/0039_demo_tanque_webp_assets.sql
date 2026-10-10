-- Ticket al Tanque demo: serve the artwork as WebP at display size.
--
-- The PNGs straight out of Codex and the retailer photos weighed 5.2 MB for one
-- home + store visit; the same pictures as WebP (q86, mascots ≤720 px tall,
-- prize cards ≤660 px wide, bottles 400×800) weigh 554 KB. The meeting runs on
-- phones over whatever network the room has, so this is the difference between
-- the bear appearing with the page and appearing three seconds after it.
-- Logos stay PNG: they are already 9–27 KB.

update public.organizations
   set theme = theme || jsonb_build_object(
         'mascots', jsonb_build_object(
           'greet',     '/brands/novamex/mascota-greet.webp',
           'ticket',    '/brands/novamex/mascota-ticket.webp',
           'celebrate', '/brands/novamex/mascota-celebrate.webp',
           'point',     '/brands/novamex/mascota-point.webp'
         )
       )
 where slug = 'novamex';

update public.products p
   set image_url = regexp_replace(p.image_url, '\.png$', '.webp')
  from public.campaigns c
 where c.id = p.campaign_id
   and c.slug = 'tanque'
   and p.image_url like '/brands/novamex/productos/%.png';

update public.prize_drop_items i
   set detail = jsonb_set(i.detail, '{image_url}',
                          to_jsonb(regexp_replace(i.detail->>'image_url', '\.png$', '.webp')))
  from public.prize_drops d
  join public.campaigns c on c.id = d.campaign_id
 where d.id = i.drop_id
   and c.slug = 'tanque'
   and i.detail->>'image_url' like '/brands/novamex/premios/%.png';

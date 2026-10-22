-- Love & Kitchen demo: copy polish from the first visual pass.
-- The parade calls each card's SKUs "presentaciones" (0050); its button still
-- said "Ver productos".
update public.campaigns
   set config = jsonb_set(config, '{copy,es,shParadeSee}', '"Ver presentaciones"')
 where slug = 'love-kitchen'
   and module = 'tickets';

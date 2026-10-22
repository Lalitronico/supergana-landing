-- Love & Kitchen demo: "Ver presentaciones" (0052) does not fit beside
-- "4 presentaciones" in the parade card's foot and wraps both to two lines on
-- a 390 px phone. The count already says "presentaciones"; the button only has
-- to say what it does.
update public.campaigns
   set config = jsonb_set(config, '{copy,es,shParadeSee}', '"Ver todas"')
 where slug = 'love-kitchen'
   and module = 'tickets';

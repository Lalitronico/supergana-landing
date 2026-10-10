-- Ticket al Tanque demo: copy polish from the visual QA round.
-- US English for a US pilot ("favorite"), and the gas prizes named in Spanish
-- on the Spanish screens ("Tarjeta de gasolina $5" rather than half-English
-- "Gift card de gasolina $5"); the English names stay "$N gas gift card".
update public.campaigns
   set config = jsonb_set(config, '{copy,en,accHeroSub}',
         '"Buy your favorite Novamex brands, snap your receipt and trade your points for gas."')
 where slug = 'tanque' and module = 'tickets';

update public.prize_drop_items i
   set name_es = regexp_replace(i.name_es, '^Gift card de gasolina ', 'Tarjeta de gasolina ')
  from public.prize_drops d
  join public.campaigns c on c.id = d.campaign_id
 where d.id = i.drop_id and c.slug = 'tanque'
   and i.name_es like 'Gift card de gasolina %';

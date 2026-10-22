-- Love & Kitchen demo: the grill stands alone.
--
-- 0050 laid the pump's "+10" dial (points per peso) over the thermometer on
-- the grill's lid. On a phone it read as a stray number floating over the
-- picture, and Eduardo asked for it to go (2026-10-22). Without `readout` the
-- code draws the picture alone; the rate is still said in words on the ticket
-- card right below ("$1 = 10 puntos").
--
-- Apply AFTER the deploy that ships the matching HeroStage: the previous build
-- turned a missing `readout` into a corner sticker.
update public.campaigns
   set config = config #- '{stage,readout}'
 where slug = 'love-kitchen'
   and module = 'tickets';

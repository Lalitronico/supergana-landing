-- Agua Alaska's mascots land, now that the artwork exists.
--
-- Kept apart from 0016 because a theme must never point at a file that is not
-- deployed: 0016 shipped the logo and the colours, this ships the three poses,
-- and each migration is true the moment it runs.
--
-- POSES ARE NAMED BY ROLE, NOT BY DRAWING
--
--   greet     → the home hero. Both characters running, which is the campaign's
--               promise in one image: buy, and something happens.
--   celebrate → the approval modal. The drop alone, arms up. The one moment the
--               module exists for.
--   ticket    → the store. The jug holding a blank ticket.
--
-- `point` (the fourth pose the plan sketched) is deliberately absent: no screen
-- in this pass has a place for a character pointing at something, and an asset
-- nothing renders is an asset nobody maintains. `lib/tickets/theme.ts` treats
-- every pose as optional, so adding it later is a row edit, not a deploy.
--
-- PRODUCTION NOTES, so the next tenant's art costs less to make
--
-- Generated with GPT Image 2 through the local Codex CLI, 1024×1024, then
-- post-processed locally because gpt-image-2 has no native transparency: it
-- chroma-keys and removes the background, which left a green fringe of ~5k
-- pixels on one of the three. The fix is a despill pass — no legitimate pixel in
-- this palette (cobalt, cyan, white, black, red) has green dominating both red
-- and blue, so every pixel that does is bleed. Then autocropped to the alpha
-- bounding box so CSS controls the size instead of the file's padding.
--
-- BRAND CAVEAT, still open
--
-- A water jug with a face becomes a character of Agua Alaska's brand, not of
-- Supergana's. Eduardo approved generating them; the client has not seen them.
-- If Alaska says no, the mascots come out of this row and the screens keep
-- working — that is why `hasArt` gates the layout instead of assuming it.

UPDATE organizations
SET theme = theme || jsonb_build_object('mascots', jsonb_build_object(
  'greet',     '/brands/agua-alaska/mascota-greet.png',
  'celebrate', '/brands/agua-alaska/mascota-celebrate.png',
  'ticket',    '/brands/agua-alaska/mascota-ticket.png'
))
WHERE slug = 'agua-alaska';

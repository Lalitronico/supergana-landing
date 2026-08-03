-- Carrera Alaska opens rehearsal to any signed-in participant while it is built.
--
-- WHY THIS IS A KEY AND NOT A DELETED LINE
--
-- The upload screen refused every test account with "esta campaña no está
-- recibiendo tickets", because a draft campaign only ever accepted receipts from
-- its own staff. That is the correct rule for a client preview and the wrong one
-- for a campaign under construction: every throwaway account needed a row in
-- `campaign_admins` before it could upload anything, which is friction with no
-- safety value while nobody has the QR.
--
-- The guard itself is worth keeping, so it was not removed. `config.rehearsal`
-- decides who counts, and `mayRehearse` (lib/tickets/campaigns.ts) is the single
-- predicate both `/me/` and `/receipts/` now ask — they used to carry two copies
-- of the rule, which is one edit away from the screen offering an upload the
-- write would refuse.
--
-- WHAT DID NOT CHANGE, AND MUST NOT
--
--   · Only `draft` consults this key. A `live` campaign answers on
--     `acceptsReceipts` before it is ever read.
--   · `paused` and `closed` stay shut for everyone, staff included: pausing is
--     an operational brake, not a permission question.
--   · The caller still has to be signed in and have a profile. This says who may
--     rehearse, not who may skip registering.
--   · Novamex keeps the default (`staff`) — nothing in this migration touches it.
--     Ticket al Tanque carries a fund, and a receipt there reserves real money.
--
-- WHAT TO DO WHEN ALASKA LAUNCHES
--
-- Nothing, strictly: flipping `status` to 'live' makes this value dead. But it
-- reads as a promise once published, so removing the key at launch keeps the row
-- honest about what it does. The five answers that gate 'live' are still open in
-- Alaska/PREGUNTAS_ABIERTAS.md — dates, plaza, participating stores, published
-- rules, minimum age — and this migration does not touch any of them.

UPDATE campaigns
SET config = config || jsonb_build_object('rehearsal', 'anyone')
WHERE slug = 'carrera-alaska'
  AND module = 'tickets'
  -- Belt and braces: this key is meaningless outside draft, and writing it to a
  -- published campaign would only ever mislead whoever reads the row next.
  AND status = 'draft';

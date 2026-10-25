-- Love & Kitchen demo: sign in with WhatsApp
-- ===========================================================================
--
-- Asked for by Eduardo's boss (2026-10-25): the Carrera del Sabor should open
-- with a phone number and a WhatsApp code, not an email and a password. The
-- mechanism exists since 0030 and the platform's WhatsApp sender has been live
-- since 2026-08-19 (template `codigo_supergana`), so this is the same two steps
-- 0031 took for Carrera Alaska, in the same order and for the same reasons.
--
-- 0050 chose email + password for "zero external dependencies in the room".
-- That trade is now reversed on purpose: a demo opened by WhatsApp depends on
-- Meta delivering, so test one real code before every meeting.
--
-- The campaign pays nothing to an email address (reward layer off, prizes by
-- threshold collected in person), so nothing downstream needs the address.

-- ---------------------------------------------------------------------------
-- 1. The test accounts
-- ---------------------------------------------------------------------------
--
-- Two participants, both from the 2026-10-22/23 demo, one receipt each. Their
-- identity is an email address and after step 2 there is no door they can come
-- back through. Receipts, consents and points fall by `on delete cascade`
-- (0006, 0011); receipt images become Storage orphans for the sweep cron.
-- `auth.users` is untouched, exactly as in 0031.
delete from public.participants p
 using public.campaigns c
 where c.id = p.campaign_id
   and c.slug = 'love-kitchen';

-- ---------------------------------------------------------------------------
-- 2. The channel
-- ---------------------------------------------------------------------------
--
-- AFTER the delete: `identity_channel` is recomputed by the trigger on every
-- write, and an email row left behind would raise "participant identified by
-- phone requires phone" the next time anything touched it.
-- `max_sends_per_hour` stays absent so the parser default (200/hour) applies.
update public.campaigns
   set config = jsonb_set(config, '{auth}', '{"channel":"phone"}'::jsonb, true)
 where slug = 'love-kitchen'
   and module = 'tickets';

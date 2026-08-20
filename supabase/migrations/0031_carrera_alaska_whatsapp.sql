-- Carrera Alaska signs in with WhatsApp
-- ===========================================================================
--
-- 0030 built the mechanism; this points one campaign at it. Two statements, and
-- the order between them is the whole migration.
--
-- WHY ALASKA AND NOT NOVAMEX. Alaska's prizes are collected over a counter
-- against a redemption code — it has never written a row to `rewards` and never
-- will — so the email address it demanded was pure friction. Worse than
-- friction: this project has no SMTP of its own and Supabase Free caps the
-- built-in sender at two messages an hour, so the password nobody could reset
-- and the code nobody received were the entire front door. Ticket al Tanque
-- pays its rewards TO an email address, so it keeps one, and its row is not
-- touched here.

-- ---------------------------------------------------------------------------
-- 1. The test accounts
-- ---------------------------------------------------------------------------
--
-- All six participants of this campaign are ours: correo@correo.com,
-- nueva@nueva.com, correo@email.com, correito@correito.com, a gmail used for an
-- OCR run, and the account the client's boss opened during a rehearsal. Between
-- them: 7 receipts, 2 redemptions, 0 rewards. Two of them share the number
-- +526567767074, which is what a login credential may not be.
--
-- They go, and not only to clear the index. Their identity IS an email address;
-- after step 2 there is no door those accounts can come back through, so
-- keeping them would keep six rows that nobody can ever sign into, in the table
-- the review console counts.
--
-- Everything hanging off them falls by `on delete cascade`, declared in 0006
-- (receipts, consents), 0010 (email_verifications), 0011 (points_entries) and
-- 0013 (prize_redemptions). The receipt IMAGES in Storage are not reachable
-- from SQL and become orphans; the existing sweep-orphans cron collects them.
--
-- `auth.users` is deliberately untouched. At least one of these addresses also
-- holds a seat in `campaign_admins`, and deleting the account would take the
-- console seat with it — a different decision, and not this migration's.
delete from public.participants p
 using public.campaigns c
 where c.id = p.campaign_id
   and c.slug = 'carrera-alaska';

-- ---------------------------------------------------------------------------
-- 2. The channel
-- ---------------------------------------------------------------------------
--
-- AFTER the delete, and that is not a style preference. `identity_channel` is
-- recomputed by the trigger on every write, and the partial unique index on
-- (campaign_id, phone) applies to the rows where it says 'phone'. Flip the
-- channel while the two rows sharing +526567767074 are still there and the next
-- write to either of them raises 23505 — from a constraint whose name says
-- nothing about a migration somebody ran days earlier.
--
-- Changing the channel of a campaign that has live participants is NOT
-- supported by this migration, and the delete above is why it does not have to
-- be. A campaign with real people in it needs an account-migration path, which
-- is a different piece of work and one nobody needs yet.
--
-- `jsonb_set(..., true)` creates the key rather than requiring it to exist.
-- Only the channel is written: `max_sends_per_hour` stays absent so the parser
-- default (200/hour) applies, and the day it needs raising, raising it is an
-- update rather than a deploy.
update public.campaigns
   set config = jsonb_set(config, '{auth}', '{"channel":"phone"}'::jsonb, true)
 where slug = 'carrera-alaska';

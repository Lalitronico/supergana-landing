-- Profile fields become campaign configuration. Written 2026-08-03.
--
-- Until now every campaign asked the same three things because the first one
-- needed them: in Ticket al Tanque the ZIP and the state are what US
-- promotional eligibility is decided on, and the ZIP is half of the household
-- key. Carrera Alaska is Mexican and its prizes are phone top-ups the operator
-- delivers "al número registrado" (0014_seed_drop_ensayo_alaska.sql) — a ZIP it
-- will never read, and a phone number it cannot deliver a prize without.
--
-- The answer is not a branch on the slug. Which fields a campaign asks for now
-- lives in `campaigns.config -> 'profile_fields'`, read by parseCampaignConfig
-- (lib/tickets/config.ts) as {phone|zip|state: required|optional|off}. This
-- migration only widens what the table will accept; the defaults in the parser
-- reproduce today's behaviour exactly (phone off, zip required, state
-- required), so every campaign whose config nobody edits keeps asking for
-- precisely what it asks for today.
--
-- Both changes are additive on purpose. Rows already exist in both campaigns
-- and none of them may be invalidated by a migration: adding a nullable column
-- and dropping a NOT NULL cannot fail an existing row, whereas a new NOT NULL
-- column or a stricter CHECK would.

-- ---------------------------------------------------------------------------
-- Phone
-- ---------------------------------------------------------------------------

alter table public.participants
  add column if not exists phone text;

-- E.164 or nothing. The browser collapses the five ways a Mexican number gets
-- typed (10 digits, +52…, 52…, 521…, 044/045…) before it is ever sent, so this
-- constraint is the proof that normalisation ran rather than a formatting
-- preference: "6561112233" and "+52 656 111 2233" stored as two rows are one
-- person the operator tops up twice. Range 10-15 because E.164 caps the whole
-- number at 15 digits and no country code plus subscriber number is shorter
-- than 10; NULL passes, which is what makes the column optional per campaign.
alter table public.participants
  drop constraint if exists participants_phone_e164;

alter table public.participants
  add constraint participants_phone_e164
  check (phone is null or phone ~ '^\+[0-9]{10,15}$');

comment on column public.participants.phone is
  'E.164, normalizado en el cliente. Solo lo piden las campañas cuyo config trae profile_fields.phone <> off; hoy es el canal de entrega de las recargas de Carrera Alaska.';

-- ---------------------------------------------------------------------------
-- ZIP
-- ---------------------------------------------------------------------------

-- The format CHECK from 0006 stays exactly as it is: in Postgres a CHECK that
-- evaluates to NULL passes, so `zip ~ '^[0-9]{5}(-[0-9]{4})?$'` keeps rejecting
-- a malformed ZIP and starts accepting no ZIP at all. Dropping NOT NULL is the
-- whole change.
alter table public.participants
  alter column zip drop not null;

-- WHAT A NULL ZIP DOES TO THE HOUSEHOLD KEY — read before configuring a
-- campaign with zip 'off'.
--
-- `household_key` is a stored generated column over last_name and zip
-- (0006_tickets_module.sql:78). With a NULL zip the concatenation yields NULL,
-- so the participant has no household. That propagates:
--
--   · tickets_approve_receipt (0011_points_ledger.sql:150) gates the welcome
--     reward with `household_key = v_participant.household_key`. NULL = NULL is
--     NULL, never true, so the subquery counts 0 rows. With per_household_limit
--     >= 1 the gate therefore always passes — the household limit is silently
--     not enforced, not enforced-and-failing.
--   · the insert right after it writes v_participant.household_key into
--     rewards.household_key, which is NOT NULL (0006:228). The reward creation
--     would fail outright.
--   · the console's household flags (app/api/tickets/[campana]/admin/route.ts)
--     group by the same key, so those participants stop being groupable.
--
-- The conclusion is a configuration rule, not a code fix: a campaign that
-- rations anything per household MUST keep zip 'required'. Turning the ZIP off
-- is only correct where the household is not a unit of anything — Carrera
-- Alaska, whose five reward gates are all 0 (0012_seed_carrera_alaska.sql), so
-- none of the code above ever runs: the participant_limit gate trips first and
-- no rewards row is ever created. Making the household key survive a missing
-- ZIP would mean picking a different key, and picking it before a campaign
-- needs one would be inventing a rule nobody asked for.

comment on column public.participants.zip is
  'Opcional desde 0015: lo exige el config de la campaña (profile_fields.zip), no la tabla. Sin ZIP no hay household_key — ver el comentario de esta migración antes de apagarlo en una campaña con límites por hogar.';

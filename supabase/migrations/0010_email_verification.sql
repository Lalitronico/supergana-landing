-- Email verification, tied to the payout and not to the sign-up.
--
-- Accounts are created with a password and no email is sent (the decision of
-- 2026-07-28: no wall at the door). Which means nothing has proven the address
-- is real — and the email IS the delivery channel for the reward. The wall
-- moves to the one place the participant has something to gain: a reward
-- cannot be marked sent until its owner has typed a code we mailed them.
--
-- The code's hash lives in its own table with RLS enabled and NO policies —
-- service_role only. It cannot go on `participants`: participants read their
-- own row, and a sha256 of a 6-digit code is a 1e6-guess offline crack for
-- whoever can see it.

alter table public.participants
  add column if not exists email_verified_at timestamptz;

-- Everyone who exists today signed in through an email OTP: typing that code
-- already proved they own the inbox. Backfilling now records that fact; new
-- password-era accounts start unverified.
update public.participants set email_verified_at = created_at
  where email_verified_at is null;

create table if not exists public.email_verifications (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  code_hash text not null,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attempts int not null default 0
);

alter table public.email_verifications enable row level security;
-- No policies on purpose: only service_role touches this table.

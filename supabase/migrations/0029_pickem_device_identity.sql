-- Who a device is, decided in one place and written in one transaction.
--
-- 0021 drew the identity correctly and said so out loud:
--
--     "`participants.auth_user_id` stays as the device that CREATED the row
--      (it is NOT NULL and other modules read it); every device that has proven
--      the number, including that first one, gets a row here [participant_devices]."
--
-- Every reader honours that. `resolvePlayer` (lib/pickem/access.ts) reads
-- `participant_devices`; so does `pickem_participant` (0023), and through it
-- `pickem_save_picks`, `pickem_checkin` and `pickem_my_week`. Exactly one writer
-- did not: the verification route moved `participants.auth_user_id` onto the
-- device that had just typed the code. Two things broke because of it.
--
--   1. IT COULD NOT SUCCEED. `participants` carries
--      `unique (campaign_id, auth_user_id)` from 0006 — a plain constraint, not
--      a partial index, verified present on this project as
--      participants_campaign_id_auth_user_id_key. So the moment the device had
--      already created a participant of its own in that campaign, moving the
--      column onto a SECOND participant raised 23505. The route saw a db_error,
--      returned 500, and never reached the line that re-points the device. The
--      `participant_devices` row stayed on the PREVIOUS player — so the person
--      who had just proved a different number went on being somebody else, with
--      somebody else's picks on the board. That is the identity bug this
--      migration exists to close.
--
--   2. WHEN IT DID SUCCEED IT DISARMED A GUARD. The route decided "this device
--      already belongs to somebody" by reading `participants.auth_user_id`. A
--      second device verifying the same number moved that column off the first
--      device, so the first device stopped looking claimed to the only check
--      that asked — while `participant_devices` still said it was. One question,
--      two answers, which is the shape of every identity bug.
--
-- The column is left alone from here on. It means what 0021 says it means, and
-- the device link is the only answer to "who is asking".

-- ---------------------------------------------------------------------------
-- Claiming a device
-- ---------------------------------------------------------------------------
--
-- Stamping the number verified and pointing the device at the player are one
-- fact, so they are one transaction. The route used to do them as two writes in
-- a deliberate order, with a comment explaining which half-state it preferred to
-- fail into; a function needs no such preference.
--
-- WHY THE CALLER PASSES THE AUTH USER instead of this reading auth.uid(). The
-- OTP is checked in the route, against a hash the browser never sees, using the
-- service role — there is no player session in play at the moment of the claim
-- and `auth.uid()` would be null. So this is service_role only: it is granted to
-- nobody, and PUBLIC is revoked because `security definer` grants to PUBLIC by
-- default. Whoever calls it has already proved the number.
--
-- THE UPSERT ALWAYS RE-POINTS, and that is the behaviour being fixed: a device
-- that proves a new number ends up on the player of THAT number. It never
-- touches any other device row, so the phone keeps its link when the tablet
-- claims one — the invariant 0021 wrote this table for.
create or replace function public.pickem_link_device(
  p_campaign uuid,
  p_auth_user uuid,
  p_participant uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_participant public.participants;
begin
  -- Locked, so two tabs finishing the same verification cannot interleave the
  -- stamp and the link.
  select * into v_participant
  from public.participants
  where id = p_participant and campaign_id = p_campaign
  for update;

  if not found then
    raise exception 'not_a_participant';
  end if;

  -- Idempotent. A second confirm of the same code keeps the first stamp: the
  -- verification date is when the number answered, and re-writing it would
  -- quietly restate that.
  update public.participants
     set phone_verified_at = coalesce(phone_verified_at, now())
   where id = p_participant;

  insert into public.participant_devices
    (campaign_id, auth_user_id, participant_id, last_seen_at)
  values
    (p_campaign, p_auth_user, p_participant, now())
  on conflict (campaign_id, auth_user_id) do update
    set participant_id = excluded.participant_id,
        last_seen_at = now();

  return jsonb_build_object(
    'participantId', p_participant,
    'alias', v_participant.alias,
    'phoneVerifiedAt', coalesce(v_participant.phone_verified_at, now())
  );
end;
$$;

revoke all on function public.pickem_link_device(uuid, uuid, uuid) from public;

comment on function public.pickem_link_device(uuid, uuid, uuid) is
  'Sella el numero como verificado y apunta ESTE dispositivo al jugador de ese numero, en una sola transaccion. Nunca toca participants.auth_user_id (0021: nombra al dispositivo que creo la fila) ni las filas de otros dispositivos: verificar en la tablet no desconecta el telefono. Solo service_role — el OTP ya se comprobo en la ruta.';

comment on column public.participants.auth_user_id is
  'El dispositivo que CREO la fila. En pickem NO es "quien esta usando la cuenta": eso vive en participant_devices, porque un jugador tiene varios dispositivos. Moverlo choca con unique (campaign_id, auth_user_id) en cuanto el dispositivo ya habia creado otro participante — fue el bug de identidad que cerro 0029.';

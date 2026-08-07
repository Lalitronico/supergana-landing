/**
 * Whose picks are these? The probe that pins one device to one player.
 *
 *     node scripts/probes/pickem-identity.mjs
 *
 * THE BUG IT EXISTS FOR. A browser that had already played as one participant
 * registered a brand new person — new alias, new number, code confirmed — and
 * arrived at the jornada with picks already made. The person was new; the device
 * was not, and the device was still pointing at the previous player.
 *
 * The mechanism was two answers to one question. Every reader asks
 * `participant_devices` who a device is — `resolvePlayer` in lib/pickem/access.ts,
 * `pickem_participant` in 0023, and through it every RPC a player can call. The
 * verification route asked `participants.auth_user_id` instead, and then WROTE
 * to it: `update participants set auth_user_id = <this device>`. That column
 * carries `unique (campaign_id, auth_user_id)` from 0006, so the moment the
 * device had already created a participant of its own the update raised 23505,
 * the route answered 500, and the line that re-points the device never ran. The
 * device kept the old player. 0029 removes the write and makes the stamp and the
 * link one transaction — `pickem_link_device`.
 *
 * FOUR CHECKS, and the fourth is the control:
 *   1. a device that proves a NEW number ends up on that number's player
 *   2. …and that player starts with no picks, which is what the report was about
 *   3. the tablet claiming an identity does not unlink the phone (0021)
 *   4. control · the collision that broke the old route is real — proving the
 *      first three are not passing against a constraint that quietly went away
 *
 * WHAT IT DOES NOT TOUCH. Its own organisation, campaign, season and players —
 * `probe-pickem-identity-*`, `league = 'probe'`, `@probe.invalid` — deleted at
 * the end. It never writes to Chapa's programme or to the shared NFL calendar.
 * Aim it at a Supabase branch by exporting NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY.
 *
 * RED UNTIL 0029 IS APPLIED, deliberately. Until then `pickem_link_device` does
 * not exist and every check below fails with "no existe la funcion", which is
 * the correct thing for a probe to say about a fix that has not been deployed.
 */

import {
  admin,
  dropTenant,
  makeReport,
  mkUser,
  probeEmail,
  seedEntry,
  seedTenant,
} from "./pickem-_shared.mjs";

const SUFFIX = "identity";
const YEAR = 2903;
const db = admin();
const report = makeReport("sonda de identidad del pick'em");

/** The device link, read the way every reader in the module reads it. */
const deviceOwner = async (campaignId, authUserId) => {
  const { data } = await db
    .from("participant_devices")
    .select("participant_id")
    .eq("campaign_id", campaignId)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data?.participant_id ?? null;
};

/** What the picks board would hydrate from: this player's picks for a week. */
const picksOf = async (campaignId, participantId, week) => {
  const { data } = await db
    .from("pickem_entries")
    .select("id, pickem_picks(game_id, choice)")
    .eq("campaign_id", campaignId)
    .eq("participant_id", participantId)
    .eq("week", week)
    .maybeSingle();
  return data?.pickem_picks ?? [];
};

/**
 * A participant created by a device, exactly as `start` inserts one: the row is
 * unverified and `auth_user_id` names the device that made it, nothing more.
 */
const createPlayer = async ({ campaignId, authUserId, alias, phone }) => {
  const { data, error } = await db
    .from("participants")
    .insert({ campaign_id: campaignId, auth_user_id: authUserId, alias, phone, locale: "es" })
    .select("id")
    .single();
  if (error) throw new Error(`participant ${alias}: ${error.message}`);
  return data.id;
};

/** What `confirm` does once the code matched. The whole fix, in one call. */
const linkDevice = async (campaignId, authUserId, participantId) =>
  db.rpc("pickem_link_device", {
    p_campaign: campaignId,
    p_auth_user: authUserId,
    p_participant: participantId,
  });

// ---------------------------------------------------------------------------

let failed = 1;
try {
  const t = await seedTenant({ suffix: SUFFIX, year: YEAR, weeks: 2 });

  // One browser, one anonymous session. Everything below happens on it.
  const device = await mkUser(probeEmail(SUFFIX, 1));
  // A second browser, for the multi-device check.
  const tablet = await mkUser(probeEmail(SUFFIX, 2));
  // The device that will end up creating the second player, so that the second
  // player exists without this device having inserted it — the shape of the
  // real case, where the new number was registered from somewhere else or is
  // being recovered here.
  const otherDevice = await mkUser(probeEmail(SUFFIX, 3));

  // ------------------------------------------------- the first player -------
  const veteran = await createPlayer({
    campaignId: t.campaignId,
    authUserId: device,
    alias: "Veterano",
    phone: "+529990070001",
  });
  const linkedVeteran = await linkDevice(t.campaignId, device, veteran);
  report.check(
    "el dispositivo se liga al primer jugador",
    !linkedVeteran.error && (await deviceOwner(t.campaignId, device)) === veteran,
    linkedVeteran.error?.message ?? "participant_devices apunta al Veterano",
  );

  // A season's worth of history on that player. This is the thing that must not
  // follow the device to somebody else.
  await seedEntry({
    campaignId: t.campaignId,
    participantId: veteran,
    week: 1,
    gameId: t.gameOf.get(1),
    choice: "home",
  });

  // ------------------------------------------- the new person, same browser --
  //
  // A number nobody on this device holds, registered from another session. The
  // person then proves it HERE — the exact repro.
  const rookie = await createPlayer({
    campaignId: t.campaignId,
    authUserId: otherDevice,
    alias: "Novata",
    phone: "+529990070002",
  });

  const claim = await linkDevice(t.campaignId, device, rookie);
  const ownerAfter = await deviceOwner(t.campaignId, device);

  report.check(
    "verificar un numero nuevo re-apunta el dispositivo a ESE jugador",
    !claim.error && ownerAfter === rookie,
    claim.error
      ? `${claim.error.message} — con el codigo movido a mano (0006 unique) la ruta devolvia 500 y el dispositivo se quedaba en el jugador anterior`
      : "participant_devices apunta a la Novata",
  );

  const inherited = await picksOf(t.campaignId, ownerAfter, 1);
  report.check(
    "la persona nueva empieza SIN picks",
    inherited.length === 0,
    inherited.length
      ? `HEREDO ${inherited.length} picks del jugador anterior — es el bug reportado`
      : "jornada 1 en blanco, la historia se quedo con el Veterano",
  );

  const { data: rookieRow } = await db
    .from("participants")
    .select("auth_user_id, phone_verified_at")
    .eq("id", rookie)
    .maybeSingle();
  report.check(
    "participants.auth_user_id NO se mueve al verificar",
    rookieRow?.auth_user_id === otherDevice && rookieRow?.phone_verified_at !== null,
    rookieRow?.auth_user_id === otherDevice
      ? "sigue nombrando al dispositivo que creo la fila, y el numero quedo sellado (0021)"
      : `apunta a ${rookieRow?.auth_user_id} — 0021 dice que nombra al creador`,
  );

  // ------------------------------------------------------- multi-dispositivo -
  //
  // 0021: "verificar en la tablet no debe cerrar la sesion del telefono". The
  // rookie now proves her number on a second browser; the first must keep its
  // link.
  const second = await linkDevice(t.campaignId, tablet, rookie);
  report.check(
    "verificar en la tablet NO desconecta el telefono",
    !second.error &&
      (await deviceOwner(t.campaignId, tablet)) === rookie &&
      (await deviceOwner(t.campaignId, device)) === rookie,
    second.error?.message ?? "los dos dispositivos apuntan a la Novata",
  );

  // El Veterano perdio ESTE dispositivo, no su cuenta: sus puntos viven en su
  // numero y los recupera verificandolo de nuevo.
  const veteranPicks = await picksOf(t.campaignId, veteran, 1);
  report.check(
    "el jugador anterior conserva su historia",
    veteranPicks.length === 1,
    `${veteranPicks.length} pick(s) siguen siendo del Veterano`,
  );

  // ------------------------------------------------------------- control ----
  //
  // Without this every check above would also pass against a database where
  // `unique (campaign_id, auth_user_id)` had quietly gone away — and that
  // constraint is the entire reason the old route could not succeed. A green
  // that survives the thing it guards being removed is worse than no green.
  const { error: collision } = await db
    .from("participants")
    .update({ auth_user_id: device })
    .eq("id", rookie);
  report.check(
    "control · mover auth_user_id a un dispositivo ocupado SIGUE chocando",
    Boolean(collision),
    collision
      ? `${collision.code} — es el 23505 que la ruta vieja se comia como 500`
      : "NO CHOCO: participants_campaign_id_auth_user_id_key no esta puesta, los checks de arriba no prueban nada",
  );

  failed = report.finish().failed;
} finally {
  await dropTenant({ suffix: SUFFIX, year: YEAR });
  console.log("\nprograma de prueba eliminado");
}

process.exit(failed ? 1 : 0);

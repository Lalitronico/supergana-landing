/**
 * The probe that separates a contest from a private lottery.
 *
 *     node scripts/probes/pickem-legal.mjs
 *
 * SUPERGANA_PLATAFORMA_FUNDAMENTOS.md states the platform's one legal rule:
 * no point that decides a prize may be earned by consuming. Tickets carries the
 * rule one way round — points are the accumulation regime and must never feed a
 * draw. Pick'em carries it the other way and the stakes are higher: its prize is
 * decided by a leaderboard, so if spending could move a leaderboard position,
 * spending would improve the odds of winning, and the programme would be a
 * private lottery rather than a game of skill.
 *
 * 0022 encoded that as a column: `points_entries.currency`, 'points' or
 * 'fichas'. The leaderboard sums 'points'. A loyalty entry earned by consuming
 * is written 'fichas' and cannot enter the ranking by accident — only by
 * somebody typing the other word.
 *
 * Doc 10 asks for exactly this test, in one line: "El leaderboard NO se mueve al
 * registrar consumo. Es el test que protege el marco legal." access.ts:141 says
 * a probe proves it. Until this file existed, that sentence was false.
 *
 * WHAT IT DOES NOT TOUCH. It builds its own organisation, campaign, season and
 * players — `probe-pickem-legal-*`, `league = 'probe'`, `@probe.invalid` — and
 * deletes all of it at the end. It never writes to Chapa's programme and never
 * writes a score onto the shared NFL calendar. Aim it at a Supabase branch by
 * exporting NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
 * SUPABASE_SERVICE_ROLE_KEY before running; those win over .env.local.
 */

import {
  ACCESS_TS,
  admin,
  anonClient,
  dropTenant,
  makeReport,
  mirrorCheck,
  seedEntry,
  seedPlayer,
  seedTenant,
} from "./pickem-_shared.mjs";

const SUFFIX = "legal";
const YEAR = 2901;
const db = admin();
const report = makeReport("sonda legal del pick'em");

// ---------------------------------------------------------------------------
// The mirror of getSeasonPoints
// ---------------------------------------------------------------------------
//
// lib/pickem/access.ts:143. Ported rather than imported — see pickem-_shared.mjs
// for why that is unavoidable and how the fingerprint above keeps it honest.
const MIRROR = { file: ACCESS_TS, fn: "getSeasonPoints", expected: "34ce4a56cb6f7504" };

const seasonPointsMirror = async (campaignId, participantId) => {
  const { data, error } = await db
    .from("points_entries")
    .select("points")
    .eq("campaign_id", campaignId)
    .eq("participant_id", participantId)
    .eq("currency", "points");
  if (error || !data) return 0;
  return data.reduce((sum, r) => sum + Number(r.points ?? 0), 0);
};

// The leaderboard is read the way a visitor reads it: signed out, through the
// RPC. Reading it as the service role would prove the SQL works and nothing
// about what reaches a phone.
const anon = anonClient();
const leaderboard = async (slug, scope, week = null) => {
  const { data, error } = await anon.rpc("pickem_leaderboard", {
    p_campaign_slug: slug,
    p_week: week,
    p_scope: scope,
    p_limit: 50,
  });
  if (error) throw new Error(`pickem_leaderboard ${scope}: ${error.message}`);
  return data ?? [];
};

const ledger = async (participantId, campaignId, kind, currency, points, note) => {
  const { error } = await db.from("points_entries").insert({
    campaign_id: campaignId,
    participant_id: participantId,
    kind,
    currency,
    points,
    note,
  });
  return error;
};

// ---------------------------------------------------------------------------

let failed = 1;
try {
  const t = await seedTenant({ suffix: SUFFIX, year: YEAR, weeks: 2 });

  const champ = await seedPlayer({ campaignId: t.campaignId, suffix: SUFFIX, n: 1, alias: "Campeon" });
  const rival = await seedPlayer({ campaignId: t.campaignId, suffix: SUFFIX, n: 2, alias: "Rival" });
  const unver = await seedPlayer({
    campaignId: t.campaignId, suffix: SUFFIX, n: 3, alias: "SinVerificar", verified: false,
  });

  // Two settled weeks' worth of pick'em points, the only currency the ranking
  // is allowed to see.
  await ledger(champ.participantId, t.campaignId, "pickem_week", "points", 120, "Jornada 1");
  await ledger(rival.participantId, t.campaignId, "pickem_week", "points", 100, "Jornada 1");

  mirrorCheck(report, MIRROR);

  // ---------------------------------------------------------- baseline ----
  const base = await leaderboard(t.campaignSlug, "season");
  const baseChamp = base.find((r) => r.participant_id === champ.participantId);
  const baseRival = base.find((r) => r.participant_id === rival.participantId);

  report.check(
    "el acumulado arranca donde debe",
    Number(baseChamp?.points) === 120 && Number(baseRival?.points) === 100 &&
      Number(baseChamp?.rank) === 1 && Number(baseRival?.rank) === 2,
    `Campeon ${baseChamp?.points} (lugar ${baseChamp?.rank}) · Rival ${baseRival?.points} (lugar ${baseRival?.rank})`,
  );

  report.check(
    "getSeasonPoints y el leaderboard dan el MISMO número",
    (await seasonPointsMirror(t.campaignId, champ.participantId)) === Number(baseChamp?.points),
    "un solo total de temporada, dos lectores",
  );

  // ------------------------------------------------- consumption enters ----
  //
  // 5,000 fichas is an absurd amount on purpose: if the currency filter is
  // missing anywhere, the Rival does not merely creep past the Campeón, it
  // laps the entire table, and no rounding or ordering accident can explain it.
  const fichasError = await ledger(
    rival.participantId, t.campaignId, "purchase", "fichas", 5000,
    "consumo de $500,000 en la barra",
  );
  report.check("se puede registrar consumo como fichas", !fichasError,
    fichasError?.message ?? "asiento de 5,000 fichas escrito");

  const after = await leaderboard(t.campaignSlug, "season");
  const afterChamp = after.find((r) => r.participant_id === champ.participantId);
  const afterRival = after.find((r) => r.participant_id === rival.participantId);

  report.check(
    "5,000 fichas de consumo NO mueven el leaderboard",
    Number(afterRival?.points) === 100 && Number(afterRival?.rank) === 2 &&
      Number(afterChamp?.points) === 120 && Number(afterChamp?.rank) === 1,
    `Rival ${afterRival?.points} (lugar ${afterRival?.rank}) · Campeon ${afterChamp?.points} (lugar ${afterChamp?.rank})`,
  );

  report.check(
    "5,000 fichas de consumo NO mueven getSeasonPoints",
    (await seasonPointsMirror(t.campaignId, rival.participantId)) === 100,
    `${await seasonPointsMirror(t.campaignId, rival.participantId)} pts`,
  );

  // ------------------------------------------------------------ control ----
  //
  // Without this, every check above would also pass against a leaderboard that
  // returns a frozen table, an empty result or the wrong campaign. A green that
  // survives the thing it guards being broken is worse than no green.
  await ledger(rival.participantId, t.campaignId, "adjustment", "points", 50, "control de la sonda");
  const moved = await leaderboard(t.campaignSlug, "season");
  const movedRival = moved.find((r) => r.participant_id === rival.participantId);
  report.check(
    "control · 50 puntos SÍ mueven el leaderboard",
    Number(movedRival?.points) === 150 && Number(movedRival?.rank) === 1,
    `Rival ${movedRival?.points} (lugar ${movedRival?.rank}) — si esto falla, los checks de arriba no valen`,
  );
  await db.from("points_entries").delete()
    .eq("participant_id", rival.participantId).eq("note", "control de la sonda");

  // -------------------------------------------------- the column itself ----
  const bogus = await ledger(
    champ.participantId, t.campaignId, "purchase", "fichas_oro", 999, "moneda inventada",
  );
  report.check(
    "una moneda inventada es rechazada por la restricción",
    Boolean(bogus),
    bogus?.message ?? "SE ESCRIBIÓ — points_entries_currency_check no está puesta",
  );

  // -------------------------------------------------- who is in the table --
  //
  // The other half of "the ranking is worth reading": only numbers that
  // answered a code. 0023 filtered that on the season scope and forgot it on
  // the week scope (0023:624 against 637-641). 0028 closes it. This check is
  // RED until 0028 is applied, and that is the point of writing it here.
  await seedEntry({
    campaignId: t.campaignId, participantId: champ.participantId,
    week: 1, gameId: t.gameOf.get(1), choice: "home",
  });
  const ghost = await seedEntry({
    campaignId: t.campaignId, participantId: unver.participantId,
    week: 1, gameId: t.gameOf.get(1), choice: "home",
  });
  await db.from("pickem_entries")
    .update({ points: 999, hits: 1, settled_at: new Date().toISOString() })
    .eq("id", ghost);

  const seasonScope = await leaderboard(t.campaignSlug, "season");
  report.check(
    "acumulado: un número sin verificar no aparece",
    !seasonScope.some((r) => r.participant_id === unver.participantId),
    `${seasonScope.length} filas`,
  );

  const weekScope = await leaderboard(t.campaignSlug, "week", 1);
  report.check(
    "jornada: un número sin verificar no aparece  [requiere 0028]",
    !weekScope.some((r) => r.participant_id === unver.participantId),
    weekScope.some((r) => r.participant_id === unver.participantId)
      ? "APARECE en primer lugar con 999 pts — asimetría de 0023, la cierra 0028_pickem_audit.sql"
      : `${weekScope.length} filas, todas de números verificados`,
  );

  failed = report.finish().failed;
} finally {
  await dropTenant({ suffix: SUFFIX, year: YEAR });
  console.log("\nprograma de prueba eliminado");
}

process.exit(failed ? 1 : 0);

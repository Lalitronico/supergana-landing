/**
 * The probe that pins the two streak implementations together.
 *
 *     node scripts/probes/pickem-streak.mjs
 *
 * There are two, and there have to be. `pickem_score_entry` (0023:177-188)
 * counts the streak in SQL because the week's points are born inside the
 * transaction that settles it, and `getStreak` (lib/pickem/access.ts:303)
 * counts it again in TypeScript because the mechanics panel has to show the
 * streak BEFORE the week settles — and the scorer refuses to score a week whose
 * scores are not in.
 *
 * Two implementations of one rule drift. When they drift here the failure is
 * specific and expensive: the panel promises a bonus the ledger will not pay,
 * to a player who then reads a smaller number on Tuesday than the one the app
 * showed them on Sunday. Both comments in the code — 0023 and access.ts:300 —
 * already claim "the settle probe pins them". This file is that claim becoming
 * true.
 *
 * The patterns are chosen for the bug doc 10 names outright: "la primera
 * versión contaba hacia atrás desde la jornada actual y daba 0 a alguien con
 * diez jornadas seguidas, solo porque aún no había tocado la de esa semana."
 * `Corto` and `Nunca` below exist to keep that fix nailed down.
 *
 * WHAT IT DOES NOT TOUCH. Its own season under `league = 'probe'`, its own
 * organisation, campaign and players, all deleted at the end. Scoring a week
 * means writing final scores onto `sport_games`, and the real rows there are
 * the shared NFL calendar — a fact about the world, not about a tenant. Aim it
 * at a Supabase branch with NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY.
 */

import {
  ACCESS_TS,
  admin,
  dropTenant,
  makeReport,
  mirrorCheck,
  scoreWeek,
  seedEntry,
  seedPlayer,
  seedTenant,
} from "./pickem-_shared.mjs";

const SUFFIX = "streak";
const YEAR = 2902;
const WEEKS = 8;
const db = admin();
const report = makeReport("sonda de racha del pick'em");

// ---------------------------------------------------------------------------
// The mirror of getStreak
// ---------------------------------------------------------------------------
//
// lib/pickem/access.ts:303. Ported rather than imported — see pickem-_shared.mjs
// for why, and for what the fingerprint below is protecting.
const MIRROR = { file: ACCESS_TS, fn: "getStreak", expected: "8facf3a3bc909485" };

const streakMirror = async (campaignId, participantId, week) => {
  const { data, error } = await db
    .from("pickem_entries")
    .select("week, pickem_picks(game_id)")
    .eq("campaign_id", campaignId)
    .eq("participant_id", participantId)
    .lte("week", week);
  if (error || !data) return 0;

  const played = new Set(
    data.filter((e) => (e.pickem_picks?.length ?? 0) > 0).map((e) => e.week),
  );

  let probe = played.has(week) ? week : week - 1;
  let streak = 0;
  while (probe >= 1 && played.has(probe)) {
    streak += 1;
    probe -= 1;
  }
  return streak;
};

/** The SQL side, read through the one function that computes a score. */
const streakSql = async (entryId) => {
  const { data, error } = await db.rpc("pickem_score_entry", { p_entry: entryId });
  if (error) {
    throw new Error(
      `pickem_score_entry: ${error.message} — 0023 la revoca de PUBLIC y no la ` +
      `concede a nadie explícitamente; corre esta sonda con SUPABASE_SERVICE_ROLE_KEY.`,
    );
  }
  return data;
};

// The patterns. `weeks` is which jornadas the player entered.
const PATTERNS = [
  { n: 1, alias: "Constante", weeks: [1, 2, 3, 4, 5, 6, 7, 8] },
  { n: 2, alias: "Interrumpido", weeks: [1, 2, 3, 5, 6, 7, 8] },
  { n: 3, alias: "Tardio", weeks: [8] },
  { n: 4, alias: "Corto", weeks: [2, 3] },
  { n: 5, alias: "Nunca", weeks: [] },
];

// ---------------------------------------------------------------------------

let failed = 1;
try {
  const t = await seedTenant({ suffix: SUFFIX, year: YEAR, weeks: WEEKS });

  // Home wins every week, and every pick below is 'home'. One hit per week,
  // so the score of a week is `10 + streakBonus` and nothing else — which is
  // what makes the bonus check further down readable instead of arithmetic.
  for (let w = 1; w <= WEEKS; w += 1) {
    await scoreWeek({ seasonId: t.seasonId, week: w, away: 17, home: 20 });
  }

  const players = [];
  for (const p of PATTERNS) {
    const player = await seedPlayer({
      campaignId: t.campaignId, suffix: SUFFIX, n: p.n, alias: p.alias,
    });
    const entries = new Map();
    for (const w of p.weeks) {
      entries.set(
        w,
        await seedEntry({
          campaignId: t.campaignId,
          participantId: player.participantId,
          week: w,
          gameId: t.gameOf.get(w),
          choice: "home",
        }),
      );
    }
    players.push({ ...p, ...player, entries });
  }

  if (!mirrorCheck(report, MIRROR)) {
    console.log("       │   (se sigue corriendo, pero el resultado no es una prueba)");
  }

  // ------------------------------------------------- SQL against TypeScript --
  //
  // For every week a player actually entered, both sides can answer, and they
  // have to answer the same thing. This is the whole probe.
  for (const p of players) {
    if (p.weeks.length === 0) continue; // no entry, nothing for SQL to answer
    const pairs = [];
    let agree = true;
    for (const w of p.weeks) {
      const sql = await streakSql(p.entries.get(w));
      const ts = await streakMirror(t.campaignId, p.participantId, w);
      const sqlStreak = sql === null ? null : Number(sql.streak);
      if (sqlStreak !== ts) agree = false;
      pairs.push(`J${w}:${sqlStreak}/${ts}`);
    }
    report.check(
      `${p.alias} — SQL y TypeScript cuentan igual`,
      agree,
      `sql/ts por jornada · ${pairs.join(" ")}`,
    );
  }

  // The numbers themselves, spelled out. An agreement check alone would pass
  // if both sides broke the same way — which is exactly what happens when
  // somebody "fixes" one and copies the fix into the other.
  const expected = [
    ["Constante", 8, 8],
    ["Interrumpido", 8, 4],
    ["Interrumpido", 7, 3],
    ["Interrumpido", 5, 1],
    ["Interrumpido", 3, 3],
    ["Tardio", 8, 1],
    ["Corto", 3, 2],
  ];
  for (const [alias, week, want] of expected) {
    const p = players.find((x) => x.alias === alias);
    const sql = await streakSql(p.entries.get(week));
    const ts = await streakMirror(t.campaignId, p.participantId, week);
    report.check(
      `${alias} en la jornada ${week} lleva racha de ${want}`,
      Number(sql?.streak) === want && ts === want,
      `sql ${sql?.streak} · ts ${ts}`,
    );
  }

  // ------------------------------------------------ the TypeScript-only case --
  //
  // The reason the second implementation exists, and the bug doc 10 warns
  // about. SQL cannot be asked about a week with no entry — it takes an entry
  // id — so nothing here has an SQL counterpart, and nothing here is a
  // disagreement. It is the branch that has to keep working alone.
  const corto = players.find((p) => p.alias === "Corto");
  report.check(
    "una jornada aún no jugada NO borra la racha viva",
    (await streakMirror(t.campaignId, corto.participantId, 4)) === 2,
    `racha de ${await streakMirror(t.campaignId, corto.participantId, 4)} en la J4 sin haberla tocado ` +
      `(jugó J2 y J3) — contar hacia adelante daría 0, que es el bug de la primera versión`,
  );
  report.check(
    "dos jornadas sin jugar sí la cortan",
    (await streakMirror(t.campaignId, corto.participantId, 5)) === 0,
    `racha de ${await streakMirror(t.campaignId, corto.participantId, 5)} en la J5`,
  );
  const nunca = players.find((p) => p.alias === "Nunca");
  report.check(
    "quien no ha jugado nada lleva racha 0",
    (await streakMirror(t.campaignId, nunca.participantId, 1)) === 0,
    "sin entradas, sin racha, sin división entre cero",
  );

  // --------------------------------------------------- the bonus it pays -----
  //
  // The streak is only worth pinning because it turns into points. Defaults
  // from 0022: 20 desde 3 jornadas, 50 desde 6. One hit a week at 10 puntos,
  // sin desempate, sin madrugador, sin check-in y sin jornada doble.
  const bonusCases = [
    ["Constante", 8, 8, 50],
    ["Interrumpido", 7, 3, 20],
    ["Interrumpido", 5, 1, 0],
    ["Tardio", 8, 1, 0],
  ];
  for (const [alias, week, streak, bonus] of bonusCases) {
    const p = players.find((x) => x.alias === alias);
    const s = await streakSql(p.entries.get(week));
    const ok =
      Number(s?.streak) === streak &&
      Number(s?.streakBonus) === bonus &&
      Number(s?.mult) === 1 &&
      Number(s?.points) === 10 + bonus;
    report.check(
      `${alias} J${week}: racha ${streak} paga ${bonus} y la jornada vale ${10 + bonus}`,
      ok,
      `racha ${s?.streak} · bono ${s?.streakBonus} · ×${s?.mult} · total ${s?.points}`,
    );
  }

  failed = report.finish().failed;
} finally {
  await dropTenant({ suffix: SUFFIX, year: YEAR });
  console.log("\nprograma de prueba eliminado");
}

process.exit(failed ? 1 : 0);

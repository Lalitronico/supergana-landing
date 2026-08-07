/**
 * Pulls a season from ESPN into `sport_seasons` and `sport_games`.
 *
 *   node scripts/pickem-ingest-season.mjs 2026                 # whole season
 *   node scripts/pickem-ingest-season.mjs 2026 --weeks 9,10,11
 *   node scripts/pickem-ingest-season.mjs 2026 --scores-only
 *
 * A THIN WRAPPER, AND THAT IS THE POINT. All of the logic lives in
 * lib/pickem/ingest.ts, which is also what the Tuesday cron routes call
 * (app/api/pickem/cron/). Two implementations of "never blank a stored score"
 * would diverge, and the divergence would surface as a week that had already
 * paid out coming back un-settled — from the one path nobody was watching.
 *
 * What is left here is what only a laptop needs: reading .env.local, parsing
 * argv, and printing.
 *
 * Requires Node ≥ 22.18, which strips TypeScript types without a flag. On an
 * older 22.x run it as `node --experimental-strip-types scripts/...`, the same
 * flag package.json already uses for the tests.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  REGULAR_SEASON_WEEKS,
  countSeasonGames,
  ingestWeeks,
  resolveSeason,
} from "../lib/pickem/ingest.ts";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const args = process.argv.slice(2);
const YEAR = Number(args[0]);
if (!Number.isInteger(YEAR) || YEAR < 2000) {
  console.error("Uso: node scripts/pickem-ingest-season.mjs <año> [--weeks 1,2,3] [--scores-only]");
  process.exit(1);
}
const weekArg = args.includes("--weeks") ? args[args.indexOf("--weeks") + 1] : null;
const WEEKS = weekArg
  ? weekArg.split(",").map(Number).filter(Number.isInteger)
  : Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => i + 1);
const SCORES_ONLY = args.includes("--scores-only");

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

console.log(`Leyendo la temporada ${YEAR} de ESPN (${WEEKS.length} jornadas)…`);

const seasonId = await resolveSeason(db, YEAR, REGULAR_SEASON_WEEKS);

const report = await ingestWeeks(db, {
  seasonId,
  year: YEAR,
  weeks: WEEKS,
  scoresOnly: SCORES_ONLY,
  // 272 = 32 × 17 ÷ 2. Only meaningful on a whole-season pull; a three-week
  // re-ingest obviously will not total 272.
  verifyFullSeason: WEEKS.length === REGULAR_SEASON_WEEKS,
  onProgress: (week, count) => process.stdout.write(`  jornada ${week}: ${count} partidos\n`),
});

for (const error of report.errors) console.error(`  ${error}`);

if (report.placeholderWeeks.length) {
  console.warn(
    `\nSin horarios definidos todavía: jornada(s) ${report.placeholderWeeks.join(", ")}.` +
    `\nLa NFL no los fija hasta terminar la 17 — hay que re-ingestar antes de que abran.`,
  );
}

const total = await countSeasonGames(db, seasonId);

console.log(`
Temporada ${YEAR}  season_id ${seasonId}
  nuevos        ${report.inserted}
  actualizados  ${report.updated}
  con marcador  ${report.scored}
  sin tocar     ${report.skipped}
  total en base ${total}
`);

if (report.errors.length) process.exit(1);

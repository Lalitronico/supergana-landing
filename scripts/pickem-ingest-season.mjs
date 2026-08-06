/**
 * Pulls a season from ESPN into `sport_seasons` and `sport_games`.
 *
 *   node scripts/pickem-ingest-season.mjs 2025          # whole season
 *   node scripts/pickem-ingest-season.mjs 2026 --weeks 9,10,11
 *   node scripts/pickem-ingest-season.mjs 2026 --scores-only
 *
 * This is the ingestion the Tuesday cron will call, not a one-off importer.
 * Re-running is the normal case and it is what makes two of the season's real
 * problems solvable:
 *
 *   · Weeks 16-18 arrive with no broadcast assigned, and week 18 with all
 *     sixteen games on one placeholder kickoff — the league does not set those
 *     times until week 17 has been played. Without a re-ingest, week 18 locks
 *     at a time that was never real.
 *   · Scores only exist after the games are played.
 *
 * So it is written to be safe to run at any moment: it never nulls a value it
 * cannot see, and it never moves a game that already has a score.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
  : Array.from({ length: 18 }, (_, i) => i + 1);
const SCORES_ONLY = args.includes("--scores-only");

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------
//
// Derived from the kickoff slot, never asserted. Read in EASTERN time, because
// "Thursday Night" and "Sunday Night" are the names of US broadcast windows and
// that is the clock those windows are defined in — and because `sport_games` is
// shared by every tenant, so a label derived in one tenant's zone would be a
// label the next tenant inherits wrongly.
//
// The hour gates matter as much as the weekday. A rule that only looked at the
// day once labelled a week 12 Wednesday game "kickoff de temporada", and would
// call the Thanksgiving lunch games "Thursday Night".

const ET = "America/New_York";

const parts = (iso) => {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    weekday: "short",
    hour: "numeric",
    hour12: false,
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const get = (t) => f.find((p) => p.type === t)?.value ?? "";
  return { weekday: get("weekday"), hour: Number(get("hour")), month: Number(get("month")), day: Number(get("day")) };
};

const venueNote = (iso, week, venue) => {
  // An international game names its city. It outranks the broadcast slot: a
  // Sunday morning in London is not "Sunday Night", and the city is the more
  // interesting fact anyway — five of them are breakfast in Ciudad Juárez.
  const country = venue?.country;
  if (country && country !== "USA") {
    return [venue.city, country].filter(Boolean).join(", ");
  }

  const { weekday, hour } = parts(iso);
  if (weekday === "Wed") return week === 1 ? "Kickoff de temporada" : "Partido de miércoles";
  if (weekday === "Mon" && hour >= 17) return "Monday Night";
  if (weekday === "Thu") return hour >= 17 ? "Thursday Night" : "Thanksgiving";
  if (weekday === "Fri") return "Partido de viernes";
  if (weekday === "Sat") return "Sábado";
  if (weekday === "Sun" && hour >= 17) return "Sunday Night";
  return null;
};

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

const fetchWeek = async (week) => {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${YEAR}&seasontype=2&week=${week}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN devolvió ${res.status} para la jornada ${week}`);
  const json = await res.json();

  return (json.events ?? []).map((event) => {
    const c = event.competitions?.[0] ?? {};
    const home = (c.competitors ?? []).find((x) => x.homeAway === "home");
    const away = (c.competitors ?? []).find((x) => x.homeAway === "away");
    const done = c.status?.type?.completed === true;
    const network = c.broadcasts?.[0]?.names?.[0] ?? null;

    return {
      week,
      away: away?.team?.abbreviation,
      home: home?.team?.abbreviation,
      kickoff_at: new Date(event.date).toISOString(),
      network,
      venue_note: venueNote(event.date, week, c.venue?.address),
      // Only when the game is over. A score read mid-game and written as final
      // would settle a week on a result that had not happened yet.
      away_score: done && away?.score != null ? Number(away.score) : null,
      home_score: done && home?.score != null ? Number(home.score) : null,
    };
  });
};

console.log(`Leyendo la temporada ${YEAR} de ESPN (${WEEKS.length} jornadas)…`);
const games = [];
for (const w of WEEKS) {
  const batch = await fetchWeek(w);
  games.push(...batch);
  process.stdout.write(`  jornada ${w}: ${batch.length} partidos\n`);
}

const bad = games.filter((g) => !g.away || !g.home);
if (bad.length) {
  console.error(`${bad.length} partidos sin equipos. No se escribe nada.`);
  process.exit(1);
}

// The arithmetic that catches a missing week. Only meaningful for a full
// season — a partial re-ingest of three weeks obviously will not total 272.
if (WEEKS.length === 18) {
  const teams = new Set(games.flatMap((g) => [g.away, g.home]));
  if (teams.size !== 32 || games.length !== 272) {
    console.error(
      `Esperaba 272 partidos y 32 equipos (32 × 17 ÷ 2); llegaron ${games.length} y ${teams.size}. No se escribe nada.`,
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

const { data: season, error: seasonError } = await db
  .from("sport_seasons")
  .upsert({ league: "nfl", year: YEAR, weeks: 18 }, { onConflict: "league,year" })
  .select("id")
  .single();

if (seasonError) {
  console.error("no se pudo escribir la temporada:", seasonError.message);
  process.exit(1);
}

const { data: existing } = await db
  .from("sport_games")
  .select("id, week, away, home, away_score")
  .eq("season_id", season.id)
  .returns([]);

const key = (g) => `${g.week}|${g.away}|${g.home}`;
const known = new Map((existing ?? []).map((g) => [key(g), g]));

let inserted = 0;
let updated = 0;
let scored = 0;
let skipped = 0;

for (const g of games) {
  const prev = known.get(key(g));

  const row = {
    season_id: season.id,
    week: g.week,
    away: g.away,
    home: g.home,
    kickoff_at: g.kickoff_at,
    // Never null out what we cannot see. ESPN reports "?" as no broadcast for
    // weeks the league has not assigned yet, and overwriting a known network
    // with nothing would lose information on every re-run.
    network: g.network,
    venue_note: g.venue_note,
    away_score: g.away_score,
    home_score: g.home_score,
  };

  if (prev && prev.away_score !== null && g.away_score === null) {
    // Already scored here, not scored at the source. Trust what we have: this
    // is the shape of a transient API hiccup, and blanking a score would
    // un-settle a week that has already paid out.
    skipped += 1;
    continue;
  }
  if (SCORES_ONLY && !prev) {
    skipped += 1;
    continue;
  }
  if (SCORES_ONLY) {
    if (g.away_score === null) {
      skipped += 1;
      continue;
    }
    const { error } = await db
      .from("sport_games")
      .update({ away_score: g.away_score, home_score: g.home_score })
      .eq("id", prev.id);
    if (error) {
      console.error(`  ${key(g)}: ${error.message}`);
      continue;
    }
    scored += 1;
    continue;
  }

  const { error } = await db
    .from("sport_games")
    .upsert(row, { onConflict: "season_id,week,away,home" });
  if (error) {
    console.error(`  ${key(g)}: ${error.message}`);
    continue;
  }
  if (prev) updated += 1;
  else inserted += 1;
  if (g.away_score !== null) scored += 1;
}

const { count } = await db
  .from("sport_games")
  .select("id", { count: "exact", head: true })
  .eq("season_id", season.id);

console.log(`
Temporada ${YEAR}  season_id ${season.id}
  nuevos        ${inserted}
  actualizados  ${updated}
  con marcador  ${scored}
  sin tocar     ${skipped}
  total en base ${count}
`);

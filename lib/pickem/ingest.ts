// Pulling the NFL calendar and its scores out of ESPN and into `sport_games`.
//
// This used to live only in scripts/pickem-ingest-season.mjs, which meant the
// Tuesday operation existed exclusively on a laptop. It is here now so the cron
// routes and the script run the same code — a second implementation of "never
// blank a score" is the kind of divergence nobody notices until a week that had
// already paid out comes back un-settled.
//
// Everything above the "Writing" heading is pure: it takes an ESPN payload and
// the rows we already have, and says what should happen. That is what makes the
// week-18 placeholder and the do-not-overwrite rules testable in August, five
// months before the week they protect.
//
// The Supabase client is passed in rather than imported, for two reasons: the
// script builds its own from .env.local, and lib/supabase/server.ts is not
// resolvable outside the Next build. Keep every relative import in this file
// type-only for the same reason.

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** A game as ESPN describes it, already normalised. */
export interface IngestGame {
  week: number;
  away: string;
  home: string;
  /** ISO-8601, UTC. */
  kickoffAt: string;
  network: string | null;
  venueNote: string | null;
  awayScore: number | null;
  homeScore: number | null;
}

/** The subset of a stored row the write decision needs. */
export interface ExistingGame {
  id: string;
  week: number;
  away: string;
  home: string;
  kickoffAt: string;
  network: string | null;
  venueNote: string | null;
  awayScore: number | null;
}

export interface WeekParse {
  week: number;
  games: IngestGame[];
  /**
   * Every game of the week sharing one kickoff: the league has not set the
   * times yet. Week 18 arrives this way every season — see the column comment
   * on `sport_games.kickoff_at` in 0022.
   */
  placeholder: boolean;
}

export const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

/** Weeks in an NFL regular season since 2021. */
export const REGULAR_SEASON_WEEKS = 18;

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

interface VenueAddress {
  city?: string | null;
  country?: string | null;
}

const easternParts = (iso: string) => {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { weekday: get("weekday"), hour: Number(get("hour")) };
};

export const venueNote = (
  iso: string,
  week: number,
  venue?: VenueAddress | null,
): string | null => {
  // An international game names its city. It outranks the broadcast slot: a
  // Sunday morning in London is not "Sunday Night", and the city is the more
  // interesting fact anyway — five of them are breakfast in Ciudad Juárez.
  const country = venue?.country;
  if (country && country !== "USA") {
    return [venue?.city, country].filter(Boolean).join(", ");
  }

  const { weekday, hour } = easternParts(iso);
  if (weekday === "Wed") return week === 1 ? "Kickoff de temporada" : "Partido de miércoles";
  if (weekday === "Mon" && hour >= 17) return "Monday Night";
  if (weekday === "Thu") return hour >= 17 ? "Thursday Night" : "Thanksgiving";
  if (weekday === "Fri") return "Partido de viernes";
  if (weekday === "Sat") return "Sábado";
  if (weekday === "Sun" && hour >= 17) return "Sunday Night";
  return null;
};

/**
 * How many identical kickoffs it takes before we call a week unscheduled.
 *
 * A real Sunday slot holds a lot of games but never the whole week: the late
 * window and the night game are always somewhere else. Sixteen games on one
 * instant is not a schedule, it is a row the league has not filled in.
 */
export const PLACEHOLDER_MIN_GAMES = 8;

export const isPlaceholderWeek = (kickoffs: string[]): boolean =>
  kickoffs.length >= PLACEHOLDER_MIN_GAMES && new Set(kickoffs).size === 1;

// ---------------------------------------------------------------------------
// Reading ESPN
// ---------------------------------------------------------------------------

/**
 * Turns one scoreboard payload into games.
 *
 * Tolerant on the way in — ESPN moves fields around between seasons and a
 * missing broadcast is normal — and strict about two things: a game without
 * both teams is dropped by `assertTeams` before anything is written, and a
 * score is only read once the game is over.
 */
export const parseScoreboard = (payload: unknown, week: number): WeekParse => {
  const events = (payload as { events?: unknown[] } | null)?.events ?? [];

  const games: IngestGame[] = [];
  for (const raw of events) {
    const event = raw as {
      date?: string;
      competitions?: {
        competitors?: { homeAway?: string; score?: unknown; team?: { abbreviation?: string } }[];
        status?: { type?: { completed?: boolean } };
        broadcasts?: { names?: string[] }[];
        venue?: { address?: VenueAddress };
      }[];
    };
    const c = event.competitions?.[0] ?? {};
    const competitors = c.competitors ?? [];
    const home = competitors.find((x) => x.homeAway === "home");
    const away = competitors.find((x) => x.homeAway === "away");
    const done = c.status?.type?.completed === true;
    if (!event.date) continue;

    const score = (raw: unknown): number | null => {
      if (!done || raw === null || raw === undefined || raw === "") return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    const kickoffAt = new Date(event.date).toISOString();
    games.push({
      week,
      away: away?.team?.abbreviation ?? "",
      home: home?.team?.abbreviation ?? "",
      kickoffAt,
      network: c.broadcasts?.[0]?.names?.[0] ?? null,
      venueNote: venueNote(kickoffAt, week, c.venue?.address),
      // Only when the game is over. A score read mid-game and written as final
      // would settle a week on a result that had not happened yet.
      awayScore: score(away?.score),
      homeScore: score(home?.score),
    });
  }

  // A placeholder kickoff produces a placeholder label — "Sábado" for all
  // sixteen games of week 18, which is not a fact about anything. Blank it and
  // let `planWrite` keep whatever is already stored.
  const placeholder = isPlaceholderWeek(games.map((g) => g.kickoffAt));
  if (placeholder) for (const g of games) g.venueNote = null;

  return { week, games, placeholder };
};

export const fetchWeek = async (
  year: number,
  week: number,
  fetchImpl: typeof fetch = fetch,
): Promise<WeekParse> => {
  const url = `${ESPN_SCOREBOARD}?dates=${year}&seasontype=2&week=${week}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`ESPN devolvió ${res.status} para la jornada ${week}`);
  return parseScoreboard(await res.json(), week);
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Games ESPN gave us without both teams. Nothing is written while any exist. */
export const missingTeams = (games: IngestGame[]): IngestGame[] =>
  games.filter((g) => !g.away || !g.home);

export interface SeasonCheck {
  ok: boolean;
  games: number;
  teams: number;
  reason: string | null;
}

/**
 * 272 = 32 teams × 17 games ÷ 2.
 *
 * The arithmetic that catches a missing week, kept from the extractor that
 * built the demo's schedule. Only meaningful for a full-season pull — a Tuesday
 * re-ingest of three weeks obviously will not total 272 — so the callers that
 * pull a window skip it.
 */
export const checkFullSeason = (games: IngestGame[]): SeasonCheck => {
  const teams = new Set(games.flatMap((g) => [g.away, g.home])).size;
  const ok = teams === 32 && games.length === 272;
  return {
    ok,
    games: games.length,
    teams,
    reason: ok
      ? null
      : `Esperaba 272 partidos y 32 equipos (32 × 17 ÷ 2); llegaron ${games.length} y ${teams}.`,
  };
};

// ---------------------------------------------------------------------------
// Deciding what to write
// ---------------------------------------------------------------------------

export const gameKey = (g: { week: number; away: string; home: string }) =>
  `${g.week}|${g.away}|${g.home}`;

export type SkipReason =
  /** Scored here, unscored at the source. A transient API shape, not a result. */
  | "already_scored"
  /** The game has not been played. Normal for most of the week. */
  | "no_score_yet"
  /** Scores-only pass and the game was never seeded. Nothing to update. */
  | "not_seeded";

export interface UpsertRow {
  season_id: string;
  week: number;
  away: string;
  home: string;
  kickoff_at: string;
  network: string | null;
  venue_note: string | null;
  away_score: number | null;
  home_score: number | null;
}

export type WritePlan =
  | { kind: "upsert"; row: UpsertRow; existing: boolean }
  /** Only the score moves. Kickoff and labels are left exactly as stored. */
  | { kind: "score"; id: string; awayScore: number; homeScore: number; network: string | null }
  | { kind: "skip"; reason: SkipReason };

/**
 * What to do with one game, given what is already in the table.
 *
 * The whole point of the ingest being re-runnable is concentrated here, so the
 * rules are spelled out rather than implied:
 *
 *  1. **A stored score is never blanked.** ESPN dropping a result it showed an
 *     hour ago is a hiccup; writing that back would un-settle a week that has
 *     already handed somebody a prize.
 *  2. **A scored game never moves.** Once the final whistle is a fact, the
 *     kickoff and the label are history and a re-ingest may only add to them.
 *  3. **Nothing we cannot see is nulled.** The league leaves weeks 16-18
 *     without a broadcast for months; overwriting a known network with nothing
 *     on every Tuesday would lose the information as fast as it arrives.
 *  4. **A label is only replaced when the slot it came from changed.** The
 *     derivation is deterministic, so an unchanged kickoff producing a null
 *     label means ESPN dropped the venue, not that the game lost its slot.
 */
export const planWrite = (
  incoming: IngestGame,
  prev: ExistingGame | null,
  { seasonId, scoresOnly = false }: { seasonId: string; scoresOnly?: boolean },
): WritePlan => {
  const scored = incoming.awayScore !== null && incoming.homeScore !== null;

  // Rules 1 and 2.
  if (prev && prev.awayScore !== null) {
    if (!scored) return { kind: "skip", reason: "already_scored" };
    return {
      kind: "score",
      id: prev.id,
      awayScore: incoming.awayScore as number,
      homeScore: incoming.homeScore as number,
      network: incoming.network,
    };
  }

  if (scoresOnly) {
    if (!prev) return { kind: "skip", reason: "not_seeded" };
    if (!scored) return { kind: "skip", reason: "no_score_yet" };
    return {
      kind: "score",
      id: prev.id,
      awayScore: incoming.awayScore as number,
      homeScore: incoming.homeScore as number,
      network: incoming.network,
    };
  }

  // Rule 3.
  const network = incoming.network ?? prev?.network ?? null;
  // Rule 4.
  const moved = !prev || prev.kickoffAt !== incoming.kickoffAt;
  const venue_note = incoming.venueNote ?? (moved ? null : (prev?.venueNote ?? null));

  return {
    kind: "upsert",
    existing: Boolean(prev),
    row: {
      season_id: seasonId,
      week: incoming.week,
      away: incoming.away,
      home: incoming.home,
      kickoff_at: incoming.kickoffAt,
      network,
      venue_note,
      away_score: scored ? incoming.awayScore : null,
      home_score: scored ? incoming.homeScore : null,
    },
  };
};

/**
 * The weeks a Tuesday re-ingest should pull.
 *
 * The open week is included on purpose: the schedule cron runs before the
 * settle, so the "open" week on Tuesday morning is the one that just finished,
 * and picking it up catches a game the league moved after the fact. The two
 * ahead are the ones players are about to look at.
 *
 * Near the end of the season the window slides back instead of shrinking, so
 * week 18 — the one that arrives as a placeholder and has to be re-read — is
 * still pulled three times before it is played.
 */
export const weeksAround = (openWeek: number, totalWeeks = REGULAR_SEASON_WEEKS, span = 3): number[] => {
  if (totalWeeks < 1 || span < 1) return [];
  const size = Math.min(span, totalWeeks);
  const start = Math.max(1, Math.min(openWeek, totalWeeks - size + 1));
  return Array.from({ length: size }, (_, i) => start + i);
};

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export interface IngestReport {
  seasonId: string;
  year: number;
  weeks: number[];
  fetched: number;
  inserted: number;
  updated: number;
  scored: number;
  skipped: number;
  /** Weeks the league still has not scheduled. Week 18 lives here until week 17
      has been played, and its lock is not to be trusted while it does. */
  placeholderWeeks: number[];
  errors: string[];
}

export interface IngestOptions {
  seasonId: string;
  year: number;
  weeks: number[];
  /** Only touch games that already exist, and only their scores. */
  scoresOnly?: boolean;
  /** Run the 272/32 arithmetic. Only valid for a whole-season pull. */
  verifyFullSeason?: boolean;
  fetchImpl?: typeof fetch;
  onProgress?: (week: number, count: number) => void;
}

const EXISTING_COLUMNS = "id, week, away, home, kickoff_at, network, venue_note, away_score";

interface ExistingRow {
  id: string;
  week: number;
  away: string;
  home: string;
  kickoff_at: string;
  network: string | null;
  venue_note: string | null;
  away_score: number | null;
}

/**
 * Reads the requested weeks from ESPN and reconciles them against the table.
 *
 * Safe at any hour and safe to repeat, which is what lets the cron routes fire
 * on a UTC schedule that drifts an hour against Ciudad Juárez when daylight
 * saving ends on 1 November. Nothing here depends on it being Tuesday.
 */
export const ingestWeeks = async (
  db: SupabaseClient,
  {
    seasonId,
    year,
    weeks,
    scoresOnly = false,
    verifyFullSeason = false,
    fetchImpl = fetch,
    onProgress,
  }: IngestOptions,
): Promise<IngestReport> => {
  const report: IngestReport = {
    seasonId,
    year,
    weeks: [...weeks],
    fetched: 0,
    inserted: 0,
    updated: 0,
    scored: 0,
    skipped: 0,
    placeholderWeeks: [],
    errors: [],
  };
  if (!weeks.length) return report;

  const games: IngestGame[] = [];
  for (const week of weeks) {
    const parsed = await fetchWeek(year, week, fetchImpl);
    if (parsed.placeholder) report.placeholderWeeks.push(week);
    games.push(...parsed.games);
    onProgress?.(week, parsed.games.length);
  }
  report.fetched = games.length;

  // Both checks abort before a single write. A partial calendar noticed at
  // ingest time is a log line; noticed by a player it is a support ticket
  // about a jornada that is missing games.
  const bad = missingTeams(games);
  if (bad.length) {
    report.errors.push(`${bad.length} partidos sin equipos. No se escribe nada.`);
    return report;
  }
  if (verifyFullSeason) {
    const check = checkFullSeason(games);
    if (!check.ok) {
      report.errors.push(`${check.reason} No se escribe nada.`);
      return report;
    }
  }

  const { data: existing, error: readError } = await db
    .from("sport_games")
    .select(EXISTING_COLUMNS)
    .eq("season_id", seasonId)
    .in("week", weeks)
    .returns<ExistingRow[]>();

  if (readError) {
    report.errors.push(`lectura de sport_games: ${readError.message}`);
    return report;
  }

  const known = new Map<string, ExistingGame>(
    (existing ?? []).map((r) => [
      gameKey(r),
      {
        id: r.id,
        week: r.week,
        away: r.away,
        home: r.home,
        kickoffAt: new Date(r.kickoff_at).toISOString(),
        network: r.network,
        venueNote: r.venue_note,
        awayScore: r.away_score,
      },
    ]),
  );

  const upserts: UpsertRow[] = [];
  let inserts = 0;

  for (const g of games) {
    const plan = planWrite(g, known.get(gameKey(g)) ?? null, { seasonId, scoresOnly });

    if (plan.kind === "skip") {
      report.skipped += 1;
      continue;
    }
    if (plan.kind === "score") {
      const patch: Record<string, unknown> = {
        away_score: plan.awayScore,
        home_score: plan.homeScore,
      };
      // Rule 3 again: only ever adds a broadcast, never removes one.
      if (plan.network) patch.network = plan.network;
      const { error } = await db.from("sport_games").update(patch).eq("id", plan.id);
      if (error) report.errors.push(`${gameKey(g)}: ${error.message}`);
      else report.scored += 1;
      continue;
    }

    upserts.push(plan.row);
    if (plan.existing) report.updated += 1;
    else inserts += 1;
    if (plan.row.away_score !== null) report.scored += 1;
  }

  if (upserts.length) {
    const { error } = await db
      .from("sport_games")
      .upsert(upserts, { onConflict: "season_id,week,away,home" });
    if (error) {
      // One bad row must not cost the other fifteen. Retrying singly costs a
      // round trip per game on a path that runs once a week, and buys a log
      // line that names the game instead of the batch.
      report.errors.push(`lote de ${upserts.length}: ${error.message}`);
      report.inserted = 0;
      report.updated = 0;
      let recovered = 0;
      for (const row of upserts) {
        const { error: rowError } = await db
          .from("sport_games")
          .upsert(row, { onConflict: "season_id,week,away,home" });
        if (rowError) report.errors.push(`${gameKey(row)}: ${rowError.message}`);
        else recovered += 1;
      }
      report.updated = recovered;
      return report;
    }
    report.inserted = inserts;
  }

  return report;
};

/**
 * Finds or creates the season row. Used by the script, which is given a year;
 * the cron routes already hold a `season_id` from `pickem_programs` and must
 * not invent a season nobody has a programme for.
 */
export const resolveSeason = async (
  db: SupabaseClient,
  year: number,
  weeks = REGULAR_SEASON_WEEKS,
  league = "nfl",
): Promise<string> => {
  const { data, error } = await db
    .from("sport_seasons")
    .upsert({ league, year, weeks }, { onConflict: "league,year" })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`no se pudo escribir la temporada: ${error?.message}`);
  return data.id;
};

export const countSeasonGames = async (
  db: SupabaseClient,
  seasonId: string,
): Promise<number> => {
  const { count } = await db
    .from("sport_games")
    .select("id", { count: "exact", head: true })
    .eq("season_id", seasonId);
  return count ?? 0;
};

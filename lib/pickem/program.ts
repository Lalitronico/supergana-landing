// Programme and schedule lookup. Server only.
//
// Service-role reads, like lib/tickets/campaigns.ts: `campaigns` is closed to
// anon and authenticated by RLS, so the tenant's config never reaches a browser
// except through the fields a page or route chooses to render.

import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parseOrgTheme } from "@/lib/tickets/theme";
import { buildWeek, lockOf } from "./schedule";
import {
  parseMechanics,
  type Game,
  type LeaderboardRow,
  type Program,
  type ProgramStatus,
  type Week,
} from "./schema";

interface ProgramRow {
  id: string;
  slug: string;
  name: string;
  status: ProgramStatus;
  config: Record<string, unknown> | null;
  organizations: { name: string; slug: string; theme: unknown } | null;
  pickem_programs: {
    season_id: string;
    open_week: number;
    mechanics: unknown;
    promo_weeks: number[] | null;
    venues: string[] | null;
    sport_seasons: { year: number; weeks: number } | null;
  } | null;
}

export const getProgram = async (slug: string): Promise<Program | null> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("campaigns")
    .select(
      `id, slug, name, status, config,
       organizations(name, slug, theme),
       pickem_programs(season_id, open_week, mechanics, promo_weeks, venues,
                       sport_seasons(year, weeks))`,
    )
    .eq("slug", slug)
    .eq("module", "pickem")
    .maybeSingle<ProgramRow>();

  if (error) {
    console.error("[pickem] program lookup failed", error);
    return null;
  }
  // A campaign without its `pickem_programs` row is a half-seeded programme,
  // not a programme with defaults. Rendering one would mean inventing a season.
  if (!data?.pickem_programs) return null;

  const p = data.pickem_programs;

  return {
    campaignId: data.id,
    slug: data.slug,
    name: data.name,
    status: data.status,
    orgName: data.organizations?.name ?? data.name,
    orgSlug: data.organizations?.slug ?? data.slug,
    theme: parseOrgTheme(data.organizations?.theme),
    // Falls back to Juárez rather than UTC: a missing zone showing kickoffs six
    // hours off is a bug that looks like data, and every tenant this module has
    // is in this one. A second town makes it a required key.
    timezone:
      typeof data.config?.timezone === "string"
        ? data.config.timezone
        : "America/Ciudad_Juarez",
    // Opt-in, never inherited: a programme whose config nobody edited is shut.
    rehearsal: data.config?.rehearsal === "anyone",
    seasonId: p.season_id,
    seasonYear: p.sport_seasons?.year ?? 0,
    totalWeeks: p.sport_seasons?.weeks ?? 18,
    openWeek: p.open_week,
    mechanics: parseMechanics(p.mechanics),
    promoWeeks: p.promo_weeks ?? [],
    venues: p.venues ?? [],
  };
};

/**
 * A draft programme renders — that is how the client previews it before launch
 * — but see `acceptsPicks`: only a live one takes a submission.
 */
export const isVisible = (program: Program) => program.status !== "closed";

/**
 * Whether a pick may actually land.
 *
 * `live` is the normal answer. The other one exists because the season opens on
 * 9 September and somebody at Chapa has to walk the whole thing end to end
 * before then — register, pick, check in, see a score — and they cannot do that
 * against a programme that refuses every write. Nor should the programme be
 * opened early just to allow it: a week 1 leaderboard built out of rehearsals
 * is a week 1 leaderboard nobody can trust.
 *
 * So `config.rehearsal` opens a draft programme, and ONLY a draft one. A
 * `paused` or `closed` programme stays shut for everybody including staff,
 * because pausing is an operational brake rather than a permission question.
 * The widest this ever opens is a programme nobody has been given the QR for.
 *
 * Same key and same reasoning as the tickets module (lib/tickets/campaigns.ts,
 * `mayRehearse`), deliberately: an operator who has run one rehearsal should
 * not have to learn a second vocabulary for the next module.
 */
export const acceptsPicks = (program: Program) =>
  program.status === "live" || (program.status === "draft" && program.rehearsal);

interface GameRow {
  id: string;
  week: number;
  away: string;
  home: string;
  kickoff_at: string;
  network: string | null;
  venue_note: string | null;
  away_score: number | null;
  home_score: number | null;
  voided: boolean;
}

const toGame = (r: GameRow): Game => ({
  id: r.id,
  week: r.week,
  away: r.away,
  home: r.home,
  kickoffAt: r.kickoff_at,
  network: r.network,
  venueNote: r.venue_note,
  awayScore: r.away_score,
  homeScore: r.home_score,
  voided: r.voided,
});

export const getWeek = async (
  program: Program,
  week: number,
  now = new Date(),
): Promise<Week | null> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("sport_games")
    .select(
      "id, week, away, home, kickoff_at, network, venue_note, away_score, home_score, voided",
    )
    .eq("season_id", program.seasonId)
    .eq("week", week)
    .order("kickoff_at", { ascending: true })
    .returns<GameRow[]>();

  if (error) {
    console.error("[pickem] week lookup failed", error);
    return null;
  }
  if (!data?.length) return null;

  const games = data.map(toGame);
  // Settled is a property of the campaign's entries, not of the calendar: every
  // live game having a score means the week COULD settle, not that it has. The
  // distinction matters on Tuesday morning, between the last whistle and the
  // cron — the week is frozen but the points are not credited yet.
  const scored = games.filter((g) => !g.voided).every((g) => g.awayScore !== null);
  const settled = scored && (await weekIsSettled(program.campaignId, week));

  return buildWeek(week, games, program.openWeek, settled, now);
};

const weekIsSettled = async (campaignId: string, week: number): Promise<boolean> => {
  const db = supabaseAdmin();
  const { count, error } = await db
    .from("pickem_entries")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("week", week)
    .not("settled_at", "is", null);
  if (error) {
    console.error("[pickem] settled check failed", error);
    return false;
  }
  return (count ?? 0) > 0;
};

// ---------------------------------------------------------------------------
// The leaderboard
// ---------------------------------------------------------------------------

/**
 * The scoped read 0011 anticipated, and the only place one player sees another.
 *
 * Through the RPC rather than a table query, because the RPC is where the
 * `currency = 'points'` condition lives — the one that keeps loyalty tokens
 * earned by spending out of the ranking. A convenient `select` here would be a
 * second implementation of the rule that keeps this a contest.
 */
export const getLeaderboard = (
  program: Program,
  scope: "week" | "season",
  week: number | null,
  limit = 50,
): Promise<LeaderboardRow[]> => readLeaderboard(program.slug, scope, week, limit);

/**
 * The uncached read, by slug rather than by programme.
 *
 * Split out because `unstable_cache` keys on the arguments it is given and a
 * whole `Program` object — theme, mechanics, venues — is a cache key that
 * changes whenever the tenant edits their colours. A slug does not.
 */
const readLeaderboard = async (
  slug: string,
  scope: "week" | "season",
  week: number | null,
  limit: number,
): Promise<LeaderboardRow[]> => {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("pickem_leaderboard", {
    p_campaign_slug: slug,
    p_week: week,
    p_scope: scope,
    p_limit: limit,
  });

  if (error) {
    console.error("[pickem] leaderboard failed", error);
    return [];
  }

  return (data ?? []).map(
    (r: { rank: number; alias: string | null; venue: string | null; points: number; participant_id: string }) => ({
      rank: Number(r.rank),
      alias: r.alias ?? "Jugador",
      venue: r.venue,
      points: Number(r.points),
      participantId: r.participant_id,
    }),
  );
};

/** How many rows the ranking screen shows before it stops being a list. */
export const LEADERBOARD_TOP = 50;

/**
 * How many rows are read so that a position can be stated at all.
 *
 * 08-DECISIONES-ABIERTAS §9: the demo showed "lugar 2 de 13" while the model
 * projects 450 players, and "lugar 2 de 13" with 450 playing is a lie. A real
 * position needs the real padrón, so the read is the whole table and the screen
 * shows the first `LEADERBOARD_TOP` of it. 5,000 is roughly ten times the
 * projected padrón — high enough that nobody falls off the end of their own
 * ranking, low enough that a misconfigured programme cannot pull a million rows
 * into a page render.
 */
const LEADERBOARD_MAX = 5000;

/**
 * The cache tags a settle should drop.
 *
 * 07-OPERACION-SEMANAL: "El leaderboard se consulta mucho el martes. Cachear la
 * respuesta de la RPC por jornada; se invalida al cerrar." The second half is
 * not wired yet — `pickem_settle_week` has no route calling it — so whoever
 * builds the staff panel and the Tuesday cron calls `revalidateTag` with these
 * after settling. Until then the 60-second window below is what bounds the
 * staleness, and a minute is well inside the gap between the cron closing the
 * week and anybody reading the table.
 */
export const leaderboardTags = (slug: string, week?: number | null): string[] =>
  week === undefined || week === null
    ? [`pickem-leaderboard:${slug}`]
    : [`pickem-leaderboard:${slug}`, `pickem-leaderboard:${slug}:w${week}`];

/**
 * The cached read.
 *
 * WHY `unstable_cache` AND NOT `use cache`. Next 16 replaced it with the
 * directive, and the directive needs `cacheComponents: true` in next.config.ts
 * — a flag that changes how every route in the repo renders, including the
 * tickets module and the campaign pages, which is not a switch a ranking screen
 * gets to throw. `unstable_cache` works with the configuration this repo
 * actually has, is the documented path for a project that has not opted into
 * Cache Components, and is confined to this one function. If the repo adopts
 * Cache Components later this becomes a `use cache` with a `cacheLife`, and the
 * call sites do not change.
 *
 * The key holds the slug, the scope and the week, so two tenants and two
 * jornadas never share an entry. Nothing about the reader is in it, which is
 * the point: the table is the same for everybody, and the one row that depends
 * on who is asking is found in it afterwards, uncached.
 */
const cachedBoard = (slug: string, scope: "week" | "season", week: number | null) =>
  unstable_cache(
    () => readLeaderboard(slug, scope, week, LEADERBOARD_MAX),
    ["pickem-leaderboard", slug, scope, String(week ?? "season")],
    { revalidate: 60, tags: leaderboardTags(slug, week) },
  );

export interface Standings {
  /** What the screen lists. */
  top: LeaderboardRow[];
  /** Everybody in the padrón for this scope — the denominator of "lugar X de Y". */
  total: number;
  /**
   * The reader's own row, with its REAL position, whether or not it is in
   * `top`. Null when they are not playing, or not in this table yet.
   */
  mine: LeaderboardRow | null;
  /** Whether `mine` is already visible in `top`, so it is not drawn twice. */
  mineInTop: boolean;
}

/**
 * The ranking as a screen needs it: a top, a total, and your own row.
 *
 * With 450 players projected, almost nobody is in the top 50 — so a ranking
 * that stops at 50 tells the majority of the padrón nothing about themselves,
 * which is the fastest way to make somebody stop opening it. The position is
 * the product; being 231st is still being somewhere.
 */
export const getStandings = async (
  program: Program,
  scope: "week" | "season",
  week: number | null,
  participantId: string | null,
): Promise<Standings> => {
  const all = await cachedBoard(program.slug, scope, scope === "week" ? week : null)();
  const top = all.slice(0, LEADERBOARD_TOP);
  const mine = participantId ? (all.find((r) => r.participantId === participantId) ?? null) : null;

  return {
    top,
    total: all.length,
    mine,
    mineInTop: mine !== null && top.some((r) => r.participantId === mine.participantId),
  };
};

// ---------------------------------------------------------------------------
// Prizes on offer
// ---------------------------------------------------------------------------

export interface Prize {
  id: string;
  scope: "week" | "season";
  place: number;
  name: string;
  detail: string | null;
  validDays: number;
}

/**
 * What the tenant is putting up. Empty until they say — the prizes are defined
 * and supplied by the client, which is how the programme was quoted, so an
 * empty catalogue renders an honest "todavía no anunciados" rather than a
 * placeholder somebody might read as a promise.
 */
export const getPrizes = async (program: Program): Promise<Prize[]> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("pickem_prizes")
    .select("id, scope, place, name, detail, valid_days")
    .eq("campaign_id", program.campaignId)
    .eq("active", true)
    .order("scope", { ascending: true })
    .order("place", { ascending: true })
    .returns<
      { id: string; scope: "week" | "season"; place: number; name: string; detail: string | null; valid_days: number }[]
    >();

  if (error) {
    console.error("[pickem] prizes failed", error);
    return [];
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    scope: p.scope,
    place: p.place,
    name: p.name,
    detail: p.detail,
    validDays: p.valid_days,
  }));
};

export interface WeekSummary {
  week: number;
  games: number;
  lockAt: string | null;
  promo: boolean;
}

/**
 * One row per week of the season, for the eighteen-cell strip that runs across
 * the top of every screen. Kickoffs only — the strip needs to know when each
 * week locks and how many games it holds, not who is playing.
 */
export const getSeasonOutline = async (program: Program): Promise<WeekSummary[]> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("sport_games")
    .select("week, kickoff_at, voided")
    .eq("season_id", program.seasonId)
    .order("week", { ascending: true })
    .returns<{ week: number; kickoff_at: string; voided: boolean }[]>();

  if (error) {
    console.error("[pickem] season outline failed", error);
    return [];
  }

  const byWeek = new Map<number, { kickoffAt: string; voided: boolean }[]>();
  for (const r of data ?? []) {
    const list = byWeek.get(r.week) ?? [];
    list.push({ kickoffAt: r.kickoff_at, voided: r.voided });
    byWeek.set(r.week, list);
  }

  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, rows]) => ({
      week,
      games: rows.length,
      lockAt: lockOf(
        rows.map((r) => ({ kickoffAt: r.kickoffAt, voided: r.voided }) as Game),
      ),
      promo: program.promoWeeks.includes(week),
    }));
};

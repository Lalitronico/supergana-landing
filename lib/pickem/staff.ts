// The supervisor's side of the pick'em. SERVER ONLY.
//
// Everything here runs with the service-role client, and none of it decides who
// may call it. That check happens one layer up, in the panel routes, against
// `campaign_admins` through `resolveStaff` — the same allowlist and the same
// helper the tickets console has used since 0006. There is one notion of staff
// on this platform; this module assumes the caller already cleared it and takes
// the staff's user id as an argument so the ledger and the awards can be signed
// with a session-verified identity rather than with whatever the request body
// claimed.
//
// The split against the rest of lib/pickem is deliberate:
//   access.ts   — what one PLAYER may see and did.
//   program.ts  — the programme and the calendar, read by every screen.
//   settle.ts   — the Tuesday close, from the cron's side.
//   staff.ts    — the four things a person has to be able to do by hand.
//
// The close itself is NOT re-implemented here. `settleProgram` already knows
// what `pickem_settle_week`'s answer means, and two readings of one RPC would
// eventually disagree about whether a week closed.

import type { StaffRole } from "@/lib/tickets/roles";
import type { SettleOutcome } from "@/lib/pickem/settle";
import type { Program } from "./schema";

// ---------------------------------------------------------------------------
// Runtime bridges
// ---------------------------------------------------------------------------
//
// Dynamic imports, not static ones, and the reason is the test file next door:
// `node --test --experimental-strip-types` runs these sources directly, with no
// bundler, and nothing resolves the `@/` alias for it. A static import of the
// service-role client would make every pure predicate in this module
// untestable — and the predicates are the part most worth a test, because they
// decide what a cashier is told when a code does not work.
//
// Next resolves the alias inside a dynamic import exactly as it does in a
// static one, and the module cache means the resolution happens once.

const admin = async () => (await import("@/lib/supabase/server")).supabaseAdmin();

// ===========================================================================
// Pure: what a seat may do
// ===========================================================================
//
// UI affordances AND route guards. Unlike lib/tickets/roles.ts these are not
// imported by a client component — the panel is told what it may do by the
// snapshot it fetches, so the browser never has to hold the rule.

/**
 * Closing a jornada, breaking a tie, annulling a game, correcting the ledger.
 *
 * Narrow on purpose. Each of these moves points or hands out a prize, and
 * `reviewer` is a seat drawn for judging one receipt at a time. `finance`
 * settles what was promised, it does not decide the promise — the same line
 * `canReview` and `canManageStore` already draw in the tickets console.
 */
export const canOperateWeek = (role: StaffRole) =>
  role === "supervisor" || role === "admin";

/**
 * Redeeming a code at the counter. Every seat on the programme, and that is the
 * widest door in the module on purpose.
 *
 * The runbook is explicit that validation must not require the waiter to have
 * an account of their own: the branch has one tablet signed in and whoever is
 * at the counter uses it. Narrowing this to supervisors would mean the prize
 * can only be collected when the supervisor is in the building, which is the
 * mechanism of the business failing on a Tuesday afternoon.
 *
 * Enumerated rather than written as `true`, and that is the point: a role added
 * later lands outside the list and is refused until somebody decides. Defaulting
 * a new seat into the door that hands out prizes is the wrong direction to fail.
 */
export const canRedeemAward = (role: StaffRole) =>
  role === "reviewer" || role === "supervisor" || role === "finance" || role === "admin";

// ===========================================================================
// Pure: the code on the screen
// ===========================================================================

/**
 * A typed code reduced to what actually identifies it.
 *
 * Mirrors the expression inside `pickem_redeem_award` and `pickem_find_award`
 * character for character: uppercase, and everything that is not a letter or a
 * digit removed. A cashier reading `CHA-W3-K7M2QX` off a phone across a counter
 * may type it lowercase, without dashes, or with a space where a dash was.
 *
 * THIS IS NOT THE MATCH. The match happens in SQL, in the two functions above,
 * because a code the panel can find but the redeem would refuse — or the other
 * way round — looks from the customer's side exactly like a prize that does not
 * exist. This is here to tidy the input box and to know whether it is worth
 * asking the database at all.
 */
export const normalizeAwardCode = (raw: string): string =>
  (raw ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

/**
 * Puts the dashes back: `chaw3k7m2qx` → `CHA-W3-K7M2QX`.
 *
 * Read off the ends rather than by counting forward, because only the ends have
 * fixed widths — the tenant prefix is three characters and the random tail is
 * six, and the jornada token in the middle is `W3` or `W17`. A string that
 * cannot hold all three parts is handed back normalised and undecorated, which
 * is what a half-typed code should look like while somebody is still typing.
 */
export const formatAwardCode = (raw: string): string => {
  const flat = normalizeAwardCode(raw);
  if (flat.length < 10) return flat;
  return `${flat.slice(0, 3)}-${flat.slice(3, -6)}-${flat.slice(-6)}`;
};

/**
 * Whether the box holds enough to be worth a lookup.
 *
 * Three for the prefix, at least two for the jornada token, six for the tail.
 * Below that the answer is always "no such code", and showing that to somebody
 * who has typed four characters reads as a refusal rather than as patience.
 */
export const looksLikeAwardCode = (raw: string): boolean =>
  normalizeAwardCode(raw).length >= 10;

// ===========================================================================
// Pure: is this jornada closeable
// ===========================================================================

export interface PanelGame {
  id: string;
  week: number;
  away: string;
  home: string;
  kickoffAt: string;
  network: string | null;
  awayScore: number | null;
  homeScore: number | null;
  voided: boolean;
}

export interface WeekReadiness {
  /** Every game of the jornada, annulled ones included. */
  total: number;
  /** The ones that count. A voided game scores for nobody. */
  live: number;
  voided: number;
  scored: number;
  /** Live games still without a final score, in kickoff order. */
  missing: PanelGame[];
  /** Whether `pickem_settle_week` would accept the week right now. */
  ready: boolean;
}

/**
 * Exactly the condition the settle refuses on, computed on this side so the
 * panel can name the missing games instead of reporting a count.
 *
 * A jornada with no live games is not ready either, and that is not pedantry:
 * every game annulled means there is nothing to score, and letting the settle
 * run would credit a room full of zeroes and advance the season past a week
 * that never happened.
 */
export const readinessOf = (games: PanelGame[]): WeekReadiness => {
  const live = games.filter((g) => !g.voided);
  const missing = live
    .filter((g) => g.awayScore === null || g.homeScore === null)
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  return {
    total: games.length,
    live: live.length,
    voided: games.length - live.length,
    scored: live.length - missing.length,
    missing,
    ready: live.length > 0 && missing.length === 0,
  };
};

// ===========================================================================
// Pure: an adjustment is a signed sentence
// ===========================================================================

/**
 * The magnitude above which the panel asks a second time.
 *
 * Not a limit — `pickem_adjust_points` refuses to hold one, because a rail low
 * enough to catch a fat finger eventually blocks a legitimate correction at the
 * worst moment. A settled jornada is worth a few hundred points at most, so
 * four digits is already unusual enough to be worth re-reading before it is
 * written to an append-only ledger.
 */
export const ADJUSTMENT_CONFIRM_AT = 1000;

/** Hard ceiling, and this one IS a limit: a typo of one extra digit. */
export const ADJUSTMENT_MAX = 100000;

/** The shortest reason that is still a reason. "x" is not one. */
export const ADJUSTMENT_NOTE_MIN = 6;
export const ADJUSTMENT_NOTE_MAX = 200;

export type AdjustmentError =
  | "not_a_number"
  | "zero_adjustment"
  | "too_large"
  | "note_required"
  | "note_too_short"
  | "note_too_long";

export type AdjustmentCheck =
  | { ok: true; points: number; note: string; confirm: boolean }
  | { ok: false; error: AdjustmentError };

/**
 * What the route and the form both ask before anything is written.
 *
 * The reason is mandatory and it is the whole point of the mechanism: the
 * ledger is append-only, so a correction is a new entry that will be read
 * months later by somebody who was not in the room. "Ajuste" is not a reason.
 * "Marcador de PHI-DAL capturado al revés, J7" is.
 */
export const validateAdjustment = (points: unknown, note: unknown): AdjustmentCheck => {
  if (typeof points !== "number" || !Number.isFinite(points) || !Number.isInteger(points)) {
    return { ok: false, error: "not_a_number" };
  }
  if (points === 0) return { ok: false, error: "zero_adjustment" };
  if (Math.abs(points) > ADJUSTMENT_MAX) return { ok: false, error: "too_large" };

  const trimmed = typeof note === "string" ? note.trim() : "";
  if (!trimmed) return { ok: false, error: "note_required" };
  if (trimmed.length < ADJUSTMENT_NOTE_MIN) return { ok: false, error: "note_too_short" };
  if (trimmed.length > ADJUSTMENT_NOTE_MAX) return { ok: false, error: "note_too_long" };

  return {
    ok: true,
    points,
    note: trimmed,
    confirm: Math.abs(points) >= ADJUSTMENT_CONFIRM_AT,
  };
};

// ===========================================================================
// Pure: what the screen says when something is refused
// ===========================================================================
//
// Every machine code these RPCs raise, in the language the panel is written in.
// A supervisor at a counter on a Tuesday should never see `week_incomplete`,
// and the person who has to translate it should not be inventing the sentence
// at the call site — that is how two screens end up describing one refusal two
// different ways.

const MESSAGES: Record<string, string> = {
  // settle
  week_incomplete: "Faltan marcadores. La jornada no puede cerrarse hasta que todos los partidos que cuentan tengan resultado.",
  season_over: "La temporada ya terminó: no queda jornada por cerrar.",
  no_games: "Esta jornada no tiene partidos sembrados.",
  // tie
  week_not_settled: "La jornada todavía no cierra, así que aún no hay primer lugar que premiar.",
  no_winners: "Elige al menos a un ganador.",
  not_tied_at_top: "Alguien de la lista ya no está empatado en la cima. Recarga el panel y vuelve a elegir.",
  no_week_prize: "Este programa no tiene premio semanal configurado. Cárgalo antes de otorgar.",
  already_awarded: "El premio de esta jornada ya está otorgado.",
  // games
  game_not_found: "Ese partido no pertenece a la temporada de este programa.",
  week_settled: "La jornada ya cerró. Un partido no se anula después del cierre: la corrección va por un ajuste de puntos con motivo.",
  // adjustments
  participant_not_found: "Ese jugador no está en este programa.",
  note_required: "El motivo es obligatorio.",
  note_too_short: "El motivo es demasiado corto. Escribe qué se corrigió y por qué.",
  note_too_long: "El motivo es demasiado largo.",
  zero_adjustment: "Un ajuste de cero no corrige nada.",
  too_large: "Ese ajuste es demasiado grande. Revisa la cifra.",
  not_a_number: "Los puntos deben ser un número entero.",
  // redemption
  award_not_found: "No encontramos ese código en este programa.",
  already_redeemed: "Este código ya fue canjeado.",
  award_expired: "Este código está vencido.",
  award_canceled: "Este premio fue cancelado.",
  unknown_venue: "Elige una sucursal válida.",
  // shared
  campaign_not_found: "No encontramos el programa.",
  db_error: "No pudimos completar la operación. Intenta de nuevo.",
};

export const staffMessage = (code: string): string =>
  MESSAGES[code] ?? "No pudimos completar la operación.";

/** Codes that mean "the request was fine, the rules refused it" → HTTP 409. */
const RULE_CODES = new Set([
  "week_incomplete",
  "week_not_settled",
  "not_tied_at_top",
  "no_week_prize",
  "already_awarded",
  "week_settled",
  "already_redeemed",
  "award_expired",
  "award_canceled",
  "zero_adjustment",
  "note_required",
  "season_over",
  "no_games",
]);

export const staffStatusFor = (code: string): number => {
  if (code === "campaign_not_found") return 404;
  if (code === "game_not_found" || code === "participant_not_found") return 404;
  if (code === "award_not_found") return 404;
  if (RULE_CODES.has(code)) return 409;
  if (code === "db_error") return 500;
  return 400;
};

// ===========================================================================
// Results
// ===========================================================================

export type StaffResult<T> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Machine code out of a PostgREST error, or `db_error` when it is not one. */
const codeOf = (message: string | undefined, known: Set<string>): string => {
  const raw = (message ?? "").trim();
  return known.has(raw) ? raw : "db_error";
};

// ===========================================================================
// Reading the jornada
// ===========================================================================

export interface EntryCounts {
  total: number;
  settled: number;
}

export interface TieRow {
  participantId: string;
  alias: string;
  venue: string | null;
  points: number;
}

export interface TieState {
  top: number;
  rows: TieRow[];
  /** More than one player on the top line. */
  tied: boolean;
  /** Whether first place of this jornada already has an award out. */
  awarded: boolean;
}

export interface WeekAward {
  id: string;
  code: string;
  alias: string;
  place: number;
  status: "pending" | "redeemed" | "expired" | "canceled";
  prizeName: string;
  expiresAt: string;
  redeemedAt: string | null;
  redeemedVenue: string | null;
}

export interface PanelSnapshot {
  week: number;
  openWeek: number;
  totalWeeks: number;
  games: PanelGame[];
  readiness: WeekReadiness;
  entries: EntryCounts;
  /** Whether any entry of this jornada carries a settle stamp. */
  settled: boolean;
  tie: TieState | null;
  awards: WeekAward[];
}

interface GameRow {
  id: string;
  week: number;
  away: string;
  home: string;
  kickoff_at: string;
  network: string | null;
  away_score: number | null;
  home_score: number | null;
  voided: boolean;
}

export const getPanelWeek = async (
  program: Program,
  week: number,
): Promise<PanelSnapshot> => {
  const db = await admin();

  const { data: gameRows, error: gameError } = await db
    .from("sport_games")
    .select("id, week, away, home, kickoff_at, network, away_score, home_score, voided")
    .eq("season_id", program.seasonId)
    .eq("week", week)
    .order("kickoff_at", { ascending: true })
    .returns<GameRow[]>();

  if (gameError) console.error("[pickem staff] week games failed", gameError);

  const games: PanelGame[] = (gameRows ?? []).map((g) => ({
    id: g.id,
    week: g.week,
    away: g.away,
    home: g.home,
    kickoffAt: g.kickoff_at,
    network: g.network,
    awayScore: g.away_score,
    homeScore: g.home_score,
    voided: g.voided,
  }));

  const { count: total } = await db
    .from("pickem_entries")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", program.campaignId)
    .eq("week", week);

  const { count: settledCount } = await db
    .from("pickem_entries")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", program.campaignId)
    .eq("week", week)
    .not("settled_at", "is", null);

  const settled = (settledCount ?? 0) > 0;

  return {
    week,
    openWeek: program.openWeek,
    totalWeeks: program.totalWeeks,
    games,
    readiness: readinessOf(games),
    entries: { total: total ?? 0, settled: settledCount ?? 0 },
    settled,
    tie: settled ? await getTieState(program, week) : null,
    awards: await getWeekAwards(program, week),
  };
};

/**
 * Who finished first, and whether more than one of them did.
 *
 * Only meaningful after the settle: `points` is null until then, so an
 * "unsettled top score" would be whichever row Postgres happened to return.
 * Read against the entries rather than through `pickem_leaderboard`, because
 * the tie the supervisor has to break is a tie of the JORNADA's points and the
 * RPC's week scope caps at a limit meant for a screen.
 */
export const getTieState = async (
  program: Program,
  week: number,
): Promise<TieState | null> => {
  const db = await admin();

  const { data, error } = await db
    .from("pickem_entries")
    .select("participant_id, points, venue, participants(alias)")
    .eq("campaign_id", program.campaignId)
    .eq("week", week)
    .not("settled_at", "is", null)
    .order("points", { ascending: false })
    .returns<
      {
        participant_id: string;
        points: number | null;
        venue: string | null;
        participants: { alias: string | null } | null;
      }[]
    >();

  if (error) {
    console.error("[pickem staff] tie lookup failed", error);
    return null;
  }
  if (!data?.length) return null;

  const top = data.reduce((max, r) => Math.max(max, r.points ?? 0), 0);
  const rows: TieRow[] = data
    .filter((r) => (r.points ?? 0) === top)
    .map((r) => ({
      participantId: r.participant_id,
      alias: r.participants?.alias ?? "Jugador",
      venue: r.venue,
      points: r.points ?? 0,
    }));

  const { count } = await db
    .from("pickem_awards")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", program.campaignId)
    .eq("week", week)
    .eq("place", 1);

  return { top, rows, tied: rows.length > 1, awarded: (count ?? 0) > 0 };
};

interface AwardRow {
  id: string;
  code: string;
  place: number;
  status: WeekAward["status"];
  expires_at: string;
  redeemed_at: string | null;
  redeemed_venue: string | null;
  participants: { alias: string | null } | null;
  pickem_prizes: { name: string } | null;
}

const toAward = (a: AwardRow): WeekAward => ({
  id: a.id,
  code: a.code,
  alias: a.participants?.alias ?? "Jugador",
  place: a.place,
  // A pending award past its date is expired in fact whether or not anybody ran
  // the update. Showing it as claimable would send somebody to the counter to
  // be turned away — access.ts makes the same correction on the player's side.
  status:
    a.status === "pending" && new Date(a.expires_at).getTime() < Date.now()
      ? "expired"
      : a.status,
  prizeName: a.pickem_prizes?.name ?? "Premio",
  expiresAt: a.expires_at,
  redeemedAt: a.redeemed_at,
  redeemedVenue: a.redeemed_venue,
});

const AWARD_SELECT =
  "id, code, place, status, expires_at, redeemed_at, redeemed_venue, participants(alias), pickem_prizes(name)";

export const getWeekAwards = async (
  program: Program,
  week: number,
): Promise<WeekAward[]> => {
  const db = await admin();
  const { data, error } = await db
    .from("pickem_awards")
    .select(AWARD_SELECT)
    .eq("campaign_id", program.campaignId)
    .eq("week", week)
    .order("place", { ascending: true })
    .returns<AwardRow[]>();

  if (error) {
    console.error("[pickem staff] week awards failed", error);
    return [];
  }
  return (data ?? []).map(toAward);
};

/**
 * Prizes still waiting at the counter, most recent first.
 *
 * The counter screen's standing list: it answers "who is coming in with a code
 * this week" without anybody having to search, and it is how a cashier notices
 * that a prize is about to expire.
 */
export const listPendingAwards = async (
  program: Program,
  limit = 20,
): Promise<WeekAward[]> => {
  const db = await admin();
  const { data, error } = await db
    .from("pickem_awards")
    .select(AWARD_SELECT)
    .eq("campaign_id", program.campaignId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AwardRow[]>();

  if (error) {
    console.error("[pickem staff] pending awards failed", error);
    return [];
  }
  return (data ?? []).map(toAward);
};

// ===========================================================================
// Closing the jornada by hand
// ===========================================================================

const SETTLE_CODES = new Set(["campaign_not_found", "week_incomplete"]);

/**
 * The manual close.
 *
 * Delegates to `settleProgram`, which is the cron's own path: the RPC is one
 * transaction and its answer has exactly one reading, so a second interpretation
 * living in the panel would eventually disagree with the cron about whether a
 * jornada closed. What the panel adds is a person choosing WHICH jornada — the
 * cron only ever closes the open one, and the real cases from the runbook are a
 * postponed game and a score captured wrong, both of which leave an earlier week
 * needing a second pass.
 */
export const settleWeekByHand = async (
  program: Program,
  week: number,
): Promise<StaffResult<SettleOutcome>> => {
  const { settleProgram } = await import("@/lib/pickem/settle");
  try {
    const outcome = await settleProgram({
      campaignId: program.campaignId,
      slug: program.slug,
      name: program.name,
      status: program.status,
      rehearsal: program.rehearsal,
      seasonId: program.seasonId,
      seasonYear: program.seasonYear,
      totalWeeks: program.totalWeeks,
      // `settleProgram` closes the programme's open week. The supervisor's
      // choice IS the week to close, so it is handed over as such rather than
      // duplicating the RPC call with a different argument.
      openWeek: week,
    });

    if (outcome.status === "error") {
      return fail(codeOf(outcome.reason, SETTLE_CODES));
    }
    if (outcome.status !== "settled") {
      return fail(outcome.status);
    }
    return { ok: true, data: outcome };
  } catch (e) {
    console.error("[pickem staff] manual settle failed", e);
    return fail("db_error");
  }
};

// ===========================================================================
// Breaking the tie
// ===========================================================================

export interface TieResolution {
  week: number;
  top: number;
  tied: number;
  prize: string;
  validDays: number;
  awarded: { participantId: string; alias: string | null; code: string }[];
}

const TIE_CODES = new Set([
  "campaign_not_found",
  "week_not_settled",
  "no_winners",
  "not_tied_at_top",
  "no_week_prize",
  "already_awarded",
]);

export const resolveTie = async (
  program: Program,
  week: number,
  winners: string[],
  staffId: string,
): Promise<StaffResult<TieResolution>> => {
  const db = await admin();
  const { data, error } = await db.rpc("pickem_resolve_tie", {
    p_campaign_slug: program.slug,
    p_week: week,
    p_winners: winners,
    p_staff: staffId,
  });

  if (error) {
    const code = codeOf(error.message, TIE_CODES);
    if (code === "db_error") console.error("[pickem staff] resolve tie failed", error);
    return fail(code);
  }
  return { ok: true, data: data as TieResolution };
};

// ===========================================================================
// Annulling a game
// ===========================================================================

const VOID_CODES = new Set(["campaign_not_found", "game_not_found", "week_settled"]);

export interface VoidResult {
  gameId: string;
  week: number;
  away: string;
  home: string;
  voided: boolean;
}

export const setGameVoided = async (
  program: Program,
  gameId: string,
  voided: boolean,
  staffId: string,
): Promise<StaffResult<VoidResult>> => {
  const db = await admin();
  const { data, error } = await db.rpc("pickem_set_game_voided", {
    p_campaign_slug: program.slug,
    p_game: gameId,
    p_voided: voided,
    p_staff: staffId,
  });

  if (error) {
    const code = codeOf(error.message, VOID_CODES);
    if (code === "db_error") console.error("[pickem staff] void game failed", error);
    return fail(code);
  }
  return { ok: true, data: data as VoidResult };
};

// ===========================================================================
// Correcting the ledger
// ===========================================================================

const ADJUST_CODES = new Set([
  "campaign_not_found",
  "participant_not_found",
  "note_required",
  "zero_adjustment",
]);

export interface AdjustResult {
  entryId: string;
  alias: string | null;
  points: number;
  note: string;
  total: number;
}

export const adjustPoints = async (
  program: Program,
  participantId: string,
  points: number,
  note: string,
  staffId: string,
): Promise<StaffResult<AdjustResult>> => {
  const db = await admin();
  const { data, error } = await db.rpc("pickem_adjust_points", {
    p_campaign_slug: program.slug,
    p_participant: participantId,
    p_points: points,
    p_note: note,
    p_staff: staffId,
  });

  if (error) {
    const code = codeOf(error.message, ADJUST_CODES);
    if (code === "db_error") console.error("[pickem staff] adjust failed", error);
    return fail(code);
  }
  return { ok: true, data: data as AdjustResult };
};

// ---------------------------------------------------------------------------
// Finding somebody to correct
// ---------------------------------------------------------------------------

export interface PlayerHit {
  participantId: string;
  alias: string;
  phone: string | null;
  verified: boolean;
}

/**
 * Search by alias or by phone, within this programme only.
 *
 * The query is stripped down to letters, digits and spaces before it reaches
 * PostgREST: the `or=` filter is a comma-separated string, so a comma or a
 * parenthesis typed into the box would be read as syntax rather than as text.
 */
export const searchPlayers = async (
  program: Program,
  query: string,
  limit = 12,
): Promise<PlayerHit[]> => {
  const clean = (query ?? "").replace(/[^\p{L}\p{N} ]/gu, "").trim();
  if (clean.length < 2) return [];

  const db = await admin();
  const { data, error } = await db
    .from("participants")
    .select("id, alias, phone, phone_verified_at")
    .eq("campaign_id", program.campaignId)
    .or(`alias.ilike.%${clean}%,phone.ilike.%${clean}%`)
    .order("alias", { ascending: true })
    .limit(limit)
    .returns<
      { id: string; alias: string | null; phone: string | null; phone_verified_at: string | null }[]
    >();

  if (error) {
    console.error("[pickem staff] player search failed", error);
    return [];
  }
  return (data ?? []).map((p) => ({
    participantId: p.id,
    alias: p.alias ?? "Jugador",
    phone: p.phone,
    verified: p.phone_verified_at !== null,
  }));
};

export interface LedgerLine {
  id: string;
  kind: string;
  points: number;
  note: string | null;
  createdAt: string;
  /** Null when the programme wrote it. A value means a person did. */
  createdBy: string | null;
}

export interface PlayerLedger {
  participantId: string;
  alias: string;
  /** The SUM, never a stored column. `currency = 'points'` is the legal frame. */
  total: number;
  lines: LedgerLine[];
}

export const getPlayerLedger = async (
  program: Program,
  participantId: string,
  limit = 12,
): Promise<PlayerLedger | null> => {
  const db = await admin();

  const { data: player } = await db
    .from("participants")
    .select("id, alias")
    .eq("campaign_id", program.campaignId)
    .eq("id", participantId)
    .maybeSingle<{ id: string; alias: string | null }>();

  if (!player) return null;

  const { data, error } = await db
    .from("points_entries")
    .select("id, kind, points, note, created_at, created_by")
    .eq("campaign_id", program.campaignId)
    .eq("participant_id", participantId)
    .eq("currency", "points")
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        kind: string;
        points: number;
        note: string | null;
        created_at: string;
        created_by: string | null;
      }[]
    >();

  if (error) {
    console.error("[pickem staff] ledger read failed", error);
    return null;
  }

  const rows = data ?? [];
  return {
    participantId,
    alias: player.alias ?? "Jugador",
    total: rows.reduce((sum, r) => sum + Number(r.points ?? 0), 0),
    lines: rows.slice(0, limit).map((r) => ({
      id: r.id,
      kind: r.kind,
      points: Number(r.points ?? 0),
      note: r.note,
      createdAt: r.created_at,
      createdBy: r.created_by,
    })),
  };
};

// ===========================================================================
// The counter
// ===========================================================================

export interface AwardLookup {
  code: string;
  alias: string;
  prize: string;
  detail: string | null;
  week: number | null;
  place: number;
  status: "pending" | "redeemed" | "expired" | "canceled";
  /** The date has passed, whatever the stored status still says. */
  expired: boolean;
  expiresAt: string;
  redeemedAt: string | null;
  redeemedVenue: string | null;
}

/**
 * What the cashier sees before confirming anything.
 *
 * The match is `pickem_find_award`, which normalises the typed code with the
 * same expression `pickem_redeem_award` uses. Nothing here compares strings:
 * a search that forgave a different set of typos than the redeem would produce
 * a code that cannot be found and could have been collected, which from the
 * customer's side is a prize that does not exist.
 */
export const findAward = async (
  program: Program,
  code: string,
): Promise<StaffResult<AwardLookup | null>> => {
  const db = await admin();
  const { data, error } = await db.rpc("pickem_find_award", {
    p_campaign_slug: program.slug,
    p_code: code,
  });

  if (error) {
    const c = codeOf(error.message, new Set(["campaign_not_found"]));
    if (c === "db_error") console.error("[pickem staff] find award failed", error);
    return fail(c);
  }
  return { ok: true, data: (data as AwardLookup | null) ?? null };
};

export interface RedeemResult {
  code: string;
  alias: string | null;
  prize: string;
  detail: string | null;
  week: number | null;
  venue: string;
}

const REDEEM_CODES = new Set([
  "campaign_not_found",
  "award_not_found",
  "already_redeemed",
  "award_expired",
  "award_canceled",
  "unknown_venue",
]);

/**
 * The moment the game turns into a visit.
 *
 * Every rule is inside `pickem_redeem_award`: the status machine, the deadline,
 * the branch. This only supplies the staff id, which comes from the verified
 * session in the route and never from the request body — the record of who
 * handed over a prize is worth nothing if the person handing it over can type
 * somebody else's name.
 */
export const redeemAward = async (
  program: Program,
  code: string,
  venue: string,
  staffId: string,
): Promise<StaffResult<RedeemResult>> => {
  const db = await admin();
  const { data, error } = await db.rpc("pickem_redeem_award", {
    p_campaign_slug: program.slug,
    p_code: code,
    p_venue: venue,
    p_staff: staffId,
  });

  if (error) {
    const c = codeOf(error.message, REDEEM_CODES);
    if (c === "db_error") console.error("[pickem staff] redeem failed", error);
    return fail(c);
  }
  return { ok: true, data: data as RedeemResult };
};

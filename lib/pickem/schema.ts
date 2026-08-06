// Shapes shared by both sides of the pick'em module.
//
// Importable from server and browser alike: nothing here reaches for
// next/headers or the Supabase admin client. The modules that do are
// program.ts and access.ts, and the build enforces that boundary.

import type { OrgTheme } from "@/lib/tickets/theme";

/** What a week is, from the player's point of view. */
export type WeekState =
  /** Settled. Scores are in, points are credited, the screen shows results. */
  | "settled"
  /** Accepting picks right now. Exactly one week per programme is ever this. */
  | "open"
  /** Kicked off, not yet settled. Picks are frozen, results are arriving. */
  | "running"
  /** Visible but not playable. Seeing week 12 exists is what makes a season
      feel like one, so these render rather than being hidden. */
  | "upcoming";

export interface Game {
  id: string;
  week: number;
  away: string;
  home: string;
  /** ISO-8601, UTC. Formatted for the player in the tenant's zone, never by
      subtracting an offset — see `formatKickoff`. */
  kickoffAt: string;
  /** Null while the league has not assigned the broadcast. Weeks 16-18 of 2026
      arrive this way and the screen says so rather than drawing a dash. */
  network: string | null;
  venueNote: string | null;
  awayScore: number | null;
  homeScore: number | null;
  /** Postponed and taken out of the scoring. Shown, greyed, worth nothing. */
  voided: boolean;
}

export interface Week {
  week: number;
  state: WeekState;
  games: Game[];
  /** First kickoff of the week: the moment picks close. Null only if the week
      has no games, which would be a seeding bug. */
  lockAt: string | null;
}

/**
 * Every number the game is scored with. Defaults live here AND in the
 * `mechanics` column default (0022) — the same values, because a config that
 * lost a key must not produce a differently-scored week depending on which
 * side read it.
 */
export interface Mechanics {
  hit: number;
  tiebreak: number;
  tiebreakMargin: number;
  early: number;
  earlyHours: number;
  streak3: number;
  streak6: number;
  checkinMult: number;
  promoMult: number;
}

export const DEFAULT_MECHANICS: Mechanics = {
  hit: 10,
  tiebreak: 15,
  tiebreakMargin: 3,
  early: 5,
  earlyHours: 24,
  streak3: 20,
  streak6: 50,
  checkinMult: 1,
  promoMult: 1,
};

export const parseMechanics = (raw: unknown): Mechanics => {
  if (!raw || typeof raw !== "object") return DEFAULT_MECHANICS;
  const r = raw as Record<string, unknown>;
  const num = (key: keyof Mechanics) => {
    const v = r[key];
    return typeof v === "number" && Number.isFinite(v) ? v : DEFAULT_MECHANICS[key];
  };
  return {
    hit: num("hit"),
    tiebreak: num("tiebreak"),
    tiebreakMargin: num("tiebreakMargin"),
    early: num("early"),
    earlyHours: num("earlyHours"),
    streak3: num("streak3"),
    streak6: num("streak6"),
    checkinMult: num("checkinMult"),
    promoMult: num("promoMult"),
  };
};

export type ProgramStatus = "draft" | "live" | "paused" | "closed";

export interface Program {
  campaignId: string;
  slug: string;
  name: string;
  status: ProgramStatus;
  orgName: string;
  orgSlug: string;
  theme: OrgTheme;
  /** IANA zone. Ciudad Juárez is Mountain, synced to El Paso — not Central
      like the rest of Chihuahua. Read from `campaigns.config`, because the
      league's calendar is shared and the clock it is read in is not. */
  timezone: string;
  /**
   * Whether a draft programme accepts writes so the client can rehearse it.
   * `campaigns.config.rehearsal = 'anyone'`. See `acceptsPicks`.
   */
  rehearsal: boolean;
  seasonId: string;
  seasonYear: number;
  totalWeeks: number;
  openWeek: number;
  mechanics: Mechanics;
  /** Weeks the tenant marked double. */
  promoWeeks: number[];
  venues: string[];
}

/**
 * The scoring breakdown, exactly as `pickem_score_entry` builds it.
 *
 * Rendered, never recomputed. There is one scorer and it is in SQL — a second
 * implementation here would exist only to show a preview, and two versions of
 * a scoring rule drift silently until somebody's ranking is wrong in a way
 * nobody can reproduce.
 */
export interface Breakdown {
  hits: number;
  of: number;
  base: number;
  tiebreakBonus: number;
  earlyBonus: number;
  streak: number;
  streakBonus: number;
  checkedIn: boolean;
  promo: boolean;
  mult: number;
  subtotal: number;
  points: number;
}

export interface LeaderboardRow {
  rank: number;
  alias: string;
  venue: string | null;
  points: number;
  participantId: string;
}

// Who is calling, and what may they do. SERVER ONLY.
//
// Reaches for next/headers through lib/supabase/route, so it cannot be bundled
// for the browser — the same boundary lib/tickets/access.ts keeps, and the
// build rejects crossing it, which is the right rejection.
//
// Two independent facts, deliberately kept apart:
//   authentication — Supabase verified this anonymous session's JWT
//   authorization  — a device row ties that session to a verified player
//
// Having a session grants nothing at all. In this module a session is created
// by simply opening the page; it becomes a player only after a code sent to a
// phone comes back.

import { currentUser } from "@/lib/supabase/route";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface PlayerContext {
  authUserId: string;
  participantId: string;
  alias: string;
  /** Null until the number answered. Nothing may be played before it is set. */
  phoneVerifiedAt: string | null;
}

/**
 * The player this device belongs to, if any.
 *
 * Resolved through `participant_devices` rather than `participants.auth_user_id`
 * because one player may hold the identity on a phone and a tablet at once —
 * see 0021. The `participants` column names only the device that created the
 * row, which after a phone change is not the device asking.
 */
export const resolvePlayer = async (
  campaignId: string,
): Promise<PlayerContext | null> => {
  const user = await currentUser();
  if (!user) return null;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("participant_devices")
    .select("participant_id, participants(alias, phone_verified_at)")
    .eq("campaign_id", campaignId)
    .eq("auth_user_id", user.id)
    .maybeSingle<{
      participant_id: string;
      participants: { alias: string | null; phone_verified_at: string | null } | null;
    }>();

  if (error) {
    console.error("[pickem] player lookup failed", error);
    return null;
  }
  if (!data?.participants) return null;

  return {
    authUserId: user.id,
    participantId: data.participant_id,
    alias: data.participants.alias ?? "Jugador",
    phoneVerifiedAt: data.participants.phone_verified_at,
  };
};

/** A device that proved its number. The only thing allowed to play. */
export const isVerified = (player: PlayerContext | null): boolean =>
  player !== null && player.phoneVerifiedAt !== null;

// ---------------------------------------------------------------------------
// What the player already did this week
// ---------------------------------------------------------------------------

export interface EntryState {
  entryId: string;
  /** game id → 'away' | 'home' */
  picks: Record<string, "away" | "home">;
  tiebreak: number | null;
  submittedAt: string;
  settledAt: string | null;
  hits: number | null;
  points: number | null;
  /** The stored breakdown of a settled week, exactly as the scorer wrote it. */
  breakdown: unknown;
  venue: string | null;
}

export const getEntry = async (
  campaignId: string,
  participantId: string,
  week: number,
): Promise<EntryState | null> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("pickem_entries")
    .select(
      "id, tiebreak, submitted_at, settled_at, hits, points, breakdown, venue, pickem_picks(game_id, choice)",
    )
    .eq("campaign_id", campaignId)
    .eq("participant_id", participantId)
    .eq("week", week)
    .maybeSingle<{
      id: string;
      tiebreak: number | null;
      submitted_at: string;
      settled_at: string | null;
      hits: number | null;
      points: number | null;
      breakdown: unknown;
      venue: string | null;
      pickem_picks: { game_id: string; choice: "away" | "home" }[] | null;
    }>();

  if (error) {
    console.error("[pickem] entry lookup failed", error);
    return null;
  }
  if (!data) return null;

  const picks: Record<string, "away" | "home"> = {};
  for (const p of data.pickem_picks ?? []) picks[p.game_id] = p.choice;

  return {
    entryId: data.id,
    picks,
    tiebreak: data.tiebreak,
    submittedAt: data.submitted_at,
    settledAt: data.settled_at,
    hits: data.hits,
    points: data.points,
    breakdown: data.breakdown,
    venue: data.venue,
  };
};

/**
 * Season total: the SUM of the ledger, never a stored column.
 *
 * `currency = 'points'` is the legal frame rather than a filter — loyalty
 * tokens earned by spending must never reach this number, because a total that
 * consumption can raise is a ranking that money can buy. Same condition as
 * `pickem_leaderboard`, and there is a probe that proves it holds.
 */
export const getSeasonPoints = async (
  campaignId: string,
  participantId: string,
): Promise<number> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("points_entries")
    .select("points")
    .eq("campaign_id", campaignId)
    .eq("participant_id", participantId)
    .eq("currency", "points")
    .returns<{ points: number }[]>();
  if (error || !data) return 0;
  return data.reduce((sum, r) => sum + Number(r.points ?? 0), 0);
};

/** Whether this player has checked in at a branch this week. */
export const getCheckin = async (
  campaignId: string,
  participantId: string,
  week: number,
): Promise<string | null> => {
  const db = supabaseAdmin();
  const { data } = await db
    .from("pickem_checkins")
    .select("venue")
    .eq("campaign_id", campaignId)
    .eq("participant_id", participantId)
    .eq("week", week)
    .maybeSingle<{ venue: string }>();
  return data?.venue ?? null;
};

// ---------------------------------------------------------------------------
// Prizes won
// ---------------------------------------------------------------------------

export interface Award {
  id: string;
  week: number | null;
  place: number;
  /** The bearer token for a physical thing. Never leaves the owner's screen. */
  code: string;
  status: "pending" | "redeemed" | "expired" | "canceled";
  expiresAt: string;
  redeemedAt: string | null;
  redeemedVenue: string | null;
  prizeName: string;
  prizeDetail: string | null;
}

export const getAwards = async (
  campaignId: string,
  participantId: string,
): Promise<Award[]> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("pickem_awards")
    .select(
      "id, week, place, code, status, expires_at, redeemed_at, redeemed_venue, pickem_prizes(name, detail)",
    )
    .eq("campaign_id", campaignId)
    .eq("participant_id", participantId)
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        week: number | null;
        place: number;
        code: string;
        status: Award["status"];
        expires_at: string;
        redeemed_at: string | null;
        redeemed_venue: string | null;
        pickem_prizes: { name: string; detail: string | null } | null;
      }[]
    >();

  if (error) {
    console.error("[pickem] awards lookup failed", error);
    return [];
  }

  return (data ?? []).map((a) => ({
    id: a.id,
    week: a.week,
    place: a.place,
    code: a.code,
    // A pending award past its date is expired in fact whether or not anybody
    // has run the update. Showing it as claimable would send somebody to a
    // counter to be turned away.
    status:
      a.status === "pending" && new Date(a.expires_at).getTime() < Date.now()
        ? "expired"
        : a.status,
    expiresAt: a.expires_at,
    redeemedAt: a.redeemed_at,
    redeemedVenue: a.redeemed_venue,
    prizeName: a.pickem_prizes?.name ?? "Premio",
    prizeDetail: a.pickem_prizes?.detail ?? null,
  }));
};

// ---------------------------------------------------------------------------
// The season, week by week
// ---------------------------------------------------------------------------

export interface SeasonCell {
  week: number;
  played: boolean;
  points: number | null;
  hits: number | null;
}

/**
 * Every jornada of the season for one player: what they scored, or nothing.
 *
 * A week they did not play reads as a dash, never a zero — a zero says "you
 * came last" and that is a different sentence, and a discouraging one to read
 * eighteen times.
 */
export const getSeasonGrid = async (
  campaignId: string,
  participantId: string,
  totalWeeks: number,
): Promise<SeasonCell[]> => {
  const db = supabaseAdmin();
  const { data } = await db
    .from("pickem_entries")
    .select("week, points, hits, settled_at, pickem_picks(game_id)")
    .eq("campaign_id", campaignId)
    .eq("participant_id", participantId)
    .returns<
      { week: number; points: number | null; hits: number | null; settled_at: string | null; pickem_picks: { game_id: string }[] | null }[]
    >();

  const byWeek = new Map((data ?? []).map((e) => [e.week, e]));

  return Array.from({ length: totalWeeks }, (_, i) => {
    const w = i + 1;
    const e = byWeek.get(w);
    return {
      week: w,
      played: (e?.pickem_picks?.length ?? 0) > 0,
      points: e?.settled_at ? (e.points ?? 0) : null,
      hits: e?.settled_at ? (e.hits ?? 0) : null,
    };
  });
};

/**
 * How many consecutive weeks this player has entered, counting back from and
 * including `week` when it has picks.
 *
 * Mirrors the streak loop in `pickem_score_entry`. It is here as well because
 * the mechanics panel has to show the streak BEFORE the week settles, and the
 * scorer refuses to score an unfinished week. The two are pinned together by
 * the settle probe: if this ever disagrees with SQL, the panel is promising a
 * bonus the ledger will not pay.
 */
export const getStreak = async (
  campaignId: string,
  participantId: string,
  week: number,
): Promise<number> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("pickem_entries")
    .select("week, pickem_picks(game_id)")
    .eq("campaign_id", campaignId)
    .eq("participant_id", participantId)
    .lte("week", week)
    .returns<{ week: number; pickem_picks: { game_id: string }[] | null }[]>();

  if (error || !data) return 0;

  const played = new Set(
    data.filter((e) => (e.pickem_picks?.length ?? 0) > 0).map((e) => e.week),
  );

  // Counting back from the current week if it has picks, from the previous one
  // if it does not. Without that distinction the panel tells somebody on a
  // ten-week run that their streak is 0, purely because they have not touched
  // this week yet — which is the first version's bug, and it is discouraging in
  // exactly the wrong direction.
  let probe = played.has(week) ? week : week - 1;
  let streak = 0;
  while (probe >= 1 && played.has(probe)) {
    streak += 1;
    probe -= 1;
  }
  return streak;
};

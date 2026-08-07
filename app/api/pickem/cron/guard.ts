import { NextResponse, type NextRequest } from "next/server";

// ===========================================================================
// WHEN THESE RUN — the note vercel.json cannot carry, because it is JSON
// ===========================================================================
//
// The runbook says Tuesday 6:00, 8:00 and 9:00 AM in Ciudad Juárez. Vercel
// schedules in UTC and Juárez is not a fixed offset: MDT (UTC−6) until 1
// November 2026, MST (UTC−7) after it — week 9 of an eighteen-week season.
// There is no cron expression that is 6:00 AM local all season.
//
// So the schedules are pinned to the EARLIEST local time each one may fire at,
// and the routes are built so the drift does not matter:
//
//   "0 12 * * 2"  →  6:00 AM MDT  ·  5:00 AM MST   schedule re-ingest
//   "0 14 * * 2"  →  8:00 AM MDT  ·  7:00 AM MST   scores
//   "0 15 * * 2"  →  9:00 AM MDT  ·  8:00 AM MST   settle
//
// Earliest rather than latest because the only hard boundary is the one behind
// them — Monday Night ends around 04:30 UTC Tuesday, so 12:00 UTC clears it by
// seven hours either way — while the boundary ahead is the deck's promise of
// prizes on Tuesday, and an hour early keeps that promise better than an hour
// late. The order and the spacing survive the change: an hour between scores
// and settle, in every part of the season.
//
// Every route is idempotent and checks state before acting, which is what makes
// that acceptable. Firing at 5:00 AM instead of 6:00, twice, or on the wrong
// Tuesday changes nothing: the ingest never blanks what it cannot see, and the
// settle refuses a week whose scores are not all in.

/**
 * The gate on every pick'em cron route.
 *
 * Same shape as `app/api/tickets/cron/sweep-orphans/route.ts`, on purpose: one
 * secret, one header, and a refusal rather than an open endpoint when the
 * variable is missing. These routes credit points and hand out prizes — an
 * unauthenticated settle is somebody else deciding who won.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on scheduled invocations
 * once the variable exists in the project. Until it does, every route here
 * answers 503 and the cron shows up as failing, which is the loud version of
 * "we forgot to set the env var".
 *
 * Returns null when the caller is allowed through.
 */
export const denyCron = (req: NextRequest, tag: string): NextResponse | null => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(`[${tag}] CRON_SECRET is not set — refusing to run`);
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
};

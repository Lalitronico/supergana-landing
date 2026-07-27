import { NextResponse, type NextRequest } from "next/server";
import { sweepOrphanReceipts, ORPHAN_GRACE_HOURS } from "@/lib/tickets/sweep";

export const runtime = "nodejs";
// Deleting files is not something a cache may decide to skip or repeat.
export const dynamic = "force-dynamic";

/**
 * Scheduled removal of receipt images that never became receipts.
 *
 * Authorised by `CRON_SECRET`, checked against Vercel's own `Authorization:
 * Bearer` header. Without the variable set the route refuses outright rather
 * than running open: an unauthenticated endpoint that deletes storage is worse
 * than no cleanup at all, and "we forgot to set the env var" is exactly how
 * that happens.
 *
 * `?dryRun=1` reports what it would delete and touches nothing.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[tickets sweep] CRON_SECRET is not set — refusing to run");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const startedAt = Date.now();
  const result = await sweepOrphanReceipts({ dryRun });

  // Logged whatever happens: this runs unattended, so the log is the only
  // account of it. A sweep that suddenly deletes hundreds is a signal about
  // something upstream, not a success.
  console.log("[tickets sweep]", JSON.stringify({
    dryRun, graceHours: ORPHAN_GRACE_HOURS, ms: Date.now() - startedAt, ...result,
  }));

  return NextResponse.json({
    dryRun,
    graceHours: ORPHAN_GRACE_HOURS,
    ...result,
  }, { status: result.errors.length ? 207 : 200 });
}

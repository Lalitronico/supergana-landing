import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { listOperablePrograms, settleProgram, type SettleOutcome } from "@/lib/pickem/settle";
import { leaderboardTags } from "@/lib/pickem/program";
import { denyCron } from "../guard";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Tuesday, 9:00 AM Juárez — the close.
 *
 * The critical operation of the week and the one the deck sold: picks Wednesday,
 * games Sunday, ranking Monday, prizes Tuesday. All of the work is inside
 * `pickem_settle_week` (0026), in one transaction — count the hits, credit the
 * ledger, award first place, advance the open week. This route only decides
 * which programmes to call it for and how to read the answer.
 *
 * Three things it deliberately does NOT treat as failures:
 *
 *  · **Missing scores.** The RPC refuses the week and so does the pre-check
 *    here. A partial close hands out the wrong prizes and that does not undo
 *    cleanly. The response says how many are missing; the following Tuesday
 *    reads the same week again because `open_week` never moved.
 *  · **A tie at the top.** The RPC settles the week, credits everybody, and
 *    awards nobody. Who takes the prize when the tiebreak did not separate two
 *    players is a decision with a person's name on it — a supervisor's call in
 *    the panel, not a silent `limit 1`. The cron reports it and moves on.
 *  · **Running twice.** The ledger's unique index refuses a second credit, the
 *    `(campaign, week, place)` key refuses a second award, and `open_week` only
 *    advances while it still equals the week being closed. A repeat settles
 *    nothing and says so.
 *
 * The cron is never the only way in. Over eighteen weeks ESPN will fail, a game
 * will be postponed, and a score will be captured wrong and need correcting
 * after the close — that last one through a new `adjustment` entry in the
 * ledger, never by editing the original. All of it belongs to the staff panel.
 */
export async function GET(req: NextRequest) {
  const denied = denyCron(req, "pickem settle");
  if (denied) return denied;

  const startedAt = Date.now();

  let programs;
  try {
    programs = await listOperablePrograms();
  } catch (e) {
    console.error("[pickem settle] program lookup failed", e);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const results: SettleOutcome[] = [];
  for (const program of programs) {
    try {
      const outcome = await settleProgram(program);
      results.push(outcome);
      if (outcome.status === "settled") {
        // The base tag reaches every cached board for the slug — the closed
        // week's and the season total, which both just changed. "max" serves
        // the stale board once while the fresh one loads; the 60 s window on
        // the cache already tolerates that.
        for (const tag of leaderboardTags(program.slug, outcome.week)) revalidateTag(tag, "max");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({
        slug: program.slug,
        week: program.openWeek,
        status: "error",
        reason: message,
      });
    }
  }

  const failed = results.filter((r) => r.status === "error");
  // Settled but nobody could be awarded. Not an error and not silence either:
  // a person has to open the panel and decide before the winner is told.
  const needsSupervisor = results.filter((r) => r.tiedAtTop).map((r) => `${r.slug} J${r.week}`);

  console.log("[pickem settle]", JSON.stringify({
    ms: Date.now() - startedAt,
    programs: programs.length,
    results,
    needsSupervisor,
  }));

  return NextResponse.json(
    { programs: programs.length, results, needsSupervisor },
    { status: failed.length ? 207 : 200 },
  );
}

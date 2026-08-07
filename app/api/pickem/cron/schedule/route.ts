import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ingestWeeks, weeksAround, type IngestReport } from "@/lib/pickem/ingest";
import { listOperablePrograms } from "@/lib/pickem/settle";
import { denyCron } from "../guard";

export const runtime = "nodejs";
// Three ESPN round trips per season plus the writes. Well inside the limit, but
// stated rather than inherited: a schedule that silently timed out halfway would
// leave week 18 on its placeholder kickoff and nobody would know.
export const maxDuration = 60;
// Reading a live sports API is never something a cache may answer for.
export const dynamic = "force-dynamic";

/**
 * Tuesday, 6:00 AM Juárez — the calendar of the weeks about to be played.
 *
 * The re-ingest is not a nicety. Two facts about a real NFL season make it
 * required:
 *
 *  · **Weeks 16-18 arrive with no broadcast assigned**, and the league fills
 *    them in over the following months. Without a re-read the screens say
 *    "cadena por definir" for the rest of the season.
 *  · **Week 18 arrives with all sixteen games on one placeholder kickoff.** The
 *    league does not set those times until week 17 has been played. A week whose
 *    lock is a placeholder is a week that closes picks at a time that was never
 *    real, and `lockOf` reads the first kickoff — so this is the difference
 *    between the last jornada working and the last jornada being a complaint.
 *
 * Runs the window `weeksAround` picks: the open week — which on Tuesday morning
 * is still the one that just finished, because the settle has not run yet — and
 * the two after it. Seasons are pulled once even when two tenants share one.
 *
 * Safe at any hour and safe to repeat. It never blanks a value it cannot see
 * and never moves a game that already has a score, so the hour of UTC it fires
 * at — which drifts against Juárez when daylight saving ends on 1 November —
 * changes nothing about the outcome.
 */
export async function GET(req: NextRequest) {
  const denied = denyCron(req, "pickem schedule");
  if (denied) return denied;

  const startedAt = Date.now();

  let programs;
  try {
    programs = await listOperablePrograms();
  } catch (e) {
    console.error("[pickem schedule] program lookup failed", e);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // One season may serve several tenants — that is the whole reason
  // `sport_seasons` sits outside `campaigns`. Pull it once, over the union of
  // the windows its programmes need.
  const bySeason = new Map<string, { year: number; weeks: Set<number>; slugs: string[] }>();
  for (const p of programs) {
    const entry = bySeason.get(p.seasonId) ?? { year: p.seasonYear, weeks: new Set<number>(), slugs: [] };
    for (const w of weeksAround(p.openWeek, p.totalWeeks)) entry.weeks.add(w);
    entry.slugs.push(p.slug);
    bySeason.set(p.seasonId, entry);
  }

  const db = supabaseAdmin();
  const reports: (IngestReport & { slugs: string[] })[] = [];
  const errors: string[] = [];

  for (const [seasonId, entry] of bySeason) {
    if (!entry.year) {
      errors.push(`${seasonId}: temporada sin año, no se ingesta`);
      continue;
    }
    try {
      const report = await ingestWeeks(db, {
        seasonId,
        year: entry.year,
        weeks: [...entry.weeks].sort((a, b) => a - b),
      });
      errors.push(...report.errors);
      reports.push({ ...report, slugs: entry.slugs });
    } catch (e) {
      // ESPN being down is the expected failure. It is loud in the log and a
      // 207 in the response, and the next Tuesday fixes it — nothing was half
      // written, because `ingestWeeks` validates before it writes.
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`${seasonId}: ${message}`);
    }
  }

  // This runs unattended, so the log is the only account of it. Placeholder
  // weeks in particular: seeing week 18 leave that list is how anybody knows
  // the last jornada finally has real kickoffs.
  console.log("[pickem schedule]", JSON.stringify({
    ms: Date.now() - startedAt,
    programs: programs.length,
    seasons: reports.length,
    reports,
    errors,
  }));

  return NextResponse.json(
    { programs: programs.length, seasons: reports, errors },
    { status: errors.length ? 207 : 200 },
  );
}

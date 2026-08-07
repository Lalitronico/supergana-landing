import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ingestWeeks, type IngestReport } from "@/lib/pickem/ingest";
import { listOperablePrograms } from "@/lib/pickem/settle";
import { denyCron } from "../guard";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Tuesday, 8:00 AM Juárez — the final scores of the week that just ended.
 *
 * Once a week, not live. The demo simulated scores ticking over on Sunday and
 * that is theatre: what the business needs is that the ranking is published and
 * correct on Tuesday. A live feed adds a dependency that can fail on Sunday
 * afternoon with the customers at the table looking at the screen.
 *
 * The week read is the programme's OPEN week, which is still the finished one
 * at this hour — the settle runs an hour later and is what advances it. That
 * also makes the route self-healing: if a settle is blocked for a week, the
 * open week does not move, and the following Tuesday reads the same week again.
 *
 * Scores-only. It never inserts a game and never writes a null: a game not yet
 * played is skipped, and a game already scored here but unscored at ESPN is
 * left alone. So firing this before the games are over, or five times in a row,
 * costs three HTTP requests and changes nothing.
 */
export async function GET(req: NextRequest) {
  const denied = denyCron(req, "pickem scores");
  if (denied) return denied;

  const startedAt = Date.now();

  let programs;
  try {
    programs = await listOperablePrograms();
  } catch (e) {
    console.error("[pickem scores] program lookup failed", e);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Keyed by season and week: two tenants on the same season and the same open
  // week are one read of ESPN, not two.
  const wanted = new Map<string, { seasonId: string; year: number; week: number; slugs: string[] }>();
  for (const p of programs) {
    if (p.openWeek > p.totalWeeks) continue; // season over, nothing left to score
    const key = `${p.seasonId}|${p.openWeek}`;
    const entry = wanted.get(key) ?? {
      seasonId: p.seasonId,
      year: p.seasonYear,
      week: p.openWeek,
      slugs: [],
    };
    entry.slugs.push(p.slug);
    wanted.set(key, entry);
  }

  const db = supabaseAdmin();
  const reports: (IngestReport & { slugs: string[] })[] = [];
  const errors: string[] = [];

  for (const entry of wanted.values()) {
    if (!entry.year) {
      errors.push(`${entry.seasonId}: temporada sin año, no se ingesta`);
      continue;
    }
    try {
      const report = await ingestWeeks(db, {
        seasonId: entry.seasonId,
        year: entry.year,
        weeks: [entry.week],
        scoresOnly: true,
      });
      errors.push(...report.errors);
      reports.push({ ...report, slugs: entry.slugs });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`${entry.seasonId} jornada ${entry.week}: ${message}`);
    }
  }

  console.log("[pickem scores]", JSON.stringify({
    ms: Date.now() - startedAt,
    programs: programs.length,
    reports,
    errors,
  }));

  return NextResponse.json(
    { programs: programs.length, weeks: reports, errors },
    { status: errors.length ? 207 : 200 },
  );
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseRoute } from "@/lib/supabase/route";
import { acceptsPicks, getProgram, isVisible } from "@/lib/pickem/program";

export const runtime = "nodejs";

/**
 * Checking in at a branch.
 *
 * The mechanic that fills the dining room, and the one that has to stay clean:
 * it doubles the week's score and requires spending nothing. Scanning the QR on
 * the table is free, and the screen that leads here says so.
 *
 * That is not politeness. If money could raise a leaderboard position, then
 * spending more would improve the odds of winning a prize, and the programme
 * stops being a contest and becomes a private lottery. Presence is allowed to
 * pay; consumption is not. See the table comment in 0022.
 *
 * Every rule — the window, the one-per-week limit, whether the branch exists —
 * is inside `pickem_checkin`, called with the caller's own session.
 */

const bodySchema = z.object({
  week: z.number().int().min(1).max(30),
  venue: z.string().trim().min(1).max(80),
});

const STATUS: Record<string, number> = {
  campaign_not_found: 404,
  not_a_participant: 403,
  not_verified: 403,
  unknown_venue: 400,
  outside_window: 409,
  already_checked_in: 409,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ programa: string }> },
) {
  const { programa } = await params;
  const program = await getProgram(programa);
  if (!program || !isVisible(program)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!acceptsPicks(program)) {
    return NextResponse.json({ error: "not_live" }, { status: 409 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const supabase = await supabaseRoute();
  const { data, error } = await supabase.rpc("pickem_checkin", {
    p_campaign_slug: program.slug,
    p_week: parsed.data.week,
    p_venue: parsed.data.venue,
  });

  if (error) {
    const code = error.message?.trim();
    const status = STATUS[code] ?? 500;
    if (status === 500) console.error("[pickem checkin] rpc failed", error);
    return NextResponse.json({ error: status === 500 ? "db_error" : code }, { status });
  }

  return NextResponse.json({ ok: true, ...(data as object) });
}

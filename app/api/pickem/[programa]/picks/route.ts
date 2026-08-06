import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseRoute } from "@/lib/supabase/route";
import { acceptsPicks, getProgram, isVisible } from "@/lib/pickem/program";

export const runtime = "nodejs";

/**
 * Saving a week's picks.
 *
 * Thin on purpose. Every rule that decides whether these picks count — is the
 * number verified, is this the open week, has the first kickoff passed, is the
 * set of games complete — lives inside `pickem_save_picks`, under the row lock,
 * in the same transaction that writes them. This route authenticates the
 * caller and translates error codes; it does not get a vote.
 *
 * Called with the COOKIE-BOUND client, not the service role. That is the whole
 * authorization model: the RPC resolves the player from `auth.uid()`, so no
 * argument here says whose picks to write, and a forged body cannot name
 * somebody else.
 */

const bodySchema = z.object({
  week: z.number().int().min(1).max(30),
  // game id → side. Validated as UUIDs here so a malformed key fails with a
  // 400 rather than a Postgres cast error the UI cannot read.
  picks: z.record(z.uuid(), z.enum(["away", "home"])),
  tiebreak: z.number().int().min(0).max(200).nullable().optional(),
});

/** RPC error codes → HTTP. Anything unlisted is a bug, and 500 says so. */
const STATUS: Record<string, number> = {
  campaign_not_found: 404,
  not_a_participant: 403,
  not_verified: 403,
  week_not_open: 409,
  week_locked: 409,
  incomplete_picks: 400,
  unknown_game: 400,
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

  // A draft programme renders so the client can walk through it, and refuses
  // writes. Letting picks land in a programme nobody has launched would mean a
  // week 1 leaderboard built from rehearsals.
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
  const { data, error } = await supabase.rpc("pickem_save_picks", {
    p_campaign_slug: program.slug,
    p_week: parsed.data.week,
    p_picks: parsed.data.picks,
    p_tiebreak: parsed.data.tiebreak ?? null,
  });

  if (error) {
    const code = error.message?.trim();
    const status = STATUS[code] ?? 500;
    if (status === 500) console.error("[pickem picks] rpc failed", error);
    return NextResponse.json({ error: status === 500 ? "db_error" : code }, { status });
  }

  return NextResponse.json({ ok: true, ...(data as object) });
}

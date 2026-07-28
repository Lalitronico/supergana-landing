import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveParticipant } from "@/lib/tickets/access";
import { getCampaign, isVisible } from "@/lib/tickets/campaigns";

export const runtime = "nodejs";

/**
 * The leaderboard: the one legitimate exception to "you only see your own
 * rows", built as a narrow aggregate rather than a wider read policy. The
 * browser receives alias and points — never names, emails, receipts or
 * reward amounts — and the aggregation happens here with the service role,
 * so no client-side policy needs loosening.
 *
 * Ranking is pure accumulation. Whatever prizes hang off these positions
 * must stay chance-free; a drawing fed by this ranking is the one shape the
 * legal frame forbids.
 */

const TOP = 10;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ campana: string }> },
) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign || !isVisible(campaign)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Participants only: the board shows other people's aliases, and that is
  // for people inside the campaign, not for anonymous crawlers.
  const ctx = await resolveParticipant(campaign.id);
  if (!ctx) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: entries, error } = await db
    .from("points_entries")
    .select("participant_id, points, participants(alias, first_name, last_name)")
    .eq("campaign_id", campaign.id);

  if (error) {
    console.error("[tickets leaderboard] read failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  interface Row {
    participant_id: string;
    points: number;
    participants: { alias: string | null; first_name: string; last_name: string } | null;
  }

  // Aggregated in memory: fine at campaign scale (hundreds of entries). If a
  // campaign ever outgrows this, the fix is a SQL view — not a wider policy.
  const totals = new Map<string, { points: number; display: string }>();
  for (const raw of (entries ?? []) as unknown as Row[]) {
    const current = totals.get(raw.participant_id);
    // Alias is what people chose to show. Profiles that predate the field
    // fall back to first name + last initial, never the full name.
    const display =
      raw.participants?.alias ??
      `${raw.participants?.first_name ?? "—"} ${(raw.participants?.last_name ?? "").slice(0, 1)}.`;
    totals.set(raw.participant_id, {
      points: (current?.points ?? 0) + raw.points,
      display,
    });
  }

  const ranked = [...totals.entries()]
    .map(([participantId, v]) => ({ participantId, ...v }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points);

  const meId = ctx.participant?.id ?? null;
  const myIndex = meId ? ranked.findIndex((r) => r.participantId === meId) : -1;

  return NextResponse.json({
    top: ranked.slice(0, TOP).map((r, i) => ({
      rank: i + 1,
      alias: r.display,
      points: r.points,
      isMe: r.participantId === meId,
    })),
    me: myIndex >= 0 ? { rank: myIndex + 1, points: ranked[myIndex].points } : null,
    totalRanked: ranked.length,
  });
}

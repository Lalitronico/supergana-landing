import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabase/server";
import { computePrizePool } from "@/lib/mundial/config";

export const runtime = "nodejs";
// Public transparency numbers; refreshed at most once per minute.
export const revalidate = 60;

export async function GET() {
  if (!supabaseAdminConfigured()) {
    // Pre-launch / local without keys: show the zero state instead of erroring.
    return NextResponse.json({ ...computePrizePool(0), entries: 0, winners: [] });
  }

  const db = supabaseAdmin();
  const [tickets, entries, winners] = await Promise.all([
    db
      .from("mundial_tickets")
      .select("amount_usd", { count: "exact" })
      .eq("status", "paid"),
    db.from("mundial_entries").select("id", { count: "exact", head: true }),
    db
      .from("mundial_winners")
      .select("stage, payload, prize_usd, updated_at")
      .eq("published", true),
  ]);

  if (tickets.error) {
    console.error("[mundial stats] tickets query failed", tickets.error);
    return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }

  const totalUsd = (tickets.data ?? []).reduce(
    (sum, t) => sum + Number(t.amount_usd ?? 0),
    0,
  );

  return NextResponse.json({
    ...computePrizePool(tickets.count ?? 0, totalUsd),
    entries: entries.count ?? 0,
    winners: winners.data ?? [],
  });
}

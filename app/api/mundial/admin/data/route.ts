import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/mundial/adminAuth";
import { computePrizePool } from "@/lib/mundial/config";

export const runtime = "nodejs";

// Full campaign snapshot for the admin panel: tickets joined with their
// entry (if any), current results and winner computations.
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const [tickets, entries, results, winners] = await Promise.all([
    db.from("mundial_tickets").select("*").order("created_at", { ascending: false }),
    db.from("mundial_entries").select("*").order("created_at", { ascending: true }),
    db.from("mundial_results").select("*").maybeSingle(),
    db.from("mundial_winners").select("*"),
  ]);

  const firstError = tickets.error ?? entries.error ?? results.error ?? winners.error;
  if (firstError) {
    console.error("[mundial admin data] query failed", firstError);
    return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }

  const paid = (tickets.data ?? []).filter((t) => t.status === "paid");
  const totalUsd = paid.reduce((sum, t) => sum + Number(t.amount_usd ?? 0), 0);

  return NextResponse.json({
    tickets: tickets.data ?? [],
    entries: entries.data ?? [],
    results: results.data ?? null,
    winners: winners.data ?? [],
    pool: computePrizePool(paid.length, totalUsd),
  });
}

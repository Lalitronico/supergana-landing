import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { eligibleStages } from "@/lib/mundial/config";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Gate check for the form: is this ticket real, paid and unused?
export async function GET(req: NextRequest) {
  const ticketId = req.nextUrl.searchParams.get("ticket");
  if (!ticketId || !UUID_RE.test(ticketId)) {
    return NextResponse.json({ error: "Boleto inválido" }, { status: 400 });
  }

  const { data: ticket, error } = await supabaseAdmin()
    .from("mundial_tickets")
    .select("id, email, status, used_at")
    .eq("id", ticketId)
    .maybeSingle();

  if (error) {
    console.error("[mundial ticket] lookup failed", error);
    return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }
  if (!ticket || ticket.status !== "paid") {
    return NextResponse.json({ error: "Boleto no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    ticket: ticket.id,
    email: ticket.email,
    used: Boolean(ticket.used_at),
    eligibleStages: eligibleStages(new Date()),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCheckoutSession, stripeConfigured } from "@/lib/mundial/stripe";
import { isOurPaymentLink } from "@/lib/mundial/config";

export const runtime = "nodejs";

// Called by /mundial/quiniela when the user lands from the Stripe Payment
// Link redirect (?session_id=...). Confirms payment with Stripe and returns
// the ticket token, creating the ticket if the webhook hasn't run yet.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId || !/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
    return NextResponse.json({ error: "session_id inválido" }, { status: 400 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe no configurado" }, { status: 503 });
  }

  const session = await getCheckoutSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Sesión de pago no encontrada" }, { status: 404 });
  }
  // Shared Stripe account: only sessions from the quiniela Payment Link grant access.
  if (!isOurPaymentLink(session.paymentLink)) {
    return NextResponse.json({ error: "Este pago no corresponde a la quiniela" }, { status: 403 });
  }
  if (session.paymentStatus !== "paid") {
    return NextResponse.json({ error: "El pago aún no se confirma" }, { status: 402 });
  }

  const db = supabaseAdmin();
  const { error: upsertError } = await db.from("mundial_tickets").upsert(
    {
      email: session.email,
      source: "stripe",
      stripe_session_id: session.id,
      stripe_payment_intent: session.paymentIntent,
      amount_usd:
        session.currency === "usd" && session.amountTotal != null
          ? session.amountTotal / 100
          : 100,
    },
    { onConflict: "stripe_session_id", ignoreDuplicates: true },
  );
  if (upsertError) {
    console.error("[mundial verify] upsert failed", upsertError);
    return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }

  const { data: ticket, error } = await db
    .from("mundial_tickets")
    .select("id, used_at, status")
    .eq("stripe_session_id", session.id)
    .single();

  if (error || !ticket) {
    return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }

  return NextResponse.json({
    ticket: ticket.id,
    used: Boolean(ticket.used_at),
    email: session.email,
  });
}

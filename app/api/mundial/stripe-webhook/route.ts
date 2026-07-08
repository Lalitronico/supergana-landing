import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyWebhookEvent } from "@/lib/mundial/stripe";
import { isOurPaymentLink } from "@/lib/mundial/config";
import { sendTicketEmail } from "@/lib/mundial/email";

export const runtime = "nodejs";

// Stripe calls this on checkout.session.completed (Payment Link purchases).
// It is the source of truth for ticket creation; /api/mundial/verify covers
// the redirect race where the user lands on the form before the webhook runs.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const event = verifyWebhookEvent(rawBody, req.headers.get("stripe-signature"));
  if (!event) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as {
    id: string;
    payment_status?: string;
    payment_link?: string | { id: string } | null;
    customer_details?: { email?: string | null };
    customer_email?: string | null;
    amount_total?: number | null;
    currency?: string | null;
    payment_intent?: string | { id: string } | null;
  };

  // The Stripe account is shared with other products; only mint tickets for
  // sessions created from the quiniela Payment Link. Ignore everyone else's.
  const paymentLinkId =
    typeof session.payment_link === "string"
      ? session.payment_link
      : (session.payment_link?.id ?? null);
  if (!isOurPaymentLink(paymentLinkId)) {
    return NextResponse.json({ received: true, ignored: "other payment link" });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const email = session.customer_details?.email ?? session.customer_email ?? null;
  const db = supabaseAdmin();

  // Idempotent per session: retries and the verify endpoint never duplicate tickets.
  const { error: insertError } = await db
    .from("mundial_tickets")
    .upsert(
      {
        email,
        source: "stripe",
        stripe_session_id: session.id,
        stripe_payment_intent:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
        amount_usd:
          session.currency === "usd" && session.amount_total != null
            ? session.amount_total / 100
            : 100,
      },
      { onConflict: "stripe_session_id", ignoreDuplicates: true },
    );

  if (insertError) {
    console.error("[mundial webhook] ticket insert failed", insertError);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  const { data: ticket } = await db
    .from("mundial_tickets")
    .select("id, email, used_at")
    .eq("stripe_session_id", session.id)
    .single();

  if (ticket && email && !ticket.used_at) {
    await sendTicketEmail(email, ticket.id);
  }

  return NextResponse.json({ received: true });
}

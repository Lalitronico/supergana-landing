// Minimal Stripe helpers using fetch + node:crypto — the campaign only needs
// to read Checkout Sessions (Payment Link flow) and verify webhook signatures,
// so we skip the full stripe SDK.

import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";

export interface CheckoutSessionSummary {
  id: string;
  paymentStatus: string; // "paid" | "unpaid" | "no_payment_required"
  email: string | null;
  amountTotal: number | null; // cents
  currency: string | null;
  paymentIntent: string | null;
  paymentLink: string | null; // plink_... this session was created from, if any
}

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

export async function getCheckoutSession(
  sessionId: string,
): Promise<CheckoutSessionSummary | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY.");

  const res = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Stripe session lookup failed (${res.status}): ${await res.text()}`);
  }

  const session = await res.json();
  return {
    id: session.id,
    paymentStatus: session.payment_status,
    email: session.customer_details?.email ?? session.customer_email ?? null,
    amountTotal: session.amount_total ?? null,
    currency: session.currency ?? null,
    paymentIntent:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
    paymentLink:
      typeof session.payment_link === "string"
        ? session.payment_link
        : (session.payment_link?.id ?? null),
  };
}

/**
 * Verifies a Stripe webhook signature (Stripe-Signature header, scheme v1):
 * HMAC-SHA256 over `${timestamp}.${rawBody}` with the endpoint signing secret.
 * Returns the parsed event on success, null on any mismatch.
 */
export function verifyWebhookEvent(
  rawBody: string,
  signatureHeader: string | null,
  toleranceSeconds = 300,
): { type: string; data: { object: Record<string, unknown> } } | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return null;

  const parts = new Map(
    signatureHeader.split(",").map((kv) => {
      const [k, ...rest] = kv.split("=");
      return [k.trim(), rest.join("=")] as const;
    }),
  );
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return null;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return null;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

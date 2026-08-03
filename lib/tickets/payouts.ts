// Reward delivery, behind an interface.
//
// The brief is explicit that the vendor must be replaceable behind an internal
// interface, and the same reasoning applies to payouts: Supergana owns the
// ledger, the budget and the audit trail; the provider only moves the money.
//
// v1 ships `manual` only, by decision on 2026-07-24 — the pilot is operable by
// hand the moment the review queue works, and Tremendous cannot be integrated
// honestly before there is an account whose gift-card catalogue we can check
// (the pitch promises supermarket gift cards, an anti-arbitrage choice that
// depends on what the catalogue actually offers).
//
// Adding Tremendous later means writing one adapter and flipping
// `campaigns.config.payout_provider`. Nothing else in the module changes.
// What that adapter must honour:
//   • POST /orders with the reward's `external_id` as the order external_id —
//     Tremendous treats it as idempotent, so a retry cannot double-pay.
//   • never create an order before the receipt reached status `approved`.
//   • store the returned order id in `rewards.provider_ref`.

import type { PayoutProvider } from "./config";
import type { RewardStatusValue } from "./schema";

export interface PayoutRequest {
  /** The reward's `external_id`. The provider's idempotency key. Never reuse it. */
  externalId: string;
  amountCents: number;
  recipientEmail: string;
  recipientName: string;
  campaignName: string;
  locale: "es" | "en";
}

export interface PayoutResult {
  status: RewardStatusValue;
  providerRef: string | null;
  /** Shown to the operator in the console; not sent to the participant. */
  note: string | null;
}

export interface PayoutAdapter {
  readonly name: PayoutProvider;
  /** True when the adapter can actually reach its provider right now. */
  readonly configured: boolean;
  /**
   * Must be safe to call twice with the same `externalId`. Implementations that
   * cannot guarantee that do not belong here.
   */
  createOrder(request: PayoutRequest): Promise<PayoutResult>;
}

/**
 * Records intent and stops. A human sends the reward and marks the result in
 * the console — which is the whole of v1 delivery, and is exactly what the
 * ledger's state machine already models.
 */
const manualAdapter: PayoutAdapter = {
  name: "manual",
  configured: true,
  async createOrder(request) {
    return {
      status: "queued",
      providerRef: null,
      note: `Entrega manual pendiente · ${(request.amountCents / 100).toFixed(2)} USD → ${request.recipientEmail}`,
    };
  },
};

export const getPayoutAdapter = (provider: PayoutProvider): PayoutAdapter => {
  if (provider === "tremendous") {
    // Deliberately not a silent fallback with a shrug: a campaign configured
    // for Tremendous that quietly queues everything by hand would look like it
    // was paying people when it was not.
    console.warn(
      "[tickets payouts] provider 'tremendous' is configured but no adapter is implemented; falling back to manual delivery.",
    );
  }
  return manualAdapter;
};

/** Legal delivery-state transitions. The console never offers an illegal one. */
export const PAYOUT_TRANSITIONS: Record<RewardStatusValue, RewardStatusValue[]> = {
  reserved: ["queued", "sent", "canceled"],
  queued: ["sent", "failed", "canceled"],
  sent: ["delivered", "failed"],
  delivered: [],
  failed: ["queued", "sent", "canceled"],
  canceled: [],
};

export const canTransition = (from: RewardStatusValue, to: RewardStatusValue) =>
  PAYOUT_TRANSITIONS[from].includes(to);

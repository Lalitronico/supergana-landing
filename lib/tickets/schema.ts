// Request validation and row shapes for the Carrera de Tickets module.
// Zod 4 top-level validators (z.email, z.uuid), matching lib/mundial/schema.ts.

import { z } from "zod";
import { ACCEPTED_IMAGE_TYPES, RECEIPT_STATUSES, REWARD_STATUSES } from "./config";

// ---------------------------------------------------------------------------
// Participant
// ---------------------------------------------------------------------------

// Both consents are literal `true`: the brief requires age/eligibility and
// rules acceptance to be affirmative acts. Marketing is separate, optional and
// never pre-checked — mixing them is exactly what regulators look for.
export const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  // The leaderboard shows this and nothing else about the person. Asked for
  // at registration precisely so real names never reach a public ranking.
  alias: z.string().trim().min(2).max(20),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "zip"),
  state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "state")
    .transform((s) => s.toUpperCase()),
  locale: z.enum(["es", "en"]),
  acceptedAgeState: z.literal(true),
  acceptedRules: z.literal(true),
  acceptedMarketing: z.boolean(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

// Password sign-up. 8 is the floor Supabase's leaked-password protection
// assumes; the ceiling only guards against absurd payloads. The email is also
// the reward delivery address, so it gets the strict validator, not a regex.
export const accountSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(8).max(72),
});

export type AccountInput = z.infer<typeof accountSchema>;

// The bytes never pass through the API — the browser uploads straight to
// Supabase Storage and hands us the object key. The server then reads the
// object back to hash it, so a client cannot lie about what it uploaded.
export const receiptSubmitSchema = z.object({
  imagePath: z.string().trim().min(3).max(400),
  contentType: z.enum(ACCEPTED_IMAGE_TYPES),
});

export type ReceiptSubmitInput = z.infer<typeof receiptSubmitSchema>;

// ---------------------------------------------------------------------------
// Console
// ---------------------------------------------------------------------------

export const reviewItemSchema = z.object({
  productId: z.uuid().nullable(),
  aliasMatched: z.string().trim().max(120).nullable(),
  lineText: z.string().trim().min(1).max(200),
  amountCents: z.number().int().min(0).max(10_000_000),
});

export const approveSchema = z.object({
  receiptId: z.uuid(),
  storeName: z.string().trim().min(2).max(160),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
  totalCents: z.number().int().min(0).max(10_000_000),
  eligibleCents: z.number().int().min(0).max(10_000_000),
  items: z.array(reviewItemSchema).max(80),
  note: z.string().trim().max(500).optional(),
});

export type ApproveInput = z.infer<typeof approveSchema>;

export const reviewSchema = z.object({
  receiptId: z.uuid(),
  decision: z.enum(["rejected", "needs_new_image", "in_review"]),
  reason: z.string().trim().max(500).optional(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

// Manual delivery in v1: an operator sends the reward and records what
// happened. `providerRef` is where the gift-card order number goes, so the
// finance export can be reconciled against the provider's own report.
export const payoutSchema = z.object({
  rewardId: z.uuid(),
  status: z.enum(["queued", "sent", "delivered", "failed", "canceled"]),
  providerRef: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});

export type PayoutInput = z.infer<typeof payoutSchema>;

// ---------------------------------------------------------------------------
// Row shapes (service-role reads)
// ---------------------------------------------------------------------------

export type ReceiptStatusValue = (typeof RECEIPT_STATUSES)[number];
export type RewardStatusValue = (typeof REWARD_STATUSES)[number];

export interface ParticipantRow {
  id: string;
  campaign_id: string;
  auth_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  /** Leaderboard display name. Null only on profiles that predate the field. */
  alias: string | null;
  zip: string;
  state: string | null;
  locale: "es" | "en";
  household_key: string;
  /** Set once the address is proven real — the payout gate reads this. */
  email_verified_at: string | null;
  created_at: string;
}

export interface ReceiptRow {
  id: string;
  campaign_id: string;
  participant_id: string;
  status: ReceiptStatusValue;
  image_path: string;
  image_hash: string | null;
  submitted_at: string;
  store_name: string | null;
  purchase_date: string | null;
  total_cents: number | null;
  eligible_cents: number | null;
  reject_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface RewardRow {
  id: string;
  campaign_id: string;
  participant_id: string;
  receipt_id: string;
  amount_cents: number;
  provider: "manual" | "tremendous";
  external_id: string;
  provider_ref: string | null;
  status: RewardStatusValue;
  household_key: string;
  week_start: string;
  note: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface ProductRow {
  id: string;
  brand: string;
  name: string;
  size: string | null;
  active: boolean;
}

export interface ProductWithAliases extends ProductRow {
  aliases: { id: string; retailer: string | null; alias_text: string }[];
}

/** A queue row: receipt joined with who sent it and the risk flags we can see. */
export interface QueueRow {
  receipt: ReceiptRow;
  participant: Pick<
    ParticipantRow,
    "id" | "email" | "first_name" | "last_name" | "zip" | "state" | "household_key"
  >;
  flags: RiskFlag[];
}

/**
 * What v1 can actually observe without OCR or a fraud vendor. Deliberately not
 * dressed up as a risk score: an operator reading four honest signals beats a
 * number nobody can explain to the client.
 */
export interface RiskFlag {
  level: "ok" | "warn" | "bad";
  code:
    | "household_shared"
    | "household_rewarded"
    | "participant_rewarded"
    | "repeat_submitter"
    | "new_account"
    | "duplicate_image"
    | "clean";
  detail: string;
}

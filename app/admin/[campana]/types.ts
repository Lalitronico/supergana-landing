// Shape of GET /api/tickets/[campana]/admin, mirrored on the client.
//
// Hand-written rather than generated: the console is the only consumer, and a
// mismatch here is caught by tsc the moment the route's response changes shape.

import type {
  CampaignConfig,
  CampaignMechanic,
  ReceiptStatus,
  RewardStatus,
} from "@/lib/tickets/config";
import type { RiskFlag } from "@/lib/tickets/schema";
import type { StaffRole } from "@/lib/tickets/roles";
import type { DropStatus, PrizeKind, RedemptionStatus } from "@/lib/tickets/store";

export type { StaffRole, RiskFlag };

export interface AdminReceipt {
  id: string;
  participant_id: string;
  status: ReceiptStatus;
  image_path: string;
  image_hash: string | null;
  submitted_at: string;
  store_name: string | null;
  purchase_date: string | null;
  total_cents: number | null;
  eligible_cents: number | null;
  reject_reason: string | null;
  reviewed_at: string | null;
}

export interface AdminParticipant {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  zip: string | null;
  state: string | null;
  /** E.164. Where the operator sends a top-up, so the console must show it. */
  phone: string | null;
  /** Null when the campaign asks for no ZIP: there is no household without one. */
  householdKey: string | null;
  createdAt: string;
}

/**
 * Lo que el modelo leyó del ticket. Sugerencia, nunca acta.
 *
 * `null` es un estado normal y frecuente: la campaña puede tener la lectura
 * apagada, la migración puede no haber corrido, o el ticket puede ser anterior
 * a que existiera todo esto. La consola tiene que trabajar igual sin ella.
 */
export interface AdminExtraction {
  receipt_id: string;
  status: "pending" | "ok" | "failed" | "skipped";
  model: string;
  store_name: string | null;
  store_branch: string | null;
  purchase_date: string | null;
  /** La fecha como se imprime. dd/mm vs mm/dd es ambiguo; esta es la cruda. */
  purchase_date_raw: string | null;
  purchase_time: string | null;
  total_cents: number | null;
  total_printed: string | null;
  lines: {
    text: string;
    amountPrinted: string | null;
    amountCents: number | null;
    quantity: number | null;
  }[];
  legible: boolean | null;
  issues: string[];
  error: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

export interface QueueItem {
  receipt: AdminReceipt;
  participant: AdminParticipant | null;
  flags: RiskFlag[];
  extraction: AdminExtraction | null;
}

export interface AdminReward {
  id: string;
  participant_id: string;
  receipt_id: string;
  amount_cents: number;
  provider: "manual" | "tremendous";
  external_id: string;
  provider_ref: string | null;
  status: RewardStatus;
  household_key: string;
  week_start: string;
  note: string | null;
  created_at: string;
  sent_at: string | null;
  participantEmail: string | null;
  participantName: string | null;
}

export interface AdminProduct {
  id: string;
  brand: string;
  name: string;
  size: string | null;
  active: boolean;
  product_aliases: { id: string; retailer: string | null; alias_text: string }[];
}

export interface AdminData {
  staff: { email: string; role: StaffRole };
  campaign: {
    id: string;
    slug: string;
    name: string;
    orgName: string;
    status: "draft" | "live" | "paused" | "closed";
    config: CampaignConfig;
  };
  quota: {
    weekStart: string;
    weeklyQuota: number;
    weeklyUsed: number;
    weeklyLeft: number;
    totalSlots: number;
    totalUsed: number;
    totalLeft: number;
    fundCents: number;
    fundUsedCents: number;
    fundLeftCents: number;
    fundReservedCents: number;
  };
  summary: {
    participants: number;
    receipts: number;
    approved: number;
    rejected: number;
    needsNewImage: number;
    pending: number;
    marketingOptIn: number;
    medianReviewMinutes: number | null;
    avgEligibleCents: number | null;
  };
  queue: QueueItem[];
  decided: QueueItem[];
  rewards: AdminReward[];
  products: AdminProduct[];
}

// ---------------------------------------------------------------------------
// Prize store — GET /api/tickets/[campana]/admin/store
// ---------------------------------------------------------------------------

export interface AdminDropItem {
  id: string;
  nameEs: string;
  nameEn: string | null;
  kind: PrizeKind;
  pointsCost: number;
  inventory: number;
  /** Non-canceled redemptions against this prize. Counted, never stored. */
  claimed: number;
  remaining: number;
  active: boolean;
  detail: Record<string, unknown>;
}

export interface AdminDrop {
  id: string;
  weekStart: string;
  status: DropStatus;
  createdAt: string;
  /** The RPC refuses everything else, whatever the status says. */
  isCurrentWeek: boolean;
  items: AdminDropItem[];
}

export interface AdminRedemption {
  id: string;
  code: string;
  status: RedemptionStatus;
  pointsSpent: number;
  createdAt: string;
  fulfilledAt: string | null;
  prizeName: string;
  prizeKind: PrizeKind | null;
  participantName: string | null;
  participantAlias: string | null;
  participantEmail: string | null;
}

export interface StoreAdminData {
  /** False while migration 0013 has not run against this project. */
  available: boolean;
  weekStart: string;
  canManage: boolean;
  mechanic: CampaignMechanic;
  drops: AdminDrop[];
  redemptions: AdminRedemption[];
}

// Campaign configuration for the Carrera de Tickets module.
//
// The platform rule is that a new client is configuration, not code: thresholds,
// quotas, fund, eligible states, brands and copy all live in `campaigns.config`
// (jsonb). This file is only the reader — the defaults below MUST stay in sync
// with the ones hardcoded in `tickets_approve_receipt` (migration 0006), which
// is the authority whenever money is involved.

import type { OrgTheme } from "./theme";

export type Locale = "es" | "en";

export const LOCALES: Locale[] = ["es", "en"];

export const isLocale = (value: unknown): value is Locale =>
  value === "es" || value === "en";

export type CampaignStatus = "draft" | "live" | "paused" | "closed";

export type PayoutProvider = "manual" | "tremendous";

/**
 * Who may submit a receipt while a campaign is still a draft.
 *
 *  · `staff`  — only seats on the campaign. The safe default, and what a client
 *               preview wants: the team walks the flow, nobody else can.
 *  · `anyone` — any signed-in participant with a profile. For the stretch when
 *               the campaign is being built and every throwaway test account
 *               would otherwise need a row in `campaign_admins` first.
 *
 * What this key cannot do is the point of it being a key at all. It is only ever
 * consulted for `draft`, so:
 *   · a `live` campaign is unaffected — `acceptsReceipts` answers first;
 *   · a `paused` or `closed` campaign stays shut for everyone, staff included,
 *     because pausing is an operational brake and not a permission question;
 *   · the moment a campaign is published this value stops meaning anything.
 *
 * The guard it relaxes is real: an unpublished campaign has no dates, no
 * published rules and, in a threshold campaign, a fund that a receipt would
 * reserve money from. Opening it to anyone is a decision per campaign, taken
 * while nobody has the QR yet — not a line removed from the module.
 */
export type Rehearsal = "staff" | "anyone";

export interface Brand {
  name: string;
  color: string;
}

export interface CampaignConfig {
  /** Minimum eligible spend, in a single transaction, after coupons and before tax. */
  minPurchaseCents: number;
  rewardCents: number;
  /** "First N valid claims" — the campaign-long ceiling. */
  totalRewardSlots: number;
  /** Rewards released per campaign week, so the fund cannot drain in days. */
  weeklyQuota: number;
  perParticipantLimit: number;
  perHouseholdLimit: number;
  fundCents: number;
  reviewSlaHours: number;
  /** Decides when Monday starts for the weekly release. */
  timezone: string;
  eligibleStates: string[];
  payoutProvider: PayoutProvider;
  /** Stamped on every consent, so a mid-campaign rule change stays auditable. */
  rulesVersion: string;
  rulesUrl: string | null;
  /**
   * Off until the v1.1 drawing exists with official rules and an AMOE.
   * Announcing a prize whose rules are not written is worse than not
   * announcing it: it is what turns a promotion into an illegal lottery.
   */
  showGrandPrize: boolean;
  /** Illustrative brand chips for the home screen. NOT the validation catalogue. */
  brands: Brand[];
  /** Points earned per eligible dollar. Must mirror the RPC's default. */
  pointsPerDollar: number;
  /** Which fields "completa tu perfil" asks for. See `ProfileFields`. */
  profileFields: ProfileFields;
  /** Who may submit receipts while the campaign is a draft. See `Rehearsal`. */
  rehearsal: Rehearsal;
  /**
   * Participating stores, spelled the way they print on a receipt.
   *
   * The reviewer types the store by hand and the anti-duplicate lock is
   * (store + date + total), so two spellings of one shop are two shops as far
   * as that lock can tell. Offering the list turns a free-text field into a
   * pick, without forbidding the branch number a reviewer still has to add.
   *
   * Also the console's only honest source for a placeholder: it used to suggest
   * "El Super #114 · El Paso, TX" to somebody reading a Ciudad Juárez receipt.
   */
  stores: string[];
  /**
   * Accumulation prizes: reached by points threshold, no chance anywhere.
   * This is the legal line that keeps the campaign out of lottery territory —
   * a prize in this list may never be raffled among top scorers.
   */
  prizes: Prize[];
}

export interface Prize {
  /** Stable key: future redemption ledger entries will reference it. */
  id: string;
  points: number;
  nameEs: string;
  nameEn: string;
}

/**
 * How hard a campaign asks for one profile field.
 *  · `required` — the form will not submit without it, the API rejects it.
 *  · `optional` — rendered, accepted empty, stored as null.
 *  · `off`      — never rendered, and ignored if a client sends it anyway.
 */
export type ProfileFieldMode = "required" | "optional" | "off";

/**
 * The fields of "completa tu perfil" that differ between campaigns.
 *
 * Name, surname, alias, email and locale are absent on purpose: they are what
 * the module is built on (the leaderboard needs an alias, the reward needs an
 * address) and a campaign that could switch them off would be a campaign that
 * could break the module through configuration.
 *
 * These three are the ones geography decides. A US promotion is scoped by ZIP
 * and state and rations by household; a Mexican one delivers a top-up to a
 * phone number and has no use for either. That is a difference between clients,
 * which means it belongs in `campaigns.config`, not in an `if` on the slug.
 */
export interface ProfileFields {
  phone: ProfileFieldMode;
  zip: ProfileFieldMode;
  state: ProfileFieldMode;
}

/**
 * Deliberately the shape Ticket al Tanque already has, not a neutral one: the
 * campaign has live participants and its config carries no `profile_fields`
 * key, so anything else here would change a running campaign by deploying a
 * parser. A new campaign that wants something different says so in its config.
 */
export const DEFAULT_PROFILE_FIELDS: ProfileFields = {
  phone: "off",
  zip: "required",
  state: "required",
};

export interface Campaign {
  id: string;
  slug: string;
  name: string;
  status: CampaignStatus;
  locales: Locale[];
  orgName: string;
  orgSlug: string;
  /** The tenant's brand, as far as it is allowed to reach. See `theme.ts`. */
  theme: OrgTheme;
  config: CampaignConfig;
}

/**
 * Which story the participant screens tell.
 *
 *  · `threshold`    — "spend {min} in one transaction, get {reward} back"
 *                     (Ticket al Tanque). Rationed: weekly quota, total slots,
 *                     a fund. The screens talk about the reward and its stock.
 *  · `accumulation` — every eligible peso earns points and there is no per
 *                     ticket reward (Carrera Alaska). No minimum, no stock,
 *                     nothing to run out of.
 *
 * Derived, deliberately not a new config key: a campaign whose reward is worth
 * nothing has no reward to announce, and the five gates that would ration it
 * (min purchase, slots, weekly quota, per participant/household limits, fund)
 * are all zeroed in the same breath — turning the reward off IS the accumulation
 * setup. Reading it back from `reward_cents` means no campaign row has to be
 * edited to get the right screens, and no seed can set the two out of sync.
 */
export type CampaignMechanic = "threshold" | "accumulation";

export const mechanicOf = (
  config: Pick<CampaignConfig, "rewardCents">,
): CampaignMechanic => (config.rewardCents > 0 ? "threshold" : "accumulation");

const DEFAULTS: CampaignConfig = {
  minPurchaseCents: 1000,
  rewardCents: 2000,
  totalRewardSlots: 1200,
  weeklyQuota: 150,
  perParticipantLimit: 1,
  perHouseholdLimit: 1,
  fundCents: 3_000_000,
  reviewSlaHours: 48,
  timezone: "America/Denver",
  eligibleStates: [],
  payoutProvider: "manual",
  rulesVersion: "draft",
  rulesUrl: null,
  showGrandPrize: false,
  brands: [],
  pointsPerDollar: 10,
  profileFields: DEFAULT_PROFILE_FIELDS,
  // Staff-only unless a campaign says otherwise: the permissive value has to be
  // asked for, never inherited by a campaign nobody edited.
  rehearsal: "staff",
  stores: [],
  prizes: [],
};

const asInt = (value: unknown, fallback: number): number => {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

const asPrizes = (value: unknown): Prize[] =>
  Array.isArray(value)
    ? value
        .flatMap((entry) => {
          if (!entry || typeof entry !== "object") return [];
          const e = entry as Record<string, unknown>;
          const points = asInt(e.points, 0);
          if (typeof e.id !== "string" || points <= 0) return [];
          const nameEs = typeof e.name_es === "string" ? e.name_es : null;
          const nameEn = typeof e.name_en === "string" ? e.name_en : null;
          // A prize missing either language is dropped whole: showing a
          // Spanish prize name on the English screen is the exact failure the
          // Dict type prevents for UI copy, so config gets the same bar.
          if (!nameEs || !nameEn) return [];
          return [{ id: e.id, points, nameEs, nameEn }];
        })
        .sort((a, b) => a.points - b.points)
    : [];

// An unrecognised mode falls back to the default rather than throwing. A typo
// in one key must not take the registration form down for a whole campaign,
// and "we kept asking the way we asked yesterday" is the safe way to be wrong.
const asFieldMode = (value: unknown, fallback: ProfileFieldMode): ProfileFieldMode =>
  value === "required" || value === "optional" || value === "off" ? value : fallback;

const asProfileFields = (value: unknown): ProfileFields => {
  const f = (value ?? {}) as Record<string, unknown>;
  return {
    phone: asFieldMode(f.phone, DEFAULT_PROFILE_FIELDS.phone),
    zip: asFieldMode(f.zip, DEFAULT_PROFILE_FIELDS.zip),
    state: asFieldMode(f.state, DEFAULT_PROFILE_FIELDS.state),
  };
};

const asBrands = (value: unknown): Brand[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const { name, color } = entry as Record<string, unknown>;
        if (typeof name !== "string") return [];
        return [{ name, color: typeof color === "string" ? color : "#0A0A0A" }];
      })
    : [];

export const parseCampaignConfig = (raw: unknown): CampaignConfig => {
  const c = (raw ?? {}) as Record<string, unknown>;
  const states = asStringArray(c.eligible_states).map((s) => s.toUpperCase());
  return {
    minPurchaseCents: asInt(c.min_purchase_cents, DEFAULTS.minPurchaseCents),
    rewardCents: asInt(c.reward_cents, DEFAULTS.rewardCents),
    totalRewardSlots: asInt(c.total_reward_slots, DEFAULTS.totalRewardSlots),
    weeklyQuota: asInt(c.weekly_quota, DEFAULTS.weeklyQuota),
    perParticipantLimit: asInt(c.per_participant_limit, DEFAULTS.perParticipantLimit),
    perHouseholdLimit: asInt(c.per_household_limit, DEFAULTS.perHouseholdLimit),
    fundCents: asInt(c.fund_cents, DEFAULTS.fundCents),
    reviewSlaHours: asInt(c.review_sla_hours, DEFAULTS.reviewSlaHours),
    timezone: typeof c.timezone === "string" ? c.timezone : DEFAULTS.timezone,
    eligibleStates: states,
    payoutProvider: c.payout_provider === "tremendous" ? "tremendous" : "manual",
    rulesVersion:
      typeof c.rules_version === "string" ? c.rules_version : DEFAULTS.rulesVersion,
    rulesUrl: typeof c.rules_url === "string" ? c.rules_url : null,
    showGrandPrize: c.show_grand_prize === true,
    brands: asBrands(c.brands),
    pointsPerDollar: asInt(c.points_per_dollar, DEFAULTS.pointsPerDollar),
    profileFields: asProfileFields(c.profile_fields),
    // An unrecognised value falls back to "staff". A typo in this key must fail
    // closed — the direction where a mistake costs a slower rehearsal instead of
    // an open door.
    rehearsal: c.rehearsal === "anyone" ? "anyone" : DEFAULTS.rehearsal,
    stores: asStringArray(c.stores).map((s) => s.trim()).filter(Boolean),
    prizes: asPrizes(c.prizes),
  };
};

/**
 * The subset of a campaign that may reach a browser. The fund, the household
 * rule and the alias dictionary are absent by construction: anything not
 * listed here cannot leak by someone adding a field to a JSON response.
 */
export interface PublicCampaign {
  slug: string;
  name: string;
  orgName: string;
  status: CampaignStatus;
  locales: Locale[];
  /**
   * Safe to publish: a logo path and two brand colours are what the tenant
   * prints on a shelf talker. No key of this shape describes anybody.
   */
  theme: OrgTheme;
  /** Decides which set of screens the participant gets. See `mechanicOf`. */
  mechanic: CampaignMechanic;
  acceptsReceipts: boolean;
  minPurchaseCents: number;
  rewardCents: number;
  reviewSlaHours: number;
  eligibleStates: string[];
  brands: Brand[];
  showGrandPrize: boolean;
  rulesUrl: string | null;
  rulesVersion: string;
  pointsPerDollar: number;
  /**
   * Safe to publish: it says which boxes the form draws, not anything about
   * anybody. The browser needs it to render the form, and the API validates
   * against its own copy — this one is a rendering hint, never the authority.
   */
  profileFields: ProfileFields;
  prizes: Prize[];
}

export const toPublicCampaign = (campaign: Campaign): PublicCampaign => ({
  slug: campaign.slug,
  name: campaign.name,
  orgName: campaign.orgName,
  status: campaign.status,
  locales: campaign.locales,
  theme: campaign.theme,
  mechanic: mechanicOf(campaign.config),
  acceptsReceipts: campaign.status === "live",
  minPurchaseCents: campaign.config.minPurchaseCents,
  rewardCents: campaign.config.rewardCents,
  reviewSlaHours: campaign.config.reviewSlaHours,
  eligibleStates: campaign.config.eligibleStates,
  brands: campaign.config.brands,
  showGrandPrize: campaign.config.showGrandPrize,
  rulesUrl: campaign.config.rulesUrl,
  rulesVersion: campaign.config.rulesVersion,
  pointsPerDollar: campaign.config.pointsPerDollar,
  profileFields: campaign.config.profileFields,
  prizes: campaign.config.prizes,
});

// ---------------------------------------------------------------------------
// Money and time
// ---------------------------------------------------------------------------

// narrowSymbol is not cosmetic: es-MX renders USD as "USD 10" to disambiguate
// it from pesos, which is right in Mexico and wrong in El Paso. This is a US
// campaign paying in dollars, and a shopper in either language reads "$10".
export const formatUsdCents = (cents: number, locale: Locale = "en"): string =>
  new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);

/** "12.34" / "12,34" / "$12.34" → 1234. Returns null when it isn't a number. */
export const parseUsdToCents = (input: string): number | null => {
  const cleaned = input.replace(/[^0-9.,-]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
};

/**
 * Monday 00:00 in the campaign timezone, as an ISO instant. Mirrors the SQL
 * `tickets_week_start`; used for read-only displays, never to decide a payout.
 */
export const weekStart = (timezone: string, at: Date = new Date()): Date => {
  // Read the wall-clock date in the campaign timezone, then walk back to Monday.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const offset = Math.max(0, weekdays.indexOf(get("weekday")));
  const monday = new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - offset);
  return monday;
};

/**
 * Today's wall-clock date in the campaign's plaza, as `YYYY-MM-DD`.
 *
 * The plaza and not UTC, for the same reason Monday is decided there: at 19:00
 * in Ciudad Juárez it is already tomorrow in UTC, and a receipt printed an hour
 * ago would be judged against a day that has not happened locally.
 *
 * `en-CA` because it formats as YYYY-MM-DD, which compares correctly as a string
 * and is the shape `receipts.purchase_date` already stores.
 */
export const todayInTz = (timezone: string, at: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);

/**
 * A purchase date cannot be in the future.
 *
 * Sounds obvious enough not to need a function, and it was missing: the approve
 * schema validated the SHAPE of the date and nothing about its value, so a
 * reviewer's typo sailed through. One receipt in Carrera Alaska is stored with a
 * purchase date two days after it was reviewed.
 *
 * It matters beyond tidiness. The anti-duplicate lock is (store + date + total),
 * and the campaign's validity window is checked against this date — a wrong date
 * moves a receipt out of the period it belongs to and out of the way of the
 * duplicate it is a copy of.
 *
 * No lower bound here on purpose. The floor is the campaign's `starts_at`, which
 * Carrera Alaska does not have yet (question 1 of PREGUNTAS_ABIERTAS), and
 * inventing an arbitrary one would reject legitimately older receipts.
 */
export const isFuturePurchaseDate = (date: string, timezone: string): boolean =>
  date > todayInTz(timezone);

/**
 * Points ledger kinds (migration 0011) that spend points instead of earning
 * them. The balance is the SUM of everything; the leaderboard is the SUM of
 * everything except these — canjear no te saca de la carrera.
 *
 * An exclusion list rather than an allow-list of earning kinds on purpose: a
 * future earning kind (welcome bonus, streak bonus) should rank the day it
 * exists, while a future spending kind is a deliberate edit here.
 */
export const POINTS_SPEND_KINDS = ["redemption"] as const;

export const RECEIPT_STATUSES = [
  "received",
  "in_review",
  "approved",
  "rejected",
  "needs_new_image",
] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const REWARD_STATUSES = [
  "reserved",
  "queued",
  "sent",
  "delivered",
  "failed",
  "canceled",
] as const;
export type RewardStatus = (typeof REWARD_STATUSES)[number];

/** Statuses that hold budget. Mirrors `status <> 'canceled'` in the RPC. */
export const rewardHoldsFunds = (status: RewardStatus) => status !== "canceled";

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const RECEIPTS_BUCKET = "receipts";

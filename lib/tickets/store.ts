// Prize store: the shapes the API sends and the vocabulary both surfaces share.
//
// Kept apart from `config.ts` because none of this is campaign configuration —
// a Drop is data an operator curates every week, not a key somebody sets once.
// No server imports here: the panel and the console both read this file.

import type { Locale } from "./config";
import type { CopyKey } from "./i18n";

export const DROP_STATUSES = ["scheduled", "open", "closed"] as const;
export type DropStatus = (typeof DROP_STATUSES)[number];

export const PRIZE_KINDS = ["product", "recharge", "giftcard", "item", "cash"] as const;
export type PrizeKind = (typeof PRIZE_KINDS)[number];

export const REDEMPTION_STATUSES = ["confirmed", "fulfilled", "canceled"] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];

/** Statuses that hold a unit of inventory. Mirrors `status <> 'canceled'` in the RPC. */
export const redemptionHoldsStock = (status: RedemptionStatus) => status !== "canceled";

export interface StorePrize {
  id: string;
  nameEs: string;
  nameEn: string | null;
  kind: PrizeKind;
  pointsCost: number;
  inventory: number;
  /** Derived server-side: inventory minus non-canceled redemptions. Never stored. */
  remaining: number;
  active: boolean;
  detail: Record<string, unknown>;
}

export interface StoreDrop {
  id: string;
  status: DropStatus;
  weekStart: string;
  items: StorePrize[];
}

export interface StoreRedemption {
  id: string;
  code: string;
  status: RedemptionStatus;
  pointsSpent: number;
  createdAt: string;
  fulfilledAt: string | null;
  /**
   * Which Drop item this claimed. Present so a screen can tell "you already
   * took this one" from "you can't afford it yet" — `nextPrize` needs it, and
   * without it the progress bar would point at a prize the RPC would refuse.
   */
  dropItemId: string;
  prizeNameEs: string;
  prizeNameEn: string | null;
  kind: PrizeKind;
}

export interface StoreSnapshot {
  /**
   * False when the store cannot be read at all — the tables are not deployed
   * yet, or the schema cache has not caught up. The panel degrades to a quiet
   * "not open yet" card instead of failing: a participant checking their points
   * should never meet a stack trace because a migration is pending.
   */
  available: boolean;
  weekStart: string;
  points: number;
  /** null when no drop of the current week is open. */
  drop: StoreDrop | null;
  redemptions: StoreRedemption[];
}

/**
 * The prize the balance is heading towards, and how far along it is.
 *
 * This is what replaced the mockup's "PASO 3 DE 7" rail. There are no seven
 * steps in this mechanic and inventing them would have been decoration; the
 * distance to the next reachable prize is a real number the participant can
 * act on, and it is derivable from data the store already sends.
 *
 * "Reachable" does three exclusions, each matching a rule the redeem RPC
 * enforces, so the bar can never point at a prize that would be refused:
 *   · sold out — `remaining <= 0` is gone until Monday
 *   · already claimed in THIS Drop — one unit per prize per participant per
 *     Drop (`status <> 'canceled'`, exactly as the RPC counts it)
 *   · nothing left to aim at — every prize claimed or gone returns null, and
 *     the caller says "you've taken everything in this Drop" instead of a bar
 *     stuck at 100%.
 */
export interface NextPrize {
  prize: StorePrize;
  points: number;
  /** Points still missing. 0 means it is affordable right now. */
  missing: number;
  /** 0–100, for the bar's width. Reaches 100 exactly when missing is 0. */
  pct: number;
  affordable: boolean;
}

export const nextPrize = (snapshot: StoreSnapshot | null): NextPrize | null => {
  if (!snapshot?.drop) return null;

  const claimed = new Set(
    snapshot.redemptions
      .filter((r) => redemptionHoldsStock(r.status))
      .map((r) => r.dropItemId),
  );

  // Items arrive ordered by cost from the API, but sorting here means the
  // helper does not depend on that promise holding.
  const reachable = snapshot.drop.items
    .filter((item) => item.remaining > 0 && !claimed.has(item.id))
    .sort((a, b) => a.pointsCost - b.pointsCost);

  // The cheapest one still out of reach is the goal. If everything reachable is
  // already affordable, the goal is the cheapest of those — "you can claim this
  // now" is the more useful thing to say than "you are 100% of the way to it".
  const target = reachable.find((item) => item.pointsCost > snapshot.points) ?? reachable[0];
  if (!target) return null;

  const missing = Math.max(0, target.pointsCost - snapshot.points);
  return {
    prize: target,
    points: snapshot.points,
    missing,
    pct:
      target.pointsCost > 0
        ? Math.min(100, Math.round((snapshot.points / target.pointsCost) * 100))
        : 100,
    affordable: missing === 0,
  };
};

/** The name to print, honouring campaigns that only wrote one language. */
export const prizeName = (
  prize: { nameEs: string; nameEn: string | null },
  locale: Locale,
): string => (locale === "en" ? (prize.nameEn ?? prize.nameEs) : prize.nameEs);

/**
 * "The prize store isn't deployed here" as opposed to "the database is broken".
 *
 * PostgREST answers a missing table with PGRST205 and a missing function with
 * PGRST202; Postgres itself raises 42P01. Any of the three means the 0013
 * migration has not run against this project — which is a normal state between
 * a deploy and a migration, and must not take the panel down with it.
 */
export const isMissingStoreRelation = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  if (code === "42P01" || code === "PGRST205" || code === "PGRST202") return true;
  const text = (message ?? "").toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("could not find the function") ||
    text.includes("schema cache")
  );
};

/**
 * Machine codes raised by `tickets_redeem_prize` → participant-facing copy.
 * Anything missing here is a bug, not a rule, and the caller shows errGeneric.
 */
export const REDEEM_ERROR_KEY: Record<string, CopyKey> = {
  insufficient_points: "stErrPoints",
  sold_out: "stErrSoldOut",
  already_redeemed: "stErrAlready",
  drop_closed: "stErrClosed",
  item_inactive: "stErrClosed",
  item_not_found: "stErrClosed",
  not_a_participant: "errNotSignedIn",
  store_unavailable: "stUnavailable",
};

/** The same codes for the operations console, which reads Spanish and no keys. */
export const REDEEM_ERROR_ES: Record<string, string> = {
  insufficient_points: "El participante no tiene puntos suficientes.",
  sold_out: "Ese premio ya se agotó en este Drop.",
  already_redeemed: "Este participante ya canjeó ese premio en este Drop.",
  drop_closed: "El Drop no está abierto o ya no es el de esta semana.",
  item_inactive: "Ese premio está desactivado.",
  item_not_found: "Ese premio no existe en esta campaña.",
  not_a_participant: "Esa cuenta no participa en esta campaña.",
  drop_not_found: "No hay Drop para esa semana.",
  redemption_not_found: "Ese canje ya no existe.",
  bad_status: "Ese canje ya no está confirmado.",
  store_unavailable:
    "La tienda todavía no existe en la base: faltan las migraciones 0013 y 0014.",
};

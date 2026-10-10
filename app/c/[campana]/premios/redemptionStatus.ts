import type { CopyKey } from "@/lib/tickets/i18n";
import { REDEMPTION_STATUS_KEY } from "@/lib/tickets/i18n";
import type { StoreRedemption } from "@/lib/tickets/store";
import { isPhysicalPrize } from "./PrizeIcon";

/**
 * What a redemption's status is called, which depends on what was won.
 * "Confirmed" means "go pick it up" for a product and "it's travelling to your
 * inbox" for a gift card; one label for both told gift-card winners to go to a
 * store. Shared by the shelf's history and the panel's list so they cannot
 * drift apart.
 */
export const redemptionLabelKey = (row: Pick<StoreRedemption, "status" | "kind">): CopyKey => {
  if (row.status !== "confirmed") return REDEMPTION_STATUS_KEY[row.status];
  if (isPhysicalPrize(row.kind)) return "jrRedPickup";
  return row.kind === "giftcard" ? "jrRedGift" : "jrRedProcessing";
};

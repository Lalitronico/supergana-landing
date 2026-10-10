import type { ReactNode } from "react";
import type { Locale } from "@/lib/tickets/config";
import type { Translate } from "@/lib/tickets/i18n";
import { prizeDetail, prizeName, type NextPrize } from "@/lib/tickets/store";

const MARK = "\u2063"; // invisible separator: never appears in real copy

/**
 * Wraps the first `token` found in `text` in <b>. The dictionaries are plain
 * strings (one sentence, one key, so translators keep word order), and the
 * number is the one word in the sentence that carries the weight — splitting on
 * a marker we inject ourselves keeps both true.
 */
export function emphasize(text: string): ReactNode {
  const parts = text.split(MARK);
  if (parts.length < 3) return text;
  return parts.map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : part));
}

/**
 * "Te faltan 120 pts para tu gift card de $5" — from the real next prize.
 * Gift cards are named by their face value (that is how a person says it);
 * everything else by its name.
 */
export function fuelGoal({
  next,
  t,
  locale,
  money,
}: {
  next: NextPrize;
  t: Translate;
  locale: Locale;
  money: (cents: number) => string;
}): ReactNode {
  const { valueCents } = prizeDetail(next.prize, locale);
  const gift = next.prize.kind === "giftcard" && valueCents !== null;
  const name = prizeName(next.prize, locale);
  const value = valueCents !== null ? money(valueCents) : "";
  const pts = `${MARK}${next.missing.toLocaleString(locale === "en" ? "en-US" : "es-MX")}${MARK}`;

  if (next.affordable) {
    return emphasize(t(gift ? "jrFuelReadyGift" : "jrFuelReadyItem", { value, name }));
  }
  return emphasize(t(gift ? "jrFuelMissingGift" : "jrFuelMissingItem", { points: pts, value, name }));
}

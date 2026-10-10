import type { ReactNode } from "react";
import type { Locale } from "@/lib/tickets/config";
import type { Translate } from "@/lib/tickets/i18n";
import { prizeDetail, prizeName, type NextPrize, type StorePrize } from "@/lib/tickets/store";

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

type Money = (cents: number) => string;

/** "gift card de $10" is how a person says a gift card; everything else by name. */
const targetOf = (prize: StorePrize, locale: Locale, money: Money) => {
  const { valueCents } = prizeDetail(prize, locale);
  const gift = prize.kind === "giftcard" && valueCents !== null;
  return { gift, value: valueCents !== null ? money(valueCents) : "", name: prizeName(prize, locale) };
};

/**
 * The two sentences under the gauge, and the rule that keeps them from
 * contradicting each other.
 *
 * The needle always measures toward the NEXT goal (the cheapest prize still out
 * of reach), but the copy leads with whatever is claimable today. Saying "te
 * faltan 227 pts para tu gift card de $10" while the same card says "ya te
 * alcanza para canjear" was the bug: both true, read as opposites. So:
 *   · something claimable now → main: "¡Ya te alcanza para X!" (the best one),
 *     secondary: "Siguiente meta: Y · te faltan N pts";
 *   · nothing claimable yet   → main: "Te faltan N pts para Y", no secondary;
 *   · the goal itself is reachable → main: it is ready, no secondary.
 */
export function fuelLines({
  next,
  claimable,
  t,
  locale,
  money,
}: {
  next: NextPrize;
  /** `bestAffordablePrize` — null when the balance reaches nothing. */
  claimable: StorePrize | null;
  t: Translate;
  locale: Locale;
  money: Money;
}): { main: ReactNode; secondary: ReactNode | null; canRedeem: boolean } {
  const goal = targetOf(next.prize, locale, money);
  const pts = `${MARK}${next.missing.toLocaleString(locale === "en" ? "en-US" : "es-MX")}${MARK}`;

  if (next.affordable) {
    return {
      main: emphasize(t(goal.gift ? "jrFuelReadyGift" : "jrFuelReadyItem", { value: goal.value, name: goal.name })),
      secondary: null,
      canRedeem: true,
    };
  }

  if (claimable) {
    return {
      main: t("jrFuelNowMain", { name: prizeName(claimable, locale) }),
      secondary: emphasize(
        t(goal.gift ? "jrFuelNextGift" : "jrFuelNextItem", { points: pts, value: goal.value, name: goal.name }),
      ),
      canRedeem: true,
    };
  }

  return {
    main: emphasize(
      t(goal.gift ? "jrFuelMissingGift" : "jrFuelMissingItem", { points: pts, value: goal.value, name: goal.name }),
    ),
    secondary: null,
    canRedeem: false,
  };
}

/** "Siguiente meta: gift card de $10 · te faltan 72 pts", standing alone. */
export function fuelNextLine({
  next,
  t,
  locale,
  money,
}: {
  next: NextPrize;
  t: Translate;
  locale: Locale;
  money: Money;
}): ReactNode {
  const goal = targetOf(next.prize, locale, money);
  const pts = `${MARK}${next.missing.toLocaleString(locale === "en" ? "en-US" : "es-MX")}${MARK}`;
  return emphasize(
    t(goal.gift ? "jrFuelNextGift" : "jrFuelNextItem", { points: pts, value: goal.value, name: goal.name }),
  );
}

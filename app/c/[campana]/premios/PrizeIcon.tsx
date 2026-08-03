"use client";

import type { PrizeKind } from "@/lib/tickets/store";

/**
 * What a prize looks like, from what kind of prize it is.
 *
 * The mockups draw a product photo per prize. There are none: `prize_drop_items`
 * holds a name, a cost and an inventory, and inventing an image field would mean
 * every operator curating a Drop also has to source artwork before Monday.
 *
 * A line drawing per `kind` is honest about what it knows — a jug is a product, a
 * phone is a top-up — and it costs the operator nothing. If per-prize art ever
 * becomes worth it, it belongs in `detail`, next to the delivery note that is
 * already there.
 */
const ICONS: Record<PrizeKind, React.ReactNode> = {
  product: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.6 2.7h4.8v2.1H9.6z" />
      <path d="M8.5 4.8h7c1 0 1.8.8 1.8 1.8v12.7c0 1.1-.9 2-2 2H8.7c-1.1 0-2-.9-2-2V6.6c0-1 .8-1.8 1.8-1.8Z" />
      <path d="M8.9 10.2h6.2M8.9 13.4h6.2" />
    </svg>
  ),
  recharge: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6.4" y="2.6" width="11.2" height="18.8" rx="2.2" />
      <path d="M10.4 18.6h3.2" />
      <path d="m10 9.6 4-2.2-1.2 3.2 2.2.6-4 3 1-3.2z" />
    </svg>
  ),
  giftcard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.6" y="5.4" width="18.8" height="13.2" rx="2.2" />
      <path d="M2.6 10.2h18.8M6.8 14.6h4" />
    </svg>
  ),
  item: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.2" y="8.4" width="17.6" height="12.4" rx="1.8" />
      <path d="M3.2 13.1h17.6M12 8.4v12.4" />
      <path d="M12 8.4S10.6 4.4 8.2 4.4a2.1 2.1 0 0 0 0 4zm0 0s1.4-4 3.8-4a2.1 2.1 0 0 1 0 4z" />
    </svg>
  ),
  cash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="6.4" rx="7.6" ry="3.2" />
      <path d="M4.4 6.4v11.2c0 1.8 3.4 3.2 7.6 3.2s7.6-1.4 7.6-3.2V6.4" />
      <path d="M4.4 12c0 1.8 3.4 3.2 7.6 3.2s7.6-1.4 7.6-3.2" />
    </svg>
  ),
};

/**
 * Physical prizes are collected at a counter with a code; digital ones are
 * processed by the promotion team. Which one it is changes what the person
 * should expect next, so the store says it rather than leaving it to be
 * discovered after redeeming.
 */
export const isPhysicalPrize = (kind: PrizeKind): boolean =>
  kind === "product" || kind === "item";

export function PrizeIcon({ kind, className }: { kind: PrizeKind; className?: string }) {
  return (
    <span className={["tk-prizeico", className].filter(Boolean).join(" ")} aria-hidden="true">
      {ICONS[kind]}
    </span>
  );
}

"use client";

import type { CSSProperties } from "react";
import type { Brand } from "@/lib/tickets/config";
import { useTickets } from "../TicketsShell";
import { SafeImg } from "./SafeImg";

/**
 * The ink band under the hero: every participating brand, scrolling.
 *
 * The list is rendered twice and the track slides by exactly half its width, so
 * the loop has no seam whatever the logos' widths. The second copy is
 * aria-hidden so a screen reader hears each brand once. Under reduced motion the
 * track stops and the band becomes a swipeable row: same information, no
 * movement.
 */
export function LogoMarquee({ brands }: { brands: Brand[] }) {
  const { t } = useTickets();
  if (brands.length === 0) return null;

  const row = (hidden: boolean) =>
    brands.map((brand) => {
      const name = <span className="sh-mq-name">{brand.name}</span>;
      return (
        <li
          key={`${hidden ? "b" : "a"}-${brand.name}`}
          aria-hidden={hidden || undefined}
          style={{ "--sh-brand": brand.color } as CSSProperties}
        >
          {brand.logoUrl ? (
            <SafeImg src={brand.logoUrl} alt={hidden ? "" : brand.name} fallback={name} />
          ) : (
            name
          )}
        </li>
      );
    });

  return (
    <section className="sh-mq" aria-label={t("brandsTitle")}>
      <ul className="sh-mq-track">
        {row(false)}
        {row(true)}
      </ul>
    </section>
  );
}

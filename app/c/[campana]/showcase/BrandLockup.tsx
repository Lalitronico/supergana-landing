"use client";

import type { CSSProperties } from "react";
import type { Brand } from "@/lib/tickets/config";
import { useTickets } from "../TicketsShell";
import { SafeImg } from "./SafeImg";

/**
 * The participating brands as logos, for a multi-brand campaign whose org logo
 * is the parent company's. Renders nothing unless at least one brand ships a
 * logo: a row of bare names would only repeat the chips further down the page.
 *
 * Each logo sits on a card tinted with its own brand colour (derived with
 * color-mix, not asked of the tenant) so two logos with different artwork
 * backgrounds still read as one family.
 */
export function BrandLockup({ brands }: { brands: Brand[] }) {
  const { t } = useTickets();
  if (!brands.some((b) => b.logoUrl)) return null;

  return (
    <section className="sh-lockup" aria-label={t("brandsTitle")}>
      <span className="sh-lockup-label">{t("brandsTitle")}</span>
      <ul>
        {brands.map((brand) => {
          const name = <span className="sh-lockup-name">{brand.name}</span>;
          return (
            <li key={brand.name} style={{ "--sh-brand": brand.color } as CSSProperties}>
              {brand.logoUrl ? (
                <SafeImg src={brand.logoUrl} alt={brand.name} fallback={name} />
              ) : (
                name
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import type { CSSProperties } from "react";
import type { Brand } from "@/lib/tickets/config";
import { useTickets } from "../TicketsShell";
import { SafeImg } from "./SafeImg";

export interface GalleryProduct {
  brand: string;
  name: string;
  size: string | null;
  imageUrl: string | null;
}

/**
 * Shelf of participating products: the bottle on a card tinted with its brand's
 * colour. A horizontal scroll-snap strip rather than a grid because the catalogue
 * is open-ended (three flavours today, eight next campaign) and a strip scales
 * without redesign, while the half-cut last card tells the eye "more this way".
 *
 * Opt-in by data: the caller only mounts this when some product has an image.
 */
export function ProductGallery({
  products,
  brands,
}: {
  products: GalleryProduct[];
  brands: Brand[];
}) {
  const { t } = useTickets();
  const tint = (brand: string) =>
    brands.find((b) => b.name.toLowerCase() === brand.toLowerCase())?.color ?? "#FFD93D";

  return (
    <ul className="sh-gallery" aria-label={t("shGalleryAria")}>
      {products.map((p, i) => {
        // Names often already carry the presentation ("Fresa 1.5 L"); repeating
        // it as a second line would read as a stutter.
        const showSize = p.size && !p.name.toLowerCase().includes(p.size.toLowerCase());
        const initial = (
          <span className="sh-prod-initial" aria-hidden="true">
            {p.brand.charAt(0)}
          </span>
        );
        return (
          <li
            key={`${p.brand}-${p.name}`}
            className="sh-prod"
            style={{ "--sh-brand": tint(p.brand), "--i": i } as CSSProperties}
          >
            <div className="sh-prod-photo">
              {p.imageUrl ? <SafeImg src={p.imageUrl} alt="" fallback={initial} /> : initial}
            </div>
            <div className="sh-prod-text">
              <span className="sh-prod-brand">{p.brand}</span>
              <b>{p.name}</b>
              {showSize && <span className="sh-prod-size">{p.size}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

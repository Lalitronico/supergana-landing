"use client";

import { useState, type CSSProperties } from "react";
import type { Brand } from "@/lib/tickets/config";
import { productLabel } from "@/lib/tickets/productLabel";
import { castForBrand, contrastRatio } from "@/lib/tickets/theme";
import { useTickets } from "../TicketsShell";
import { CastFigure } from "../fiesta/CastFigure";
import { SafeImg } from "./SafeImg";
import type { GalleryProduct } from "./ProductGallery";

/** Text colour that reads on a brand's own colour: ink or white, whichever has more contrast. */
const onColor = (bg: string): string =>
  contrastRatio(bg, "#0A0A0A") >= contrastRatio(bg, "#FFFFFF") ? "#0A0A0A" : "#FFFFFF";

/**
 * The parade: one tall card per participating brand, in the brand's colour, with
 * the cast member who holds it. Tapping a card turns it over to the brand's
 * participating products, so all the SKUs are one tap away without a 32-row list
 * on the screen.
 *
 * A horizontal snap strip rather than a grid: seven cards stacked would be two
 * screens of scrolling before the next section, and the half-visible neighbour
 * is what invites the swipe. Everything comes from data (colours and logos from
 * `config.brands`, characters from the theme's cast, SKUs from `products`); a
 * brand with no logo shows its name, one with no character its initial, one
 * with no products still has a front.
 */
export function BrandParade({
  brands,
  products,
}: {
  brands: Brand[];
  products: GalleryProduct[];
}) {
  const { campaign, t } = useTickets();
  const [flipped, setFlipped] = useState<string | null>(null);

  return (
    <ul className="sh-parade" aria-label={t("shParadeTitle")}>
      {brands.map((brand, i) => {
        const skus = products.filter((p) => p.brand.toLowerCase() === brand.name.toLowerCase());
        const member = castForBrand(campaign.theme, brand.name);
        const open = flipped === brand.name;
        const withPhoto = skus.filter((p) => p.imageUrl);
        // No character for this brand: its own packshot stands in, big, and
        // the side column keeps the rest. A giant initial is the last resort,
        // for a brand with neither.
        const hero = member ? null : (withPhoto[0] ?? null);
        const photos = (hero ? withPhoto.slice(1) : withPhoto).slice(0, 3);
        const count = skus.length === 1 ? t("shParadeOne") : t("shParadeMany", { n: skus.length });
        const nameChip = <span className="sh-card-name">{brand.name}</span>;

        return (
          <li
            key={brand.name}
            className={open ? "sh-card open" : "sh-card"}
            style={{ "--c": brand.color, "--on": onColor(brand.color), "--i": i } as CSSProperties}
          >
            <div className="sh-card-inner">
              {/* FRONT */}
              <div className="sh-face front" inert={open}>
                <button
                  type="button"
                  className="sh-card-hit"
                  aria-label={t("shParadeAria", { brand: brand.name })}
                  disabled={skus.length === 0}
                  onClick={() => setFlipped(brand.name)}
                />
                <div className="sh-card-logo">
                  {brand.logoUrl ? (
                    <SafeImg src={brand.logoUrl} alt={brand.name} fallback={nameChip} />
                  ) : (
                    nameChip
                  )}
                </div>
                <div className="sh-card-art">
                  {member ? (
                    <CastFigure member={member} height="100%" delay={i * 280} alt="" />
                  ) : hero ? (
                    <SafeImg
                      src={hero.imageUrl as string}
                      alt=""
                      className="sh-card-pack"
                      fallback={
                        <span className="sh-card-initial" aria-hidden="true">
                          {brand.name.charAt(0)}
                        </span>
                      }
                    />
                  ) : (
                    <span className="sh-card-initial" aria-hidden="true">
                      {brand.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="sh-card-foot">
                  <span>{skus.length > 0 ? count : brand.name}</span>
                  {skus.length > 0 && <b>{t("shParadeSee")}</b>}
                </div>
                {photos.length > 0 && (
                  <div className="sh-card-photos" aria-hidden="true">
                    {photos.map((p) => (
                      <SafeImg key={p.name} src={p.imageUrl as string} alt="" fallback={null} />
                    ))}
                  </div>
                )}
              </div>

              {/* BACK */}
              <div className="sh-face back" inert={!open}>
                <div className="sh-back-head">
                  <b>{brand.name}</b>
                  <button type="button" className="sh-back-btn" onClick={() => setFlipped(null)}>
                    {t("shParadeBack")}
                  </button>
                </div>
                <ul className={skus.length <= 2 ? "sh-skus few" : "sh-skus"}>
                  {skus.map((p) => {
                    const emptySlot = <span className="sh-sku-ph" aria-hidden="true" />;
                    return (
                      <li key={`${p.name}-${p.size}`}>
                        {p.imageUrl ? <SafeImg src={p.imageUrl} alt="" fallback={emptySlot} /> : emptySlot}
                        <span>{productLabel(p, { withBrand: false })}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

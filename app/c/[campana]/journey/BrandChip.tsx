"use client";

import { useState } from "react";
import type { Brand } from "@/lib/tickets/config";

/**
 * A product (or brand) as a small coloured chip: the brand's colour on the left
 * edge and its logo when it has one. Everything comes from `config.brands`
 * (colour, logo) and the product label — nothing here knows a brand by name.
 * A label with no known brand is a plain white chip.
 */
/** Logo that disappears instead of showing a broken-image glyph when the file
 *  is missing. Checked after hydration too: the server renders the <img> and
 *  the browser may have failed it before React could attach `onError`. */
function Logo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tenant logo from data
    <img
      src={src}
      alt=""
      decoding="async"
      onError={() => setFailed(true)}
      ref={(el) => {
        if (el && el.complete && el.naturalWidth === 0) setFailed(true);
      }}
    />
  );
}

export function BrandChip({
  label,
  brand,
  className,
  style,
}: {
  label: string;
  brand: Brand | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <li
      className={["jr-chip", className].filter(Boolean).join(" ")}
      style={{ ...style, ["--chip" as string]: brand?.color ?? "var(--sg-green)" }}
    >
      <span className="jr-chip-dot" aria-hidden="true">
        {brand?.logoUrl ? <Logo src={brand.logoUrl} /> : null}
      </span>
      {label}
    </li>
  );
}

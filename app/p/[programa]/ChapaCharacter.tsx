"use client";

import Image from "next/image";
import { useState } from "react";
import type { CharacterName } from "./cast";

/**
 * A Supergana character, standing next to the thing it is talking about.
 *
 * The folder it reads from is derived from the tenant's theme, not written
 * down — see `cast.ts`, which is also where `characterDir` lives, because a
 * server component cannot call a function exported from a client module.
 *
 * WHY IT IS A CLIENT COMPONENT.
 *
 * The art is produced separately from the code and a campaign can be deployed
 * before a pose exists. A missing PNG in a plain <img> paints a broken-image
 * glyph next to a headline, which looks like a bug rather than like a pose that
 * has not been drawn yet. `onError` removes it instead, so an incomplete cast
 * degrades to no character at all.
 *
 * WHY IT NEVER OVERLAPS ANYTHING.
 *
 * It renders in a flow cell — a grid column beside the text, never
 * `position: absolute`. The demo positioned a character absolutely over the
 * board and it landed on top of a match row, hiding the tiebreak label. A cell
 * that reserves its own width cannot land on anything, at any viewport. That is
 * the one place this departs from the approved mockups, where the cast leans
 * over the header: the composition is worth less than the guarantee.
 */
export function ChapaCharacter({
  dir,
  name,
  /** Widest the art is ever drawn. It shrinks with the viewport from there. */
  size = 120,
  className = "",
}: {
  dir: string | null;
  name: CharacterName;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!dir || failed) return null;

  return (
    <span
      className={`pk-char ${className}`.trim()}
      style={{ "--pk-char-w": `${size}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      <Image
        src={`${dir}/${name}.png`}
        alt=""
        width={1024}
        height={1024}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

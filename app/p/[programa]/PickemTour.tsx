"use client";

import type { ReactNode } from "react";
import { TourHost } from "@/components/platform/Tour";
import type { TourDefinition } from "@/lib/platform/tour";
import { ChapaCharacter } from "./ChapaCharacter";
import type { CharacterName } from "./cast";
import { TourPickDemo } from "./TourPickDemo";

/**
 * Where the platform's tour engine meets this module's face.
 *
 * The engine in components/platform/Tour.tsx knows how to point at a thing and
 * say a sentence. It does not know what a "dino-picks" is, and it must not: the
 * moment it imports a cast or a demo it stops being the platform's and becomes
 * the pick'em's. So art and interactive slots cross as string KEYS in the
 * definition, and this file is the only place that resolves them.
 *
 * That is also what keeps `TourDefinition` JSON-serialisable, which is what
 * lets the definition be built on the server from the programme row — see
 * tour.ts, and the rules-screen doctrine it exists to obey.
 */
export function PickemTour({
  definition,
  charDir,
  /** Points per correct pick, for the demo's header. Straight from the
      programme's mechanics, like every other number the module shows. */
  hit,
  slug,
  children,
}: {
  definition: TourDefinition;
  charDir: string | null;
  hit: number;
  slug: string;
  children: ReactNode;
}) {
  return (
    <TourHost
      definition={definition}
      // The staff console shares this layout. A tour of player screens has no
      // business over a settlement in progress — the same reason PickemTabs
      // disappears there.
      mutedPrefixes={[`/p/${slug}/panel`]}
      renderArt={(key, size) => (
        // ChapaCharacter returns null when the pose is missing or the tenant has
        // no cast, so an unknown key degrades to a card with no art rather than
        // to a broken image.
        <ChapaCharacter dir={charDir} name={key as CharacterName} size={size} />
      )}
      renderSlot={(key) => (key === "pick-demo" ? <TourPickDemo hit={hit} /> : null)}
    >
      {children}
    </TourHost>
  );
}

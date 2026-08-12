import Image from "next/image";

/**
 * The co-brand, at full size, on the one screen that has room for it.
 *
 * This used to be the header on every screen: a two-row black plate carrying
 * the tenant's sign, the programme's name and our signature. It is the right
 * drawing and the wrong place — repeated eighteen times it costs ~128px of
 * every screen to say something the player already knows by jornada 2.
 *
 * So it moved here, into the portada's scrolling area, where the QR lands and
 * where "whose game is this" is genuinely the first question. The bar keeps a
 * one-row version of the same plate; see `PickemHeader`.
 *
 * WHY THE MARK GETS A DARK PLATE. Chapa's wordmark is copper with "CARNES &
 * CANTINA" in white underneath, drawn for a dark background: on cream that
 * subtitle disappears completely. Recolouring somebody's logo to survive our
 * background is not ours to do, so the mark gets a plate — which is also what
 * turns it into a sign hanging on a restaurant wall rather than a logo pasted
 * on top, and is what the approved mockups show.
 *
 * The wordmark is a tenant asset addressed the same way premios/page.tsx
 * addresses it, guarded by the same key. It wants a `wordmark_url` in
 * `organizations.theme` the day a second tenant arrives; today the theme only
 * carries the emblem, and the emblem's absence is what turns this off.
 */
export function PickemPlate({
  programName,
  orgName,
  logoUrl,
  logoAlt,
  poweredBy,
}: {
  /** The campaign's own name — "NFL Pick'em by Chapa". */
  programName: string;
  orgName: string;
  logoUrl: string | null;
  logoAlt: string;
  poweredBy: boolean;
}) {
  return (
    <div className="pk-plate">
      {logoUrl ? (
        <span className="pk-plate-mark">
          <Image
            src="/brands/chapa/chapa-wordmark-420.png"
            alt={logoAlt}
            width={420}
            height={126}
            priority
          />
        </span>
      ) : (
        <span className="pk-plate-name">{orgName}</span>
      )}

      <div className="pk-plate-bottom">
        <span className="pk-plate-text">
          <span className="pk-plate-name">{programName}</span>
          <span className="pk-plate-sig">
            {poweredBy ? "Powered by Supergana" : orgName}
          </span>
        </span>
      </div>
    </div>
  );
}

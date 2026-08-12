import Image from "next/image";
import Link from "next/link";
import type { ProgramStatus } from "@/lib/pickem/schema";

/**
 * The bar the tenant lives in.
 *
 * Its sign, the programme's name, and Supergana's signature. One aesthetic,
 * with the client inside it: the programme is sold as *powered by Supergana*,
 * so the cartoon world IS the product and the tenant is the guest. Two earlier
 * versions of the demo got this backwards — one gave Chapa a separate sober
 * skin, the other a switch between two skins. Neither is what a co-brand is.
 *
 * WHY THE BAR IS A BLACK PLATE.
 *
 * Chapa's wordmark is copper with "CARNES & CANTINA" in white underneath, drawn
 * for a dark background: on cream that subtitle disappears completely.
 * Recolouring somebody's logo to survive our background is not ours to do, so
 * the mark gets a dark plate — which is also what turns it into a sign hanging
 * on a restaurant wall rather than a logo pasted on top, and is what the
 * approved mockups show on every screen. `.chapa-sign` already did this for the
 * prize screen; the header now uses the same primitive at bar scale.
 *
 * The wordmark is a tenant asset addressed the same way premios/page.tsx
 * addresses it, guarded by the same key. It wants a `wordmark_url` in
 * `organizations.theme` the day a second tenant arrives; today the theme only
 * carries the emblem, and the emblem is the fallback here.
 */
export function PickemHeader({
  programSlug,
  programName,
  orgName,
  logoUrl,
  logoAlt,
  poweredBy,
  status,
}: {
  programSlug: string;
  /** The campaign's own name — "NFL Pick'em by Chapa". */
  programName: string;
  orgName: string;
  orgSlug: string;
  logoUrl: string | null;
  logoAlt: string;
  poweredBy: boolean;
  status: ProgramStatus;
}) {
  return (
    // Two rows, the way the mockups draw it: the sign on top, the programme's
    // name and our signature under it. One row was tried first and lost — the
    // frame is at most 400px wide, and a wordmark plus a name plus two pills on
    // a single line truncated the name to "NFL P…" on every screen.
    <header className="sg-head pk-head">
      <div className="pk-plate">
        <Link className="pk-plate-top" href={`/p/${programSlug}/`}>
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
        </Link>

        <div className="pk-plate-bottom">
          <span className="pk-plate-text">
            <span className="pk-plate-name">{programName}</span>
            <span className="pk-plate-sig">{poweredBy ? "Powered by Supergana" : orgName}</span>
          </span>

          <span className="pk-head-side">
            {/* The published rules, from every screen.
                08-DECISIONES-ABIERTAS §6 makes written, in-product rules a
                launch blocker for a programme with real prizes. The bar is the
                only navigation the module shows on every screen, so it is the
                only place the link is always one tap away — including from the
                prize screen, where the question that sends somebody looking for
                the rules actually gets asked. */}
            <Link className="sg-pill" href={`/p/${programSlug}/reglas/`}>
              Reglas
            </Link>

            {/* A draft programme renders so the client can walk through it
                before launch, and it says so. Without the label, a preview and
                the live thing are indistinguishable — which is how somebody
                demos a programme to a room and cannot tell them whether it is
                really open. */}
            {status !== "live" ? (
              <span className="sg-pill wait">
                {status === "draft"
                  ? "Vista previa"
                  : status === "paused"
                    ? "En pausa"
                    : "Cerrado"}
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </header>
  );
}

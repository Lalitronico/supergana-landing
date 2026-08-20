import Image from "next/image";
import Link from "next/link";
import type { ProgramStatus } from "@/lib/pickem/schema";

/**
 * The bar the tenant lives in — one row of it.
 *
 * Its sign, the programme's name, and the way out to the rules. One aesthetic,
 * with the client inside it: the programme is sold as *powered by Supergana*,
 * so the cartoon world IS the product and the tenant is the guest.
 *
 * WHY IT IS ONE ROW NOW.
 *
 * It was two — the sign on top, the name and our signature under it — and at
 * ~128px it ate, together with a per-screen dock of up to ~165px, more than a
 * third of a 844px phone before a single match was drawn. Eduardo said so after
 * ten minutes with it on his own iPhone, and he is right: the co-brand is worth
 * saying loudly once, not quietly eighteen times. The full plate moved to the
 * portada's scrolling hero (`PickemPlate`), where the QR lands and where whose
 * game this is is genuinely the first question.
 *
 * What survived the cut is what a bar is FOR: whose place this is (the sign),
 * what this is (the name), and the rules — which 08-DECISIONES-ABIERTAS §6
 * makes a launch blocker for a programme with real prizes, and which have to be
 * one tap from every screen including the prize screen, because that is where
 * the question that sends somebody looking for them actually gets asked.
 *
 * The name gets `min-width: 0` and an ellipsis rather than a guaranteed fit.
 * The earlier attempt at one row truncated it to "NFL P…" — the fix is that the
 * pills got smaller and the wordmark got much smaller, not that the name is
 * allowed to push the row wider than the phone.
 */
export function PickemHeader({
  programSlug,
  programName,
  orgName,
  logoUrl,
  logoAlt,
  status,
}: {
  programSlug: string;
  /** The campaign's own name — "NFL Pick'em by Chapa". */
  programName: string;
  orgName: string;
  logoUrl: string | null;
  logoAlt: string;
  status: ProgramStatus;
}) {
  return (
    <header className="sg-head pk-head">
      <div className="pk-bar">
        <Link className="pk-bar-mark" href={`/p/${programSlug}/`} aria-label={orgName}>
          {logoUrl ? (
            <Image
              src="/brands/chapa/chapa-wordmark-420.png"
              alt={logoAlt}
              width={420}
              height={126}
              priority
            />
          ) : (
            <span className="pk-bar-org">{orgName}</span>
          )}
        </Link>

        {/* The bar already carries the tenant's own sign, so the "by Chapa"
            half of the name is the one part that says nothing new — and it is
            exactly the part the ellipsis was eating ("NFL Pick'em by …").
            Split rather than sliced per-tenant: any programme named "X by Y"
            shows X here; a name without "by" shows whole. */}
        <span className="pk-bar-name">{programName.split(/\s+by\s+/i)[0]}</span>

        <span className="pk-head-side">
          <Link className="sg-pill" href={`/p/${programSlug}/reglas/`} data-tour="head-reglas">
            Reglas
          </Link>

          {/* A draft programme renders so the client can walk through it before
              launch, and it says so. Without the label, a preview and the live
              thing are indistinguishable — which is how somebody demos a
              programme to a room and cannot tell them whether it is really
              open. */}
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
    </header>
  );
}

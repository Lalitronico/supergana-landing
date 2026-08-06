import Image from "next/image";
import Link from "next/link";
import type { ProgramStatus } from "@/lib/pickem/schema";

/**
 * The bar the tenant lives in.
 *
 * Its badge on a dark plate, the programme's name, and Supergana's signature.
 * One aesthetic, with the client inside it: the programme is sold as *powered
 * by Supergana*, so the cartoon world IS the product and the tenant is the
 * guest. Two earlier versions of the demo got this backwards — one gave Chapa
 * a separate sober skin, the other a switch between two skins. Neither is what
 * a co-brand is.
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
  /** The campaign's own name — "NFL Pick'em by Chapa". Already carries the
      tenant, which is why the subtitle does not repeat it: the two together
      wrapped to three lines in a 44px bar. */
  programName: string;
  orgName: string;
  orgSlug: string;
  logoUrl: string | null;
  logoAlt: string;
  poweredBy: boolean;
  status: ProgramStatus;
}) {
  return (
    <header className="sg-head">
      <Link
        href={`/p/${programSlug}/`}
        style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit", minWidth: 0 }}
      >
        {logoUrl ? (
          <span className="chapa-badge">
            <Image src={logoUrl} alt={logoAlt} width={30} height={30} />
          </span>
        ) : null}
        <span style={{ minWidth: 0 }}>
          <span
            className="sg-h"
            style={{ fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {programName}
          </span>
          <span className="sg-powered" style={{ display: "block", whiteSpace: "nowrap" }}>
            {poweredBy ? "Powered by Supergana" : orgName}
          </span>
        </span>
      </Link>

      {/* A draft programme renders so the client can walk through it before
          launch, and it says so. Without the label, a preview and the live
          thing are indistinguishable — which is how somebody demos a programme
          to a room and cannot tell them whether it is really open. */}
      {status !== "live" ? (
        <span className="sg-pill wait" style={{ flexShrink: 0 }}>
          {status === "draft" ? "Vista previa" : status === "paused" ? "En pausa" : "Cerrado"}
        </span>
      ) : null}
    </header>
  );
}

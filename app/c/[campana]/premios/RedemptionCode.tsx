"use client";

import { useState } from "react";
import { nextPrize, prizeDetail, prizeName, type StorePrize } from "@/lib/tickets/store";
import { fuelNextLine } from "../journey/fuelCopy";
import { brandOfLabel } from "@/lib/tickets/brandOf";
import { castForBrand } from "@/lib/tickets/theme";
import { Confetti } from "../Confetti";
import { Mascot } from "../Mascot";
import { CastFigure } from "../fiesta/CastFigure";
import { useStoreState, useTickets } from "../TicketsShell";
import { isPhysicalPrize } from "./PrizeIcon";
import { PrizeArt } from "./PrizeArt";

/**
 * The code, as the prize it is.
 *
 * This screen fixes a real bug and honours a real constraint at the same time.
 * The bug: six characters set as one word overflowed the card at 390px and cut
 * the last letter off — on the one string somebody reads aloud at a counter. The
 * constraint: the alphabet deliberately excludes 0/O/1/I/L so it survives being
 * read aloud, and the layout has to survive it too.
 *
 * Six tiles solve both. Each character gets its own box, so nothing can reflow
 * into a seventh line, and the eye groups them the way somebody dictating them
 * does. The tiles are sized in `ch` off the container, so they shrink together
 * rather than pushing past the ticket's edge.
 *
 * It takes the whole screen instead of sitting at the top of the shelf: the
 * mockups are right that this is the payoff, and a payoff competing with a grid
 * of other prizes is not a payoff. Same route, different state — the flow does
 * not change.
 */
export function RedemptionCode({
  code,
  prize: won,
  onBack,
}: {
  code: string;
  prize: StorePrize;
  onBack: () => void;
}) {
  const { campaign, locale, t, money } = useTickets();
  const { snapshot } = useStoreState();

  const kind = won.kind;
  const prize = prizeName(won, locale);
  const detail = prizeDetail(won, locale);
  const gift = kind === "giftcard";
  const physical = isPhysicalPrize(kind);
  const [copied, setCopied] = useState(false);

  // Copy is a convenience, never a requirement: the code is on screen in big
  // tiles either way, so a browser that refuses the clipboard (plain http on a
  // LAN, an in-app webview) just leaves the button doing nothing visible.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* the tiles are the fallback */
    }
  };
  const balance = snapshot?.points ?? 0;
  const next = nextPrize(snapshot);
  const fmt = (n: number) => n.toLocaleString(locale === "en" ? "en-US" : "es-MX");
  // Who jumps on the ticket: the character of the prize's brand when the prize
  // names one ("Sidral Mundet 1.5 L gratis"), else the cast's host (a gas gift
  // card belongs to nobody in particular).
  const host =
    castForBrand(campaign.theme, brandOfLabel(prize, campaign.brands)?.name) ??
    campaign.theme.cast.find((m) => m.brand === null) ??
    campaign.theme.cast[0] ??
    null;

  return (
    <div className="jr-bands">
      <section className="jr-band rays codepage">
      {/* Over the whole app frame, not the heading's box: a burst thrown from
          a 60px strip has nowhere to go. */}
      <Confetti burst className="over" />
      <div className="tk-codewrap">
        <div className="tk-codehead">
          <h1 className="tk-h" style={{ fontSize: 30 }}>
            {t("jrCodeDone")}
          </h1>
          {host ? (
            <CastFigure member={host} height={168} bob={false} className="jr-code-cast" alt="" />
          ) : (
            <Mascot pose="celebrate" className="tk-codemascot" />
          )}
        </div>
      </div>

      {/* The golden ticket. Rotated a hair, like every other object in this
          system that is meant to feel handled rather than rendered. */}
      <div className={["tk-goldticket", "jr-flip", gift ? "jr-gold-gift" : null].filter(Boolean).join(" ")}>
        {/* Gas-station ticket: a chequered flag along the top edge. */}
        <div className="jr-ticket-flag sg-checker" aria-hidden="true" />
        <span className="tk-kindbadge">
          {t(physical ? "stKindPhysical" : "stKindDigital")}
        </span>

        <p className="tk-goldticket-prize">{prize}</p>
        <p className="tk-goldticket-org">{campaign.orgName}</p>

        {/* The prize's own picture — the real art when the data has it, a drawn
            gift card or the kind icon when it does not — so the ticket shows
            what was just won rather than a generic mascot. */}
        <PrizeArt prize={won} wide />
        {detail.provider && (
          <p className="jr-prize-meta" style={{ textAlign: "center" }}>
            {t("jrDeliveryVia", { provider: detail.provider })}
          </p>
        )}

        <div className="tk-goldticket-rip" />

        <div className="tk-eyebrow" style={{ textAlign: "center" }}>{t(physical ? "stCodeLabel" : "jrCodeEyebrow")}</div>

        {/* One element carries the whole code for a screen reader; the tiles are
            decoration around it. Read character by character it would be
            dictated as six unrelated letters. */}
        <div className="tk-code" role="img" aria-label={t("stCodeAria", { code })}>
          {[...code].map((char, i) => (
            <span
              className="tk-code-tile"
              key={`${i}-${char}`}
              aria-hidden="true"
              style={{ animationDelay: `${0.35 + i * 0.08}s` }}
            >
              {char}
            </span>
          ))}
        </div>

        <button type="button" className="jr-copy" onClick={() => void copy()}>
          {copied ? t("jrCodeCopied") : t("jrCodeCopy")}
        </button>
      </div>

      <div className="tk-card tk-collect">
        <span className="tk-collect-ico" aria-hidden="true">
          {physical ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.4 9.2 5 4.6h14l1.6 4.6" />
              <path d="M4.4 9.2h15.2v10.2H4.4z" />
              <path d="M3.4 9.2h17.2M9.4 19.4v-5.2h5.2v5.2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6.4" y="2.6" width="11.2" height="18.8" rx="2.2" />
              <path d="M10.4 18.6h3.2M9.4 8.4h5.2M9.4 12h5.2" />
            </svg>
          )}
        </span>
        <div>
          <b>{t(physical ? "stShowTitle" : gift ? "jrCodeHowTitle" : "stDigitalTitle")}</b>
          {/* The operator's own delivery note wins over the generic line: it is
              the one that is true for this prize ("al correo registrado, vía
              Tremendous"). */}
          <p className="tk-foot" style={{ marginTop: 4 }}>
            {detail.delivery ?? t(physical ? "stShowSub" : "stDigitalSub")}
          </p>
        </div>
      </div>

      <div className="tk-codefoot">
        <div className="tk-card flat">
          <div className="tk-eyebrow">{t("stBalanceNow")}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <span className="tk-amount" style={{ fontSize: 32 }}>{fmt(balance)}</span>
            <b style={{ fontFamily: "var(--tk-display)", fontSize: 13 }}>{t("pointsUnit")}</b>
          </div>
          {/* The next goal, as the quiet last line: the celebration above is
              about what was just won, not about what is still missing. */}
          {next && !next.affordable && (
            <p className="tk-foot" style={{ marginTop: 6 }}>
              {fuelNextLine({ next, t, locale, money })}
            </p>
          )}
        </div>

        <div className="tk-card flat tk-saved">
          <span className="tk-saved-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9.2" />
              <path d="m8 12.4 2.6 2.6L16 9.6" />
            </svg>
          </span>
          <div>
            <b>{t("stSavedTitle")}</b>
            <p className="tk-foot" style={{ marginTop: 3 }}>{t("stSavedSub")}</p>
          </div>
        </div>
      </div>

      <button type="button" className="tk-btn" onClick={onBack}>
        {t("stBackToPrizes")} →
      </button>
      </section>
    </div>
  );
}

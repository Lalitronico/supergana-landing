"use client";

import { nextPrize } from "@/lib/tickets/store";
import { Confetti } from "../Confetti";
import { Mascot } from "../Mascot";
import { useStoreState, useTickets } from "../TicketsShell";
import { isPhysicalPrize, PrizeIcon } from "./PrizeIcon";
import type { PrizeKind } from "@/lib/tickets/store";

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
  prize,
  kind,
  onBack,
}: {
  code: string;
  prize: string;
  kind: PrizeKind;
  onBack: () => void;
}) {
  const { campaign, locale, t } = useTickets();
  const { snapshot } = useStoreState();

  const physical = isPhysicalPrize(kind);
  const balance = snapshot?.points ?? 0;
  const next = nextPrize(snapshot);
  const fmt = (n: number) => n.toLocaleString(locale === "en" ? "en-US" : "es-MX");

  return (
    <>
      <div className="tk-codewrap">
        <Confetti />
        <div className="tk-codehead">
          <h1 className="tk-h" style={{ fontSize: 30 }}>{t("stRedeemedTitle")}</h1>
          <Mascot pose="celebrate" className="tk-codemascot" />
        </div>
      </div>

      {/* The golden ticket. Rotated a hair, like every other object in this
          system that is meant to feel handled rather than rendered. */}
      <div className="tk-goldticket">
        <span className="tk-kindbadge">
          {t(physical ? "stKindPhysical" : "stKindDigital")}
        </span>

        <p className="tk-goldticket-prize">{prize}</p>
        <p className="tk-goldticket-org">{campaign.orgName}</p>

        {/* The tenant's character on its own ticket, which is what the mockup
            draws. Falls back to the kind icon, so an unthemed campaign still
            gets a picture of what it just won rather than a gap. */}
        {campaign.theme.mascots.ticket ? (
          <Mascot pose="ticket" bob={false} className="tk-goldticket-art" />
        ) : (
          <PrizeIcon kind={kind} className="big" />
        )}

        <div className="tk-goldticket-rip" />

        <div className="tk-eyebrow" style={{ textAlign: "center" }}>{t("stCodeLabel")}</div>

        {/* One element carries the whole code for a screen reader; the tiles are
            decoration around it. Read character by character it would be
            dictated as six unrelated letters. */}
        <div className="tk-code" role="img" aria-label={t("stCodeAria", { code })}>
          {[...code].map((char, i) => (
            <span className="tk-code-tile" key={`${i}-${char}`} aria-hidden="true">
              {char}
            </span>
          ))}
        </div>
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
          <b>{t(physical ? "stShowTitle" : "stDigitalTitle")}</b>
          <p className="tk-foot" style={{ marginTop: 4 }}>
            {t(physical ? "stShowSub" : "stDigitalSub")}
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
          {next && !next.affordable && (
            <p className="tk-foot" style={{ marginTop: 6 }}>
              {t("npMissingLead")}{" "}
              <b style={{ color: "var(--tk-brand-ink)" }}>
                {t("npMissingPts", { points: fmt(next.missing) })}
              </b>
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
    </>
  );
}

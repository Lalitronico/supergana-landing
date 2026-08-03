"use client";

import { prizeName, type StorePrize } from "@/lib/tickets/store";
import { Mascot } from "../Mascot";
import { useTickets } from "../TicketsShell";
import { isPhysicalPrize, PrizeIcon } from "./PrizeIcon";

/**
 * The two-step confirmation, given the drama it deserves.
 *
 * It was two buttons appearing inline in a list row. That is the right number of
 * steps and the wrong amount of weight: the points leave the balance the instant
 * this lands, there is no undo on this screen, and the participant is spending
 * something it took weeks of receipts to earn.
 *
 * The number that makes this a decision instead of a dare is the balance
 * afterwards. It is one subtraction the screen was never doing, and it answers
 * the question somebody actually has before pressing: what am I left with?
 */
export function ConfirmRedeem({
  prize,
  points,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  prize: StorePrize;
  /** Current balance. The remainder is derived here, never passed in. */
  points: number;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { locale, t } = useTickets();
  const fmt = (n: number) => n.toLocaleString(locale === "en" ? "en-US" : "es-MX");
  const after = points - prize.pointsCost;

  return (
    <div
      className="tk-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("stConfirmTitle")}
    >
      <div className="tk-modal confirm">
        <div className="tk-confirmticket">
          <span className="tk-kindbadge">
            {t(isPhysicalPrize(prize.kind) ? "stKindPhysical" : "stKindDigital")}
          </span>

          {/* The remaining stock, stamped on at an angle. Rotated because it is
              the one element here that is about time running out. */}
          <span className="tk-stockstamp">{t("stLeft", { left: prize.remaining })}</span>

          <PrizeIcon kind={prize.kind} className="big" />

          <p className="tk-confirmticket-prize">{prizeName(prize, locale)}</p>
          <p className="tk-confirmticket-cost">
            {t("stCost", { points: fmt(prize.pointsCost) })}
          </p>

          <div className="tk-confirmticket-rip" />

          <p className="tk-confirmticket-after">
            {t("stAfterLead")}{" "}
            <b>{t("stCost", { points: fmt(Math.max(0, after)) })}</b>{" "}
            {t("stAfterRest")}
          </p>
        </div>

        <div className="tk-confirmask">
          <Mascot pose="ticket" bob={false} className="tk-confirmmascot" />
          <div>
            <h2 className="tk-h" style={{ fontSize: 17 }}>{t("stConfirmTitle")}</h2>
            <p className="tk-foot" style={{ marginTop: 4 }}>{t("stConfirmUndo")}</p>
          </div>
        </div>

        {error && <p className="tk-error">{error}</p>}

        <button type="button" className="tk-btn" disabled={busy} onClick={onConfirm}>
          {busy ? t("stRedeeming") : t("stConfirmYes")}
        </button>
        <button type="button" className="tk-btn ghost sm" disabled={busy} onClick={onCancel}>
          {t("stConfirmNo")}
        </button>

        {/* The reassurance that makes spending safe: redeeming costs points, not
            position. It is the client's own rule and it belongs at the moment of
            doubt, not in a note further down the page. */}
        <p className="tk-foot" style={{ marginTop: 10 }}>{t("stConfirmNote")}</p>
      </div>
    </div>
  );
}

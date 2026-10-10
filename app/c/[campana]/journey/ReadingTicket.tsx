"use client";

import { useEffect, useState } from "react";
import type { ReceiptStatus } from "@/lib/tickets/config";
import { Mascot } from "../Mascot";
import { useTickets } from "../TicketsShell";

/**
 * The wait, made watchable.
 *
 * Between "Enviar" and the verdict there are usually a handful of seconds in
 * which an OCR reads the ticket and the gate approves it. A static "we're
 * reviewing" card makes those seconds feel like nothing is happening; this makes
 * them the best part of the flow: the photo the person just took sits on a
 * clipboard while a scanner line passes over it and three steps tick off.
 *
 * Honesty rules, because this screen is the one place the product could lie:
 *   · the steps are paced by the clock, not by real progress — the server does
 *     not report intermediate states — so the copy says what is being done in
 *     general terms and never claims a result;
 *   · past the point where an automatic read normally finishes, the last step
 *     stays "in progress" and the copy admits a person may look at it;
 *   · once the receipt is `in_review` — or has simply outlived the automatic
 *     read — the scanner stops and the screen says so plainly, with the SLA the
 *     campaign promises.
 */
const TEAM_AFTER_SECONDS = 50;

export function ReadingTicket({
  photoUrl,
  status,
  submittedAt,
}: {
  /** The photo this browser just uploaded; null after a reload (it is private). */
  photoUrl: string | null;
  status: ReceiptStatus;
  /** ISO time the receipt was sent, so a reload resumes mid-wait. */
  submittedAt: string;
}) {
  const { campaign, t } = useTickets();
  // Seconds since the receipt was sent. Seeded from the server's timestamp so a
  // reload does not restart the show from "Leyendo…" on a ticket that has been
  // waiting for ten minutes; clamped at 0 for a phone whose clock runs behind.
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(submittedAt).getTime()) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // The automatic read answers in seconds. A receipt still unresolved after
  // this long was not approved by it, so it is waiting for a person — and the
  // honest thing is to say so, not to keep a scanner running over it. (The
  // status stays `received` until a reviewer opens it, so the status alone
  // would never tell us.)
  const withTeam = status === "in_review" || elapsed >= TEAM_AFTER_SECONDS;

  // Seconds at which each step becomes the active one.
  const active = withTeam ? 3 : elapsed < 4 ? 0 : elapsed < 9 ? 1 : 2;
  const steps = [t("jrRead1"), t("jrRead2"), t("jrRead3")];
  const slow = !withTeam && elapsed >= 25;

  return (
    <div className="jr-read">
      <div className={["jr-clip", withTeam ? "paused" : null].filter(Boolean).join(" ")}>
        <div className="jr-paper">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob: URL of the photo just taken
            <img src={photoUrl} alt={t("jrReadAlt")} />
          ) : (
            // After a reload the original is gone from the browser and private
            // in storage, so the scanner passes over a drawn stand-in instead of
            // a broken image.
            <div className="jr-fake" aria-hidden="true">
              <i style={{ width: "58%" }} /><i style={{ width: "36%" }} />
              <i /><i style={{ width: "82%" }} /><i style={{ width: "70%" }} />
              <i /><i style={{ width: "76%" }} /><i style={{ width: "44%" }} />
              <i style={{ width: "88%" }} /><i style={{ width: "52%" }} />
            </div>
          )}
          <span className="jr-scan" aria-hidden="true" />
        </div>
      </div>

      <div className="jr-reader">
        <Mascot pose="ticket" className="jr-reader-mascot" />
        <div role="status" aria-live="polite" className="jr-reader-text">
          <h1 className="tk-h" style={{ fontSize: 22 }}>
            {withTeam ? t("jrReadInReviewTitle") : t("jrReadTitle")}
          </h1>
          {withTeam ? (
            <p className="tk-body" style={{ fontSize: 13.5, marginTop: 6 }}>
              {t("jrReadInReview", { hours: campaign.reviewSlaHours })}
            </p>
          ) : (
            <ol className="jr-steps">
              {steps.map((label, i) => (
                <li key={label} className={i < active ? "done" : i === active ? "now" : "next"}>
                  <span className="jr-step-dot" aria-hidden="true">{i < active ? "✓" : ""}</span>
                  {i === 2 && slow && i === active ? t("jrReadLong") : label}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {!withTeam && <p className="tk-foot jr-honest">{t("jrReadHonest")}</p>}
    </div>
  );
}

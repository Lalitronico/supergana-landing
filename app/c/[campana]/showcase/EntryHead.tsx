"use client";

import type { ReactNode } from "react";
import { useTickets } from "../TicketsShell";
import { Mascot } from "../Mascot";
import { CastFigure } from "../fiesta/CastFigure";
import { stageCast } from "../fiesta/stage";

/**
 * The heading block shared by every entry screen (sign in, create account,
 * profile): step counter, title, one line of context, and the tenant's mascot
 * peeking in when it has one.
 *
 * One component so the four screens cannot drift apart, which is what makes a
 * flow feel like a flow. The mascot is a smaller crop than the home's: here it
 * is company, not the headline, and it must never push the first field below
 * the keyboard line.
 */
export function EntryHead({
  step,
  title,
  sub,
}: {
  /** null: not a step of the sign-up (a login for somebody who already has an account). */
  step: number | null;
  title: ReactNode;
  sub: ReactNode;
}) {
  const { campaign, t } = useTickets();
  const { host } = stageCast(campaign.theme);
  const hasArt = Boolean(host || campaign.theme.mascots.greet);
  // Colour by step, so the three screens of the flow feel like three stops.
  const tone = step === null ? "blue" : step === 1 ? "yellow" : "pink";

  return (
    <div className={hasArt ? `sh-entry-head art ${tone}` : `sh-entry-head ${tone}`}>
      <div className="sh-entry-text">
        {step !== null && (
          <div className="sh-steps" aria-label={t("regStep", { n: step })}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={n <= step ? "on" : undefined} />
            ))}
            <span className="tk-eyebrow">{t("regStep", { n: step })}</span>
          </div>
        )}
        <h1 className="tk-h sh-entry-title">{title}</h1>
        <p className="tk-body sh-entry-sub">{sub}</p>
      </div>
      {hasArt && (
        <div className="sh-entry-art">
          {host ? <CastFigure member={host} height={128} alt="" /> : <Mascot pose="greet" />}
        </div>
      )}
    </div>
  );
}

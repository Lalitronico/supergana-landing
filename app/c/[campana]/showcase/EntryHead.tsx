"use client";

import type { ReactNode } from "react";
import { useTickets } from "../TicketsShell";
import { Mascot } from "../Mascot";

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
  const hasArt = Boolean(campaign.theme.mascots.greet);

  return (
    <div className={hasArt ? "sh-entry-head art" : "sh-entry-head"}>
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
          <Mascot pose="greet" />
        </div>
      )}
    </div>
  );
}

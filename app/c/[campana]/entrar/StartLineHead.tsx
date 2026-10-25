"use client";

import type { ReactNode } from "react";
import { useTickets } from "../TicketsShell";
import { Headline } from "../Headline";
import { Mascot } from "../Mascot";
import { CastFigure } from "../fiesta/CastFigure";
import { stageCast } from "../fiesta/stage";

/**
 * Header of both steps of the WhatsApp sign-in: a compact version of the
 * campaign home's hero, drawn as the starting line of the race. Sunburst sky in
 * the campaign's backdrop, a checkered band along the bottom, and the host
 * standing on it. Styles live in ./start-line.css (prefix `wa-line-`).
 */
export type StartPhase = "bib" | "lights" | "go";

export interface StartLineHeadProps {
  /** Step of the 3-step sign-up this screen is (always 1 on the phone door). */
  step: number;
  /** Full headline, plain text. */
  title: string;
  /** Substring of `title` painted on the yellow highlighter (see Headline). */
  mark: string;
  sub: ReactNode;
  /** Which half of the sign-in is on screen; "go" = code accepted, leaving. */
  phase: StartPhase;
}

export function StartLineHead({ step, title, mark, sub, phase }: StartLineHeadProps) {
  const { t, campaign } = useTickets();
  const { host } = stageCast(campaign.theme);
  const hasMascot = Boolean(campaign.theme.mascots.greet);

  return (
    <div className={host ? "wa-line" : "wa-line wa-line-mascot"} data-backdrop={campaign.stage.backdrop} data-phase={phase}>
      <div className="wa-line-text">
        <div className="wa-line-eyebrow">
          <span className="wa-line-pips" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <i key={n} className={n <= step ? "on" : undefined} />
            ))}
          </span>
          <span className="tk-eyebrow">
            {t("waStartLine")} · {t("regStep", { n: step })}
          </span>
        </div>
        <h1 className="tk-h wa-line-title">
          {/* "mark" (highlighter), not "brand": a red brand word vanishes on a red sky. */}
          <Headline text={title} mark={mark} as="mark" />
        </h1>
        <p className="wa-line-sub">{sub}</p>
      </div>

      {/* Pure decoration from here down. No lamps up here: the gantry below is
          the code step's one set of starting lights, and a second set competed
          with it (and with the host's hat). */}
      <div className="wa-line-band" aria-hidden="true" />
      {(host || hasMascot) && (
        <div className="wa-line-host" aria-hidden="true">
          {host ? <CastFigure member={host} height={118} alt="" /> : <Mascot pose="greet" />}
        </div>
      )}
    </div>
  );
}

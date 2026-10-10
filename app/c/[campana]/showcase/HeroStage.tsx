"use client";

import type { CSSProperties } from "react";
import { useTickets } from "../TicketsShell";
import { Headline } from "../Headline";
import { Mascot } from "../Mascot";
import { CastFigure } from "../fiesta/CastFigure";
import { GasPump } from "../fiesta/GasPump";
import { stageCast } from "../fiesta/stage";

/**
 * The home's opening scene: a sunburst, a headline the size of a billboard, and
 * the cast gathered around the pump. Everything that is not the headline is
 * decoration (aria-hidden): the page reads fine with the stage removed, which is
 * also what happens when the tenant has no cast.
 *
 * Opt-in by data: a campaign with a cast gets its characters on stage; one
 * without gets its mascot (or nobody) beside the same pump, never a hole.
 */
export function HeroStage({ org }: { org: string }) {
  const { campaign, t } = useTickets();
  const { host, others } = stageCast(campaign.theme, 4);
  const rate = campaign.pointsPerDollar;
  const hasMascot = Boolean(campaign.theme.mascots.greet);

  const pop = (n: number): CSSProperties => ({ "--d": `${180 + n * 110}ms` }) as CSSProperties;

  return (
    <div className="sh-hero">
      <h1 className="tk-h sh-title">
        <Headline text={t("accHeroTitle", { org })} mark={t("accHeroMark", { org })} as="brand" />
      </h1>
      <p className="sh-sub">{t("accHeroSub")}</p>

      <div className="sh-stage" aria-hidden="true">
        <div className="sh-stage-floor" />
        {others[2] && (
          <div className="sh-pop sh-slot s4" style={pop(4)}>
            <CastFigure member={others[2]} height={118} delay={900} alt="" />
          </div>
        )}
        {others[0] && (
          <div className="sh-pop sh-slot s2" style={pop(2)}>
            <CastFigure member={others[0]} height={142} delay={400} alt="" />
          </div>
        )}
        <div className="sh-pop sh-slot pump" style={pop(1)}>
          <GasPump digits={`+${rate}`} height={176} />
        </div>
        {host ? (
          <div className="sh-pop sh-slot s1" style={pop(0)}>
            <CastFigure member={host} height={166} alt="" />
          </div>
        ) : (
          hasMascot && (
            <div className="sh-pop sh-slot s1 mascot" style={pop(0)}>
              <Mascot pose="greet" />
            </div>
          )
        )}
        {others[1] && (
          <div className="sh-pop sh-slot s3" style={pop(3)}>
            <CastFigure member={others[1]} height={104} delay={700} alt="" />
          </div>
        )}
      </div>
    </div>
  );
}

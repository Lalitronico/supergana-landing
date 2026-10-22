"use client";

import type { CSSProperties } from "react";
import type { StageProp } from "@/lib/tickets/config";
import { useTickets } from "../TicketsShell";
import { Headline } from "../Headline";
import { Mascot } from "../Mascot";
import { CastFigure } from "../fiesta/CastFigure";
import { GasPump } from "../fiesta/GasPump";
import { stageCast } from "../fiesta/stage";
import { SafeImg } from "./SafeImg";

/**
 * The prop in the middle of the stage.
 *
 * The pump draws its own "+N" dial (points per dollar). A tenant's picture
 * stands alone unless the campaign places that dial over it (`stage.readout`,
 * fractions of the picture's box, e.g. a thermometer drawn on a grill's lid).
 */
function StageProp({ prop, rate }: { prop: StageProp; rate: number }) {
  if (prop.kind === "pump") return <GasPump digits={`+${rate}`} height={228} />;

  const { readout } = prop;
  return (
    <div className="sh-prop">
      <SafeImg src={prop.url} alt="" fallback={null} />
      {readout && (
        <span
          className="sh-dial"
          style={{
            left: `${readout.x * 100}%`,
            top: `${readout.y * 100}%`,
            width: `${readout.size * 100}%`,
          }}
        >
          +{rate}
        </span>
      )}
    </div>
  );
}

/**
 * The home's opening scene: a sunburst, a headline the size of a billboard, and
 * the cast gathered around the campaign's prop. Everything that is not the
 * headline is decoration (aria-hidden): the page reads fine with the stage
 * removed, which is also what happens when the tenant has no cast.
 *
 * Opt-in by data: a campaign with a cast gets its characters on stage; one
 * without gets its mascot (or nobody). The prop and the sky come from
 * `config.stage`, so the fuel pump stays Ticket al Tanque's and a grill can be
 * Love & Kitchen's without either knowing about the other.
 */
export function HeroStage({ org }: { org: string }) {
  const { campaign, t } = useTickets();
  const { host, others } = stageCast(campaign.theme, 3);
  const rate = campaign.pointsPerDollar;
  const hasMascot = Boolean(campaign.theme.mascots.greet);
  const prop = campaign.stage.prop;

  const pop = (n: number): CSSProperties => ({ "--d": `${180 + n * 110}ms` }) as CSSProperties;

  return (
    <div className="sh-hero">
      <h1 className="tk-h sh-title">
        <Headline text={t("accHeroTitle", { org })} mark={t("accHeroMark", { org })} as="brand" />
      </h1>
      <p className="sh-sub">{t("accHeroSub")}</p>

      <div className="sh-stage" aria-hidden="true">
        <div className="sh-stage-floor" />
        {prop && (
          <div className={`sh-pop sh-slot pump ${prop.kind}`} style={pop(1)}>
            <StageProp prop={prop} rate={rate} />
          </div>
        )}
        {others[2] && (
          <div className="sh-pop sh-slot s4" style={pop(4)}>
            <CastFigure member={others[2]} height={150} delay={900} alt="" />
          </div>
        )}
        {others[0] && (
          <div className="sh-pop sh-slot s2" style={pop(2)}>
            <CastFigure member={others[0]} height={160} delay={400} alt="" />
          </div>
        )}
        {host ? (
          <div className="sh-pop sh-slot s1" style={pop(0)}>
            <CastFigure member={host} height={190} alt="" />
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
            <CastFigure member={others[1]} height={152} delay={700} alt="" />
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTickets } from "./TicketsShell";
import { Confetti } from "./Confetti";
import { Mascot } from "./Mascot";
import { NextPrizeProgress } from "./NextPrizeProgress";
import { CastFigure } from "./fiesta/CastFigure";
import { BrandChip } from "./journey/BrandChip";
import { PumpDisplay } from "./journey/PumpDisplay";
import { castForBrand } from "@/lib/tickets/theme";
import { dominantBrand } from "@/lib/tickets/brandOf";
import type { Me } from "./useMe";

interface Celebration {
  points: number;
  /** Balance before this approval, so the gauge can start where it was. */
  fromPoints: number;
  gotReward: boolean;
  /** Catalog products read on the receipt(s) that just flipped. */
  products: string[];
}

/**
 * The moment the module exists for: a receipt flipping to "approved" while
 * the person is looking at the screen. The polling in useMe already notices
 * the transition — this celebrates it instead of letting the pill change
 * silently. Mounted on the screens someone actually waits on (subir, panel).
 *
 * Only fires on a transition seen live: if the approval happened before the
 * screen opened, the panel already tells that story and a popup would just
 * repeat it.
 */
export function ApprovalCelebration({ me }: { me: Me | null }) {
  const { campaign, t, base, money } = useTickets();
  const [show, setShow] = useState<Celebration | null>(null);
  const prev = useRef<{ open: Set<string>; points: number; rewards: number } | null>(null);

  useEffect(() => {
    if (!me) return;
    const open = new Set(
      me.receipts
        .filter((r) => r.status === "received" || r.status === "in_review")
        .map((r) => r.id),
    );
    const snapshot = { open, points: me.points, rewards: me.rewards.length };

    if (prev.current) {
      const approvedNow = me.receipts.some(
        (r) => prev.current!.open.has(r.id) && r.status === "approved",
      );
      if (approvedNow) {
        const flipped = me.receipts.filter(
          (r) => prev.current!.open.has(r.id) && r.status === "approved",
        );
        setShow({
          points: Math.max(0, me.points - prev.current.points),
          fromPoints: prev.current.points,
          gotReward: me.rewards.length > prev.current.rewards,
          products: [...new Set(flipped.flatMap((r) => r.products ?? []))],
        });
        // A short double tap on phones that support it: the win is felt, not
        // just seen. Silently ignored elsewhere (iOS Safari has no vibrate).
        try {
          navigator.vibrate?.([30, 60, 30]);
        } catch {
          /* decorative */
        }
      }
    }
    prev.current = snapshot;
  }, [me]);

  if (!show) return null;

  const { dominant, byLabel } = dominantBrand(show.products, campaign.brands);
  // Whose celebration it is: the character who holds the brand that earned the
  // most on this ticket; if the basket had no brand we know, the host of the
  // cast; with no cast at all (a single-mascot tenant), the mascot as before.
  const member =
    castForBrand(campaign.theme, dominant?.name) ??
    campaign.theme.cast.find((m) => m.brand === null) ??
    campaign.theme.cast[0] ??
    null;
  const hasMascot = Boolean(campaign.theme.mascots.celebrate);
  const hasStore = campaign.mechanic === "accumulation";

  // Sunburst in the brand's colour (or the system yellow), lighter on the
  // alternate rays so it reads as light and not as stripes.
  const rays = dominant?.color ?? "var(--tk-yellow)";

  return (
    <div
      className="tk-overlay jr-party"
      role="dialog"
      aria-modal="true"
      aria-label={t("clbTitle")}
      style={{
        ["--rays-a" as string]: rays,
        ["--rays-b" as string]: `color-mix(in srgb, ${rays} 30%, #ffd93d)`,
      }}
    >
      <div className="jr-party-rays sg-rays" aria-hidden="true" />
      {/* The thrown burst lives above everything; the rain behind the card. */}
      <Confetti className="over" burst />

      <div className="jr-party-body">
        <div className="jr-party-stage">
          {member ? (
            <CastFigure member={member} height="var(--jr-cast-h, 168px)" bob={false} className="jr-party-cast" alt="" />
          ) : hasMascot ? (
            <Mascot pose="celebrate" bob={false} className="jr-party-cast jr-pop" />
          ) : (
            <div className="tk-modal-emoji" aria-hidden="true">🎉</div>
          )}
        </div>

        <div className="jr-party-card">
          <h2 className="tk-h jr-party-title">{t("clbTitle")}</h2>

          {show.points > 0 && (
            <PumpDisplay
              value={show.points}
              unit={t("pointsUnit")}
              label={`+${show.points} ${t("pointsUnit")}`}
            />
          )}

          {(show.points === 0 || show.gotReward) && (
            <p className="tk-body" style={{ fontSize: 14.5, marginTop: 8 }}>
              {show.points === 0 && t("clbApproved")}
              {show.points === 0 && show.gotReward && " "}
              {show.gotReward && t("clbReward", { amount: money(campaign.rewardCents) })}
            </p>
          )}

          {/* What was actually read on THEIR ticket, in the colour of each
              brand: proof the reader understood it. Absent when the review was
              manual and nobody matched lines to products. */}
          {show.products.length > 0 && (
            <div className="jr-found">
              <div className="tk-eyebrow">{t("jrClbFound")}</div>
              <ul>
                {show.products.slice(0, 3).map((name, i) => (
                  <BrandChip
                    key={name}
                    label={name}
                    brand={byLabel[i]}
                    style={{ animationDelay: `${0.9 + i * 0.12}s` }}
                  />
                ))}
                {show.products.length > 3 && (
                  <li className="jr-chip more" style={{ animationDelay: "1.3s" }}>
                    +{show.products.length - 3} {t("jrMore")}
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* The tank fills from where it was to where it is now. */}
          <NextPrizeProgress compact fromPoints={show.fromPoints} />
        </div>

        <div className="jr-party-actions">
          <Link
            href={hasStore && !show.gotReward ? `${base}premios/` : `${base}panel/`}
            className="tk-btn"
            onClick={() => setShow(null)}
          >
            {hasStore && !show.gotReward ? t("jrClbStore") : t("clbCta")} →
          </Link>
          <button type="button" className="jr-party-close" onClick={() => setShow(null)}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

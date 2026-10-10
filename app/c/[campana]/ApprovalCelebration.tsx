"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTickets } from "./TicketsShell";
import { Confetti } from "./Confetti";
import { Mascot } from "./Mascot";
import { NextPrizeProgress } from "./NextPrizeProgress";
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
 * 0 → `target` over ~1s, easing out, so "+150" is earned on screen instead of
 * appearing. Starts after a short beat (the modal is still popping in) and
 * jumps straight to the final number under prefers-reduced-motion.
 */
function useCountUp(target: number, delayMs = 450, durationMs = 1100): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setValue(target), 0);
      return () => clearTimeout(id);
    }
    let frame = 0;
    const begin = performance.now() + delayMs;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - begin) / durationMs));
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, delayMs, durationMs]);
  return value;
}

/** The "+150 pts" object. Its own component so the hook only runs when shown. */
function PointsBurst({ points }: { points: number }) {
  const { locale, t } = useTickets();
  const shown = useCountUp(points);
  return (
    <div className="tk-plusbadge jr-plus" aria-label={`+${points} ${t("pointsUnit")}`}>
      <b aria-hidden="true">+{shown.toLocaleString(locale === "en" ? "en-US" : "es-MX")}</b>
      <span aria-hidden="true">{t("pointsUnit")}</span>
    </div>
  );
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

  const hasMascot = Boolean(campaign.theme.mascots.celebrate);
  const hasStore = campaign.mechanic === "accumulation";

  return (
    <div className="tk-overlay" role="dialog" aria-modal="true" aria-label={t("clbTitle")}>
      {/* Confetti outside the card, over the whole overlay: it is the room
          celebrating, not a decoration inside a box. The burst variant shoots
          out from behind the card; the falling rain keeps it going after. */}
      <Confetti className="over" burst />

      <div className="tk-modal celebrate jr-celebrate">
        {/* The tenant's mascot when it has one, the system's emoji when it
            doesn't. Neither is load-bearing — the points card below is. */}
        {hasMascot ? (
          <Mascot pose="celebrate" bob={false} className="tk-modal-mascot jr-pop" />
        ) : (
          <div className="tk-modal-emoji" aria-hidden="true">🎉</div>
        )}

        <h2 className="tk-h" style={{ fontSize: 24 }}>{t("clbTitle")}</h2>

        {/* The number gets its own object rather than sitting inside a
            sentence: "+50 pts" is what the person came to see, and it counts
            up from zero so it is earned on screen. */}
        {show.points > 0 && <PointsBurst points={show.points} />}

        {(show.points === 0 || show.gotReward) && (
          <p className="tk-body" style={{ fontSize: 14.5, marginTop: 8 }}>
            {show.points === 0 && t("clbApproved")}
            {show.points === 0 && show.gotReward && " "}
            {show.gotReward && t("clbReward", { amount: money(campaign.rewardCents) })}
          </p>
        )}

        {/* What was actually read on THEIR ticket: proof the reader understood
            it, and the most "it works" detail the screen can show. Absent when
            the review was manual and nobody matched lines to products. */}
        {show.products.length > 0 && (
          <div className="jr-found">
            <div className="tk-eyebrow">{t("jrClbFound")}</div>
            <ul>
              {show.products.slice(0, 3).map((name, i) => (
                <li key={name} style={{ animationDelay: `${0.9 + i * 0.12}s` }}>{name}</li>
              ))}
              {/* A long basket must not push the buttons off the screen. */}
              {show.products.length > 3 && (
                <li className="more" style={{ animationDelay: "1.3s" }}>
                  +{show.products.length - 3} {t("jrMore")}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* The tank fills from where it was to where it is now. Silent on
            campaigns with no store, and the reason this modal ends in a
            decision rather than in an acknowledgement. */}
        <NextPrizeProgress compact fromPoints={show.fromPoints} />

        <Link
          href={hasStore && !show.gotReward ? `${base}premios/` : `${base}panel/`}
          className="tk-btn"
          style={{ marginTop: 16 }}
          onClick={() => setShow(null)}
        >
          {hasStore && !show.gotReward ? t("jrClbStore") : t("clbCta")} →
        </Link>
        <button type="button" className="tk-linkbtn" style={{ marginTop: 6 }} onClick={() => setShow(null)}>
          {t("close")}
        </button>
      </div>
    </div>
  );
}

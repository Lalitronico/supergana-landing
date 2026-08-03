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
  gotReward: boolean;
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
  const { campaign, locale, t, base, money } = useTickets();
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
        setShow({
          points: Math.max(0, me.points - prev.current.points),
          gotReward: me.rewards.length > prev.current.rewards,
        });
      }
    }
    prev.current = snapshot;
  }, [me]);

  if (!show) return null;

  const hasMascot = Boolean(campaign.theme.mascots.celebrate);

  return (
    <div className="tk-overlay" role="dialog" aria-modal="true" aria-label={t("clbTitle")}>
      {/* Confetti outside the card, over the whole overlay: it is the room
          celebrating, not a decoration inside a box. */}
      <Confetti className="over" />

      <div className="tk-modal celebrate">
        {/* The tenant's mascot when it has one, the system's emoji when it
            doesn't. Neither is load-bearing — the points card below is. */}
        {hasMascot ? (
          <Mascot pose="celebrate" bob={false} className="tk-modal-mascot" />
        ) : (
          <div className="tk-modal-emoji" aria-hidden="true">🎉</div>
        )}

        <h2 className="tk-h" style={{ fontSize: 24 }}>{t("clbTitle")}</h2>

        {/* The number gets its own object rather than sitting inside a
            sentence: "+50 pts" is what the person came to see, and the mockup
            is right that it should be the loudest thing on the card. */}
        {show.points > 0 && (
          <div className="tk-plusbadge">
            <b>+{show.points.toLocaleString(locale === "en" ? "en-US" : "es-MX")}</b>
            <span>{t("pointsUnit")}</span>
          </div>
        )}

        {(show.points === 0 || show.gotReward) && (
          <p className="tk-body" style={{ fontSize: 14.5, marginTop: 8 }}>
            {show.points === 0 && t("clbApproved")}
            {show.points === 0 && show.gotReward && " "}
            {show.gotReward && t("clbReward", { amount: money(campaign.rewardCents) })}
          </p>
        )}

        {/* What the new balance is now worth. Silent on campaigns with no
            store, and the reason this modal ends in a decision rather than in
            an acknowledgement. */}
        <NextPrizeProgress compact />

        <Link
          href={`${base}panel/`}
          className="tk-btn"
          style={{ marginTop: 16 }}
          onClick={() => setShow(null)}
        >
          {t("clbCta")} →
        </Link>
        <button type="button" className="tk-linkbtn" style={{ marginTop: 10 }} onClick={() => setShow(null)}>
          {t("close")}
        </button>
      </div>
    </div>
  );
}

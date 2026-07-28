"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTickets } from "./TicketsShell";
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
        setShow({
          points: Math.max(0, me.points - prev.current.points),
          gotReward: me.rewards.length > prev.current.rewards,
        });
      }
    }
    prev.current = snapshot;
  }, [me]);

  if (!show) return null;

  return (
    <div className="tk-overlay" role="dialog" aria-modal="true" aria-label={t("clbTitle")}>
      <div className="tk-modal">
        <div className="tk-modal-emoji" aria-hidden="true">🎉</div>
        <h2 className="tk-h" style={{ fontSize: 24 }}>{t("clbTitle")}</h2>
        <p className="tk-body" style={{ fontSize: 14.5, marginTop: 8 }}>
          {show.points > 0 && t("clbPoints", { points: show.points })}
          {show.points > 0 && show.gotReward && " "}
          {show.gotReward && t("clbReward", { amount: money(campaign.rewardCents) })}
        </p>
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

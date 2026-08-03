"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { useSession, useTickets } from "../TicketsShell";
import { PrizeStore } from "./PrizeStore";

/**
 * The Prize Store as a destination of its own.
 *
 * It used to be the third card down inside Mi panel, which buried the reason
 * the points exist under the ledger that counts them. A tab of its own is what
 * the mockups asked for and what the mechanic deserves: in an accumulation
 * campaign the store IS the goal, and a goal should be one tap away.
 *
 * Threshold campaigns never reach here — they have no balance to spend, so the
 * shell renders no tab and this route 404s rather than showing an empty shelf.
 */
export default function PrizesPage() {
  const { campaign, t, base } = useTickets();
  const router = useRouter();
  const { status, me, reload } = useSession();

  useEffect(() => {
    if (status === "anon") router.replace(`${base}entrar/?next=premios`);
    if (status === "no-profile") router.replace(`${base}registro/`);
  }, [status, router, base]);

  if (campaign.mechanic !== "accumulation") notFound();

  if (status === "loading" || status === "anon" || status === "no-profile" || !me) {
    return (
      <div className="tk-pad">
        <p className="tk-body">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="tk-pad">
      {/* onRedeemed refreshes the shared session, which is what repaints the
          balance chip in the header — the number the participant just spent.
          The shelf itself reloads through the store state, inside PrizeStore. */}
      <PrizeStore slug={campaign.slug} onRedeemed={reload} />
    </div>
  );
}

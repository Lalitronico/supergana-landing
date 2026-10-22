"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, useTickets } from "./TicketsShell";
import { Confetti } from "./Confetti";
import { Mascot } from "./Mascot";
import { NextPrizeProgress } from "./NextPrizeProgress";
import { CastFigure } from "./fiesta/CastFigure";
import { BrandChip } from "./journey/BrandChip";
import { PumpDisplay } from "./journey/PumpDisplay";
import { castForBrand, castMember } from "@/lib/tickets/theme";
import { dominantBrand } from "@/lib/tickets/brandOf";
import type { MeReceipt } from "./useMe";

type Verdict =
  | {
      kind: "approved";
      points: number;
      /** Balance before this approval, so the gauge can start where it was. */
      fromPoints: number;
      gotReward: boolean;
      /** Catalog products read on the receipt(s) that just flipped. */
      products: string[];
    }
  | { kind: "needs_new_image" | "rejected"; reason: string | null };

const isOpen = (r: MeReceipt) => r.status === "received" || r.status === "in_review";

/**
 * Receipts this device saw in flight, per participant and campaign.
 *
 * In storage, not just in memory, because the verdict often lands while the
 * page is not there to see it: the phone was locked, the participant switched
 * apps, or iOS discarded the tab and reloaded it on return. An in-memory
 * "before" dies with the page, and the approval then arrived in silence — which
 * is exactly how a manually approved ticket went unnoticed in the first demo.
 */
const watchKey = (slug: string, participantId: string) => `tk-watch:${slug}:${participantId}`;

const readWatched = (key: string): Set<string> => {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
};

const writeWatched = (key: string, ids: Set<string>) => {
  try {
    if (ids.size > 0) window.localStorage.setItem(key, JSON.stringify([...ids]));
    else window.localStorage.removeItem(key);
  } catch {
    /* private mode or full storage: the in-memory set still covers this page */
  }
};

/**
 * The moment the module exists for: a receipt's verdict, told to the person
 * who is waiting for it, on whatever screen they happen to be.
 *
 * Mounted once, in the shell. It used to live on the two screens people wait
 * on (subir, panel) and to fire only on a transition that screen saw live, so a
 * verdict that landed while the participant was on the home screen, or after a
 * reload, changed a pill nobody was looking at. Now every receipt this device
 * saw in flight is remembered until its verdict has been shown:
 *
 *   · approved → the full celebration (points on the pump, the brand's
 *     character, what was read on the ticket);
 *   · needs a new image / rejected → a plain notice with the reason and the
 *     way forward. Nobody should have to find out from the panel.
 *
 * Only receipts seen in flight HERE count: opening the app on a second phone
 * does not replay old verdicts — the panel already tells that story.
 */
export function ApprovalCelebration() {
  const { campaign, t, base, money } = useTickets();
  const { me } = useSession();
  const [show, setShow] = useState<Verdict | null>(null);
  const watched = useRef<{ key: string; ids: Set<string> } | null>(null);
  // In-session balance, for one race only: see `credited` below.
  const lastPoints = useRef<number | null>(null);

  useEffect(() => {
    const participantId = me?.participant?.id;
    if (!me || !participantId) return;

    const key = watchKey(campaign.slug, participantId);
    if (watched.current?.key !== key) watched.current = { key, ids: readWatched(key) };
    const ids = watched.current.ids;

    const flipped = me.receipts.filter((r) => ids.has(r.id) && !isOpen(r));
    const present = new Set(me.receipts.map((r) => r.id));
    for (const id of [...ids]) if (!present.has(id)) ids.delete(id);
    for (const r of flipped) ids.delete(r.id);
    for (const r of me.receipts) if (isOpen(r)) ids.add(r.id);
    writeWatched(key, ids);

    const before = lastPoints.current;
    lastPoints.current = me.points;
    if (flipped.length === 0) return;

    const approved = flipped.filter((r) => r.status === "approved");
    if (approved.length > 0) {
      // Each receipt carries what it credited. The in-session balance difference
      // is only the fallback for the poll that sees the approval a beat before
      // its ledger row, which printed "+0".
      const credited = approved.reduce((sum, r) => sum + (r.points ?? 0), 0);
      const gained = credited || (before !== null ? Math.max(0, me.points - before) : 0);
      setShow({
        kind: "approved",
        points: gained,
        fromPoints: Math.max(0, me.points - gained),
        gotReward: me.rewards.some((rw) => approved.some((r) => r.id === rw.receipt_id)),
        products: [...new Set(approved.flatMap((r) => r.products ?? []))],
      });
      // A short double tap on phones that support it: the win is felt, not
      // just seen. Silently ignored elsewhere (iOS Safari has no vibrate).
      try {
        navigator.vibrate?.([30, 60, 30]);
      } catch {
        /* decorative */
      }
      return;
    }

    const latest = flipped[0];
    setShow({
      kind: latest.status === "rejected" ? "rejected" : "needs_new_image",
      reason: latest.reject_reason,
    });
  }, [me, campaign.slug]);

  if (!show) return null;

  const { cast } = campaign.theme;
  const own = castMember(campaign.theme, me?.participant?.avatar);
  const host = cast.find((m) => m.brand === null) ?? cast[0] ?? null;

  // ---- not approved: say so, say why, and show the way forward -------------
  if (show.kind !== "approved") {
    const member = own ?? host;
    const retry = show.kind === "needs_new_image";
    return (
      <div className="tk-overlay" role="dialog" aria-modal="true" aria-labelledby="tk-verdict-title">
        <div className="tk-modal tk-verdict">
          {member ? (
            <CastFigure member={member} height={112} bob={false} className="tk-verdict-cast" alt="" />
          ) : (
            campaign.theme.mascots.ticket && <Mascot pose="ticket" bob={false} />
          )}
          <h2 id="tk-verdict-title" className="tk-h" style={{ fontSize: 21, marginTop: 10 }}>
            {retry ? t("vrdNewImageTitle") : t("vrdRejectedTitle")}
          </h2>
          <p className="tk-body" style={{ fontSize: 14, marginTop: 8 }}>
            {show.reason ? t("pnRejected", { reason: show.reason }) : t("pnNeedsNewImage")}
          </p>
          <Link
            href={retry ? `${base}subir/` : `${base}panel/`}
            className="tk-btn"
            style={{ marginTop: 16, width: "100%" }}
            onClick={() => setShow(null)}
          >
            {retry ? t("vrdNewImageCta") : t("clbCta")} →
          </Link>
          <button type="button" className="jr-party-close" onClick={() => setShow(null)}>
            {t("close")}
          </button>
        </div>
      </div>
    );
  }

  // ---- approved: the party -------------------------------------------------
  const { dominant, byLabel } = dominantBrand(show.products, campaign.brands);
  // Whose celebration it is: the character who holds the brand that earned the
  // most on this ticket; with no brand we know, the participant's own
  // character, then the host of the cast; with no cast at all (a single-mascot
  // tenant), the mascot as before.
  const member = castForBrand(campaign.theme, dominant?.name) ?? own ?? host;
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
        ["--rays-b" as string]: `color-mix(in oklch, ${rays} 55%, #ffffff)`,
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
              title={t("jrPumpLabel")}
              label={`+${show.points} ${t("pointsUnit")}`}
              icon={campaign.progressMeter === "fuel" ? "nozzle" : "drop"}
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

"use client";

import Link from "next/link";
import { nextPrize, prizeName } from "@/lib/tickets/store";
import { useStoreState, useTickets } from "./TicketsShell";

/**
 * How far the balance is from the next prize it can actually claim.
 *
 * This is what the mockup's "PASO 3 DE 7" rail became. There are no seven steps
 * in this mechanic, so a rail counting them would have been a decoration that
 * lies; the distance to the next reachable prize is a real number, derived from
 * the Drop the participant is looking at (see `nextPrize`).
 *
 * Renders nothing at all when there is nothing true to say — no session, no
 * open Drop, a campaign with no store. A card that resolves to "—" is worse
 * than a card that never appeared.
 */
export function NextPrizeProgress({
  /** Inside the approval modal: no link out, tighter type, no card chrome. */
  compact = false,
}: {
  compact?: boolean;
}) {
  const { locale, t, base } = useTickets();
  const { status, snapshot } = useStoreState();

  if (status !== "ready") return null;

  const next = nextPrize(snapshot);

  // Everything in this Drop is either claimed or sold out. Worth saying — it is
  // the good ending of the week — but only where there is room to say it.
  if (!next) {
    if (compact || !snapshot?.drop) return null;
    return (
      <div className="tk-card flat tk-nextprize">
        <div className="tk-eyebrow">{t("npTitle")}</div>
        <p className="tk-body" style={{ fontSize: 13.5, marginTop: 4 }}>{t("npAllTaken")}</p>
      </div>
    );
  }

  const name = prizeName(next.prize, locale);
  const fmt = (n: number) => n.toLocaleString(locale === "en" ? "en-US" : "es-MX");

  const body = (
    <>
      <div className="tk-eyebrow">{t("npTitle")}</div>
      <p className="tk-nextprize-name">{name}</p>

      <div className="tk-progress" role="img" aria-label={t("npAria", { name, pct: next.pct })}>
        <div className="tk-progress-fill" style={{ width: `${next.pct}%` }} />
      </div>

      <p className="tk-nextprize-gap">
        {next.affordable ? (
          <b className="tk-nextprize-ready">{t("npReady")}</b>
        ) : (
          // The number is the point of the sentence, so it carries the weight —
          // and it reads brand-ink, not brand: at 13px the fill colour would
          // miss the contrast body copy needs.
          <>
            {t("npMissingLead")} <b>{t("npMissingPts", { points: fmt(next.missing) })}</b>
          </>
        )}
        {!compact && (
          <span className="tk-nextprize-of">
            {" "}
            · {t("npOf", { points: fmt(next.points), cost: fmt(next.prize.pointsCost) })}
          </span>
        )}
      </p>
    </>
  );

  if (compact) return <div className="tk-nextprize compact">{body}</div>;

  return (
    <Link href={`${base}premios/`} className="tk-card tk-nextprize link">
      {body}
    </Link>
  );
}

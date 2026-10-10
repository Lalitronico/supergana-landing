"use client";

import type { CSSProperties } from "react";
import { prizeDetail } from "@/lib/tickets/store";
import { useSession, useTickets } from "../TicketsShell";
import { SafeImg } from "./SafeImg";

export interface TeaserPrize {
  nameEs: string;
  nameEn: string | null;
  pointsCost: number;
  /** The Drop item's free-form detail; only `image_url` is read, via `prizeDetail`. */
  detail: Record<string, unknown>;
}

/**
 * What the points are for, before somebody has any.
 *
 * Fed only by the open Drop's real rows (read on the server in page.tsx): it
 * prints what the store will show, at the price the store will charge, or it
 * does not render. Participants already have the store and the next-prize bar,
 * so this is for the visitor deciding whether the trouble is worth it.
 */
export function PrizeTeaser({ prizes }: { prizes: TeaserPrize[] }) {
  const { t, locale } = useTickets();
  const { status } = useSession();
  if (prizes.length === 0 || status !== "anon") return null;

  const numberLocale = locale === "en" ? "en-US" : "es-MX";
  const star = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m12 2.6 2.9 6.05 6.6.86-4.85 4.55 1.24 6.54L12 17.4l-5.89 3.2 1.24-6.54L2.5 9.51l6.6-.86z"
        fill="var(--tk-yellow)"
        stroke="var(--tk-ink)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
  const cost = (p: TeaserPrize) => (
    <span className="sh-prize-cost">
      {star}
      {t("shPts", { n: p.pointsCost.toLocaleString(numberLocale) })}
    </span>
  );
  const nameOf = (p: TeaserPrize) => (locale === "en" && p.nameEn ? p.nameEn : p.nameEs);
  const art = prizes.map((p) => prizeDetail(p, locale).imageUrl);

  // With illustrations the shelf is a strip of cards, like the product gallery;
  // without any, the plain price list stays exactly as it was.
  if (art.some(Boolean)) {
    return (
      <section className="sh-sec sh-sec-pink sh-gallery-block">
        <h2 className="sh-h2">{t("shPrizesTitle")}</h2>
        <ul className="sh-gallery sh-reward-strip">
          {prizes.map((p, i) => (
            <li
              key={`${p.nameEs}-${p.pointsCost}`}
              className="sh-reward"
              style={{ "--i": i } as CSSProperties}
            >
              <div className="sh-reward-art">
                {art[i] ? (
                  <SafeImg
                    src={art[i]}
                    alt=""
                    fallback={<span className="sh-reward-star">{star}</span>}
                  />
                ) : (
                  <span className="sh-reward-star">{star}</span>
                )}
              </div>
              <div className="sh-reward-text">
                <b>{nameOf(p)}</b>
                {cost(p)}
              </div>
            </li>
          ))}
        </ul>
        <p className="sh-lede">{t("shPrizesNote")}</p>
      </section>
    );
  }

  return (
    <section className="sh-sec sh-sec-pink">
      <div className="tk-card sh-prizes">
        <h2 className="tk-h" style={{ fontSize: 19, marginBottom: 4 }}>
          {t("shPrizesTitle")}
        </h2>
        <ul>
          {prizes.map((p) => (
            <li key={`${p.nameEs}-${p.pointsCost}`}>
              <span className="sh-prize-name">{nameOf(p)}</span>
              {cost(p)}
            </li>
          ))}
        </ul>
        <p className="tk-foot" style={{ marginTop: 10 }}>
          {t("shPrizesNote")}
        </p>
      </div>
    </section>
  );
}

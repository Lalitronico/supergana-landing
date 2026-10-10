"use client";

import type { CSSProperties } from "react";
import { useTickets } from "../TicketsShell";

const SVG = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.3,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const ICONS = {
  cart: (
    <svg viewBox="0 0 24 24" {...SVG}>
      <path d="M3 4h2.5l2 11h10l2-8H7" />
      <circle cx="9" cy="19.5" r="1.4" />
      <circle cx="17" cy="19.5" r="1.4" />
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 24 24" {...SVG}>
      <path d="M6 2.8h12v16.9l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4Z" />
      <path d="M9 7.2h6M9 11h6M9 14.6h3.5" />
    </svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" {...SVG}>
      <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" />
    </svg>
  ),
  flag: (
    <svg viewBox="0 0 24 24" {...SVG}>
      <path d="M5 21V4" />
      <path d="M5 4h13l-2.5 4.5L18 13H5" />
    </svg>
  ),
};

/**
 * "How it works" as a road: an asphalt strip with a dashed centre line runs down
 * the left edge and each stop is a numbered sign on it, with its title and one
 * line beside. The same four beats the glance strip used to say, but as a route
 * with a destination instead of a paragraph; the finish is a checkered flag.
 */
export function RoadMap() {
  const { campaign, t } = useTickets();
  const stops = [
    { icon: ICONS.cart, color: "var(--sg-yellow)", title: t("stripBuy"), sub: t("shRoadBuyS") },
    { icon: ICONS.receipt, color: "var(--sg-pink)", title: t("stripUpload"), sub: t("shRoadUpS") },
    {
      icon: ICONS.bolt,
      color: "var(--sg-blue)",
      title: t("stripEarn"),
      sub: t("shRoadEarnS", { rate: campaign.pointsPerDollar }),
    },
    { icon: ICONS.flag, color: "var(--sg-orange)", title: t("stripRedeem"), sub: t("shRoadWinS") },
  ];

  return (
    <ol className="sh-road">
      {stops.map((stop, i) => (
        <li key={stop.title} style={{ "--i": i } as CSSProperties}>
          <span className="sh-stop" style={{ background: stop.color }} aria-hidden="true">
            {stop.icon}
            <i>{i + 1}</i>
          </span>
          <div className="sh-stop-text">
            <b>{stop.title}</b>
            <span>{stop.sub}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

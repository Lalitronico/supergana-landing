"use client";

import { useTickets } from "./TicketsShell";

/**
 * The mechanic at a glance: four circled icons joined by a dashed line.
 *
 * The mockup's contribution to this screen. It is not redundant with the
 * "¿Cómo funciona?" card below it — this one is read in half a second by
 * somebody who just scanned a QR in front of a shelf, that one is read by
 * somebody deciding whether the promotion is worth the trouble. Glance, then
 * detail.
 *
 * Icons are inline SVG rather than files: four line drawings are smaller as
 * markup than as requests, and they inherit currentColor so they work on any
 * tenant's palette.
 */

const ICONS = {
  jug: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2.6h5v2.2h-5z" />
      <path d="M8.4 4.8h7.2c1 0 1.8.8 1.8 1.8v12.6c0 1.2-1 2.2-2.2 2.2H8.8c-1.2 0-2.2-1-2.2-2.2V6.6c0-1 .8-1.8 1.8-1.8Z" />
      <path d="M9 10.4h6" />
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2.8h12v16.9l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4Z" />
      <path d="M9 7.2h6M9 11h6M9 14.6h3.5" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.15 6.05L12 17.1l-5.45 2.75L7.7 13.8 3.2 9.6l6.1-.8z" />
    </svg>
  ),
  gift: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.2" y="8.4" width="17.6" height="12.4" rx="1.8" />
      <path d="M3.2 13.1h17.6M12 8.4v12.4" />
      <path d="M12 8.4S10.6 4.4 8.2 4.4a2.1 2.1 0 0 0 0 4zm0 0s1.4-4 3.8-4a2.1 2.1 0 0 1 0 4z" />
    </svg>
  ),
};

export function StepStrip() {
  const { t } = useTickets();

  const steps = [
    { icon: ICONS.jug, label: t("stripBuy") },
    { icon: ICONS.receipt, label: t("stripUpload") },
    { icon: ICONS.star, label: t("stripEarn") },
    { icon: ICONS.gift, label: t("stripRedeem") },
  ];

  return (
    <ol className="tk-strip">
      {steps.map((step, i) => (
        <li key={step.label}>
          <span className="tk-strip-ico">{step.icon}</span>
          <span className="tk-strip-n">{i + 1}</span>
          <span className="tk-strip-label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

"use client";

import { useEffect, useState } from "react";

/**
 * A fuel gauge, drawn as the dashboard object it is.
 *
 * "Every ticket fills your tank" is the idea the whole demo hangs on, so the
 * progress toward the next prize is a dial with a needle that sweeps from E to F
 * instead of a bar. It is still the same number — `nextPrize().pct` — drawn with
 * a metaphor; nothing about it is decorative data.
 *
 * Geometry: a half-disc plate, centre (120,122), track radius 84. Everything is
 * on the system's 3px ink line and the fill takes the tenant's `--tk-brand`, so
 * it repaints per client without knowing who the client is.
 *
 * Motion lives in CSS (journey.css): the needle is a rotate() transition with an
 * overshoot easing, the fill is a stroke-dashoffset transition. This component
 * only decides WHEN to move — it starts at `fromPct`, waits a beat so the eye is
 * on it, and then goes to `pct`. Under prefers-reduced-motion the stylesheet
 * removes the transitions and the gauge simply shows the final state.
 */

const CX = 120;
const CY = 122;
const R = 84;

/** Angle on the dial (0 = E at the left, 1 = F at the right) → point on the track. */
const point = (t: number, radius: number) => {
  const angle = Math.PI * (1 - t);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
};

/** Nine ticks, the three at E, half and F longer — what a real gauge has. */
const TICKS = Array.from({ length: 9 }, (_, i) => {
  const t = i / 8;
  const major = i % 4 === 0;
  const a = point(t, R - 14);
  const b = point(t, R - (major ? 28 : 22));
  return { key: i, x1: a.x, y1: a.y, x2: b.x, y2: b.y, major };
});

const TRACK_PATH = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
/** The first 12% of the arc: where a real gauge goes red. */
const RESERVE_END = point(0.12, R);
const RESERVE_PATH = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${RESERVE_END.x} ${RESERVE_END.y}`;

export function FuelGauge({
  pct,
  fromPct,
  compact = false,
  ariaLabel,
}: {
  /** 0–100, where the needle ends up. */
  pct: number;
  /** Where it starts when it first appears. Defaults to empty. */
  fromPct?: number;
  compact?: boolean;
  ariaLabel: string;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const [shown, setShown] = useState(clamp(fromPct ?? 0));

  // The beat before moving matters: without it the needle is already at its
  // destination by the time the screen has finished fading in, and the sweep —
  // the entire point — happens off-screen.
  useEffect(() => {
    const id = setTimeout(() => setShown(clamp(pct)), fromPct === undefined ? 350 : 700);
    return () => clearTimeout(id);
  }, [pct, fromPct]);

  const full = shown >= 100;
  const angle = -90 + (shown / 100) * 180;

  return (
    <svg
      className={["tk-fuel", compact ? "compact" : null, full ? "full" : null]
        .filter(Boolean)
        .join(" ")}
      viewBox="0 0 240 158"
      role="img"
      aria-label={ariaLabel}
    >
      {/* Plate: a half-disc with a flat base, like the cluster in a dashboard. */}
      <path
        className="tk-fuel-plate"
        d={`M ${CX - 108} ${CY + 14} L ${CX - 108} ${CY} A 108 108 0 0 1 ${CX + 108} ${CY} L ${CX + 108} ${CY + 14} Q ${CX + 108} ${CY + 30} ${CX + 92} ${CY + 30} L ${CX - 92} ${CY + 30} Q ${CX - 108} ${CY + 30} ${CX - 108} ${CY + 14} Z`}
      />

      {/* Track, built as ink under cream so the outline hugs the curve evenly. */}
      <path d={TRACK_PATH} className="tk-fuel-rim" />
      <path d={TRACK_PATH} className="tk-fuel-track" />
      <path d={RESERVE_PATH} className="tk-fuel-reserve" />
      <path
        d={TRACK_PATH}
        className="tk-fuel-fill"
        pathLength={100}
        strokeDasharray="100"
        strokeDashoffset={100 - shown}
      />

      {TICKS.map((tick) => (
        <line
          key={tick.key}
          x1={tick.x1}
          y1={tick.y1}
          x2={tick.x2}
          y2={tick.y2}
          className={tick.major ? "tk-fuel-tick major" : "tk-fuel-tick"}
        />
      ))}

      <text x={CX - R + 2} y={CY + 22} className="tk-fuel-letter" textAnchor="middle">E</text>
      <text x={CX + R - 2} y={CY + 22} className="tk-fuel-letter" textAnchor="middle">F</text>

      {/* A drop between the letters: tells the dial what it measures. */}
      <path
        className="tk-fuel-drop"
        d="M120 136 c-4 4.5-5.5 7-5.5 9.2 a5.5 5.5 0 0 0 11 0 c0-2.2-1.5-4.7-5.5-9.2Z"
      />

      <g className="tk-fuel-needle" style={{ transform: `rotate(${angle}deg)` }}>
        <path d={`M ${CX - 5} ${CY} L ${CX} ${CY - 74} L ${CX + 5} ${CY} Z`} />
      </g>
      <circle cx={CX} cy={CY} r="11" className="tk-fuel-hub" />
      <circle cx={CX} cy={CY} r="3.2" className="tk-fuel-pin" />
    </svg>
  );
}

"use client";

import { useEffect, useState } from "react";

/**
 * The tank: a jerrycan with liquid that rises as points come in.
 *
 * "Every ticket fills your tank" is the idea the demo hangs on, so progress
 * toward the next prize is a container filling with something coloured — the
 * tenant's `--tk-brand` — and not a gauge needle on a grey dial. Waves slosh on
 * the surface (two SVG sine paths sliding at different speeds), bubbles rise
 * through it, and a red pointer rides the E–F scale on the side. It is still
 * `nextPrize().pct`, drawn with a metaphor.
 *
 * Geometry lives in one place so the level maths is obvious: the body spans
 * y 64–214 and the liquid may occupy 70–210, so 0% leaves a thin film (never an
 * "empty" glass that reads as broken) and 100% touches the shoulder.
 *
 * This component only decides WHEN to move (start at `fromPct`, wait a beat so
 * the eye is on it, go to `pct`); the motion itself is CSS (journey.css) and is
 * removed under prefers-reduced-motion, leaving the final state.
 */

const BODY = { x: 24, y: 64, w: 128, h: 150, r: 24 };
const LEVEL_TOP = 70;
const LEVEL_BOTTOM = 210;

const levelY = (pct: number) => LEVEL_BOTTOM - (Math.max(0, Math.min(100, pct)) / 100) * (LEVEL_BOTTOM - LEVEL_TOP);

/** One full period is 64 units (up + down), so sliding by 64 loops seamlessly. */
const WAVE = `M0 0 ${"q16 -7 32 0 t32 0 ".repeat(1)}${"t32 0 ".repeat(7)}V170 H0 Z`;

const TICKS = [0, 25, 50, 75, 100];

export function FuelTank({
  pct,
  fromPct,
  compact = false,
  ariaLabel,
}: {
  pct: number;
  fromPct?: number;
  compact?: boolean;
  ariaLabel: string;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const [shown, setShown] = useState(clamp(fromPct ?? 0));

  useEffect(() => {
    const id = setTimeout(() => setShown(clamp(pct)), fromPct === undefined ? 350 : 700);
    return () => clearTimeout(id);
  }, [pct, fromPct]);

  const y = levelY(shown);
  const full = shown >= 100;
  const clipId = "tk-tank-clip";

  return (
    <svg
      className={["tk-tank", compact ? "compact" : null, full ? "full" : null].filter(Boolean).join(" ")}
      viewBox="0 0 200 230"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx={BODY.r} />
        </clipPath>
      </defs>

      {/* Hard shadow, like every object in the system. */}
      <rect x={BODY.x + 6} y={BODY.y + 6} width={BODY.w} height={BODY.h} rx={BODY.r} className="tk-tank-shadow" />

      {/* Handle: ink outside, yellow inside, so it reads as a thick tube. */}
      <path d="M100 66 V52 a12 12 0 0 1 12 -12 h14 a12 12 0 0 1 12 12 V66" className="tk-tank-handle-ink" />
      <path d="M100 66 V52 a12 12 0 0 1 12 -12 h14 a12 12 0 0 1 12 12 V66" className="tk-tank-handle" />

      {/* Neck and cap. */}
      <rect x="38" y="44" width="34" height="24" rx="5" className="tk-tank-neck" />
      <rect x="33" y="30" width="44" height="18" rx="6" className="tk-tank-cap" />

      {/* Glass body. */}
      <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx={BODY.r} className="tk-tank-glass" />

      <g clipPath={`url(#${clipId})`}>
        <g className="tk-tank-liquid" style={{ transform: `translateY(${y}px)` }}>
          <g className="tk-tank-wave back">
            <path d={WAVE} transform="translate(-30 4)" />
          </g>
          <g className="tk-tank-wave front">
            <path d={WAVE} transform="translate(-10 0)" />
          </g>
          <circle cx="62" cy="48" r="4.5" className="tk-tank-bubble b1" />
          <circle cx="108" cy="62" r="3.2" className="tk-tank-bubble b2" />
          <circle cx="84" cy="40" r="2.6" className="tk-tank-bubble b3" />
        </g>
        {/* Glass highlight, over the liquid. */}
        <rect x="34" y="80" width="9" height="86" rx="4.5" className="tk-tank-shine" />
      </g>

      {/* The outline goes on top so the liquid never bleeds past the stroke. */}
      <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx={BODY.r} className="tk-tank-outline" />

      <text x={BODY.x + BODY.w / 2} y="150" textAnchor="middle" className="tk-tank-pct">
        {Math.round(shown)}%
      </text>

      {/* E–F scale with a pointer that rides the level. */}
      {TICKS.map((t) => (
        <line
          key={t}
          x1="158"
          x2={t % 50 === 0 ? "174" : "168"}
          y1={levelY(t)}
          y2={levelY(t)}
          className="tk-tank-tick"
        />
      ))}
      <text x="187" y={levelY(100) + 5} textAnchor="middle" className="tk-tank-letter">F</text>
      <text x="187" y={levelY(0) + 5} textAnchor="middle" className="tk-tank-letter">E</text>
      <g className="tk-tank-pointer" style={{ transform: `translateY(${y}px)` }}>
        <path d="M156 0 l14 -7 v14 z" />
      </g>
    </svg>
  );
}

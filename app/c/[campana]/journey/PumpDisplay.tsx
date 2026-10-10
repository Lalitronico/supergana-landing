"use client";

import { useEffect, useState } from "react";

/**
 * "+324 pts" the way a gas pump counts: mechanical digit reels that roll up to
 * the number, not a slot machine. Each reel is a window one digit tall over a
 * column of 0–9 repeated twice, so every reel spins at least one full turn
 * before it settles, the leftmost one first and the units last (as on a pump,
 * where the cents blur longest).
 *
 * Reels are CSS transforms on a fixed-height column: the number is right in the
 * DOM from the first paint (aria-label carries it for screen readers) and the
 * animation only moves a window over it. Reduced motion → the final value with
 * no transition.
 */

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function Reel({ digit, index }: { digit: number; index: number }) {
  const [go, setGo] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setGo(true), 450);
    return () => clearTimeout(id);
  }, []);

  // Two turns would be 20 steps; stop on the digit in the SECOND copy so the
  // reel always travels at least 10 positions.
  const target = 10 + digit;
  const shift = go ? -(target / DIGITS.length) * 100 : 0;
  // Left reels lock first; the units reel keeps spinning a little longer.
  const duration = 1.1 + index * 0.28;

  return (
    <span className="jr-reel" aria-hidden="true">
      <span
        className="jr-reel-col"
        style={{
          transform: `translateY(${shift}%)`,
          transitionDuration: `${duration}s`,
        }}
      >
        {DIGITS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </span>
    </span>
  );
}

export function PumpDisplay({
  value,
  unit,
  label,
}: {
  value: number;
  unit: string;
  label: string;
}) {
  const digits = String(Math.max(0, Math.round(value))).split("").map(Number);
  return (
    <div className="jr-pump" role="img" aria-label={label}>
      <span className="jr-pump-plus" aria-hidden="true">+</span>
      <span className="jr-pump-reels">
        {digits.map((d, i) => (
          <Reel key={i} digit={d} index={i} />
        ))}
      </span>
      <span className="jr-pump-unit" aria-hidden="true">{unit}</span>
    </div>
  );
}

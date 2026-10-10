"use client";

import { useEffect, useState } from "react";

/**
 * "+324 PUNTOS" as the display of a fuel pump: a red pump body with its label
 * and a nozzle icon on the head, and a dark LCD window where the digits count
 * up. The number fills in from left to right, one digit after the other (the
 * way a pump's total runs), and each digit climbs through the numbers one step
 * at a time until it lands. Nothing here spins together, nothing is a lever,
 * a reel of symbols or a chance: it is a counter.
 *
 * The number is right in the DOM from the first paint (aria-label carries it);
 * the animation only reveals and moves a window over it. Reduced motion: the
 * final value, no transition.
 */

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function Reel({ digit, index }: { digit: number; index: number }) {
  const [go, setGo] = useState(false);

  // Left to right: each digit starts a beat after the one before it.
  useEffect(() => {
    const id = setTimeout(() => setGo(true), 500 + index * 330);
    return () => clearTimeout(id);
  }, [index]);

  // Two turns would be 20 steps; stop on the digit in the SECOND copy so the
  // reel always travels at least 10 positions.
  const target = 10 + digit;
  const shift = go ? -(target / DIGITS.length) * 100 : 0;
  const duration = 0.85;

  return (
    <span className={go ? "jr-reel on" : "jr-reel"} aria-hidden="true">
      <span
        className="jr-reel-col"
        style={{
          transform: `translateY(${shift}%)`,
          transitionDuration: `${duration}s`,
          // One step per digit: the reel clicks from number to number like a
          // real odometer, so no frame ever shows a digit cut in half.
          transitionTimingFunction: `steps(${target}, end)`,
        }}
      >
        {DIGITS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </span>
    </span>
  );
}

/** A small fuel nozzle: handle, spout and hose. */
function Nozzle() {
  return (
    <svg className="jr-pump-nozzle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14" />
      <path d="M3 20h12" />
      <path d="M14 9h2.5a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-2.5-2.5" />
      <path d="M7 8h4" />
    </svg>
  );
}

export function PumpDisplay({
  value,
  title,
  label,
}: {
  value: number;
  /** The head label: "PUNTOS" / "POINTS", the way a pump says "GALLONS". */
  title: string;
  label: string;
}) {
  const digits = String(Math.max(0, Math.round(value))).split("").map(Number);
  return (
    <div className="jr-pump" role="img" aria-label={label}>
      <div className="jr-pump-head" aria-hidden="true">
        <Nozzle />
        <span className="jr-pump-label">{title}</span>
      </div>
      <div className="jr-pump-window" aria-hidden="true">
        <span className="jr-pump-plus">+</span>
        <span className="jr-pump-reels">
          {digits.map((d, i) => (
            <Reel key={i} digit={d} index={i} />
          ))}
        </span>
      </div>
    </div>
  );
}

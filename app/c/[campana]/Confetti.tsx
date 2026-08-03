"use client";

/**
 * Confetti, in CSS.
 *
 * Deliberately not an image and not a canvas library: the mockups draw confetti
 * around every win, and a module that shipped a GIF per tenant would be paying
 * bytes for something twelve absolutely-positioned divs do better. It also means
 * the confetti takes the tenant's brand colour for free.
 *
 * Purely decorative, so aria-hidden — and silent under prefers-reduced-motion,
 * where the stylesheet drops the animation rather than freezing it mid-fall.
 */

/** Fixed, not random: Math.random() in render would differ between server and
    client and trip hydration. Hand-picked so the spread reads as scattered. */
const PIECES = [
  { left: 6, delay: 0, dur: 2.6, rot: -18, kind: "bar" },
  { left: 18, delay: 0.7, dur: 3.1, rot: 24, kind: "dot" },
  { left: 29, delay: 0.25, dur: 2.3, rot: 40, kind: "bar" },
  { left: 41, delay: 1.1, dur: 2.9, rot: -32, kind: "sq" },
  { left: 52, delay: 0.45, dur: 2.5, rot: 12, kind: "dot" },
  { left: 63, delay: 1.4, dur: 3.3, rot: -8, kind: "bar" },
  { left: 71, delay: 0.15, dur: 2.7, rot: 52, kind: "sq" },
  { left: 80, delay: 0.9, dur: 2.4, rot: -44, kind: "dot" },
  { left: 88, delay: 0.55, dur: 3.0, rot: 30, kind: "bar" },
  { left: 95, delay: 1.25, dur: 2.8, rot: -22, kind: "sq" },
] as const;

/** Yellow leads because action is yellow; the brand colour joins in. */
const TINTS = ["var(--tk-yellow)", "var(--tk-brand)", "var(--tk-yellow-deep)"] as const;

export function Confetti({ className }: { className?: string }) {
  return (
    <div className={["tk-confetti", className].filter(Boolean).join(" ")} aria-hidden="true">
      {PIECES.map((piece, i) => (
        <span
          key={piece.left}
          className={`p ${piece.kind}`}
          style={{
            left: `${piece.left}%`,
            background: TINTS[i % TINTS.length],
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.dur}s`,
            ["--tk-spin" as string]: `${piece.rot * 14}deg`,
          }}
        />
      ))}
    </div>
  );
}

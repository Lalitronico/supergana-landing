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

/**
 * The burst: pieces that leave the centre of the screen in every direction and
 * then drop. Angles and distances are derived from the index (a golden-angle
 * spread, so no two neighbours fly the same way) — deterministic like PIECES,
 * for the same hydration reason, and it reads as thrown rather than as a fan.
 */
const BURST = Array.from({ length: 34 }, (_, i) => {
  const angle = (i * 137.5 * Math.PI) / 180;
  const reach = 90 + ((i * 53) % 110);
  return {
    dx: Math.round(Math.cos(angle) * reach * 1.15),
    // Mostly upward and outward first; gravity (the CSS) does the rest.
    dy: Math.round(Math.sin(angle) * reach * 0.9) - 40,
    rot: ((i * 97) % 720) - 360,
    kind: (["bar", "dot", "sq"] as const)[i % 3],
    delay: (i % 5) * 0.03,
  };
});

// The system's own palette (yellow leads, the tenant's brand joins in).
const BURST_TINTS = [
  "var(--tk-yellow)",
  "var(--tk-brand)",
  "var(--sg-pink, #ff6b9d)",
  "var(--sg-blue, #1e90ff)",
  "#fff",
  "var(--sg-green, #2ecc71)",
  "var(--sg-red, #ff4757)",
  "var(--sg-purple, #8b5cf6)",
  "var(--sg-orange, #ff8a3d)",
] as const;

export function Confetti({ className, burst = false }: { className?: string; burst?: boolean }) {
  const classes = (extra?: string) =>
    ["tk-confetti", className, extra].filter(Boolean).join(" ");

  return (
    <>
      {/* The thrown pieces live in their own layer ABOVE the card: from behind
          it the burst is hidden by the very thing it celebrates. They fly for
          about two seconds and finish transparent, so covering the card is
          brief; the slow rain below stays behind it. */}
      {burst && (
        <div className={classes("burst-layer")} aria-hidden="true">
          {BURST.map((piece, i) => (
            <span
              key={i}
              className={`p burst ${piece.kind}`}
              style={{
                background: BURST_TINTS[i % BURST_TINTS.length],
                animationDelay: `${piece.delay}s`,
                ["--jr-dx" as string]: `${piece.dx}px`,
                ["--jr-dy" as string]: `${piece.dy}px`,
                ["--jr-rot" as string]: `${piece.rot}deg`,
              }}
            />
          ))}
        </div>
      )}
      <div className={classes()} aria-hidden="true">
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
    </>
  );
}

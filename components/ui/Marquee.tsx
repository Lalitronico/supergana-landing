type Tone = "ink" | "yellow";

const TONES: Record<Tone, string> = {
  ink: "bg-ink text-yellow",
  yellow: "bg-yellow text-ink",
};

type Props = {
  items: string[];
  tone?: Tone;
  /** Seconds for one full loop. Handoff calls for 22–26s. */
  duration?: number;
  /** Hand-made tilt. Alternate the sign between bands so they don't rhyme. */
  rotate?: number;
};

/**
 * A rotated band that scrolls a list across the page. Doubles as the brand's
 * strongest section divider — it breaks a run of cream sections far better
 * than a rule, and carries copy while doing it.
 *
 * The content is rendered twice and translated by -50%: at the moment the
 * first copy has fully exited, the second sits exactly where the first began,
 * so the loop has no visible seam.
 */
export function Marquee({
  items,
  tone = "ink",
  duration = 22,
  rotate = -1,
}: Props) {
  const line = items.join("  ·  ");

  return (
    <div
      className={`-mx-2.5 my-2.5 overflow-hidden border-y-[3px] border-ink py-4 ${TONES[tone]}`}
      style={{ transform: `rotate(${rotate}deg) scale(1.02)` }}
    >
      <div
        className="flex w-max"
        style={{ animation: `marquee ${duration}s linear infinite` }}
      >
        {[0, 1].map((copy) => (
          <span
            key={copy}
            aria-hidden={copy === 1}
            className="font-display whitespace-nowrap pr-10 text-[22px] tracking-[0.04em]"
          >
            {line}  ·
          </span>
        ))}
      </div>
    </div>
  );
}

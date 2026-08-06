import Link from "next/link";

/**
 * The season, as eighteen cells.
 *
 * It runs across the top of every week screen and it is doing more work than
 * navigation: seeing that week 12 exists is what makes an eighteen-week
 * commitment feel like one thing rather than a series of unrelated Sundays.
 * That is why upcoming weeks render at all instead of being hidden.
 *
 * `openWeek` is the only week that accepts picks, and everything before it has
 * settled — `pickem_settle_week` advances the pointer inside the same
 * transaction that credits the points, so "before the open week" and "settled"
 * are the same fact and do not need a second query to tell apart.
 */
export function WeekStrip({
  slug,
  total,
  current,
  openWeek,
  promoWeeks,
}: {
  slug: string;
  total: number;
  current: number;
  openWeek: number;
  promoWeeks: number[];
}) {
  const weeks = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <nav aria-label="Jornadas de la temporada" className="pk-strip">
      {weeks.map((w) => {
        const settled = w < openWeek;
        const open = w === openWeek;
        const state = settled ? "is-settled" : open ? "is-open" : "is-upcoming";
        const promo = promoWeeks.includes(w) ? " is-promo" : "";
        return (
          <Link
            key={w}
            href={`/p/${slug}/jornada/${w}/`}
            className={`pk-strip-cell ${state}${promo}`}
            aria-current={w === current ? "page" : undefined}
            aria-label={`Jornada ${w}${promo ? ", doble" : ""}`}
            style={w === current ? { outline: "3px solid var(--sg-ink)", outlineOffset: 2 } : undefined}
          >
            {w}
          </Link>
        );
      })}
    </nav>
  );
}

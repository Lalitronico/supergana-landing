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
    // The strip sits inside a ticket: eighteen loose cells between two cards
    // read as debris, and the torn frame is what makes them one object — which
    // is how the approved mockups draw it on every screen that carries it.
    <nav aria-label="Jornadas de la temporada" className="pk-ticket pk-stripwrap">
      <div className="pk-strip">
        {weeks.map((w) => {
          const settled = w < openWeek;
          const open = w === openWeek;
          const state = settled ? "is-settled" : open ? "is-open" : "is-upcoming";
          const promo = promoWeeks.includes(w) ? " is-promo" : "";
          const here = w === current ? " is-current" : "";
          return (
            <Link
              key={w}
              href={`/p/${slug}/jornada/${w}/`}
              className={`pk-strip-cell ${state}${promo}${here}`}
              aria-current={w === current ? "page" : undefined}
              aria-label={`Jornada ${w}${promo ? ", doble" : ""}`}
            >
              J{w}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

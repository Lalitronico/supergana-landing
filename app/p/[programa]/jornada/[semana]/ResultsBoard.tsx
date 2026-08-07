import Link from "next/link";
import type { Breakdown, Game } from "@/lib/pickem/schema";
import { formatKickoff } from "@/lib/pickem/schedule";
import { teamOf } from "@/lib/pickem/teams";
import { TeamMark } from "../../TeamMark";

/**
 * The same week, after it happened.
 *
 * Shares a route with the picks board on purpose: it is one jornada in two
 * states, and a link a player shares in a WhatsApp group has to open the right
 * one depending on when it is tapped.
 *
 * The breakdown is not decoration. A player who cannot follow where their score
 * came from stops believing the ranking, and the ranking is the product — which
 * is why `pickem_score_entry` returns every part rather than a total, and why
 * this renders the stored copy rather than recomputing it.
 */

const winnerOf = (g: Game): "away" | "home" | null => {
  if (g.awayScore === null || g.homeScore === null) return null;
  if (g.homeScore > g.awayScore) return "home";
  if (g.awayScore > g.homeScore) return "away";
  return null; // A draw scores for nobody. The NFL still has about one a year.
};

export function ResultsBoard({
  slug,
  week,
  games,
  tz,
  picks,
  breakdown,
  settled,
  seasonPoints,
  strip,
}: {
  slug: string;
  week: number;
  games: Game[];
  tz: string;
  picks: Record<string, "away" | "home">;
  breakdown: Breakdown | null;
  settled: boolean;
  seasonPoints: number | null;
  strip?: React.ReactNode;
}) {
  const playable = games.filter((g) => !g.voided);
  const played = Object.keys(picks).length > 0;

  return (
    <>
      <div className="sg-screen">
        <div className="sg-pad">
          <div>
            <div className="sg-eyebrow">Jornada {week}</div>
            <h1 className="sg-display" style={{ marginTop: 6 }}>
              {settled ? "Jornada cerrada" : "Jornada en juego"}
            </h1>
            <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
              {!played
                ? "No jugaste esta jornada. Quedan las que siguen."
                : settled && breakdown
                  ? `Acertaste ${breakdown.hits} de ${breakdown.of}.`
                  : "Los picks están cerrados. Los resultados llegan el martes."}
            </p>
          </div>

          {strip}

          {settled && breakdown ? (
            <>
              <div className="sg-card" style={{ background: "var(--sg-yellow)" }}>
                <div className="sg-eyebrow">Jornada {week}</div>
                <div
                  className="sg-display"
                  style={{ fontSize: 44, marginTop: 2, lineHeight: 1 }}
                >
                  {breakdown.points}
                </div>
                {seasonPoints !== null ? (
                  <div className="sg-foot" style={{ marginTop: 4 }}>
                    Acumulado de temporada {seasonPoints}
                  </div>
                ) : null}
              </div>

              {/* Every point, named. The demo proved this is what makes people
                  trust the number — and the arithmetic is checked by a test:
                  parts plus bonuses, times the multiplier, equals the total. */}
              <div className="sg-card">
                <div className="sg-eyebrow" style={{ marginBottom: 6 }}>
                  De dónde salieron tus puntos
                </div>
                <div className="pk-tally">
                  <div className="pk-tally-row">
                    <span>
                      {breakdown.hits} acierto{breakdown.hits === 1 ? "" : "s"} ×{" "}
                      {breakdown.of ? Math.round(breakdown.base / (breakdown.hits || 1)) : 0}
                    </span>
                    <span className="v">{breakdown.base}</span>
                  </div>
                  {breakdown.tiebreakBonus > 0 ? (
                    <div className="pk-tally-row">
                      <span>Desempate</span>
                      <span className="v">+{breakdown.tiebreakBonus}</span>
                    </div>
                  ) : null}
                  {breakdown.earlyBonus > 0 ? (
                    <div className="pk-tally-row">
                      <span>Madrugador</span>
                      <span className="v">+{breakdown.earlyBonus}</span>
                    </div>
                  ) : null}
                  {breakdown.streakBonus > 0 ? (
                    <div className="pk-tally-row">
                      <span>Racha de {breakdown.streak} jornadas</span>
                      <span className="v">+{breakdown.streakBonus}</span>
                    </div>
                  ) : null}
                  {breakdown.mult > 1 ? (
                    <div className="pk-tally-row">
                      <span>
                        {[
                          breakdown.checkedIn ? "Check-in en sucursal" : null,
                          breakdown.promo ? "Jornada doble" : null,
                        ]
                          .filter(Boolean)
                          .join(" + ")}
                      </span>
                      <span className="v">×{breakdown.mult}</span>
                    </div>
                  ) : null}
                </div>
                <div className="pk-tally-total">
                  <span>Total de la jornada</span>
                  <span className="v">{breakdown.points}</span>
                </div>
              </div>
            </>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {playable.map((g) => {
              const away = teamOf(g.away);
              const home = teamOf(g.home);
              const winner = winnerOf(g);
              const mine = picks[g.id];
              const hasScore = g.awayScore !== null;
              const hit = hasScore && winner !== null && mine === winner;

              // `is-picked` fills the side yellow, and on the picks board that
              // fill means one thing: I chose this. Painting the WINNER with it
              // made a week nobody played look like a completed pick sheet —
              // sixteen matches, one side lit in each — which is exactly what a
              // player who had just registered reported seeing. The rehearsal
              // makes it certain rather than likely: its open week is a 2025
              // jornada whose kickoff is long past, so a brand new player is
              // sent straight here rather than to the picks board.
              //
              // So the fill follows the reader's own pick and nothing else, and
              // the result is said in words. A screen may not assert a decision
              // the player did not make.
              const side = (which: "away" | "home", team: typeof away, abbr: string, score: number | null) => (
                <div
                  className={`pk-side${which === "home" ? " right" : ""}${mine === which ? " is-picked" : ""}`}
                >
                  <TeamMark abbr={abbr} />
                  <span style={{ minWidth: 0 }}>
                    <span className="pk-side-name">{team.name}</span>
                    <span className="pk-side-city" style={{ display: "block" }}>
                      {mine === which ? "TU PICK" : winner === which ? "GANÓ" : team.city}
                    </span>
                  </span>
                  <span
                    className="pk-lb-pts"
                    style={{ marginLeft: which === "away" ? "auto" : 0, marginRight: which === "home" ? "auto" : 0 }}
                  >
                    {/* A dash, never a zero. A zero says the team scored none. */}
                    {score === null ? "–" : score}
                  </span>
                </div>
              );

              return (
                <div className="pk-match" key={g.id}>
                  <div className="pk-match-head">
                    <span>{formatKickoff(g.kickoffAt, tz)}</span>
                    <span>
                      {!hasScore
                        ? "Por jugarse"
                        : winner === null
                          ? "Empate"
                          : mine
                            ? hit
                              ? "Acertaste"
                              : "Fallaste"
                            : "Final"}
                    </span>
                  </div>
                  <div className="pk-match-body">
                    {side("away", away, g.away, g.awayScore)}
                    <div className="pk-at">@</div>
                    {side("home", home, g.home, g.homeScore)}
                  </div>
                </div>
              );
            })}
          </div>

          {games.some((g) => g.voided) ? (
            <p className="sg-foot" style={{ margin: 0 }}>
              Hay un partido pospuesto. Se anula para el pick&rsquo;em: nadie gana ni
              pierde puntos por él.
            </p>
          ) : null}
        </div>
      </div>

      <div className="sg-dock">
        <Link className="sg-btn" href={`/p/${slug}/ranking/?w=${week}`}>
          Ver el ranking
        </Link>
      </div>
    </>
  );
}

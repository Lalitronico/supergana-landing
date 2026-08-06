import Link from "next/link";
import { notFound } from "next/navigation";
import { resolvePlayer } from "@/lib/pickem/access";
import { getLeaderboard, getProgram } from "@/lib/pickem/program";
import { WeekStrip } from "../WeekStrip";

/**
 * Who is winning.
 *
 * Public: somebody who scans the QR should be able to see the ranking before
 * deciding whether to play, and a game whose standings are hidden persuades
 * nobody. What it shows is an alias, a branch and a number — never a phone,
 * never a real name. This screen gets looked at across a table with other
 * people sitting there.
 */
export default async function RankingPage({
  params,
  searchParams,
}: {
  params: Promise<{ programa: string }>;
  searchParams: Promise<{ w?: string; scope?: string }>;
}) {
  const { programa } = await params;
  const { w, scope: rawScope } = await searchParams;

  const program = await getProgram(programa);
  if (!program) notFound();

  const scope = rawScope === "season" ? "season" : "week";
  const asked = Number(w);
  // The last week that has been played, not the open one: a ranking of a week
  // nobody has scored yet is a table of dashes, and landing on it looks broken.
  const settledWeek = Math.max(1, program.openWeek - 1);
  const week =
    Number.isInteger(asked) && asked >= 1 && asked <= program.totalWeeks ? asked : settledWeek;

  const player = await resolvePlayer(program.campaignId);
  const rows = await getLeaderboard(program, scope, scope === "week" ? week : null);

  // Week 1 is the case where the two tables are the same table, and saying so
  // is better than letting somebody wonder why the toggle does nothing.
  const sameAsSeason = scope === "season" && program.openWeek <= 2;
  const notPlayedYet = scope === "week" && week >= program.openWeek;

  return (
    <>
      <div className="sg-screen">
        <div className="sg-pad">
          <div>
            <div className="sg-eyebrow">
              {scope === "season" ? "Acumulado de temporada" : `Jornada ${week}`}
            </div>
            <h1 className="sg-display" style={{ marginTop: 6 }}>
              Ranking
            </h1>
            {notPlayedYet ? (
              <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
                La jornada {week} todavía no se juega.
              </p>
            ) : sameAsSeason ? (
              <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
                Con una jornada jugada, el acumulado y la jornada son la misma tabla.
              </p>
            ) : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Link
              className={`sg-btn sm${scope === "week" ? "" : " ghost"}`}
              href={`/p/${program.slug}/ranking/?scope=week&w=${week}`}
            >
              Jornada
            </Link>
            <Link
              className={`sg-btn sm${scope === "season" ? "" : " ghost"}`}
              href={`/p/${program.slug}/ranking/?scope=season`}
            >
              General
            </Link>
          </div>

          {scope === "week" ? (
            <WeekStrip
              slug={program.slug}
              total={program.totalWeeks}
              current={week}
              openWeek={program.openWeek}
              promoWeeks={program.promoWeeks}
            />
          ) : null}

          {rows.length === 0 ? (
            <div className="sg-card">
              <p className="sg-body" style={{ margin: 0 }}>
                Todavía no hay nadie en esta tabla. Sé el primero.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((r) => {
                const me = player?.participantId === r.participantId;
                return (
                  <div className="pk-lb-row" key={r.participantId} data-me={me}>
                    <span className="pk-lb-rank">{r.rank}</span>
                    <span className="pk-lb-name">
                      {r.alias}
                      {r.venue ? (
                        <span className="pk-lb-venue" style={{ display: "block" }}>
                          {r.venue}
                        </span>
                      ) : null}
                    </span>
                    {/* A dash, never a zero: a zero reads as "you came last". */}
                    <span className="pk-lb-pts">
                      {notPlayedYet || r.points === 0 ? "–" : r.points}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {rows.length >= 50 ? (
            <p className="sg-foot" style={{ margin: 0 }}>
              Mostrando los primeros 50.
            </p>
          ) : null}
        </div>
      </div>

      <div className="sg-dock">
        <Link className="sg-btn" href={`/p/${program.slug}/premios/`}>
          Ver mis premios
        </Link>
        <Link className="sg-btn ghost sm" href={`/p/${program.slug}/jornada/${program.openWeek}/`}>
          Ir a la jornada abierta
        </Link>
      </div>
    </>
  );
}

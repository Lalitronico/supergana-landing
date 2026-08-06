import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgram, getWeek } from "@/lib/pickem/program";
import { countdownTo, formatKickoff } from "@/lib/pickem/schedule";
import { teamOf } from "@/lib/pickem/teams";
import { Countdown } from "./Countdown";
import { TeamMark } from "./TeamMark";

/**
 * Where the QR lands.
 *
 * Everything here renders without a session, on purpose: somebody who scans the
 * code on their table should see what the game is, when it closes and who is
 * winning before being asked for anything. Asking first is how a free game
 * looks like a mailing list.
 */
export default async function PickemLanding({
  params,
}: {
  params: Promise<{ programa: string }>;
}) {
  const { programa } = await params;
  const program = await getProgram(programa);
  if (!program) notFound();

  const now = new Date();
  const week = await getWeek(program, program.openWeek, now);
  const first = week?.games.find((g) => !g.voided) ?? null;
  const tz = program.timezone;

  return (
    <>
      <div className="sg-screen">
        <div className="sg-pad">
          <section className="pk-hero">
            <div>
              {program.theme.logoUrl ? (
                <Image
                  src="/brands/chapa/chapa-wordmark-420.png"
                  alt={program.orgName}
                  width={420}
                  height={126}
                  priority
                  style={{ width: 186, height: "auto", margin: "2px auto 16px", display: "block" }}
                />
              ) : null}

              <div className="sg-eyebrow" style={{ color: "var(--sg-yellow)" }}>
                Temporada NFL {program.seasonYear} · {program.totalWeeks} jornadas
              </div>
              <h1 className="pk-hero-title">Pick&rsquo;em</h1>
              <p className="pk-hero-copy">
                Pronostica cada jornada de la temporada. Cada acierto suma al acumulado.
                Los premios se cobran en la mesa.
              </p>
            </div>

            {/* The whole idea in one frame: a Supergana character eating at
                Chapa, phone in hand, football on the table. */}
            <div className="pk-hero-art">
              <Image
                src="/brands/chapa/lince-en-chapa.png"
                alt=""
                width={900}
                height={900}
                priority
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
          </section>

          {week?.lockAt && first ? (
            <section className="sg-card">
              {/* Two lines, deliberately: "Jornada 1 cierra el mié 9 sep · 6:20
                  PM" is 41 characters of spaced uppercase and wraps mid-date on
                  a 390px screen. Splitting where the meaning splits beats
                  letting the browser choose. */}
              <div className="sg-eyebrow">Cierra en</div>
              <div className="sg-h" style={{ fontSize: 17, margin: "2px 0 10px" }}>
                Jornada {week.week} · {formatKickoff(week.lockAt, tz)}
              </div>
              <Countdown
                target={week.lockAt}
                initial={countdownTo(week.lockAt, now)}
                onDoneLabel={`Jornada ${week.week} cerrada`}
              />
              <p className="sg-foot" style={{ marginTop: 10, marginBottom: 0 }}>
                Los picks se cierran al primer kickoff de la jornada, hora de{" "}
                {tz === "America/Ciudad_Juarez" ? "Ciudad Juárez" : tz}.
              </p>
            </section>
          ) : null}

          {week ? (
            <section>
              <div className="sg-eyebrow" style={{ marginBottom: 8 }}>
                Jornada {week.week} · {week.games.filter((g) => !g.voided).length} partidos
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {week.games.slice(0, 3).map((g) => {
                  const away = teamOf(g.away);
                  const home = teamOf(g.home);
                  return (
                    <div className="pk-match" key={g.id}>
                      <div className="pk-match-head">
                        <span>{formatKickoff(g.kickoffAt, tz)}</span>
                        <span>{g.venueNote || g.network || "Cadena por definir"}</span>
                      </div>
                      <div className="pk-match-body">
                        <div className="pk-side">
                          <TeamMark abbr={g.away} />
                          <span style={{ minWidth: 0 }}>
                            <span className="pk-side-name">{away.name}</span>
                            <span className="pk-side-city" style={{ display: "block" }}>
                              {away.city}
                            </span>
                          </span>
                        </div>
                        <div className="pk-at">@</div>
                        <div className="pk-side right">
                          <TeamMark abbr={g.home} />
                          <span style={{ minWidth: 0 }}>
                            <span className="pk-side-name">{home.name}</span>
                            <span className="pk-side-city" style={{ display: "block" }}>
                              {home.city}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="sg-foot" style={{ marginTop: 8 }}>
                Y {Math.max(0, week.games.filter((g) => !g.voided).length - 3)} partidos más.
              </p>
            </section>
          ) : (
            <section className="sg-card">
              <p className="sg-body" style={{ margin: 0 }}>
                El calendario de esta jornada todavía no está cargado.
              </p>
            </section>
          )}

          {/* Where the prize is collected, said up front. It is the mechanism of
              the whole business — the game lives on the phone, the prize brings
              you back to the table — and burying it would be hiding the part
              the client is paying for. */}
          {program.venues.length ? (
            <section className="sg-card">
              <div className="sg-eyebrow" style={{ marginBottom: 8 }}>Dónde se cobra</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {program.venues.map((v) => (
                  <span className="sg-chip" key={v}>
                    {v}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {/* Trailing slashes because next.config sets `trailingSlash`. Without
          them every internal navigation costs a 308 round trip. */}
      <div className="sg-dock">
        <Link className="sg-btn" href={`/p/${program.slug}/registro/`}>
          Entrar al juego
        </Link>
        <Link className="sg-btn ghost sm" href={`/p/${program.slug}/ranking/`}>
          Ver el ranking
        </Link>
      </div>
    </>
  );
}

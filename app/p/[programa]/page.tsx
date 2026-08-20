import Link from "next/link";
import { notFound } from "next/navigation";
import { isVerified, resolvePlayer } from "@/lib/pickem/access";
import { getProgram, getWeek } from "@/lib/pickem/program";
import { countdownTo, formatKickoff } from "@/lib/pickem/schedule";
import { teamOf } from "@/lib/pickem/teams";
import { ChapaCharacter } from "./ChapaCharacter";
import { characterDir } from "./cast";
import { Countdown } from "./Countdown";
import { PickemPlate } from "./PickemPlate";
import { TeamMark } from "./TeamMark";

/**
 * Where the QR lands.
 *
 * NOTHING HERE IS BEHIND A FORM. Somebody who scans the code on their table
 * sees what the game is, when it closes and who is playing before being asked
 * for anything: the hero, the countdown, the first three matches and where the
 * prize is collected all render for a stranger. Asking first is how a free game
 * looks like a mailing list.
 *
 * The one thing that changes with a session is the CTA at the end, and reading
 * the cookie to decide it is not "asking first" — the player already answered.
 * A verified player is greeted by name and sent to the open jornada; anybody
 * else is offered the entrance. Sending a returning player to `/registro/`,
 * which is what this did, is asking somebody who is already inside to sign in
 * again on the only screen the module has for both.
 *
 * `resolvePlayer` reads cookies, so this route is dynamic — which it has to be
 * anyway: the countdown, the open week and the fixture list are all wrong the
 * moment they are cached.
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

  const player = await resolvePlayer(program.campaignId);
  const returning = isVerified(player) ? player : null;

  return (
    <>
      <div className="sg-screen">
        <div className="sg-pad">
          {/* The co-brand at full size, once, on the screen the QR lands on.
              The bar carries a one-row version of the same plate on every other
              screen — this is where "whose game is this" is actually asked. */}
          <PickemPlate
            programName={program.name}
            orgName={program.orgName}
            logoUrl={program.theme.logoUrl}
            logoAlt={program.theme.logoAlt ?? program.orgName}
            poweredBy={program.theme.poweredBy}
          />

          {/* The sign, the name of the game and the character running with the
              ball: the whole idea in one frame, on the tenant's black plate.
              The art is a grid column, never an overlay — a cell cannot land on
              the headline at any width. */}
          <section className="pk-hero">
            <div>
              <h1 className="pk-hero-title">Pick&rsquo;em</h1>
              <span className="pk-hero-stub">
                Temporada {program.seasonYear} · {program.totalWeeks} jornadas
              </span>
              <p className="pk-hero-copy">
                Pronostica cada jornada de la temporada. Cada acierto suma al acumulado.
                Los premios se cobran en la mesa.
              </p>
            </div>

            <ChapaCharacter
              dir={characterDir(program.theme.logoUrl)}
              name="bandana-portada"
              size={150}
              className="pk-hero-art"
            />
          </section>

          {week?.lockAt && first ? (
            <section className="sg-card" data-tour="portada-countdown">
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
              <div style={{ marginBottom: 10 }}>
                <span className="pk-tag">
                  Jornada {week.week} · {week.games.filter((g) => !g.voided).length} partidos
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {week.games.slice(0, 3).map((g, i) => {
                  const away = teamOf(g.away);
                  const home = teamOf(g.home);
                  const side = (team: typeof away, abbr: string) => (
                    <div
                      className="pk-side"
                      style={{ "--team": team.color } as React.CSSProperties}
                    >
                      <TeamMark abbr={abbr} />
                      <span className="pk-side-name">{team.name}</span>
                      <span className="pk-side-city">{team.city}</span>
                    </div>
                  );
                  return (
                    <div className="pk-match" key={g.id}>
                      <div className="pk-match-head">
                        <span className="pk-match-no">Reto {String(i + 1).padStart(2, "0")}</span>
                        <span className="pk-match-when">
                          {formatKickoff(g.kickoffAt, tz)}
                          {g.venueNote || g.network ? ` · ${g.venueNote || g.network}` : ""}
                        </span>
                        <span className="pk-match-pts">+{program.mechanics.hit} pts</span>
                      </div>
                      <div className="pk-match-body">
                        {side(away, g.away)}
                        <div className="pk-at">
                          <span className="pk-vs">VS</span>
                        </div>
                        {side(home, g.home)}
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

          {/* The one call to action, at the end of the pitch rather than welded
              under it. "Ver el ranking" left with the dock: it is a tab now,
              and a button that duplicates a tab teaches that the tabs are not
              the way around.

              Trailing slash because next.config sets `trailingSlash`. Without
              it every internal navigation costs a 308 round trip. */}
          {returning ? (
            <>
              <div className="pk-ticket accent raised pk-banner">
                <span className="pk-mech-disc" aria-hidden="true">
                  ★
                </span>
                <span>Qué onda, {returning.alias}</span>
              </div>
              <Link
                className="sg-btn"
                data-tour="portada-cta"
                href={`/p/${program.slug}/jornada/${program.openWeek}/`}
              >
                Ir a la jornada {program.openWeek}
              </Link>
            </>
          ) : (
            <Link className="sg-btn" data-tour="portada-cta" href={`/p/${program.slug}/registro/`}>
              Entrar al juego
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

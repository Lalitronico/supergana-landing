import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCheckin,
  getEntry,
  getSeasonPoints,
  isVerified,
  resolvePlayer,
} from "@/lib/pickem/access";
import { acceptsPicks, getProgram, getWeek } from "@/lib/pickem/program";
import { closingGame, sameLocalDay } from "@/lib/pickem/schedule";
import type { Breakdown } from "@/lib/pickem/schema";
import { WeekStrip } from "../../WeekStrip";
import { CheckinCard } from "./CheckinCard";
import { PicksBoard } from "./PicksBoard";
import { ResultsBoard } from "./ResultsBoard";

/**
 * One jornada, in whichever state it is in.
 *
 * Picks and results share this route deliberately: they are the same week seen
 * at two moments, and the link a player pastes into a WhatsApp group has to
 * open the right one depending on when somebody taps it. The week is in the URL
 * rather than in state for the same reason.
 */
export default async function JornadaPage({
  params,
}: {
  params: Promise<{ programa: string; semana: string }>;
}) {
  const { programa, semana } = await params;
  const week = Number(semana);
  if (!Number.isInteger(week) || week < 1) notFound();

  const program = await getProgram(programa);
  if (!program) notFound();
  if (week > program.totalWeeks) notFound();

  const now = new Date();
  const weekData = await getWeek(program, week, now);
  if (!weekData) notFound();

  const player = await resolvePlayer(program.campaignId);
  const verified = isVerified(player);

  const strip = (
    <WeekStrip
      slug={program.slug}
      total={program.totalWeeks}
      current={week}
      openWeek={program.openWeek}
      promoWeeks={program.promoWeeks}
    />
  );

  // The server is where the guard lives. The screens below never render for an
  // unverified device, so a hidden button is never the only thing standing
  // between somebody and a write — the RPC refuses too, and that is the check
  // that counts.
  if (!verified || !player) {
    return (
      <>
        <div className="sg-screen">
          <div className="sg-pad">
            <div>
              <div className="sg-eyebrow">Jornada {week}</div>
              <h1 className="sg-display" style={{ marginTop: 6 }}>
                Primero,
                <br />
                tu número
              </h1>
              <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
                Los puntos se guardan en tu WhatsApp. Sin confirmarlo no podemos
                acreditártelos ni ponerte en el ranking.
              </p>
            </div>
            {strip}
          </div>
        </div>
        <div className="sg-dock">
          <Link className="sg-btn" href={`/p/${program.slug}/registro/`}>
            Entrar al juego
          </Link>
        </div>
      </>
    );
  }

  const entry = await getEntry(program.campaignId, player.participantId, week);

  if (weekData.state === "open") {
    const checkedIn = await getCheckin(program.campaignId, player.participantId, week);

    // The check-in window is the week's own game days, in the tenant's clock —
    // not a weekday and not a fixed span. Week 1 opens on a Wednesday, five
    // Sundays are 7:30 AM London games and Thanksgiving is a Thursday lunch,
    // so anything hardcoded is wrong several times a season.
    const inWindow = weekData.games.some(
      (g) => !g.voided && sameLocalDay(g.kickoffAt, now.toISOString(), program.timezone),
    );

    const closing = closingGame(weekData.games);

    return (
      <PicksBoard
        slug={program.slug}
        week={week}
        games={weekData.games}
        tz={program.timezone}
        lockAt={weekData.lockAt}
        mechanics={program.mechanics}
        initialPicks={entry?.picks ?? {}}
        initialTiebreak={entry?.tiebreak ?? null}
        closingLabel={closing ? `${closing.away}–${closing.home}` : null}
        live={acceptsPicks(program)}
        strip={strip}
        checkin={
          inWindow || checkedIn ? (
            <CheckinCard
              slug={program.slug}
              week={week}
              venues={program.venues}
              checkedInAt={checkedIn}
              multiplier={program.mechanics.checkinMult}
              live={acceptsPicks(program)}
            />
          ) : null
        }
      />
    );
  }

  // Settled, running, or a week that has not opened yet. All three are read
  // only, and the board tells them apart by whether there are scores.
  const seasonPoints =
    weekData.state === "settled"
      ? await getSeasonPoints(program.campaignId, player.participantId)
      : null;

  return (
    <ResultsBoard
      slug={program.slug}
      week={week}
      games={weekData.games}
      tz={program.timezone}
      picks={entry?.picks ?? {}}
      breakdown={(entry?.breakdown as Breakdown | null) ?? null}
      settled={weekData.state === "settled"}
      seasonPoints={seasonPoints}
      strip={strip}
    />
  );
}

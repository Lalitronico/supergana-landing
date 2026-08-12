import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAwards,
  getSeasonGrid,
  getSeasonPoints,
  getStreak,
  isVerified,
  resolvePlayer,
} from "@/lib/pickem/access";
import { getProgram } from "@/lib/pickem/program";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ChapaCharacter } from "../ChapaCharacter";
import { characterDir } from "../cast";

/**
 * The screen a player comes back to in week 7.
 *
 * Identity, the accumulated season, and the eighteen weeks laid out. The phone
 * number appears here — masked, because this screen gets shown across a
 * restaurant table with other people sitting at it, and the number is the
 * account.
 */
const maskPhone = (e164: string | null): string => {
  if (!e164) return "—";
  const m = /^\+52(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+52 ${m[1]} ••• ${m[3]}` : e164;
};

export default async function PerfilPage({
  params,
}: {
  params: Promise<{ programa: string }>;
}) {
  const { programa } = await params;
  const program = await getProgram(programa);
  if (!program) notFound();

  const player = await resolvePlayer(program.campaignId);

  if (!player) {
    return (
      <>
        <div className="sg-screen">
          <div className="sg-pad">
            <div className="pk-titlerow">
              <div>
                <span className="pk-tag">Mi perfil</span>
                <h1 className="sg-display" style={{ marginTop: 10 }}>
                  Todavía
                  <br />
                  no juegas
                </h1>
                <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
                  Regístrate con tu WhatsApp y tus puntos empiezan a acumularse.
                </p>
              </div>
              <ChapaCharacter
                dir={characterDir(program.theme.logoUrl)}
                name="goblin-perfil"
                size={112}
              />
            </div>
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

  const db = supabaseAdmin();
  const { data: row } = await db
    .from("participants")
    .select("phone")
    .eq("id", player.participantId)
    .maybeSingle<{ phone: string | null }>();

  const [points, grid, awards, streak] = await Promise.all([
    getSeasonPoints(program.campaignId, player.participantId),
    getSeasonGrid(program.campaignId, player.participantId, program.totalWeeks),
    getAwards(program.campaignId, player.participantId),
    getStreak(program.campaignId, player.participantId, program.openWeek),
  ]);

  const played = grid.filter((c) => c.played).length;
  const claimable = awards.filter((a) => a.status === "pending").length;
  // Nothing has been scored yet. A big 0 in that spot reads as "you have earned
  // nothing", which is a different and more discouraging statement than "no
  // jornada has closed" — and it is the first thing somebody sees in week 1.
  const anySettled = grid.some((c) => c.points !== null);

  return (
    <>
      <div className="sg-screen">
        <div className="sg-pad">
          <div className="pk-titlerow">
            <div>
              <span className="pk-tag">Mi perfil</span>
              <h1 className="sg-display" style={{ marginTop: 10 }}>
                {player.alias}
              </h1>
              <p className="sg-body" style={{ marginTop: 6, marginBottom: 0 }}>
                {maskPhone(row?.phone ?? null)}
              </p>
            </div>
            <ChapaCharacter
              dir={characterDir(program.theme.logoUrl)}
              name="goblin-perfil"
              size={112}
            />
          </div>

          {/* The membership card. It says nothing the screen does not already
              say — it is there because a player who has come back in week 7 is
              owed something that looks like belonging. */}
          <div className="pk-ticket accent raised pk-banner">
            <span className="pk-mech-disc" aria-hidden="true">
              ★
            </span>
            <span>Jugador de {program.orgName}</span>
          </div>

          {!isVerified(player) ? (
            <div className="sg-card" style={{ borderColor: "var(--sg-red)" }}>
              <div className="sg-eyebrow" style={{ marginBottom: 4 }}>
                Falta confirmar tu número
              </div>
              <p className="sg-body" style={{ margin: 0 }}>
                Mientras no lo confirmes no podemos acreditarte puntos ni ponerte en el
                ranking.
              </p>
            </div>
          ) : null}

          <div className="sg-card" style={{ background: "var(--sg-yellow)" }}>
            <div className="sg-eyebrow">Acumulado de temporada</div>
            <div className="sg-display" style={{ fontSize: 46, marginTop: 2, lineHeight: 1 }}>
              {anySettled ? points : "–"}
            </div>
            <div className="sg-foot" style={{ marginTop: 4 }}>
              {anySettled
                ? `${played} de ${program.totalWeeks} jornadas jugadas`
                : played > 0
                  ? "Tus picks están registrados. Los puntos llegan cuando cierre la jornada."
                  : "Todavía no juegas ninguna jornada."}
              {anySettled && streak >= 2 ? ` · racha de ${streak}` : ""}
            </div>
          </div>

          {/* Eighteen weeks at a glance. A week that was not played shows a dash
              rather than a zero: a zero says the player scored nothing, which is
              a different and more discouraging thing than not having played. */}
          <div>
            <div className="sg-eyebrow" style={{ marginBottom: 8 }}>Jornada por jornada</div>
            <div className="pk-ticket pk-stripwrap">
              <div className="pk-grid">
                {grid.map((c) => (
                  <Link
                    key={c.week}
                    href={`/p/${program.slug}/jornada/${c.week}/`}
                    className={`pk-grid-cell${
                      c.points !== null ? " is-scored" : c.played ? " is-played" : ""
                    }`}
                  >
                    <div className="pk-cd-l" style={{ marginTop: 0 }}>J{c.week}</div>
                    <div className="pk-grid-n">{c.points !== null ? c.points : "–"}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="pk-ticket pk-mech">
            <span className="pk-mech-disc" aria-hidden="true">
              ★
            </span>
            <div className="pk-mech-text">
              <div className="pk-mech-name">Mis premios</div>
              <div className="pk-mech-sub">
                {awards.length === 0
                  ? `Todavía no tienes premios por canjear. Quedan ${Math.max(
                      0,
                      program.totalWeeks - program.openWeek + 1,
                    )} jornadas.`
                  : claimable > 0
                    ? `Tienes ${claimable} premio${claimable === 1 ? "" : "s"} por cobrar en sucursal.`
                    : `${awards.length} premio${awards.length === 1 ? "" : "s"} en tu historial.`}
              </div>
            </div>
          </div>

          <p className="sg-foot" style={{ margin: 0 }}>
            Tus puntos viven en tu número, no en este teléfono. Si cambias de celular,
            entras con el mismo WhatsApp y los recuperas.
          </p>
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrizes, getProgram } from "@/lib/pickem/program";

/**
 * The published rules, reachable from inside the product.
 *
 * 08-DECISIONES-ABIERTAS §6 lists this as blocking launch, and the reason is
 * not paperwork: "Un programa con premios reales necesita reglas escritas y
 * accesibles desde el producto." A prize handed across a counter against a code
 * is a promise, and a promise nobody can read is the one that gets argued about
 * at the counter on a Tuesday.
 *
 * EVERY NUMBER ON THIS SCREEN IS READ FROM THE PROGRAMME.
 *
 * `pickem_programs.mechanics` is the same jsonb the scorer reads (0023) — hits,
 * tiebreak, margin, early bird, streaks, multipliers — and `promo_weeks` and
 * `venues` come off the same row. Writing "10 puntos por acierto" as prose here
 * would be a second copy of the rules, and the first time a tenant re-configured
 * their programme the published rules would start lying about how it scores.
 * The rules the player reads and the arithmetic the ledger pays come out of one
 * row.
 *
 * What is NOT derived is everything the platform cannot know on its own:
 * eligibility, redemption, what happens to a postponed game, who breaks a tie
 * at the top. Those are the tenant's decisions, written here as the operative
 * version and marked as subordinate to the reglamento Chapa publishes.
 */

/**
 * The version this screen states, and the date it was written.
 *
 * Versioned on purpose: the tickets module records acceptance as
 * `consents.kind = 'official_rules'` with a version string, and when the
 * pick'em registration flow starts recording consent it records THIS id. Rules
 * that changed mid-season with nothing to point at are rules nobody can prove
 * somebody accepted.
 */
const RULES_VERSION = { id: "pickem-v1", date: "7 de agosto de 2026" };

export default async function ReglasPage({
  params,
}: {
  params: Promise<{ programa: string }>;
}) {
  const { programa } = await params;
  const program = await getProgram(programa);
  if (!program) notFound();

  const m = program.mechanics;
  const prizes = await getPrizes(program);

  // Multipliers ADD to the multiplier rather than multiplying each other —
  // 0023 and 10-MECANICAS both say so, and the screen has to say the same
  // thing or the published rules promise ×4 where the scorer pays ×3.
  const checkinX = 1 + m.checkinMult;
  const promoX = 1 + m.promoMult;
  const bothX = 1 + m.checkinMult + m.promoMult;

  const tzLabel =
    program.timezone === "America/Ciudad_Juarez" ? "Ciudad Juárez" : program.timezone;

  // The redemption window is a property of each prize. Stated as one number
  // only when every prize agrees; otherwise the screen refuses to average.
  const windows = [...new Set(prizes.map((p) => p.validDays))];
  const validity =
    windows.length === 1
      ? `${windows[0]} días naturales a partir de que se anuncia el resultado`
      : windows.length > 1
        ? "la que indique cada premio en tu pantalla"
        : null;

  const scoring: { name: string; sub: string; val: string }[] = [
    {
      name: "Acierto",
      sub: "Por cada partido cuyo ganador atinas",
      val: `+${m.hit}`,
    },
    {
      name: "Desempate",
      sub: `Predices los puntos totales del último partido de la jornada. Cuenta si quedas dentro de ±${m.tiebreakMargin}`,
      val: `+${m.tiebreak}`,
    },
    {
      name: "Madrugador",
      sub: `Envías tus picks al menos ${m.earlyHours} horas antes del cierre. Se mide con tu primer envío: cambiar un pick después no te lo quita`,
      val: `+${m.early}`,
    },
    {
      name: "Racha de 3 a 5 jornadas",
      sub: "Jornadas seguidas con picks enviados, contando la actual",
      val: `+${m.streak3}`,
    },
    {
      name: "Racha de 6 o más",
      sub: "Sustituye al bono de 3; no se suman entre sí",
      val: `+${m.streak6}`,
    },
    {
      name: "Check-in en sucursal",
      sub: "Escaneas el QR de la mesa el día de los partidos. Es gratis y no requiere consumo",
      val: `×${checkinX}`,
    },
    {
      name: "Jornada doble",
      sub: program.promoWeeks.length
        ? `Jornadas marcadas por Chapa: ${program.promoWeeks.map((w) => `J${w}`).join(", ")}`
        : "Chapa todavía no marca ninguna jornada doble de la temporada",
      val: `×${promoX}`,
    },
  ];

  return (
    <>
      <div className="sg-screen">
        <div className="sg-pad">
          <div>
            <div className="sg-eyebrow">Reglas oficiales</div>
            <h1 className="sg-display" style={{ marginTop: 6 }}>
              Cómo
              <br />
              se juega
            </h1>
            <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
              Temporada NFL {program.seasonYear} · {program.totalWeeks} jornadas de temporada
              regular.
            </p>
          </div>

          {/* Said before anything else, not in a footer. This screen is the
              operative version of the rules — the numbers come from the
              programme itself — but the document that governs the prizes is
              the one the tenant publishes, and pretending otherwise would be
              this product making promises on somebody else's behalf. */}
          <div className="sg-card" style={{ background: "var(--sg-yellow)" }}>
            <div className="sg-eyebrow" style={{ marginBottom: 4 }}>
              Versión operativa
            </div>
            <p className="sg-body" style={{ margin: 0, color: "var(--sg-ink)" }}>
              Ésta es la versión operativa de las reglas, generada desde la configuración
              real del programa. Está sujeta al reglamento oficial que publica{" "}
              {program.orgName}; si algo difiere, manda el reglamento publicado.
            </p>
          </div>

          {/* ---- scoring, straight from mechanics ---- */}
          <div>
            <div className="sg-eyebrow" style={{ marginBottom: 8 }}>
              Cómo se puntúa
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {scoring.map((s) => (
                <div className="pk-mech" key={s.name}>
                  <span className="pk-mech-text">
                    <span className="pk-mech-name">{s.name}</span>
                    <span className="pk-mech-sub" style={{ display: "block" }}>
                      {s.sub}
                    </span>
                  </span>
                  <span className="pk-mech-val">{s.val}</span>
                </div>
              ))}
            </div>
            <p className="sg-foot" style={{ marginTop: 8, marginBottom: 0 }}>
              Los multiplicadores se suman entre sí, no se multiplican: check-in y jornada
              doble en la misma jornada dan ×{bothX}, no ×{checkinX * promoX}. El
              multiplicador se aplica al total de la jornada, bonos incluidos, y cada
              jornada cerrada muestra el desglose completo en tu pantalla.
            </p>
          </div>

          {/* ---- the clock ---- */}
          <div className="sg-card">
            <div className="sg-eyebrow" style={{ marginBottom: 6 }}>
              Cuándo cierran los picks
            </div>
            <p className="sg-body" style={{ margin: 0 }}>
              Cada jornada cierra en el <strong>primer kickoff</strong> de esa jornada, hora
              de {tzLabel}. No es un día fijo de la semana: se lee del calendario, y hay
              jornadas que abren en miércoles o en jueves. Puedes cambiar tus picks cuantas
              veces quieras hasta ese momento.
            </p>
            <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
              Se envía la jornada completa o no se envía: si falta un partido, no se guarda
              nada. Sólo la jornada abierta acepta picks.
            </p>
          </div>

          {/* ---- games that do not resolve ---- */}
          <div className="sg-card">
            <div className="sg-eyebrow" style={{ marginBottom: 6 }}>
              Partido pospuesto, anulado o empatado
            </div>
            <p className="sg-body" style={{ margin: 0 }}>
              Un partido pospuesto o cancelado <strong>se anula para el pick&rsquo;em</strong>
              : no cuenta para nadie, ni a favor ni en contra. Sale del numerador y también
              del denominador, así que si se anula un partido de una jornada de 16, esa
              jornada se califica sobre 15 para todos.
            </p>
            <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
              Un partido que termina empatado no da acierto a nadie: no hubo ganador que
              pronosticar. La jornada cierra con los partidos que sí se resolvieron.
            </p>
          </div>

          {/* ---- who can play ---- */}
          <div className="sg-card">
            <div className="sg-eyebrow" style={{ marginBottom: 6 }}>
              Quién puede participar
            </div>
            <ul className="sg-body" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Mayores de 18 años.</li>
              <li>
                <strong>Un número de WhatsApp por persona.</strong> El número es la cuenta:
                tus puntos viven en él, no en el teléfono. Un número, un jugador.
              </li>
              <li>
                Hay que confirmar el número con el código que se envía. Sin confirmarlo no
                se acreditan puntos ni se aparece en el ranking.
              </li>
              <li>
                <strong>Jugar es gratis y no requiere consumir.</strong> Ningún punto que
                decide un premio se gana comprando — tampoco el check-in, que sólo premia
                estar en la sucursal.
              </li>
              <li>
                No pueden participar quienes trabajen en {program.orgName} ni sus
                familiares directos, conforme al reglamento publicado.
              </li>
            </ul>
          </div>

          {/* ---- prizes ---- */}
          <div className="sg-card">
            <div className="sg-eyebrow" style={{ marginBottom: 6 }}>
              Premios, canje y vigencia
            </div>
            <p className="sg-body" style={{ margin: 0 }}>
              Los premios los define y aporta {program.orgName}. Se cobran{" "}
              <strong>en sucursal</strong>: muestras el código de tu pantalla a quien te
              atiende y ahí se marca como canjeado. Nada se entrega en línea.
            </p>
            <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
              {validity
                ? `Vigencia del canje: ${validity}. Un premio vencido ya no se puede cobrar.`
                : `La vigencia del canje aparece en tu pantalla junto al código, desde el momento en que ganas. Todavía no hay premios anunciados para esta temporada.`}
            </p>
            {program.venues.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
                {program.venues.map((v) => (
                  <span className="sg-chip" key={v}>
                    {v}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* ---- ties at the top ---- */}
          <div className="sg-card">
            <div className="sg-eyebrow" style={{ marginBottom: 6 }}>
              Empate en la cima
            </div>
            <p className="sg-body" style={{ margin: 0 }}>
              Si dos jugadores terminan una jornada o la temporada con los mismos puntos, el
              empate lo resuelve {program.orgName} conforme a su reglamento publicado. El
              acumulado de temporada es la suma de las {program.totalWeeks} jornadas y no se
              redondea ni se ajusta por jornadas no jugadas.
            </p>
          </div>

          <p className="sg-foot" style={{ margin: 0 }}>
            Versión {RULES_VERSION.id} · {RULES_VERSION.date}. Los valores de puntos, bonos,
            multiplicadores, jornadas dobles y sucursales de esta pantalla se leen de la
            configuración vigente del programa, así que cambian cuando cambia el programa.
            Cualquier cambio a las reglas se publica antes de la jornada en la que aplica.
          </p>
        </div>
      </div>

      <div className="sg-dock">
        <Link className="sg-btn ghost sm" href={`/p/${program.slug}/ranking/`}>
          Ver el ranking
        </Link>
        <Link className="sg-btn ghost sm" href={`/p/${program.slug}/premios/`}>
          Ver los premios
        </Link>
      </div>
    </>
  );
}

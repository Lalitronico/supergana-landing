import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAwards, resolvePlayer } from "@/lib/pickem/access";
import { getPrizes, getProgram } from "@/lib/pickem/program";
import { formatDay } from "@/lib/pickem/schedule";

/**
 * What is at stake, and what has been won.
 *
 * The collection happens at the counter, and that is the mechanism of the whole
 * business rather than a logistics detail: the game lives on the phone, the
 * prize brings you back to the table. Nothing here is redeemable online, on
 * purpose.
 */
export default async function PremiosPage({
  params,
}: {
  params: Promise<{ programa: string }>;
}) {
  const { programa } = await params;
  const program = await getProgram(programa);
  if (!program) notFound();

  const player = await resolvePlayer(program.campaignId);
  const prizes = await getPrizes(program);
  const awards = player ? await getAwards(program.campaignId, player.participantId) : [];

  const claimable = awards.filter((a) => a.status === "pending");
  const past = awards.filter((a) => a.status !== "pending");
  const weekly = prizes.filter((p) => p.scope === "week");
  const season = prizes.filter((p) => p.scope === "season");

  return (
    <>
      <div className="sg-screen">
        <div className="sg-pad">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="sg-eyebrow">Premios</div>
              <h1 className="sg-display" style={{ marginTop: 6 }}>
                {claimable.length ? "Ganaste" : "Lo que está en juego"}
              </h1>
            </div>
            <div className="sg-art" style={{ width: 92 }}>
              <Image
                src="/brands/chapa/balon-mascota.png"
                alt=""
                width={400}
                height={400}
                style={{ width: "100%", height: "auto" }}
              />
            </div>
          </div>

          {/* Won, and not yet collected. First, because it is the only thing on
              this screen that needs doing. */}
          {claimable.map((a) => (
            <div className="sg-card" key={a.id} style={{ background: "var(--sg-yellow)" }}>
              <div className="sg-eyebrow">
                {a.week ? `Jornada ${a.week}` : "Campeón de temporada"} · lugar {a.place}
              </div>
              <div className="sg-h" style={{ fontSize: 20, marginTop: 4 }}>
                {a.prizeName}
              </div>
              {a.prizeDetail ? (
                <p className="sg-body" style={{ marginTop: 4, marginBottom: 0 }}>
                  {a.prizeDetail}
                </p>
              ) : null}

              <div
                style={{
                  marginTop: 12,
                  padding: "12px 10px",
                  background: "#fff",
                  border: "2.5px solid var(--sg-ink)",
                  borderRadius: 12,
                  textAlign: "center",
                }}
              >
                <div className="sg-eyebrow">Muestra este código</div>
                <div
                  style={{
                    fontFamily: "var(--sg-mono)",
                    fontSize: 25,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    marginTop: 4,
                  }}
                >
                  {a.code}
                </div>
              </div>

              <p className="sg-foot" style={{ marginTop: 8, marginBottom: 0 }}>
                Válido hasta el {formatDay(a.expiresAt, program.timezone)}. Se cobra en
                sucursal — enséñaselo a quien te atiende.
              </p>
            </div>
          ))}

          {past.length ? (
            <div className="sg-card">
              <div className="sg-eyebrow" style={{ marginBottom: 8 }}>Historial</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {past.map((a) => (
                  <div
                    key={a.id}
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="pk-mech-name">{a.prizeName}</span>
                      <span className="pk-mech-sub" style={{ display: "block" }}>
                        {a.week ? `Jornada ${a.week}` : "Temporada"}
                        {a.redeemedVenue ? ` · ${a.redeemedVenue}` : ""}
                      </span>
                    </span>
                    <span className={`sg-pill ${a.status === "redeemed" ? "ok" : "bad"}`}>
                      {a.status === "redeemed"
                        ? "Canjeado"
                        : a.status === "expired"
                          ? "Vencido"
                          : "Cancelado"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* What is on offer. Empty until the client defines it — the prizes
              are theirs to define and supply, and inventing a placeholder here
              would be inventing a promise on their behalf. */}
          <div>
            <div className="sg-eyebrow" style={{ marginBottom: 8 }}>
              {claimable.length ? "También está en juego" : "Cada jornada"}
            </div>
            {weekly.length === 0 && season.length === 0 ? (
              <div className="sg-card">
                <p className="sg-body" style={{ margin: 0 }}>
                  Chapa todavía no anuncia los premios de la temporada. En cuanto los
                  defina aparecen aquí.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...weekly, ...season].map((p) => (
                  <div className="sg-card" key={p.id}>
                    <div className="sg-eyebrow">
                      {p.scope === "week" ? "Cada jornada" : "Gran premio de temporada"} ·
                      lugar {p.place}
                    </div>
                    <div className="sg-h" style={{ fontSize: 17, marginTop: 3 }}>
                      {p.name}
                    </div>
                    {p.detail ? (
                      <p className="sg-body" style={{ marginTop: 3, marginBottom: 0 }}>
                        {p.detail}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {program.venues.length ? (
            <div className="sg-card">
              <div className="sg-eyebrow" style={{ marginBottom: 8 }}>Dónde se cobra</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {program.venues.map((v) => (
                  <span className="sg-chip" key={v}>
                    {v}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="sg-dock">
        <Link className="sg-btn ghost sm" href={`/p/${program.slug}/ranking/`}>
          Volver al ranking
        </Link>
        <Link className="sg-btn ghost sm" href={`/p/${program.slug}/perfil/`}>
          Mi perfil
        </Link>
      </div>
    </>
  );
}

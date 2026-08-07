"use client";

import { useState } from "react";
import { formatKickoff } from "@/lib/pickem/schedule";
import type { PanelGame, PanelProgram, PanelStaff, WeekSnapshot } from "./types";

/**
 * The Tuesday screen: where the jornada stands, and the three ways to move it.
 *
 * The close is the critical operation of the week — all of it or none of it,
 * inside one transaction. What this screen adds over the cron is a person: it
 * says exactly which marcadores are missing instead of a count, it makes the
 * tie at the top something a supervisor decides instead of something that
 * silently never resolves, and it is the only place a postponed game can be
 * taken out of the scoring.
 */

const AWARD_LABEL: Record<string, string> = {
  pending: "Por canjear",
  redeemed: "Canjeado",
  expired: "Vencido",
  canceled: "Cancelado",
};

const AWARD_PILL: Record<string, string> = {
  pending: "wait",
  redeemed: "ok",
  expired: "bad",
  canceled: "",
};

export function WeekView({
  slug,
  program,
  staff,
  snapshot,
  onWeek,
  onDone,
}: {
  slug: string;
  program: PanelProgram;
  staff: PanelStaff;
  snapshot: WeekSnapshot;
  onWeek: (week: number) => void;
  onDone: (message: string, bad?: boolean) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [winners, setWinners] = useState<string[]>([]);

  const { week, games, readiness, entries, settled, tie, awards } = snapshot;
  const tz = program.timezone;

  const post = async (body: unknown, key: string) => {
    setBusy(key);
    try {
      const res = await fetch(`/api/pickem/${slug}/panel/jornada/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        await onDone(json.message ?? "No pudimos completar la operación.", true);
        return false;
      }
      await onDone(json.message ?? "Listo.");
      return true;
    } catch {
      await onDone("Se cayó la conexión. Intenta de nuevo.", true);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const toggleWinner = (id: string) =>
    setWinners((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));

  return (
    <>
      {/* ---- which jornada -------------------------------------------- */}
      <div className="sg-card">
        <div className="pkp-week">
          <button
            className="pkp-step"
            aria-label="Jornada anterior"
            disabled={week <= 1}
            onClick={() => onWeek(week - 1)}
          >
            ‹
          </button>
          <div className="n">
            Jornada {week}
            {week === program.openWeek ? " · abierta" : ""}
          </div>
          <button
            className="pkp-step"
            aria-label="Jornada siguiente"
            disabled={week >= program.totalWeeks}
            onClick={() => onWeek(week + 1)}
          >
            ›
          </button>
        </div>

        <div className="pkp-stats" style={{ marginTop: 12 }}>
          <div className={`pkp-stat${readiness.ready ? " ok" : " warn"}`}>
            <div className="v">
              {readiness.scored}/{readiness.live}
            </div>
            <div className="l">Marcadores</div>
          </div>
          <div className="pkp-stat">
            <div className="v">{entries.total}</div>
            <div className="l">Entradas</div>
          </div>
          <div className="pkp-stat">
            <div className="v">{entries.settled}</div>
            <div className="l">Calificadas</div>
          </div>
        </div>

        {readiness.voided > 0 && (
          <p className="sg-foot" style={{ marginTop: 8 }}>
            {readiness.voided} partido(s) anulado(s) de {readiness.total}. Un partido
            anulado no cuenta para nadie, ni a favor ni en contra.
          </p>
        )}
      </div>

      {/* ---- can it close --------------------------------------------- */}
      <div className="sg-card">
        <div className="pkp-head">
          <div className="pkp-title">Cierre de jornada</div>
          <span className={`sg-pill ${settled ? "ok" : readiness.ready ? "wait" : "bad"}`}>
            {settled ? "Cerrada" : readiness.ready ? "Lista" : "Faltan marcadores"}
          </span>
        </div>

        {!readiness.ready && readiness.missing.length > 0 && (
          <>
            <p className="sg-body" style={{ marginTop: 8 }}>
              No se puede cerrar: {readiness.missing.length} partido(s) sin marcador.
              Un cierre parcial reparte premios equivocados y eso no se deshace bien.
            </p>
            <div style={{ marginTop: 6 }}>
              {readiness.missing.map((g) => (
                <div key={g.id} className="pkp-row">
                  <div className="body">
                    <div className="name">
                      {g.away} @ {g.home}
                    </div>
                    <div className="sub">{formatKickoff(g.kickoffAt, tz)}</div>
                  </div>
                  <span className="sg-pill bad">Sin marcador</span>
                </div>
              ))}
            </div>
            <p className="sg-foot" style={{ marginTop: 8 }}>
              Si uno de estos se pospuso, anúlalo abajo: es la única forma de que la
              jornada cierre con los partidos que sí se jugaron.
            </p>
          </>
        )}

        {readiness.live === 0 && (
          <p className="sg-body" style={{ marginTop: 8 }}>
            Esta jornada no tiene partidos que cuenten. No hay nada que calificar.
          </p>
        )}

        {settled && (
          <p className="sg-body" style={{ marginTop: 8 }}>
            Cerrada con {entries.settled} entrada(s) calificada(s). Volver a cerrarla no
            duplica puntos ni premios, pero tampoco vuelve a calcular lo ya calificado.
          </p>
        )}

        {staff.canOperate ? (
          <button
            className="sg-btn"
            style={{ marginTop: 12 }}
            disabled={busy !== null || !readiness.ready}
            onClick={() => void post({ action: "settle", week }, "settle")}
          >
            {busy === "settle" ? "Cerrando…" : `Cerrar jornada ${week}`}
          </button>
        ) : (
          <p className="sg-foot" style={{ marginTop: 10 }}>
            Tu rol ({staff.role}) puede consultar la jornada pero no cerrarla. El cierre
            es una decisión de supervisor.
          </p>
        )}
      </div>

      {/* ---- the tie at the top ---------------------------------------- */}
      {settled && tie && (
        <div className="sg-card">
          <div className="pkp-head">
            <div className="pkp-title">Primer lugar</div>
            <span className="sg-chip">{tie.top} pts</span>
          </div>

          {tie.awarded ? (
            <p className="sg-body" style={{ marginTop: 8 }}>
              El premio de esta jornada ya está otorgado. Aparece abajo con su código.
            </p>
          ) : !tie.tied ? (
            <p className="sg-body" style={{ marginTop: 8 }}>
              Hay un solo primer lugar y el cierre ya le otorgó su premio.
            </p>
          ) : (
            <>
              <p className="sg-body" style={{ marginTop: 8 }}>
                {tie.rows.length} jugadores empataron en la cima y el bono de desempate
                no los separó. El cierre no lo decide solo: elige a quién se le otorga,
                o marca a varios para repartir.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {tie.rows.map((r) => {
                  const on = winners.includes(r.participantId);
                  return (
                    <button
                      key={r.participantId}
                      type="button"
                      className="pkp-pick"
                      aria-pressed={on}
                      onClick={() => toggleWinner(r.participantId)}
                    >
                      <span className="box">{on ? "✓" : ""}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="name" style={{ display: "block" }}>{r.alias}</span>
                        <span className="sub">{r.venue ?? "Sin sucursal registrada"}</span>
                      </span>
                      <span className="pkp-score">{r.points}</span>
                    </button>
                  );
                })}
              </div>

              {staff.canOperate ? (
                <button
                  className="sg-btn"
                  style={{ marginTop: 12 }}
                  disabled={busy !== null || winners.length === 0}
                  onClick={async () => {
                    const ok = await post(
                      { action: "resolve-tie", week, winners },
                      "tie",
                    );
                    if (ok) setWinners([]);
                  }}
                >
                  {busy === "tie"
                    ? "Otorgando…"
                    : winners.length > 1
                      ? `Repartir entre ${winners.length}`
                      : "Otorgar premio"}
                </button>
              ) : (
                <p className="sg-foot" style={{ marginTop: 10 }}>
                  Resolver el empate es una decisión de supervisor.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ---- prizes of this jornada ------------------------------------ */}
      {awards.length > 0 && (
        <div className="sg-card">
          <div className="pkp-title">Premios de la jornada</div>
          {awards.map((a) => (
            <div key={a.id} className="pkp-row">
              <div className="body">
                <div className="name">{a.alias}</div>
                <div className="sub pkp-mono">{a.code}</div>
                <div className="sub">
                  {a.prizeName}
                  {a.redeemedVenue ? ` · ${a.redeemedVenue}` : ""}
                </div>
              </div>
              <span className={`sg-pill ${AWARD_PILL[a.status] ?? ""}`}>
                {AWARD_LABEL[a.status] ?? a.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ---- the calendar, and what can be annulled --------------------- */}
      <div className="sg-card">
        <div className="pkp-title">Partidos</div>
        <p className="sg-foot" style={{ marginTop: 4 }}>
          Anular es para un partido pospuesto: no cuenta para nadie y sale del
          denominador, así que “11 de 15” sigue siendo cierto. Después del cierre ya no
          se puede — esa corrección va por un ajuste de puntos con motivo.
        </p>

        {games.map((g) => (
          <GameRow
            key={g.id}
            game={g}
            tz={tz}
            canOperate={staff.canOperate && !settled}
            busy={busy === `game:${g.id}`}
            onToggle={() =>
              void post(
                { action: "void-game", gameId: g.id, voided: !g.voided },
                `game:${g.id}`,
              )
            }
          />
        ))}
      </div>
    </>
  );
}

function GameRow({
  game,
  tz,
  canOperate,
  busy,
  onToggle,
}: {
  game: PanelGame;
  tz: string;
  canOperate: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const scored = game.awayScore !== null && game.homeScore !== null;
  return (
    <div className={`pkp-row${game.voided ? " is-void" : ""}`}>
      <div className="body">
        <div className="name">
          {game.away} @ {game.home}
        </div>
        <div className="sub">
          {formatKickoff(game.kickoffAt, tz)}
          {game.network ? ` · ${game.network}` : ""}
        </div>
      </div>

      <span className="pkp-score">
        {game.voided ? "—" : scored ? `${game.awayScore}–${game.homeScore}` : "· ·"}
      </span>

      {canOperate && (
        <button
          type="button"
          className="sg-btn ghost sm"
          style={{ width: "auto", flex: "none" }}
          disabled={busy}
          onClick={onToggle}
        >
          {busy ? "…" : game.voided ? "Reactivar" : "Anular"}
        </button>
      )}
    </div>
  );
}

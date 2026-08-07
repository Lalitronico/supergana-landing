"use client";

import { useState } from "react";
import type { PanelStaff, PlayerHit, PlayerLedger } from "./types";

/**
 * Correcting a score after the jornada already closed.
 *
 * The third case in the runbook, and the only one that arrives after everything
 * has been published: a marcador was captured wrong and somebody's points are
 * wrong with it. The answer is never to edit the entry that was credited —
 * that entry is what the player was told and what the ranking paid out. It is a
 * NEW entry, signed, with a reason, and the balance moves because a balance is
 * a SUM and never a stored column.
 *
 * Which is why the motivo is not optional and why this screen shows the ledger
 * before it shows the form: a correction written against what somebody
 * remembers is how a double credit becomes a triple one.
 */

const KIND_LABEL: Record<string, string> = {
  pickem_week: "Cierre de jornada",
  adjustment: "Ajuste manual",
  purchase: "Compra",
  redemption: "Canje",
};

export function AdjustView({
  slug,
  staff,
  onDone,
}: {
  slug: string;
  staff: PanelStaff;
  onDone: (message: string, bad?: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlayerHit[] | null>(null);
  const [ledger, setLedger] = useState<PlayerLedger | null>(null);
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"search" | "ledger" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!staff.canOperate) {
    return (
      <div className="sg-card">
        <div className="pkp-title">Ajustes de puntos</div>
        <p className="sg-body" style={{ marginTop: 6 }}>
          Tu rol ({staff.role}) no puede corregir el ledger. Corregir puntos mueve un
          ranking que decide premios: es una decisión de supervisor.
        </p>
      </div>
    );
  }

  const search = async () => {
    setBusy("search");
    setError(null);
    setLedger(null);
    try {
      const res = await fetch(
        `/api/pickem/${slug}/panel/ajuste/?q=${encodeURIComponent(query)}`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => ({}))) as { players?: PlayerHit[] };
      setHits(json.players ?? []);
    } catch {
      setError("Se cayó la conexión. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  const open = async (participantId: string) => {
    setBusy("ledger");
    setError(null);
    try {
      const res = await fetch(
        `/api/pickem/${slug}/panel/ajuste/?player=${encodeURIComponent(participantId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        ledger?: PlayerLedger;
        message?: string;
      };
      if (!res.ok || !json.ledger) {
        setError(json.message ?? "No pudimos leer el ledger de ese jugador.");
        return;
      }
      setLedger(json.ledger);
      setPoints("");
      setNote("");
      setConfirming(false);
    } catch {
      setError("Se cayó la conexión. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  const parsed = Number(points);
  const validPoints = points.trim() !== "" && Number.isInteger(parsed) && parsed !== 0;
  // Mirrors ADJUSTMENT_CONFIRM_AT / ADJUSTMENT_NOTE_MIN in lib/pickem/staff.ts,
  // which is where the rule is enforced. These only decide when the screen asks
  // a second time and when the button lights up — the route validates again,
  // because the screen deciding what to offer and the server deciding what to
  // write are two places and only one of them is the record.
  const validNote = note.trim().length >= 6;
  const unusual = Math.abs(parsed) >= 1000;

  const save = async () => {
    if (!ledger) return;
    if (unusual && !confirming) {
      setConfirming(true);
      return;
    }
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/pickem/${slug}/panel/ajuste/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: ledger.participantId,
          points: parsed,
          note: note.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(json.message ?? "No pudimos guardar el ajuste.");
        return;
      }
      onDone(json.message ?? "Ajuste registrado.");
      setPoints("");
      setNote("");
      setConfirming(false);
      await open(ledger.participantId);
    } catch {
      setError("Se cayó la conexión. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="sg-card">
        <div className="pkp-title">Ajustes de puntos</div>
        <p className="sg-foot" style={{ marginTop: 4 }}>
          Busca por alias o por teléfono. El ledger es append-only: una corrección es un
          asiento nuevo con motivo y autor, nunca una edición del original.
        </p>

        <div className="pkp-inline" style={{ marginTop: 12 }}>
          <input
            type="search"
            placeholder="Alias o teléfono"
            aria-label="Buscar jugador"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && query.trim().length >= 2 && void search()}
          />
          <button
            className="sg-btn"
            style={{ width: "auto", flex: "none", padding: "11px 14px" }}
            disabled={busy !== null || query.trim().length < 2}
            onClick={() => void search()}
          >
            {busy === "search" ? "…" : "Buscar"}
          </button>
        </div>

        {error && <p className="sg-error" style={{ marginTop: 10 }}>{error}</p>}

        {hits !== null && hits.length === 0 && (
          <p className="sg-body" style={{ marginTop: 10 }}>
            Nadie coincide con esa búsqueda en este programa.
          </p>
        )}

        {hits?.map((p) => (
          <div key={p.participantId} className="pkp-row">
            <div className="body">
              <div className="name">{p.alias}</div>
              <div className="sub">
                {p.phone ?? "sin teléfono"}
                {p.verified ? "" : " · sin verificar"}
              </div>
            </div>
            <button
              type="button"
              className="sg-btn ghost sm"
              style={{ width: "auto", flex: "none" }}
              disabled={busy !== null}
              onClick={() => void open(p.participantId)}
            >
              Abrir
            </button>
          </div>
        ))}
      </div>

      {ledger && (
        <>
          <div className="sg-card">
            <div className="pkp-head">
              <div className="pkp-title">{ledger.alias}</div>
              <span className="sg-chip">{ledger.total} pts</span>
            </div>
            <p className="sg-foot" style={{ marginTop: 4 }}>
              Total de temporada: la SUMA de los asientos en puntos. Las fichas de
              lealtad nunca entran aquí — si el consumo pudiera mover el ranking, gastar
              mejoraría la probabilidad de ganar.
            </p>

            {ledger.lines.length === 0 ? (
              <p className="sg-body" style={{ marginTop: 8 }}>
                Todavía no tiene asientos de puntos.
              </p>
            ) : (
              ledger.lines.map((l) => (
                <div key={l.id} className="pkp-row">
                  <div className="body">
                    <div className="name">{KIND_LABEL[l.kind] ?? l.kind}</div>
                    <div className="sub">
                      {new Date(l.createdAt).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {l.note ? ` · ${l.note}` : ""}
                      {l.createdBy ? " · a mano" : ""}
                    </div>
                  </div>
                  <span className="pkp-score">
                    {l.points > 0 ? "+" : ""}
                    {l.points}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="sg-card">
            <div className="pkp-title">Nuevo ajuste</div>

            <div className="sg-field" style={{ marginTop: 10 }}>
              <label htmlFor="pkp-points">Puntos (negativo para restar)</label>
              <input
                id="pkp-points"
                type="number"
                inputMode="numeric"
                step={1}
                value={points}
                onChange={(e) => {
                  setPoints(e.target.value);
                  setConfirming(false);
                }}
              />
            </div>

            <div className="sg-field" style={{ marginTop: 10 }}>
              <label htmlFor="pkp-note">Motivo (obligatorio)</label>
              <textarea
                id="pkp-note"
                maxLength={200}
                placeholder="Marcador de PHI-DAL capturado al revés en la J7"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setConfirming(false);
                }}
              />
            </div>

            <p className="sg-foot" style={{ marginTop: 6 }}>
              El motivo lo va a leer alguien que no estuvo en la conversación. “Ajuste”
              no es un motivo; “marcador invertido en la J7” sí.
            </p>

            {confirming && (
              <p className="sg-body" style={{ marginTop: 8, fontWeight: 700 }}>
                Son {parsed > 0 ? "+" : ""}
                {parsed} puntos, una cifra inusual para una jornada. Vuelve a presionar
                para escribirla.
              </p>
            )}

            <button
              className={`sg-btn${confirming ? " ink" : ""}`}
              style={{ marginTop: 12 }}
              disabled={busy !== null || !validPoints || !validNote}
              onClick={() => void save()}
            >
              {busy === "save"
                ? "Guardando…"
                : confirming
                  ? "Confirmar ajuste"
                  : "Registrar ajuste"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { formatUsdCents } from "@/lib/tickets/config";
import { issueMessage } from "./ocrIssues";

/**
 * What the model read, beside what was decided.
 *
 * The gap this fills: auto-approval settles the clean receipts without a human,
 * so the receipts the machine is most confident about are precisely the ones
 * nobody ever sees. The review queue holds only its doubts. Before this screen,
 * "is the reading any good?" was answerable in SQL and nowhere else — which in
 * practice meant it was not answered.
 *
 * Read it as three columns: the PHOTO, what was READ off it, and what was
 * DECIDED. The fourth thing — whether a person disagreed afterwards — is the
 * one that should change anybody's mind about trusting this, so it is a badge
 * and not a footnote.
 *
 * Its own endpoint rather than the shared console snapshot, like `StoreView`:
 * the snapshot is built for the queue, this needs settled receipts too, and a
 * screen that made the queue heavier for every reviewer would be a bad trade.
 */

const money = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? "—" : formatUsdCents(cents, "es");

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-MX", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const STATUS_LABEL: Record<string, string> = {
  received: "Recibido",
  in_review: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
  needs_new_image: "Pidió otra foto",
};

const STATUS_PILL: Record<string, string> = {
  received: "warn",
  in_review: "warn",
  approved: "ok",
  rejected: "mute",
  needs_new_image: "warn",
};

/** Motivos que escribe la compuerta, en castellano de operación. */
const DECISION_LABEL: Record<string, string> = {
  approved: "Aprobado",
  rejected: "Rechazado",
  needs_new_image: "Se pidió otra imagen",
  reopened: "Reabierto",
};

const REASON_LABEL: Record<string, string> = {
  auto_approve_off: "aprobación automática apagada",
  campaign_has_no_stores: "la campaña no tiene tiendas listadas",
  extraction_failed: "la lectura no completó",
  extraction_skipped: "no se intentó leer",
  future_date: "fecha futura",
  store_not_listed: "tienda fuera de la lista",
  no_eligible_lines: "ninguna línea del catálogo",
  eligible_above_total: "elegible mayor que el total",
  below_threshold: "por debajo del mínimo",
};

const readReason = (reason: string | null): string => {
  if (!reason) return "—";
  if (reason.startsWith("issues:")) {
    return `observaciones: ${reason
      .slice("issues:".length)
      .split(",")
      .map((key) => issueMessage(key.trim()))
      .join("; ")}`;
  }
  return REASON_LABEL[reason] ?? reason;
};

interface Line {
  text?: string;
  amountPrinted?: string | null;
  amountCents?: number | null;
}

interface Row {
  receipt: {
    id: string;
    status: string;
    submittedAt: string;
    storeName: string | null;
    purchaseDate: string | null;
    totalCents: number | null;
    eligibleCents: number | null;
    rejectReason: string | null;
    reviewedAt: string | null;
    imageUrl: string | null;
  };
  reading: {
    status: string;
    model: string;
    promptVersion: string;
    storeName: string;
    storeChain: string | null;
    storeBranch: string | null;
    purchaseDate: string | null;
    purchaseDateRaw: string | null;
    totalCents: number | null;
    totalPrinted: string | null;
    lines: Line[];
    legible: boolean | null;
    issues: string[];
    error: string | null;
    latencyMs: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    readAt: string;
    reads: number;
  } | null;
  decision: {
    byMachine: boolean;
    decision: string;
    reason: string | null;
    at: string;
  } | null;
  humanAfterMachine: boolean;
}

interface Payload {
  rows: Row[];
  page: number;
  pageSize: number;
  total: number;
}

export function ReadingsView({ slug }: { slug: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [page, setPage] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Payload | null> => {
    try {
      const res = await fetch(`/api/tickets/${slug}/admin/readings/?page=${page}`, {
        cache: "no-store",
      });
      if (res.status === 403) {
        setFailed("Esta vista es para revisores: muestra lo que un tercero leyó en el ticket de alguien.");
        return null;
      }
      if (!res.ok) {
        setFailed("No pudimos cargar las lecturas.");
        return null;
      }
      return (await res.json()) as Payload;
    } catch {
      setFailed("No pudimos cargar las lecturas.");
      return null;
    }
  }, [slug, page]);

  useEffect(() => {
    let alive = true;
    setFailed(null);
    load().then((next) => {
      if (alive && next) setData(next);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  if (failed) return <div className="tka-card">{failed}</div>;
  if (!data) return <div className="tka-card">Cargando lecturas…</div>;

  const rows = data.rows;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  // The two numbers worth putting at the top, and neither is an accuracy score:
  // there is no ground truth here, only agreement. "A person changed it" is the
  // honest proxy, and it is a floor rather than a rate — a wrong reading nobody
  // caught looks exactly like a right one.
  const settledByMachine = rows.filter((r) => r.decision?.byMachine).length;
  const corrected = rows.filter((r) => r.humanAfterMachine).length;

  return (
    <>
      <div>
        <h2 className="tka-title">Lecturas</h2>
        <div className="tka-sub">
          Lo que el modelo leyó, al lado de lo que se decidió. Incluye los tickets que la
          máquina aprobó sola, que son los únicos que nunca pasan por la cola.
        </div>
      </div>

      {/* El marcado que pide `admin.css`: .v el número, .l la etiqueta, .d la
          nota. Inventar clases nuevas aquí habría dado tres líneas de texto sin
          estilo al lado de un panel que sí lo tiene. */}
      <div className="tka-grid4">
        <div className="tka-card tka-kpi">
          <div className="v">{rows.length}</div>
          <div className="l">Tickets en esta página</div>
          <div className="d">de {data.total} en la campaña</div>
        </div>
        <div className="tka-card tka-kpi">
          <div className="v">{settledByMachine}</div>
          <div className="l">Decididos sin humano</div>
          <div className="d">nunca pasaron por la cola</div>
        </div>
        <div className="tka-card tka-kpi">
          <div className="v">{corrected}</div>
          <div className="l">Corregidos después</div>
          <div className="d">
            una persona cambió lo que la máquina decidió — es el único número
            honesto sobre si conviene confiarle más
          </div>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="tka-card">Todavía no hay tickets en esta campaña.</div>
      )}

      {rows.map((row) => {
        const r = row.receipt;
        const x = row.reading;
        // The disagreement worth flagging: the human's total is not the model's.
        // Compared only when both exist and a person actually reviewed it —
        // otherwise every unsettled receipt would light up.
        const totalsDiffer =
          x?.totalCents != null && r.totalCents != null && x.totalCents !== r.totalCents;

        return (
          <div className="tka-card" key={r.id}>
            <div className="tka-top">
              <div>
                <span className={`tka-pill ${STATUS_PILL[r.status] ?? "mute"}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>{" "}
                <span className="tka-sub">{when(r.submittedAt)}</span>
              </div>
              <div className="tka-flags">
                {row.decision?.byMachine && <span className="tka-flag">decidió la máquina</span>}
                {row.humanAfterMachine && <span className="tka-flag">una persona lo corrigió</span>}
                {totalsDiffer && <span className="tka-flag">totales distintos</span>}
                {x && x.reads > 1 && <span className="tka-flag">releído {x.reads}×</span>}
              </div>
            </div>

            <div className="rd-cols">
              {/* 1 — la foto */}
              <div className="tka-side">
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="tka-shot" src={r.imageUrl} alt="Ticket" loading="lazy" />
                ) : (
                  <div className="tka-note">Sin imagen</div>
                )}
              </div>

              {/* 2 — lo que leyó */}
              <div className="tka-main">
                <h3 className="tka-title" style={{ fontSize: 15 }}>Lo que leyó</h3>
                {!x && <div className="tka-note">Nunca se leyó este ticket.</div>}
                {x && x.status !== "ok" && (
                  <div className="tka-note">
                    Lectura <b>{x.status}</b>
                    {x.error ? `: ${x.error}` : ""}
                  </div>
                )}
                {x && (
                  <>
                    <div className="tka-kv">
                      <span>Tienda</span>
                      <b>
                        {x.storeName || "—"}
                        {/* Cómo repartió el ticket los dos campos. Importa
                            porque cuál de ellos trae el nombre de la cadena lo
                            decide la impresora, no una regla nuestra — y
                            preferir uno a ciegas ya mandó a la cola un ticket
                            legítimo (ver storeNameFrom). */}
                        {x.storeChain && x.storeBranch && x.storeChain !== x.storeBranch && (
                          <span className="tka-note">
                            {" "}razón social: {x.storeChain} · sucursal: {x.storeBranch}
                          </span>
                        )}
                      </b>
                      <span>Fecha</span>
                      <b>
                        {x.purchaseDate ?? "—"}
                        {x.purchaseDateRaw && x.purchaseDateRaw !== x.purchaseDate
                          ? ` (impreso: ${x.purchaseDateRaw})`
                          : ""}
                      </b>
                      <span>Total</span>
                      <b>
                        {money(x.totalCents)}
                        {x.totalPrinted ? ` (impreso: ${x.totalPrinted})` : ""}
                      </b>
                      <span>Legible</span>
                      <b>{x.legible === null ? "—" : x.legible ? "sí" : "no"}</b>
                    </div>

                    {x.issues.length > 0 && (
                      <div className="tka-flags">
                        {x.issues.map((issue) => (
                          <span className="tka-flag" key={issue}>{issueMessage(issue)}</span>
                        ))}
                      </div>
                    )}

                    <div className="tka-lines">
                      {x.lines.length === 0 && <div className="tka-note">Sin líneas.</div>}
                      {x.lines.map((line, i) => (
                        <div className="tka-line" key={i}>
                          <span className="tka-mono">{line.text ?? ""}</span>
                          <span className="tka-mono">
                            {line.amountPrinted ?? money(line.amountCents)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="tka-note">
                      {x.model} · prompt {x.promptVersion} ·{" "}
                      {x.latencyMs !== null ? `${(x.latencyMs / 1000).toFixed(1)} s` : "—"} ·{" "}
                      {x.inputTokens ?? "?"}/{x.outputTokens ?? "?"} tokens · {when(x.readAt)}
                    </div>
                  </>
                )}
              </div>

              {/* 3 — lo que se decidió */}
              <div className="tka-main">
                <h3 className="tka-title" style={{ fontSize: 15 }}>Lo que se decidió</h3>
                {!row.decision && <div className="tka-note">Todavía nadie decidió.</div>}
                {row.decision && (
                  <div className="tka-kv">
                    <span>Decisión</span>
                    <b>{DECISION_LABEL[row.decision.decision] ?? row.decision.decision}</b>
                    <span>Quién</span>
                    <b>{row.decision.byMachine ? "la máquina" : "una persona"}</b>
                    <span>Motivo</span>
                    <b>{readReason(row.decision.reason)}</b>
                    <span>Cuándo</span>
                    <b>{when(row.decision.at)}</b>
                  </div>
                )}

                <h3 className="tka-title" style={{ fontSize: 15, marginTop: 12 }}>
                  Lo que quedó guardado
                </h3>
                <div className="tka-kv">
                  <span>Tienda</span>
                  <b>{r.storeName ?? "—"}</b>
                  <span>Fecha</span>
                  <b>{r.purchaseDate ?? "—"}</b>
                  <span>Total</span>
                  <b style={totalsDiffer ? { color: "var(--tka-bad, #b00020)" } : undefined}>
                    {money(r.totalCents)}
                  </b>
                  <span>Elegible</span>
                  <b>{money(r.eligibleCents)}</b>
                </div>
                {r.rejectReason && <div className="tka-note">Motivo al participante: {r.rejectReason}</div>}
              </div>
            </div>
          </div>
        );
      })}

      {pages > 1 && (
        <div className="tka-actions">
          <button
            className="tka-btn"
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← Más recientes
          </button>
          <span className="tka-sub">
            Página {page + 1} de {pages} · {data.total} tickets
          </span>
          <button
            className="tka-btn"
            type="button"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Más antiguos →
          </button>
        </div>
      )}
    </>
  );
}

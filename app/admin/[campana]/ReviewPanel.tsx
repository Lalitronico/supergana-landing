"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUsdCents, parseUsdToCents } from "@/lib/tickets/config";
import type { AdminProduct, QueueItem } from "./types";

const money = (cents: number) => formatUsdCents(cents, "en");

// Machine codes from tickets_approve_receipt, in the reviewer's language. Each
// one is a rule the campaign refused on, not a bug — the console says which.
const RULE_MESSAGE: Record<string, string> = {
  bad_status: "Este ticket ya fue decidido. Recárgalo para ver su estado actual.",
  below_threshold: "El gasto elegible no alcanza la compra mínima de la campaña.",
  eligible_above_total: "El elegible no puede ser mayor que el total impreso del ticket.",
  duplicate_receipt:
    "Ya existe un ticket con la misma tienda, fecha y total. Es el mismo reclamo dos veces.",
  participant_limit: "Este participante ya recibió su recompensa en esta campaña.",
  household_limit: "Este hogar (apellido + ZIP) ya recibió su recompensa.",
  weekly_quota: "Se agotó el cupo de esta semana. Se libera un bloque nuevo el lunes.",
  slots_exhausted: "Se agotaron los slots de la campaña.",
  fund_exhausted: "No queda fondo suficiente para pagar esta recompensa.",
  receipt_not_found: "El ticket ya no existe.",
  role_cannot_review: "Tu rol no puede decidir reclamos.",
};

interface Line {
  key: string;
  text: string;
  amount: string;
  productId: string | null;
  aliasMatched: string | null;
}

const newLine = (index: number): Line => ({
  key: `l${index}-${Math.random().toString(36).slice(2, 8)}`,
  text: "",
  amount: "",
  productId: null,
  aliasMatched: null,
});

/**
 * Matches a printed line against the alias dictionary.
 *
 * Longest alias first: `CAMARONAZO 32OZ` must win over a hypothetical
 * `CAMARONAZO`, otherwise the more specific SKU never gets picked. Both sides
 * are collapsed to single spaces because receipt printers pad erratically.
 */
const normalize = (value: string) => value.toUpperCase().replace(/\s+/g, " ").trim();

function matchAlias(text: string, products: AdminProduct[]) {
  const line = normalize(text);
  if (line.length < 3) return null;
  const candidates = products
    .flatMap((p) => p.product_aliases.map((a) => ({ product: p, alias: a.alias_text })))
    .sort((a, b) => b.alias.length - a.alias.length);
  for (const candidate of candidates) {
    if (line.includes(normalize(candidate.alias))) {
      return { productId: candidate.product.id, alias: candidate.alias };
    }
  }
  return null;
}

export function ReviewPanel({
  slug,
  item,
  products,
  canReview,
  rewardCents,
  minCents,
  onDone,
}: {
  slug: string;
  item: QueueItem;
  products: AdminProduct[];
  canReview: boolean;
  rewardCents: number;
  minCents: number;
  onDone: (message: string, bad?: boolean) => void | Promise<void>;
}) {
  const { receipt, participant, flags } = item;
  const decided = receipt.status === "approved" || receipt.status === "rejected";

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [storeName, setStoreName] = useState(receipt.store_name ?? "");
  const [purchaseDate, setPurchaseDate] = useState(receipt.purchase_date ?? "");
  const [total, setTotal] = useState(
    receipt.total_cents != null ? (receipt.total_cents / 100).toFixed(2) : "",
  );
  const [lines, setLines] = useState<Line[]>([newLine(0), newLine(1), newLine(2)]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No reset of imageUrl/imageError here: the parent keys this component by
  // receipt id, so picking another claim remounts it with fresh state.
  useEffect(() => {
    let alive = true;
    fetch(`/api/tickets/${slug}/admin/image/?receiptId=${receipt.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("sign failed"))))
      .then((payload: { url: string }) => {
        if (alive) setImageUrl(payload.url);
      })
      .catch(() => {
        if (alive) setImageError(true);
      });
    return () => {
      alive = false;
    };
  }, [slug, receipt.id]);

  const eligibleCents = useMemo(
    () =>
      lines.reduce(
        (sum, line) => (line.productId ? sum + (parseUsdToCents(line.amount) ?? 0) : sum),
        0,
      ),
    [lines],
  );
  const totalCents = parseUsdToCents(total);

  const updateLine = (key: string, patch: Partial<Line>) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        // Re-match only when the text changed and the reviewer hasn't overridden
        // the product by hand.
        if (patch.text !== undefined) {
          const found = matchAlias(patch.text, products);
          next.productId = found?.productId ?? null;
          next.aliasMatched = found?.alias ?? null;
        }
        return next;
      }),
    );
  };

  const send = async (payload: Record<string, unknown>, successMessage: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${slug}/admin/review/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const message = RULE_MESSAGE[body.error ?? ""] ?? "No se pudo completar la acción.";
        setError(message);
        await onDone(message, true);
        return;
      }
      await onDone(successMessage);
    } catch {
      setError("Error de red. Intenta otra vez.");
    } finally {
      setBusy(false);
    }
  };

  const approve = () => {
    if (!storeName.trim() || !purchaseDate || totalCents === null) {
      setError("Captura tienda, fecha y total antes de aprobar.");
      return;
    }
    if (eligibleCents < minCents) {
      setError(
        `El gasto elegible (${money(eligibleCents)}) no alcanza la compra mínima de ${money(minCents)}.`,
      );
      return;
    }
    void send(
      {
        action: "approve",
        receiptId: receipt.id,
        storeName: storeName.trim(),
        purchaseDate,
        totalCents,
        eligibleCents,
        items: lines
          .filter((line) => line.text.trim())
          .map((line) => ({
            productId: line.productId,
            aliasMatched: line.aliasMatched,
            lineText: line.text.trim(),
            amountCents: parseUsdToCents(line.amount) ?? 0,
          })),
      },
      `Aprobado · ${money(rewardCents)} reservados del fondo`,
    );
  };

  const decide = (decision: "rejected" | "needs_new_image") => {
    if (!reason.trim()) {
      setError("Escribe el motivo: se le envía al participante y queda en la bitácora.");
      return;
    }
    void send(
      { action: "review", receiptId: receipt.id, decision, reason: reason.trim() },
      decision === "rejected"
        ? "Rechazado · se notificó el motivo"
        : "Se pidió una imagen nueva al participante",
    );
  };

  return (
    <div className="tka-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 18 }}>
          Detalle — {participant ? `${participant.firstName} ${participant.lastName}` : "—"}
        </h3>
        <span className="tka-mono" style={{ color: "#6B665B" }}>{receipt.id.slice(0, 8)}…</span>
      </div>

      <div className="tka-detail" style={{ marginTop: 14 }}>
        <div>
          <div className="tka-shot">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL; next/image would cache what must expire
              <img src={imageUrl} alt="Ticket enviado por el participante" />
            ) : (
              <span className="empty">
                {imageError ? "No se pudo cargar la imagen." : "Cargando imagen…"}
              </span>
            )}
          </div>
          <p className="tka-note" style={{ marginTop: 8 }}>
            Enlace firmado, válido 5 minutos. El bucket es privado: el ticket lleva
            ubicación, fecha y hábitos de compra.
          </p>

          <h3 style={{ marginTop: 16 }}>Señales</h3>
          <div className="tka-flags">
            {flags.map((flag, i) => (
              <div className="tka-flag" key={`${flag.code}-${i}`}>
                <span className={`sig ${flag.level}`}>
                  {flag.level === "ok" ? "✓" : flag.level === "warn" ? "!" : "✕"}
                </span>
                {flag.detail}
              </div>
            ))}
          </div>
        </div>

        <div>
          <dl className="tka-kv">
            <dt>Participante</dt>
            <dd>{participant?.email ?? "—"}</dd>
            <dt>Hogar</dt>
            <dd className="tka-mono">{participant?.householdKey ?? "—"}</dd>
            <dt>ZIP / estado</dt>
            <dd>{participant ? `${participant.zip} · ${participant.state ?? "—"}` : "—"}</dd>
            <dt>Enviado</dt>
            <dd>{new Date(receipt.submitted_at).toLocaleString("es-MX")}</dd>
            <dt>Hash de imagen</dt>
            <dd className="tka-mono">{receipt.image_hash?.slice(0, 16) ?? "—"}…</dd>
          </dl>

          {decided ? (
            <div style={{ marginTop: 16 }}>
              <p className="tka-note">
                Ticket ya decidido ({receipt.status}). La captura quedó en la bitácora:
                {receipt.store_name ? ` ${receipt.store_name},` : ""}
                {receipt.purchase_date ? ` ${receipt.purchase_date},` : ""}
                {receipt.eligible_cents != null
                  ? ` elegible ${money(receipt.eligible_cents)}`
                  : ""}
                {receipt.reject_reason ? ` · motivo: ${receipt.reject_reason}` : ""}
              </p>
            </div>
          ) : (
            <>
              <h3 style={{ marginTop: 16 }}>Captura del ticket</h3>
              <div className="tka-form">
                <label>
                  Tienda (retailer y sucursal)
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="El Super #114 · El Paso, TX"
                  />
                </label>
                <label>
                  Fecha de compra
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </label>
                <label>
                  Total impreso
                  <input
                    type="text"
                    inputMode="decimal"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    placeholder="15.72"
                  />
                </label>
                <label>
                  Gasto elegible (calculado)
                  <input type="text" value={money(eligibleCents)} readOnly tabIndex={-1} />
                </label>
              </div>
              <p className="tka-note" style={{ marginTop: 6 }}>
                El elegible es la suma de las líneas que coinciden con el catálogo — no se
                escribe a mano, se deduce de lo capturado.
              </p>

              <h3 style={{ marginTop: 16 }}>Líneas del ticket</h3>
              <p className="tka-note">
                Escribe la línea tal como está impresa: el alias la asocia sola al producto.
              </p>
              <div className="tka-lines">
                {lines.map((line) => (
                  <div className="tka-line" key={line.key}>
                    <input
                      type="text"
                      value={line.text}
                      onChange={(e) => updateLine(line.key, { text: e.target.value })}
                      placeholder="CAMARONAZO 32OZ"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.amount}
                      onChange={(e) => updateLine(line.key, { amount: e.target.value })}
                      placeholder="4.79"
                    />
                    <select
                      value={line.productId ?? ""}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.key === line.key
                              ? { ...l, productId: e.target.value || null, aliasMatched: null }
                              : l,
                          ),
                        )
                      }
                      style={{ fontSize: 12 }}
                    >
                      <option value="">No elegible</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.brand} {product.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="tka-btn ghost sm"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      aria-label="Quitar línea"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="tka-btn ghost sm"
                style={{ marginTop: 8 }}
                onClick={() => setLines((prev) => [...prev, newLine(prev.length)])}
              >
                + Agregar línea
              </button>

              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11.5, fontWeight: 700, color: "#6B665B", marginTop: 16 }}>
                Motivo (para rechazar o pedir imagen nueva)
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="La foto corta el total y la fecha del ticket."
                />
              </label>

              {error && (
                <p style={{ color: "#E63946", fontSize: 12.5, marginTop: 10, fontWeight: 600, lineHeight: 1.4 }}>
                  {error}
                </p>
              )}

              <div className="tka-actions">
                <button className="tka-btn ok" disabled={!canReview || busy} onClick={approve}>
                  ✓ Aprobar y reservar {money(rewardCents)}
                </button>
                <button
                  className="tka-btn ghost"
                  disabled={!canReview || busy}
                  onClick={() => decide("needs_new_image")}
                >
                  Pedir imagen nueva
                </button>
                <button
                  className="tka-btn bad"
                  disabled={!canReview || busy}
                  onClick={() => decide("rejected")}
                >
                  ✕ Rechazar
                </button>
              </div>

              {totalCents !== null && eligibleCents > totalCents && (
                <p className="tka-note" style={{ marginTop: 10, color: "#E63946", fontWeight: 600 }}>
                  El elegible supera el total impreso. Revisa las líneas antes de aprobar.
                </p>
              )}

              <p className="tka-note" style={{ marginTop: 12 }}>
                Al aprobar se reservan {money(rewardCents)} del fondo dentro de la misma
                transacción y se crea la recompensa con su{" "}
                <span className="tka-mono">external_id</span> único. Reintentar nunca
                duplica el pago.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

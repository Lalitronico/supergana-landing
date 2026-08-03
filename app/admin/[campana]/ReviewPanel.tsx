"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUsdCents, isFuturePurchaseDate, parseUsdToCents, todayInTz } from "@/lib/tickets/config";
import type { CampaignMechanic } from "@/lib/tickets/config";
import { formatMxPhone } from "@/lib/tickets/phone";
import type { AdminProduct, QueueItem } from "./types";

const money = (cents: number) => formatUsdCents(cents, "en");

/**
 * What the participant will be credited, mirroring the RPC's arithmetic:
 * `(eligible_cents * points_per_dollar) / 100` in integer division. Kept in
 * step on purpose — a console promising 515 points while the database writes
 * 510 is worse than a console that says nothing.
 */
const pointsFor = (eligibleCents: number, rate: number) =>
  Math.floor((eligibleCents * rate) / 100);

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
  future_date:
    "La fecha de compra es posterior a hoy en la plaza de la campaña. Un ticket no puede venir del futuro.",
  eligible_zero:
    "El elegible llegó en 0 y una aprobación tiene que abonar algo. Captura las líneas de productos participantes, o rechaza el ticket.",
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
 * Matches a printed line against the catalogue.
 *
 * Aliases first and longest first: `CAMARONAZO 32OZ` must win over a
 * hypothetical `CAMARONAZO`, otherwise the more specific SKU never gets picked.
 *
 * Then the product's own name, which is the part that was missing. Matching only
 * aliases meant a campaign whose dictionary had not been harvested from real
 * receipts yet could match nothing at all — and since the eligible amount is the
 * sum of matched lines only, every approval credited zero. Carrera Alaska had
 * seven real products, zero aliases, and approved a receipt for no points.
 *
 * An alias is a retailer's particular spelling of a product; the product's own
 * name is the general case. Having the general case means a campaign is workable
 * on day one and the dictionary becomes an improvement rather than a
 * prerequisite.
 *
 * Diacritics are folded on both sides: receipt printers print GARRAFON, the
 * catalogue says Garrafón, and refusing to see through that is refusing to
 * match anything in a Mexican campaign.
 */
const normalize = (value: string) =>
  value
    .normalize("NFD")
    // The combining-marks block, written as escapes: the literal characters are
    // invisible in an editor and the next person to touch this line would not
    // know what they were deleting.
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

function matchAlias(text: string, products: AdminProduct[]) {
  const line = normalize(text);
  if (line.length < 3) return null;

  const candidates = [
    ...products.flatMap((p) =>
      p.product_aliases.map((a) => ({ product: p, label: a.alias_text, fromAlias: true })),
    ),
    // The catalogue's own words. Brand and name together first, so "Alaska
    // Garrafón 19 L" beats a bare "Garrafón 19 L" when both could match.
    ...products.map((p) => ({ product: p, label: `${p.brand} ${p.name}`, fromAlias: false })),
    ...products.map((p) => ({ product: p, label: p.name, fromAlias: false })),
  ].sort((a, b) => normalize(b.label).length - normalize(a.label).length);

  for (const candidate of candidates) {
    const label = normalize(candidate.label);
    if (label.length >= 3 && line.includes(label)) {
      // Only a real alias is reported as one; a name match must not look like a
      // dictionary entry in the audit trail.
      return { productId: candidate.product.id, alias: candidate.fromAlias ? candidate.label : null };
    }
  }
  return null;
}

export function ReviewPanel({
  slug,
  item,
  products,
  canReview,
  mechanic,
  rewardCents,
  minCents,
  pointsPerDollar,
  stores,
  timezone,
  onDone,
}: {
  slug: string;
  item: QueueItem;
  products: AdminProduct[];
  canReview: boolean;
  /** Decides what approving MEANS here: reserving money, or crediting points. */
  mechanic: CampaignMechanic;
  rewardCents: number;
  minCents: number;
  pointsPerDollar: number;
  /** Participating stores as they print. Empty on campaigns that never listed them. */
  stores: string[];
  /** The plaza. Decides what "today" means for the purchase date. */
  timezone: string;
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

  /**
   * Examples taken from this campaign, not from the one the console was built
   * for. The store box used to suggest "El Super #114 · El Paso, TX" and the
   * line box "CAMARONAZO 32OZ" while a reviewer was looking at a Ciudad Juárez
   * receipt for bottled water — a placeholder that describes another client's
   * campaign is worse than an empty box, because it reads as instruction.
   *
   * The store hint comes from `config.storeHint` when the campaign sets one, and
   * otherwise from the last store a reviewer typed here. The line hint is a real
   * product out of this campaign's own catalogue, upper-cased the way a receipt
   * prints it.
   */
  const lineHint = useMemo(() => {
    const sample = products.find((p) => p.product_aliases.length > 0);
    if (sample) return sample.product_aliases[0].alias_text.toUpperCase();
    return products[0] ? `${products[0].brand} ${products[0].name}`.toUpperCase() : "";
  }, [products]);

  // A store the campaign actually lists, or nothing. Never another client's.
  const storeHint = stores[0] ?? "";

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

  interface ApproveResult {
    reward_id?: string | null;
    points_awarded?: number;
    reward_skipped?: string | null;
  }

  const send = async (
    payload: Record<string, unknown>,
    successMessage: string | ((reward: ApproveResult) => string),
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${slug}/admin/review/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        reward?: ApproveResult;
      };
      if (!res.ok) {
        const message = RULE_MESSAGE[body.error ?? ""] ?? "No se pudo completar la acción.";
        setError(message);
        await onDone(message, true);
        return;
      }
      await onDone(
        typeof successMessage === "function"
          ? successMessage(body.reward ?? {})
          : successMessage,
      );
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
    /**
     * An approval has to give something. This used to be the minimum-purchase
     * check alone, which is vacuous in an accumulation campaign: Alaska zeroes
     * `min_purchase_cents`, so `0 < 0` was false and a receipt with no matched
     * lines got approved for zero points. The participant then sees a validated
     * ticket, a balance of zero and "sube tu primer ticket" — and reports it as
     * a bug in the app, because from where they stand it is one.
     *
     * A real receipt with no participating products is a rejection, not an
     * approval, and the console already has `rejected` and `needs_new_image` for
     * saying so.
     */
    if (isFuturePurchaseDate(purchaseDate, timezone)) {
      setError(
        `La fecha de compra (${purchaseDate}) es posterior a hoy en la plaza de la campaña. Revisa el ticket: un ticket no puede venir del futuro.`,
      );
      return;
    }
    if (eligibleCents <= 0) {
      setError(
        mechanic === "accumulation"
          ? "El elegible es 0, así que este ticket no abonaría puntos. Captura las líneas de productos participantes, o recházalo si el ticket no trae ninguno."
          : "El elegible es 0. Captura las líneas de productos participantes antes de aprobar.",
      );
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
      // What actually happened, not what usually happens: an approval since
      // v2 can carry points and no reward (second receipt, quota gone).
      (reward) => {
        const pts = reward.points_awarded
          ? ` · ${reward.points_awarded} puntos al participante`
          : "";
        // In an accumulation campaign there is no reward to skip: the five
        // gates are zeroed by design, so every approval logs
        // reward_skipped='participant_limit'. Reporting that as "aprobado sin
        // recompensa (participant_limit)" reads like a failure and is just the
        // reward layer being off.
        if (mechanic === "accumulation") {
          return `Aprobado · ${reward.points_awarded ?? 0} puntos abonados`;
        }
        return reward.reward_id
          ? `Aprobado · ${money(rewardCents)} reservados del fondo${pts}`
          : `Aprobado sin recompensa (${reward.reward_skipped ?? "límite"})${pts}`;
      },
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
            {/* Solo cuando existe: en las campañas que piden celular, este es
                el dato con el que se entrega la recarga, y una fila vacía en
                las que no lo piden sería ruido en la pantalla de trabajo. */}
            {participant?.phone && (
              <>
                <dt>Celular</dt>
                <dd className="tka-mono">{formatMxPhone(participant.phone)}</dd>
              </>
            )}
            <dt>ZIP / estado</dt>
            <dd>
              {participant ? `${participant.zip ?? "—"} · ${participant.state ?? "—"}` : "—"}
            </dd>
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
                    placeholder={storeHint}
                    // Suggestions, not a closed set: the reviewer still has to
                    // add the branch, and a store missing from the list must not
                    // block a real receipt on a Saturday.
                    list={stores.length > 0 ? "tka-stores" : undefined}
                    autoComplete="off"
                  />
                  {stores.length > 0 && (
                    <datalist id="tka-stores">
                      {stores.map((store) => (
                        <option key={store} value={store} />
                      ))}
                    </datalist>
                  )}
                </label>
                <label>
                  Fecha de compra
                  <input
                    type="date"
                    // The picker stops at today in the campaign's plaza, so the
                    // guard below is a backstop rather than the first thing a
                    // reviewer meets.
                    max={todayInTz(timezone)}
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
                      placeholder={lineHint}
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
                  {mechanic === "accumulation"
                    ? `✓ Aprobar y abonar ${pointsFor(eligibleCents, pointsPerDollar)} puntos`
                    : `✓ Aprobar y reservar ${money(rewardCents)}`}
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

              {mechanic === "accumulation" ? (
                <p className="tka-note" style={{ marginTop: 12 }}>
                  Esta campaña no paga recompensa por ticket: abona{" "}
                  <b>{pointsPerDollar} puntos por cada $1</b> elegible, dentro de la misma
                  transacción que aprueba el ticket. Con {money(eligibleCents)} elegibles son{" "}
                  <b>{pointsFor(eligibleCents, pointsPerDollar)} puntos</b>. Reintentar la
                  aprobación nunca abona dos veces: el ledger acepta una entrada de compra
                  por ticket.
                </p>
              ) : (
                <p className="tka-note" style={{ marginTop: 12 }}>
                  Al aprobar se reservan {money(rewardCents)} del fondo dentro de la misma
                  transacción y se crea la recompensa con su{" "}
                  <span className="tka-mono">external_id</span> único. Reintentar nunca
                  duplica el pago.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

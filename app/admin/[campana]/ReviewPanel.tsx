"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUsdCents, isFuturePurchaseDate, todayInTz } from "@/lib/tickets/config";
import type { CampaignMechanic } from "@/lib/tickets/config";
import { matchLine, parseAmountToCents, toMatchable } from "@/lib/tickets/matching";
import type { EligibilityMode } from "@/lib/tickets/matching";
import { formatMxPhone } from "@/lib/tickets/phone";
import type { AdminExtraction, AdminProduct, QueueItem } from "./types";
import type { MatchableProduct } from "@/lib/tickets/matching";

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
  /**
   * Si esta línea suma al elegible.
   *
   * Antes esto se leía de `productId != null`, lo cual daba por hecho que contar
   * y saber-qué-producto-es son la misma pregunta. No lo son: donde el POS no
   * imprime la presentación (Del Río, Cd. Juárez) una línea de agua Alaska
   * cuenta y no hay SKU que ponerle. Separar los dos campos es lo que permite
   * abonar sin inventar un producto.
   */
  eligible: boolean;
  productId: string | null;
  aliasMatched: string | null;
}

const newLine = (index: number): Line => ({
  key: `l${index}-${Math.random().toString(36).slice(2, 8)}`,
  text: "",
  amount: "",
  eligible: false,
  productId: null,
  aliasMatched: null,
});

/** Valor del select para "cuenta, pero no sabemos qué presentación es". */
const BRAND_ONLY = "__brand__";

// Lo que el modelo puede reportar de una foto, en el idioma del revisor.
const ISSUE_MESSAGE: Record<string, string> = {
  cut_off: "La foto corta parte del ticket",
  blurry: "La foto está borrosa",
  screen_photo: "Parece la foto de una pantalla, no del papel",
  handwritten: "Hay texto escrito a mano",
  no_total: "No se ve el total",
  no_date: "No se ve la fecha",
  not_a_receipt: "Esto no parece un ticket de compra",
  suspicious_text: "El ticket trae texto que intenta dar instrucciones — revísalo con cuidado",
};

/**
 * La caja de "tienda" a partir de lo leído.
 *
 * La sucursal gana sobre la razón social: el modelo lee
 * `ALMACENES DIST. DE LA FRONTERA SA DE CV.` y `DEL RIO (0010)`, y la lista de
 * tiendas de la campaña dice "Del Río". Nadie llama a esa tienda por su razón
 * social, y el candado anti-duplicado es (tienda + fecha + total): mientras más
 * cerca esté de como la nombra la campaña, mejor cierra.
 */
const storeFromExtraction = (extraction: AdminExtraction): string =>
  (extraction.store_branch ?? extraction.store_name ?? "").trim();

/**
 * Las líneas leídas, convertidas a filas del formulario y ya matcheadas contra
 * el catálogo.
 *
 * El match se calcula aquí y no se guarda en la extracción a propósito: el
 * catálogo cambia —un alias nuevo hoy— y una lectura de la semana pasada tiene
 * que beneficiarse del diccionario de hoy.
 */
const linesFromExtraction = (
  extraction: AdminExtraction,
  matchable: MatchableProduct[],
  mode: EligibilityMode,
): Line[] =>
  extraction.lines.map((line, index) => {
    const found = matchLine(line.text, matchable, mode);
    return {
      key: `x${index}-${line.text.slice(0, 8)}`,
      text: line.text,
      // El importe se muestra como el modelo lo copió del papel. Normalizarlo a
      // "10.50" escondería un "$10.50" mal leído justo donde el revisor tiene
      // que poder compararlo contra la foto.
      amount: line.amountPrinted ?? "",
      eligible: found !== null,
      productId: found?.productId ?? null,
      aliasMatched: found?.alias ?? (found?.matchedBy === "brand" ? found.label : null),
    };
  });

// El matcher y el parser de importes viven ahora en lib/tickets/matching.ts.
// Estaban aqui mientras el unico que leia un ticket era un humano tecleando en
// este formulario; con la lectura automatica hay un segundo lector en el
// servidor, y dos implementaciones que se separan es como esta pantalla promete
// 515 puntos y la base escribe 510.

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
  eligibility,
  ocr,
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
  /** Whether a line counts by exact SKU or by naming the brand. */
  eligibility: EligibilityMode;
  /** Whether this campaign reads receipts, and whether the reading pre-fills. */
  ocr: { enabled: boolean; autofill: boolean };
  onDone: (message: string, bad?: boolean) => void | Promise<void>;
}) {
  const { receipt, participant, flags } = item;
  const decided = receipt.status === "approved" || receipt.status === "rejected";

  // El catálogo en la forma que entiende el matcher compartido. Arriba de los
  // estados porque los inicializadores del autofill lo necesitan.
  const matchable = useMemo(() => products.map(toMatchable), [products]);
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand))], [products]);

  const [extraction, setExtraction] = useState<AdminExtraction | null>(item.extraction);
  const [rereading, setRereading] = useState(false);
  /**
   * De qué lectura se sembró el formulario, si de alguna.
   *
   * Se compara por `created_at` y no por un booleano porque una relectura
   * produce una fila nueva: sin esto, el ticket que el revisor acaba de mandar
   * a releer volvería con datos frescos que nadie pondría en las cajas.
   */
  const [seededFrom, setSeededFrom] = useState<string | null>(
    item.extraction?.status === "ok" && item.extraction ? item.extraction.created_at : null,
  );

  /**
   * El autofill solo siembra lo que nadie escribió todavía.
   *
   * `receipt.store_name` gana siempre que exista: si un revisor ya capturó este
   * ticket —o volvió después de un needs_new_image— su captura es el dato bueno
   * y una lectura del modelo no tiene por qué pisarla.
   *
   * Inicializadores perezosos y no un `useEffect`: el padre monta este
   * componente con `key={receipt.id}`, así que cambiar de ticket lo remonta y
   * estos valores se recalculan solos. Un efecto que "sincroniza" haría lo
   * mismo con un parpadeo de por medio y una carrera contra lo que el revisor
   * ya empezó a teclear.
   */
  const seed = ocr.autofill && !decided ? item.extraction : null;
  const seedOk = seed?.status === "ok" ? seed : null;

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [storeName, setStoreName] = useState(
    () => receipt.store_name ?? (seedOk ? storeFromExtraction(seedOk) : ""),
  );
  const [purchaseDate, setPurchaseDate] = useState(
    () => receipt.purchase_date ?? seedOk?.purchase_date ?? "",
  );
  const [total, setTotal] = useState(() =>
    receipt.total_cents != null
      ? (receipt.total_cents / 100).toFixed(2)
      : (seedOk?.total_printed ?? ""),
  );
  const [lines, setLines] = useState<Line[]>(() => {
    const seeded = seedOk ? linesFromExtraction(seedOk, matchable, eligibility) : [];
    // Siempre queda una fila vacía al final: un ticket con productos que el
    // modelo no vio se captura sin tener que buscar el botón de agregar.
    return seeded.length > 0 ? [...seeded, newLine(seeded.length)] : [newLine(0), newLine(1), newLine(2)];
  });
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

  /**
   * ¿El formulario sigue tal como se montó?
   *
   * Decide si una lectura que llega tarde puede sembrarlo. Un solo carácter
   * tecleado por el revisor lo vuelve suyo, y a partir de ahí nada automático
   * tiene permiso de tocarlo.
   */
  const pristine =
    storeName === "" &&
    purchaseDate === "" &&
    total === "" &&
    lines.every((l) => l.text === "" && l.amount === "");

  /**
   * La lectura llega tarde, y el formulario nunca se entera.
   *
   * El padre indexa este componente por id de ticket, así que cambiar de
   * reclamo lo remonta y los inicializadores de arriba corren con datos
   * frescos. Lo que NO lo remonta es el refresco de la consola cada treinta
   * segundos: mismo id, misma llave, mismo estado. Un revisor que abre un
   * ticket recién llegado lo abre entre cinco y quince segundos antes de que su
   * lectura exista, y sin esto se quedaba mirando un formulario vacío que ya
   * nunca se iba a llenar — con la lectura ahí al lado, en la pantalla.
   *
   * Solo siembra si nadie escribió nada. La regla es la misma de siempre: la
   * captura humana gana, y aquí ni siquiera hace falta que sea correcta, basta
   * con que sea suya.
   */
  const incoming =
    ocr.autofill && !decided && item.extraction?.status === "ok" ? item.extraction : null;

  if (incoming && incoming.created_at !== seededFrom && pristine) {
    // Ajuste de estado durante el render, no un efecto: es el patrón que React
    // documenta para "los props cambiaron y el estado derivado tiene que
    // seguirlos". Se re-renderiza antes de pintar, así que nadie ve el
    // formulario vacío parpadear antes de llenarse — que es justo lo que un
    // efecto sí habría dejado ver.
    setSeededFrom(incoming.created_at);
    setExtraction(incoming);
    setStoreName(storeFromExtraction(incoming));
    setPurchaseDate(incoming.purchase_date ?? "");
    setTotal(incoming.total_printed ?? "");
    const seeded = linesFromExtraction(incoming, matchable, eligibility);
    if (seeded.length > 0) setLines([...seeded, newLine(seeded.length)]);
  }

  /** Vuelca la lectura sobre el formulario, pisando lo que haya. */
  const applyExtraction = (source: AdminExtraction) => {
    // Se marca como sembrada aunque el revisor haya apretado el botón a mano:
    // si después vacía las cajas, el formulario queda pristine otra vez y sin
    // esto la siembra automática volvería a llenar lo que acaba de limpiar.
    setSeededFrom(source.created_at);
    setStoreName(storeFromExtraction(source));
    setPurchaseDate(source.purchase_date ?? "");
    setTotal(source.total_printed ?? "");
    const seeded = linesFromExtraction(source, matchable, eligibility);
    setLines([...seeded, newLine(seeded.length)]);
    setError(null);
  };

  const reread = async () => {
    setRereading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${slug}/admin/extract/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId: receipt.id }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        extraction?: AdminExtraction | null;
      };
      if (!res.ok || !body.extraction) {
        setError(
          body.error === "ocr_disabled"
            ? "Esta campaña tiene la lectura automática apagada."
            : "No se pudo releer el ticket. Captúralo a mano.",
        );
        return;
      }
      setExtraction(body.extraction);
      if (body.extraction.status === "ok") applyExtraction(body.extraction);
    } catch {
      setError("Error de red al releer.");
    } finally {
      setRereading(false);
    }
  };

  const eligibleCents = useMemo(
    () =>
      lines.reduce(
        (sum, line) => (line.eligible ? sum + (parseAmountToCents(line.amount) ?? 0) : sum),
        0,
      ),
    [lines],
  );
  const totalCents = parseAmountToCents(total);

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
          const found = matchLine(patch.text, matchable, eligibility);
          next.eligible = found !== null;
          next.productId = found?.productId ?? null;
          // Un match por marca deja la marca en `alias_matched`. Sin eso, en la
          // bitácora "contó por marca" y "no contó" se ven idénticos —  los dos
          // con product_id en null— y se pierde la única señal que distingue
          // una línea abonada de una descartada.
          next.aliasMatched =
            found?.alias ?? (found?.matchedBy === "brand" ? found.label : null);
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
            amountCents: parseAmountToCents(line.amount) ?? 0,
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

          {ocr.enabled && (
            <>
              <h3 style={{ marginTop: 16 }}>Lectura automática</h3>
              {!extraction ? (
                <p className="tka-note">
                  Este ticket no tiene lectura. Puede ser anterior a que se
                  encendiera, o haberse quedado en el camino.
                </p>
              ) : extraction.status !== "ok" ? (
                <p className="tka-note">
                  {extraction.status === "skipped"
                    ? `No se leyó (${extraction.error ?? "formato no soportado"}). Captúralo a mano.`
                    : `La lectura falló (${extraction.error ?? "sin detalle"}). Captúralo a mano.`}
                </p>
              ) : (
                <>
                  <div className="tka-flags">
                    {extraction.issues.length === 0 ? (
                      <div className="tka-flag">
                        <span className="sig ok">✓</span>
                        Ticket legible, sin observaciones
                      </div>
                    ) : (
                      extraction.issues.map((issue) => (
                        <div className="tka-flag" key={issue}>
                          <span
                            className={`sig ${issue === "suspicious_text" || issue === "not_a_receipt" ? "bad" : "warn"}`}
                          >
                            !
                          </span>
                          {ISSUE_MESSAGE[issue] ?? issue}
                        </div>
                      ))
                    )}
                    {/* La discrepancia que importa: el modelo leyó un total y el
                        revisor tiene otro en la caja. Solo se dice cuando los
                        dos existen y difieren — una caja vacía no es un
                        desacuerdo, es un formulario a medio llenar. */}
                    {extraction.total_cents != null &&
                      totalCents !== null &&
                      totalCents !== extraction.total_cents && (
                        <div className="tka-flag">
                          <span className="sig warn">!</span>
                          El total capturado ({money(totalCents)}) no coincide con el leído
                          ({money(extraction.total_cents)}). Revisa la foto.
                        </div>
                      )}
                  </div>

                  <dl className="tka-kv" style={{ marginTop: 10 }}>
                    <dt>Comercio</dt>
                    <dd>{extraction.store_name ?? "—"}</dd>
                    {extraction.store_branch && (
                      <>
                        <dt>Sucursal</dt>
                        <dd>{extraction.store_branch}</dd>
                      </>
                    )}
                    <dt>Fecha impresa</dt>
                    <dd className="tka-mono">
                      {extraction.purchase_date_raw ?? "—"}
                      {extraction.purchase_date ? ` → ${extraction.purchase_date}` : ""}
                      {extraction.purchase_time ? ` · ${extraction.purchase_time}` : ""}
                    </dd>
                    <dt>Total impreso</dt>
                    <dd className="tka-mono">{extraction.total_printed ?? "—"}</dd>
                    <dt>Renglones</dt>
                    <dd>{extraction.lines.length}</dd>
                  </dl>
                </>
              )}

              {!decided && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {extraction?.status === "ok" && (
                    <button
                      type="button"
                      className="tka-btn ghost sm"
                      disabled={busy || rereading}
                      onClick={() => applyExtraction(extraction)}
                    >
                      Volcar al formulario
                    </button>
                  )}
                  <button
                    type="button"
                    className="tka-btn ghost sm"
                    disabled={!canReview || busy || rereading}
                    onClick={() => void reread()}
                  >
                    {rereading ? "Leyendo…" : "Releer ticket"}
                  </button>
                </div>
              )}

              <p className="tka-note" style={{ marginTop: 8 }}>
                {/* Que quede escrito en la pantalla donde se decide, y no solo
                    en un comentario del código: lo de arriba es una lectura,
                    no una decisión. */}
                Lo leído es una sugerencia. Lo que se aprueba es lo que quede en el
                formulario, y el elegible siempre sale de las líneas que coinciden
                con el catálogo.
                {extraction?.status === "ok" && extraction.latency_ms != null && (
                  <>
                    {" "}
                    <span className="tka-mono">
                      {extraction.model} · {(extraction.latency_ms / 1000).toFixed(1)}s ·{" "}
                      {(extraction.input_tokens ?? 0) + (extraction.output_tokens ?? 0)} tokens
                    </span>
                  </>
                )}
              </p>
            </>
          )}
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
                      value={
                        line.productId ?? (line.eligible ? BRAND_ONLY : "")
                      }
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l) => {
                            if (l.key !== line.key) return l;
                            const value = e.target.value;
                            return {
                              ...l,
                              eligible: value !== "",
                              // BRAND_ONLY cuenta sin SKU: el producto se queda
                              // en null a propósito, para no guardar una
                              // presentación que nadie leyó.
                              productId: value === "" || value === BRAND_ONLY ? null : value,
                              aliasMatched:
                                value === BRAND_ONLY ? (brands[0] ?? null) : null,
                            };
                          }),
                        )
                      }
                      style={{ fontSize: 12 }}
                    >
                      <option value="">No elegible</option>
                      {/* Solo donde la campaña cuenta por marca. En una campaña
                          por SKU esta opción sería una puerta para abonar sin
                          reconocer el producto, que es justo lo que ese modo
                          quiere impedir. */}
                      {eligibility === "brand" && (
                        <option value={BRAND_ONLY}>
                          {(brands[0] ?? "Marca")} — presentación no impresa
                        </option>
                      )}
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

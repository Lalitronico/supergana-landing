// Qué puede decidirse sin un humano, y qué no.
//
// La regla que ordena todo este archivo: **nunca hay rechazo automático.**
// Aprobar de más cuesta dinero y se corrige; rechazar de más es una máquina
// diciéndole que no a una persona que fue a comprar y cumplió. Los dos errores
// no son del mismo tipo, así que el sistema solo sabe hacer uno.
//
// Salen tres desenlaces:
//
//   · `approve`          — todo cuadra y no hay nada que mirar. Se abona.
//   · `needs_new_image`  — la foto no permite decidir, y eso no es opinión:
//                          falta el total o falta la fecha. Se le pide otra al
//                          participante con el motivo, que es una respuesta en
//                          minutos en lugar de una espera de 48 horas.
//   · `queue`            — cualquier otra cosa. Un humano lo ve.
//
// Lo que este archivo NO revisa, a propósito: duplicados, compra mínima,
// elegible mayor que el total y estado del ticket. `tickets_approve_receipt` ya
// los refuta y los refuta dentro de la transacción que abona, que es el único
// lugar donde esa respuesta no puede quedar obsoleta. Reimplementarlos aquí
// sería tener dos jueces que algún día van a discrepar. Si el RPC se niega, el
// ticket se queda en la cola y su código de regla queda en el log.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Campaign, CampaignConfig } from "./config";
import { isFuturePurchaseDate } from "./config";
import { sendReceiptNeedsNewImage } from "./email";
import {
  matchLine,
  normalize,
  toMatchable,
  type EligibilityMode,
  type MatchableProduct,
} from "./matching";
import type { ExtractionResult } from "./ocr";

export interface AutoCapture {
  storeName: string;
  purchaseDate: string;
  totalCents: number;
  eligibleCents: number;
  items: {
    productId: string | null;
    aliasMatched: string | null;
    lineText: string;
    amountCents: number;
  }[];
}

export type AutoOutcome =
  | { action: "approve"; capture: AutoCapture }
  /** `reason` viaja al participante por correo y se le muestra en el panel. */
  | { action: "needs_new_image"; reason: string }
  /** `reason` es para el log y la consola; el participante no lo ve. */
  | { action: "queue"; reason: string };

/**
 * El nombre de tienda que se escribe al aprobar.
 *
 * Es el mismo que arma el autofill de la consola (`storeFromExtraction`), y esa
 * coincidencia es deliberada: el candado anti-duplicado es
 * `lower(store) | fecha | total`, así que si la máquina escribiera "DEL RIO
 * (0010)" y el revisor "Del Río", el mismo ticket enviado dos veces daría dos
 * llaves distintas y pasaría dos veces. Con las dos rutas produciendo la misma
 * cadena, el candado cierra igual venga de donde venga.
 */
export const autoStoreName = (extraction: {
  store_branch?: string | null;
  storeBranch?: string | null;
  store_name?: string | null;
  storeName?: string | null;
}): string =>
  (
    extraction.storeBranch ??
    extraction.store_branch ??
    extraction.storeName ??
    extraction.store_name ??
    ""
  ).trim();

/** ¿La tienda leída es una de las que la campaña lista? */
const storeIsListed = (store: string, stores: string[]): boolean => {
  const read = normalize(store);
  if (!read) return false;
  return stores.some((listed) => {
    const want = normalize(listed);
    // En los dos sentidos: el ticket imprime "DEL RIO (0010)" y la campaña
    // lista "Del Río", pero otra cadena podría imprimir menos de lo que la
    // campaña escribió.
    return want.length >= 3 && (read.includes(want) || want.includes(read));
  });
};

/**
 * Decide qué hacer con un ticket recién leído.
 *
 * Función pura: no toca la base ni la red. Todo lo que necesita para decidir
 * entra por parámetro, y por eso se puede probar contra un ticket real sin
 * aprobar nada.
 */
export function decideAutomatically({
  extraction,
  config,
  products,
  eligibility,
}: {
  extraction: ExtractionResult;
  config: CampaignConfig;
  products: MatchableProduct[];
  eligibility: EligibilityMode;
}): AutoOutcome {
  if (!config.ocr.autoApprove) {
    return { action: "queue", reason: "auto_approve_off" };
  }

  /**
   * Sin lista de tiendas no hay aprobación automática, y no es un descuido.
   * `stores` vacío significa que nadie escribió contra qué comparar, y en ese
   * estado "la tienda coincide" sería una condición que siempre se cumple —
   * o sea una puerta pintada en la pared. Una campaña que quiera esto tiene
   * que decir primero dónde se compra.
   */
  if (config.stores.length === 0) {
    return { action: "queue", reason: "campaign_has_no_stores" };
  }

  if (extraction.status !== "ok") {
    return { action: "queue", reason: `extraction_${extraction.status}` };
  }

  // ---- Lo que hace imposible decidir, y se le puede pedir al participante ---

  // `legible: false` es el modelo diciendo que no pudo leer lo esencial, y no
  // tiene sentido discutirle: si no se lee, no se aprueba y no se rechaza, se
  // pide otra foto.
  if (extraction.legible === false) {
    return {
      action: "needs_new_image",
      reason:
        "No pudimos leer tu ticket. Tómale otra foto con buena luz, de frente y que se vea completo.",
    };
  }
  if (extraction.totalCents === null || extraction.totalCents <= 0) {
    return {
      action: "needs_new_image",
      reason:
        "No alcanzamos a ver el total de tu ticket. Tómale otra foto asegurándote de que salga la parte de abajo, donde viene el total.",
    };
  }
  if (!extraction.purchaseDate) {
    return {
      action: "needs_new_image",
      reason:
        "No alcanzamos a ver la fecha de tu ticket. Tómale otra foto asegurándote de que salga la parte de arriba, donde viene la fecha.",
    };
  }

  // ---- Lo que necesita un ojo humano -------------------------------------

  /**
   * Cualquier observación del modelo manda el ticket a la cola, incluida una
   * que parezca menor.
   *
   * Es a propósito que no haya una lista de "issues tolerables". Ya vi a este
   * modelo levantar `suspicious_text` sobre un ticket honesto cuyo POS escribe
   * entidades HTML, y esa falla se fue apretando el prompt — pero lo que
   * demostró es que la detección no es perfecta en ninguna de las dos
   * direcciones. Cuando el modelo dice "aquí hay algo", el costo de que mire un
   * humano son dos minutos; el costo de ignorarlo puede ser abonar puntos sobre
   * un ticket alterado.
   */
  if (extraction.issues.length > 0) {
    return { action: "queue", reason: `issues:${extraction.issues.join(",")}` };
  }

  if (isFuturePurchaseDate(extraction.purchaseDate, config.timezone)) {
    // No se le pide otra foto: la fecha se leyó bien y dice algo imposible.
    // Eso no lo arregla una foto nueva, lo mira una persona.
    return { action: "queue", reason: "future_date" };
  }

  if (!storeIsListed(autoStoreName(extraction), config.stores)) {
    return { action: "queue", reason: "store_not_listed" };
  }

  // ---- El elegible, deducido del catálogo como siempre --------------------

  const items: AutoCapture["items"] = [];
  let eligibleCents = 0;
  for (const line of extraction.lines) {
    const amountCents = line.amountCents ?? 0;
    const found = matchLine(line.text, products, eligibility);
    if (found) eligibleCents += amountCents;
    items.push({
      productId: found?.productId ?? null,
      aliasMatched: found?.alias ?? (found?.matchedBy === "brand" ? found.label : null),
      lineText: line.text,
      amountCents,
    });
  }

  if (eligibleCents <= 0) {
    // Puede ser un ticket legítimo sin productos participantes — que es un
    // rechazo— o el catálogo que no reconoce cómo escribe esta tienda, que es
    // un arreglo nuestro. Las dos posibilidades se ven igual desde aquí y solo
    // una persona sabe cuál es.
    return { action: "queue", reason: "no_eligible_lines" };
  }
  if (eligibleCents > extraction.totalCents) {
    return { action: "queue", reason: "eligible_above_total" };
  }
  if (eligibleCents < config.minPurchaseCents) {
    return { action: "queue", reason: "below_threshold" };
  }

  return {
    action: "approve",
    capture: {
      storeName: autoStoreName(extraction),
      purchaseDate: extraction.purchaseDate,
      totalCents: extraction.totalCents,
      eligibleCents,
      items,
    },
  };
}

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------
//
// Lo de arriba decide y no toca nada; lo de aquí abajo escribe. La separación
// es lo que permite probar la regla contra tickets reales sin abonar puntos.

/** Firma en la bitácora, para que una aprobación sin revisor no sea un hueco. */
const autoNote = (model: string, eligibleCents: number) =>
  `Aprobado automáticamente por lectura de ${model}: elegible ${(eligibleCents / 100).toFixed(2)} sin observaciones.`;

interface Recipient {
  to: string;
  firstName: string;
  locale: "es" | "en";
  campaignName: string;
  campaignSlug: string;
}

/**
 * Aplica lo que `decideAutomatically` resolvió.
 *
 * Nunca lanza. Corre dentro de `after()`, después de que el participante ya se
 * fue con su confirmación: una excepción aquí no tendría a quién avisarle, y
 * dejar el ticket en la cola es exactamente lo que pasaba antes de que este
 * archivo existiera. El peor caso de este código es el statu quo.
 */
export async function settleAutomatically({
  db,
  campaign,
  receiptId,
  extraction,
  recipient,
}: {
  db: SupabaseClient;
  campaign: Campaign;
  receiptId: string;
  extraction: ExtractionResult;
  recipient: Recipient;
}): Promise<void> {
  if (!campaign.config.ocr.autoApprove) return;

  try {
    const { data: rows, error } = await db
      .from("products")
      .select("id, brand, name, product_aliases(alias_text)")
      .eq("campaign_id", campaign.id)
      .eq("active", true);

    if (error) {
      console.error("[tickets auto] catalogue unavailable", receiptId, error);
      return; // A la cola, que es donde estaba.
    }

    const products = (rows ?? []).map((row) =>
      toMatchable(row as Parameters<typeof toMatchable>[0]),
    );

    const outcome = decideAutomatically({
      extraction,
      config: campaign.config,
      products,
      eligibility: campaign.config.eligibility,
    });

    if (outcome.action === "queue") {
      console.info("[tickets auto] queued", receiptId, outcome.reason);
      return;
    }

    if (outcome.action === "needs_new_image") {
      const { error: reviewError } = await db.rpc("tickets_review_receipt", {
        p_receipt_id: receiptId,
        // Sin revisor: nadie miró esto. El motivo dice de dónde viene.
        p_reviewer: null,
        p_decision: "needs_new_image",
        p_reason: outcome.reason,
      });
      if (reviewError) {
        console.error("[tickets auto] review failed", receiptId, reviewError);
        return;
      }
      await sendReceiptNeedsNewImage(recipient, outcome.reason).catch((e) =>
        console.error("[tickets auto] needs-new-image email failed", receiptId, e),
      );
      console.info("[tickets auto] asked for a new image", receiptId);
      return;
    }

    const { capture } = outcome;
    const { error: approveError } = await db.rpc("tickets_approve_receipt", {
      p_receipt_id: receiptId,
      p_reviewer: null,
      p_store_name: capture.storeName,
      p_purchase_date: capture.purchaseDate,
      p_total_cents: capture.totalCents,
      p_eligible_cents: capture.eligibleCents,
      p_items: capture.items.map((i) => ({
        product_id: i.productId,
        alias_matched: i.aliasMatched,
        line_text: i.lineText,
        amount_cents: i.amountCents,
      })),
      p_note: autoNote(extraction.model, capture.eligibleCents),
    });

    if (approveError) {
      // Una regla de la campaña se negó — duplicado, elegible sobre el total,
      // ticket ya decidido. No es un fallo: es el candado haciendo su trabajo,
      // y el ticket se queda en la cola para que alguien lo mire.
      console.info(
        "[tickets auto] approval refused by rule",
        receiptId,
        approveError.message?.trim(),
      );
      return;
    }

    console.info("[tickets auto] approved", receiptId, capture.eligibleCents);
  } catch (e) {
    console.error("[tickets auto] threw", receiptId, e);
  }
}

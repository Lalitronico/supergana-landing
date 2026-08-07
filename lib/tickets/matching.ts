// Cómo una línea impresa se convierte en un producto del catálogo, y cómo un
// importe impreso se convierte en centavos.
//
// Vivía dentro de ReviewPanel.tsx, que estaba bien mientras la única cosa que
// leía un ticket era un humano tecleando en el navegador. Con la lectura
// automática hay un segundo lector, en el servidor, y dos matchers que se
// separan es exactamente cómo la consola promete 515 puntos y la base escribe
// 510. Una sola implementación, importada por los dos.
//
// Nada de esto decide dinero por su cuenta: produce candidatos que un revisor
// confirma. Pero es la aritmética de la que sale `eligible_cents`, así que se
// trata como código de dinero, no como una utilidad de texto.

/** Lo mínimo que necesita el matcher. Las dos formas del catálogo se adaptan. */
export interface MatchableProduct {
  id: string;
  brand: string;
  name: string;
  aliases: string[];
}

/** Fila del catálogo como la sirve la consola (`product_aliases` anidado). */
export const toMatchable = (product: {
  id: string;
  brand: string;
  name: string;
  product_aliases?: { alias_text: string }[] | null;
}): MatchableProduct => ({
  id: product.id,
  brand: product.brand,
  name: product.name,
  aliases: (product.product_aliases ?? []).map((a) => a.alias_text),
});

/**
 * Mayúsculas, sin acentos, sin espacios de más.
 *
 * Las impresoras de ticket imprimen GARRAFON y el catálogo dice Garrafón. En
 * una campaña mexicana, no ver a través de eso es no matchear nada.
 */
export const normalize = (value: string) =>
  value
    .normalize("NFD")
    // El bloque de diacríticos combinantes, escrito con escapes: los caracteres
    // literales son invisibles en un editor y el siguiente en tocar esta línea
    // no sabría qué está borrando.
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Qué decide que una línea cuente.
 *
 *  · `sku`   — tiene que reconocerse el producto exacto. Es lo correcto cuando
 *              la promoción es de SKUs concretos: en Ticket al Tanque importa
 *              que sea Camaronazo 32oz y no otra presentación de la misma marca.
 *  · `brand` — basta con que la línea nombre la marca. Es lo correcto cuando
 *              todo lo que vende la marca cuenta y los puntos salen del monto
 *              gastado, no del SKU: en Carrera Alaska, $1 de agua Alaska son 10
 *              puntos sea botella o garrafón.
 *
 * Existe porque un POS real lo obligó. Del Río (Cd. Juárez) imprime
 * `AGUA PURIFICADA "ALASKA NATURAL"`, sin presentación, y ningún alias con
 * tamaño puede matchear eso. Pedirle a la campaña que adivine el SKU para
 * después no usarlo es inventar un dato para tirarlo.
 */
export type EligibilityMode = "sku" | "brand";

export interface LineMatch {
  /**
   * Null cuando ganó la marca: la línea cuenta y no sabemos qué presentación
   * es. Preferible a apuntar a un SKU al azar — `receipt_items.product_id`
   * admite null justamente para poder decir "no se sabe" en vez de mentir.
   */
  productId: string | null;
  /** Solo cuando ganó un alias de verdad. El nombre del catálogo no es alias. */
  alias: string | null;
  matchedBy: "alias" | "name" | "brand";
  /** El texto del catálogo que hizo match, para la bitácora. */
  label: string;
}

/**
 * Matchea una línea impresa contra el catálogo.
 *
 * Alias primero y el más largo primero: `CAMARONAZO 32OZ` tiene que ganarle a un
 * hipotético `CAMARONAZO`, o el SKU más específico nunca se elige.
 *
 * Después el nombre del propio producto, que es la parte que faltaba. Matchear
 * solo alias significaba que una campaña cuyo diccionario todavía no se había
 * cosechado de tickets reales no matcheaba nada — y como el elegible es la suma
 * de las líneas matcheadas, toda aprobación abonaba cero. Carrera Alaska tenía
 * siete productos reales, cero alias, y aprobó un ticket por cero puntos.
 *
 * Un alias es la manera particular en que un retailer escribe un producto; el
 * nombre del producto es el caso general. Tener el caso general es lo que hace
 * que una campaña funcione el día uno y que el diccionario sea una mejora en vez
 * de un requisito.
 */
export function matchLine(
  text: string,
  products: MatchableProduct[],
  mode: EligibilityMode = "sku",
): LineMatch | null {
  const line = normalize(text);
  if (line.length < 3) return null;

  const candidates = [
    ...products.flatMap((p) =>
      p.aliases.map((alias) => ({ product: p, label: alias, fromAlias: true })),
    ),
    // Las palabras del propio catálogo. Marca y nombre juntos primero, para que
    // "Alaska Garrafón 19 L" le gane a un "Garrafón 19 L" pelón cuando los dos
    // podrían matchear.
    ...products.map((p) => ({ product: p, label: `${p.brand} ${p.name}`, fromAlias: false })),
    ...products.map((p) => ({ product: p, label: p.name, fromAlias: false })),
  ].sort((a, b) => normalize(b.label).length - normalize(a.label).length);

  for (const candidate of candidates) {
    const label = normalize(candidate.label);
    if (label.length >= 3 && line.includes(label)) {
      // Solo un alias real se reporta como alias; un match por nombre no debe
      // parecer una entrada de diccionario en la bitácora de auditoría.
      return {
        productId: candidate.product.id,
        alias: candidate.fromAlias ? candidate.label : null,
        matchedBy: candidate.fromAlias ? "alias" : "name",
        label: candidate.label,
      };
    }
  }

  // La marca, y solo después de que ningún producto concreto ganó. El orden
  // importa: donde el POS sí imprime la presentación seguimos guardando el SKU
  // exacto, y la marca es la red que atrapa lo que ese POS no dice. Al revés
  // —marca primero— perderíamos el SKU en las tiendas que sí lo imprimen.
  if (mode === "brand") {
    const brands = [...new Set(products.map((p) => p.brand))].sort(
      (a, b) => normalize(b).length - normalize(a).length,
    );
    for (const brand of brands) {
      const label = normalize(brand);
      if (label.length >= 3 && line.includes(label)) {
        return { productId: null, alias: null, matchedBy: "brand", label: brand };
      }
    }
  }

  return null;
}

/**
 * Un importe impreso → centavos.
 *
 * Reemplaza a `parseUsdToCents` en todo lo que toque texto leído de un ticket,
 * porque aquella hace `.replace(",", ".")` sobre la PRIMERA coma y eso convierte
 * "1,234.56" en "1.234.56", que `parseFloat` lee como 1.234 → 123 centavos. Un
 * ticket de $1,234.56 se guardaba como $1.23. En Ticket al Tanque un total de
 * cuatro cifras es raro; en Carrera Alaska, donde un negocio compra garrafones
 * por docena, no lo es.
 *
 * La regla: el ÚLTIMO separador es el decimal si y solo si le siguen exactamente
 * dos dígitos. Cualquier otro separador es de millares y se va. Cubre las tres
 * formas que imprime una caja registradora — 1,234.56 · 1.234,56 · 1234.56 — sin
 * tener que saber de antemano en qué país se imprimió.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.,]/g, "");
  if (!cleaned) return null;

  const lastSeparator = Math.max(cleaned.lastIndexOf("."), cleaned.lastIndexOf(","));
  const decimalsFollow = lastSeparator >= 0 ? cleaned.length - lastSeparator - 1 : 0;

  // Dos dígitos después del último separador: ese separador es el punto decimal.
  // Cualquier otra cosa (tres dígitos, cero dígitos, ningún separador) significa
  // que todos los separadores son de millares.
  const hasDecimals = lastSeparator >= 0 && decimalsFollow === 2;

  const whole = (hasDecimals ? cleaned.slice(0, lastSeparator) : cleaned).replace(
    /[.,]/g,
    "",
  );
  const fraction = hasDecimals ? cleaned.slice(lastSeparator + 1) : "00";

  if (!whole && !hasDecimals) return null;
  const cents = Number.parseInt(whole || "0", 10) * 100 + Number.parseInt(fraction, 10);
  return Number.isFinite(cents) && cents >= 0 ? cents : null;
}

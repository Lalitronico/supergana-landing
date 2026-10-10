// Run with:  npm test
//
// Reading money off a receipt, and reading a product name off one.
//
// `parseAmountToCents` exists because its predecessor divided four-figure
// totals by a thousand. `parseUsdToCents` did
//
//     input.replace(/[^0-9.,-]/g, "").replace(",", ".")
//
// so "1,048.00" became "1.048.00" and `parseFloat` read 1.048 — a $1,048
// receipt stored as $1.05. It was live in the manual console from day one and
// nobody noticed, because a wrong total looks exactly like a right one until
// somebody adds up the fund. The first test here is that receipt.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseAmountToCents,
  matchLine,
  namesAListedStore,
  normalize,
  storeNameFrom,
  toMatchable,
} from "./matching.ts";
import type { MatchableProduct } from "./matching.ts";

// ---------------------------------------------------------------------------
// parseAmountToCents
// ---------------------------------------------------------------------------

test("the four-figure receipt that started this", () => {
  // The exact string that became $1.05.
  assert.equal(parseAmountToCents("1,048.00"), 104800);
  assert.equal(parseAmountToCents("$1,048.00"), 104800);
  assert.equal(parseAmountToCents("1,234.56"), 123456);
  // And past a thousand, where a second separator appears.
  assert.equal(parseAmountToCents("1,048,500.25"), 104850025);
});

test("the shapes a Mexican POS actually prints", () => {
  assert.equal(parseAmountToCents("11.50"), 1150);
  assert.equal(parseAmountToCents("$11.50"), 1150);
  assert.equal(parseAmountToCents("$ 11.50"), 1150);
  assert.equal(parseAmountToCents("11.50 MXN"), 1150);
  assert.equal(parseAmountToCents("MXN 11.50"), 1150);
  assert.equal(parseAmountToCents("11"), 1100);
  assert.equal(parseAmountToCents("0.50"), 50);
});

test("a comma as the decimal mark still reads as a decimal", () => {
  // Rare on a Mexican receipt and routine on a European one. What must not
  // happen is 11,50 being read as 1150 pesos.
  assert.equal(parseAmountToCents("11,50"), 1150);
});

test("nothing that is not a number becomes a number", () => {
  for (const junk of ["", "   ", "SUBTOTAL", "$", "-", "N/A", "."]) {
    assert.equal(parseAmountToCents(junk), null, JSON.stringify(junk));
  }
});

// ---------------------------------------------------------------------------
// normalize
// ---------------------------------------------------------------------------

test("accents and case are not the shopper's problem", () => {
  // Receipt printers print GARRAFON; the catalogue says Garrafón. Not seeing
  // through that is matching nothing, in a Mexican campaign.
  assert.equal(normalize("Garrafón"), normalize("GARRAFON"));
  assert.equal(normalize("  Del  Río "), normalize("del rio"));
});

// ---------------------------------------------------------------------------
// matchLine — which lines count
// ---------------------------------------------------------------------------

const products: MatchableProduct[] = [
  { id: "p-garrafon", brand: "Alaska", name: "Agua Alaska Garrafón 20 L", aliases: ["ALASKA GARRAFON"] },
  { id: "p-botella", brand: "Alaska", name: "Agua Alaska 1 L", aliases: ["ALASKA 1L"] },
];

test("sku mode counts only what the catalogue spells out", () => {
  assert.equal(matchLine("ALASKA GARRAFON 20L", products, "sku")?.productId, "p-garrafon");
  // A line naming the brand but no known SKU does NOT count in sku mode. This
  // is the failing-closed direction: Novamex runs in sku mode, and a campaign
  // that silently started counting every line naming the brand would be a
  // campaign paying for products it never promoted.
  assert.equal(matchLine("ALASKA HIELO 5KG", products, "sku"), null);
});

test("brand mode counts any line naming the brand", () => {
  // Carrera Alaska's mode: the client sells water under one brand and did not
  // want a dictionary maintained per SKU.
  const found = matchLine("ALASKA HIELO 5KG", products, "brand");
  assert.equal(found?.matchedBy, "brand");
  assert.equal(found?.productId, null);
});

test("a line naming nothing of ours never counts, in either mode", () => {
  for (const mode of ["sku", "brand"] as const) {
    assert.equal(matchLine("SABRITAS ORIGINAL 45G", products, mode), null, mode);
    assert.equal(matchLine("TOTAL", products, mode), null, mode);
  }
});

// ---------------------------------------------------------------------------
// toMatchable
// ---------------------------------------------------------------------------

test("a product with no aliases row still matches by brand", () => {
  // The Novamex lesson: Mineragua and Sangría shipped without a dictionary, so
  // every one of their lines fell to a human. `product_aliases` being null must
  // not throw and must not silently drop the product.
  const m = toMatchable({ id: "x", brand: "Alaska", name: "Agua Alaska 1 L", product_aliases: null });
  assert.deepEqual(m.aliases, []);
  assert.equal(matchLine("ALASKA 1L", [m], "brand")?.matchedBy, "brand");
});

// ---------------------------------------------------------------------------
// storeNameFrom — el bug del 2026-08-20
// ---------------------------------------------------------------------------

const ALASKA_STORES = ["Superette", "Del Río"];

test("gana la sucursal cuando ella es la que nombra la tienda", () => {
  // El ticket real de Del Río: razón social ilegible, sucursal reconocible.
  // Nadie llama a esa tienda "ALMACENES DIST. DE LA FRONTERA SA DE CV.".
  const name = storeNameFrom(
    { store_name: "ALMACENES DIST. DE LA FRONTERA SA DE CV.", store_branch: "DEL RIO (0010)" },
    ALASKA_STORES,
  );
  assert.equal(name, "DEL RIO (0010)");
  assert.equal(namesAListedStore(name, ALASKA_STORES), true);
});

test("gana la razón social cuando la sucursal no nombra nada", () => {
  // El reparto invertido, que es el que rompió: preferir la sucursal a ciegas
  // dejaba "SUCURSAL 0010" como nombre de tienda, la compuerta preguntaba si
  // eso era una tienda participante, y un ticket legítimo se iba a la cola.
  const name = storeNameFrom(
    { store_name: "SUPER DEL RIO", store_branch: "SUCURSAL 0010" },
    ALASKA_STORES,
  );
  assert.equal(name, "SUPER DEL RIO");
  assert.equal(namesAListedStore(name, ALASKA_STORES), true);
});

test("sin empate con la lista, el comercio gana sobre la sucursal", () => {
  // Sin lista (o con una tienda fuera de ella) lo mira una persona: necesita el
  // nombre del comercio, no "#22".
  assert.equal(
    storeNameFrom({ store_name: "LA MICHOACANA MEAT MARKET", store_branch: "#22" }, []),
    "LA MICHOACANA MEAT MARKET",
  );
  assert.equal(
    storeNameFrom({ store_name: "OXXO", store_branch: "#22" }, ALASKA_STORES),
    "OXXO",
  );
  // Si el comercio no se leyó, la sucursal es mejor que nada.
  assert.equal(storeNameFrom({ store_name: "", store_branch: "#22" }, []), "#22");
});

test("acepta las dos formas del objeto, snake y camel", () => {
  // La base devuelve snake_case y el motor de OCR camelCase, y las dos rutas
  // llaman a esto. Que una de ellas devolviera "" sería el bug de nuevo.
  assert.equal(storeNameFrom({ storeName: "SUPER DEL RIO", storeBranch: "SUCURSAL 0010" }, ALASKA_STORES), "SUPER DEL RIO");
  assert.equal(storeNameFrom({ store_name: "SUPER DEL RIO", store_branch: "SUCURSAL 0010" }, ALASKA_STORES), "SUPER DEL RIO");
});

test("una tienda que no es de la campaña no se convierte en una que sí", () => {
  const name = storeNameFrom({ store_name: "OXXO", store_branch: "OXXO 4412" }, ALASKA_STORES);
  assert.equal(namesAListedStore(name, ALASKA_STORES), false);
});

test("nada leído es cadena vacía, no una tienda", () => {
  assert.equal(storeNameFrom({}, ALASKA_STORES), "");
  assert.equal(namesAListedStore("", ALASKA_STORES), false);
});

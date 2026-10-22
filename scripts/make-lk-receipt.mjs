/**
 * Demo receipts for the "Love & Kitchen" campaign (Grupo Bafar x Supergana).
 *
 * A Mexican supermarket thermal ticket (MXN), 80 mm wide rendered at ~300 dpi.
 * Item descriptions are alias strings seeded VERBATIM in migration 0050
 * (`<LINE> <BRAND> <SIZE>`, e.g. "SALSA BBQ L&K 450G"), each with its EAN-13 on
 * the line below, so the OCR gate can read and approve the ticket by itself.
 * The store is fictional on purpose ("Súper Supergana", two branches): never
 * print a real retailer name.
 *
 * Single receipt (deterministic per seed):
 *   node scripts/make-lk-receipt.mjs --out ticket.jpg --seed 7 \
 *        --date 2026-10-21 [--store "SUC. 027 CD. JUÁREZ"] [--bulk]
 *
 * A whole set (A pruebas, B demo; also writes manifest-*.json):
 *   node scripts/make-lk-receipt.mjs --set A --dir out/pruebas [--avoid out/manifest-B.json]
 *   node scripts/make-lk-receipt.mjs --set B --dir out
 *
 * Anti-duplicate lock is (store | date | total) per campaign. Inside a set the
 * uniqueness is guaranteed (colliding seeds are skipped). The lock uses the
 * store name read by the OCR ("Súper Supergana"), so both branches share it.
 *
 * Points = floor(eligible_cents * 10 / 100) (10 pts per peso), eligible = sum
 * of participating lines. All food here is IVA 0 %; only REFRESCO, CARBON and
 * PAPEL HIGIENICO carry IVA 16 % (shelf prices include it, as in Mexico).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

export const STORES = {
  "SUC. 014 CHIHUAHUA": {
    name: "SÚPER SUPERGANA",
    branch: "SUC. 014 CHIHUAHUA",
    address: ["AV. UNIVERSIDAD 1450, COL. CENTRO", "CHIHUAHUA, CHIH. C.P. 31000"],
    rfc: "SSU-261022-XX0",
    phone: "614 555 0142",
    code: "014",
  },
  "SUC. 027 CD. JUÁREZ": {
    name: "SÚPER SUPERGANA",
    branch: "SUC. 027 CD. JUÁREZ",
    address: ["AV. TECNOLÓGICO 8802, COL. PARTIDO", "CD. JUÁREZ, CHIH. C.P. 32030"],
    rfc: "SSU-261022-XX0",
    phone: "656 555 0127",
    code: "027",
  },
};
const STORE_NAME = "Súper Supergana"; // as listed in config.stores

// Participating catalogue (migration 0050). `lines` / `sizes` are the tokens used to
// build aliases; the brand token goes in the middle: "<LINE> <BRAND> <SIZE>".
const P = (ean, brand, lines, sizes, prices, maxQty = 2, bulk = false) => ({ ean, brand, lines, sizes, prices, maxQty, bulk });
const PRODUCTS = [
  P("7502006271758", "Salsa BBQ", ["SALSA BBQ"], ["450G", "450G", "450 G"], [37, 39, 41, 45]),
  P("7502006279754", "Salsa BBQ", ["SALSA BBQ"], ["4KG", "4KG", "GALON"], [245, 250, 259], 1, true),
  P("7502006271772", "Salsa Habanero Mango", ["SALSA HABANERO MANGO"], ["450G", "450G", "450 G"], [39, 42, 45]),
  P("7502006279945", "Salsa Habanero Mango", ["SALSA HABANERO MANGO"], ["4.15KG", "4.15 KG"], [215, 220, 229], 1, true),
  P("7502006271826", "Salsa de Soya", ["SALSA SOYA", "SALSA DE SOYA"], ["250ML", "250 ML"], [16, 18, 22]),
  P("7502006271352", "Salsa de Soya", ["SALSA SOYA", "SALSA DE SOYA"], ["1L", "1 L", "1LT"], [45, 52, 58]),
  P("7502006271574", "Salsa de Soya", ["SALSA SOYA", "SALSA DE SOYA"], ["3.5L", "3.5 L"], [135, 140, 149], 1, true),
  P("7502006271512", "Salsa de Soya", ["SALSA SOYA", "SALSA DE SOYA"], ["20L", "20 L", "GARRAFA"], [525, 535, 549], 1, true),
  P("7502006271840", "Jugo Sazonador", ["JUGO SAZONADOR", "JGO SAZONADOR"], ["250ML", "250 ML"], [17, 19, 22]),
  P("7502006271369", "Jugo Sazonador", ["JUGO SAZONADOR", "JGO SAZONADOR"], ["1L", "1 L", "1LT"], [55, 62, 75]),
  P("7502006279921", "Jugo Sazonador", ["JUGO SAZONADOR", "JGO SAZONADOR"], ["3.5L", "3.5 L"], [315, 322, 335], 1, true),
  P("7502006271765", "Salsa BBQ Picante", ["SALSA BBQ PICANTE", "SALSA BBQ PIC"], ["450G", "450G", "450 G"], [38, 41, 45]),
  P("7502006279969", "Salsa BBQ Picante", ["SALSA BBQ PICANTE", "SALSA BBQ PIC"], ["4KG", "GALON"], [259, 266, 275], 1, true),
  P("7502006271833", "Salsa Inglesa", ["SALSA INGLESA"], ["250ML", "250 ML"], [18, 20, 22]),
  P("7502006271482", "Salsa Inglesa", ["SALSA INGLESA"], ["1L", "1 L", "1LT"], [48, 55, 65]),
  P("7502006279914", "Salsa Inglesa", ["SALSA INGLESA"], ["3.5L", "3.5 L"], [150, 165, 179], 1, true),
  P("7502006271789", "Salsa para Alitas", ["SALSA ALITAS", "SALSA PARA ALITAS"], ["420G", "420G", "420 G"], [38, 40, 44]),
  P("7502006271697", "Salsa para Alitas", ["SALSA ALITAS", "SALSA PARA ALITAS"], ["3.5L", "3.5 L"], [235, 249], 1, true),
  P("7502006271802", "Mayonesa", ["MAYONESA LIGHT", "MAYONESA"], ["390G", "390 G"], [36, 38, 41]),
  P("7502006271796", "Catsup", ["CATSUP"], ["440G", "440 G"], [28, 30, 33]),
  P("7502006271819", "Mostaza", ["MOSTAZA"], ["420G", "420 G"], [26, 28, 31]),
];
const HOME = PRODUCTS.filter((p) => !p.bulk);
const BULK = PRODUCTS.filter((p) => p.bulk);

// Non-participating filler: must never contain SALSA, SOYA, INGLESA, SAZONADOR, BBQ,
// ALITAS, CATSUP, MAYONESA, MOSTAZA, HOJUELAS, L&K, LOVE, KITCHEN.
// kind: "u" per unit, "w" by weight (kg). iva16: price already includes 16 % IVA.
const FILLER = [
  { plu: "7501055300013", name: "TORTILLA MAIZ KG", kind: "w", price: 22.0, wmax: 1.5 },
  { plu: "4046", name: "AGUACATE HASS KG", kind: "w", price: 54.9, wmax: 0.9 },
  { plu: "4958", name: "LIMON KG", kind: "w", price: 32.9, wmax: 0.8 },
  { plu: "4664", name: "CEBOLLA BLANCA KG", kind: "w", price: 21.9, wmax: 1.0 },
  { plu: "4087", name: "TOMATE SALADET KG", kind: "w", price: 27.5, wmax: 1.2 },
  { plu: "4707", name: "CHILE SERRANO KG", kind: "w", price: 44.9, wmax: 0.4 },
  { plu: "2200145", name: "ARRACHERA KG", kind: "w", price: 219.0, wmax: 1.1 },
  { plu: "2200318", name: "COSTILLA RES KG", kind: "w", price: 189.0, wmax: 1.4 },
  { plu: "7501000121014", name: "CARBON 3KG", kind: "u", price: 54.0, iva16: true, maxQty: 2 },
  { plu: "7501055363322", name: "REFRESCO COLA 2L", kind: "u", price: 33.5, iva16: true, maxQty: 3 },
  { plu: "7501030440019", name: "PAN BOLILLO", kind: "u", price: 3.5, maxQty: 8 },
  { plu: "7501020561018", name: "QUESO OAXACA KG", kind: "w", price: 189.0, wmax: 0.5 },
  { plu: "7501020515011", name: "HUEVO BLANCO 18PZ", kind: "u", price: 63.5, maxQty: 1 },
  { plu: "7501060820011", name: "FRIJOL PINTO 900G", kind: "u", price: 32.9, maxQty: 2 },
  { plu: "7501013120055", name: "PAPEL HIGIENICO 12R", kind: "u", price: 58.0, iva16: true, maxQty: 1 },
  { plu: "7501025404126", name: "CREMA ACIDA 450G", kind: "u", price: 29.5, maxQty: 1 },
];

/** mulberry32: tiny seeded PRNG, enough for reproducible receipts. */
const prng = (seed) => {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const cents = (n) => Math.round(n * 100);
/** cents -> "1,234.50" */
const money = (c) => (c / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * Alias spellings that stay in the catalogue after the dictionary prune (L1 = first
 * line token, S1 = first size token, S2 = S1 with a space before the unit):
 *   "L1 L&K S1" (preferred), "L1 L&K S2", "L&K L1 S1", "L1 LOVE KITCHEN S1".
 * Anything else may stop matching, so nothing else is ever printed.
 */
function aliasFor(product, rand) {
  const l1 = product.lines[0];
  const s1 = product.sizes[0];
  const s2 = s1.replace(/(\d)([A-Z]+)$/, "$1 $2");
  const r = rand();
  let desc;
  if (r < 0.5) desc = `${l1} L&K ${s1}`;
  else if (r < 0.65) desc = `${l1} L&K ${s2}`;
  else if (r < 0.82) desc = `L&K ${l1} ${s1}`;
  else desc = `${l1} LOVE KITCHEN ${s1}`;
  return desc.length > 37 ? `${l1} L&K ${s1}` : desc;
}

/** Build the receipt data (no drawing). Deterministic per (seed, options). */
export function buildReceipt({ seed, date, store, bulk }) {
  const rand = prng(seed * 7919 + 13);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const storeKey = store ?? (seed % 2 === 0 ? "SUC. 014 CHIHUAHUA" : "SUC. 027 CD. JUÁREZ");
  const spec = STORES[storeKey];
  if (!spec) throw new Error(`Sucursal desconocida: ${storeKey}`);
  const withBulk = bulk ?? seed % 3 === 0;

  // Participating basket: 2-4 distinct lines, one of them bulk on "business" tickets.
  const nLines = 2 + Math.floor(rand() * 3);
  const chosen = [];
  if (withBulk) chosen.push(pick(BULK));
  const homePool = [...HOME];
  while (chosen.length < nLines) {
    const p = homePool.splice(Math.floor(rand() * homePool.length), 1)[0];
    if (!chosen.some((c) => c.brand === p.brand)) chosen.push(p);
  }
  const lines = chosen.map((p) => {
    const qty = p.bulk ? 1 : rand() < 0.65 ? 1 : 2;
    const unit = cents(pick(p.prices) + (rand() < 0.3 && !p.bulk ? 0.5 : 0));
    const desc = aliasFor(p, rand);
    return { brand: p.brand, code: p.ean, desc, qty, unit, amount: qty * unit, iva16: false, participant: true };
  });

  // 3-6 generic items.
  const pool = [...FILLER];
  const fillerCount = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < fillerCount; i++) {
    const f = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    const unit = cents(f.price);
    if (f.kind === "w") {
      const weight = Math.round((0.15 + rand() * (f.wmax - 0.15)) * 1000) / 1000;
      lines.push({ code: f.plu, desc: f.name, weight, unit, amount: Math.round(weight * unit), iva16: !!f.iva16, participant: false });
    } else {
      const qty = 1 + Math.floor(rand() * f.maxQty);
      lines.push({ code: f.plu, desc: f.name, qty, unit, amount: qty * unit, iva16: !!f.iva16, participant: false });
    }
  }
  for (let i = lines.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [lines[i], lines[j]] = [lines[j], lines[i]];
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);
  const gross16 = lines.filter((l) => l.iva16).reduce((s, l) => s + l.amount, 0);
  const iva16 = Math.round(gross16 - gross16 / 1.16);
  const subtotal = total - iva16;
  const eligibleCents = lines.filter((l) => l.participant).reduce((s, l) => s + l.amount, 0);

  const hour = 9 + Math.floor(rand() * 12);
  const minute = Math.floor(rand() * 60);
  const [y, m, d] = date.split("-");
  const stamp = `${d}/${m}/${y} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const byCard = rand() < 0.55;
  let tendered = total;
  if (!byCard) tendered = Math.ceil(total / 5000) * 5000 + (rand() < 0.3 ? 5000 : 0); // bills of $50
  return {
    seed, storeKey, spec, date, stamp, lines, subtotal, iva16, total, eligibleCents,
    points: Math.floor((eligibleCents * 10) / 100),
    bulk: lines.some((l) => l.participant && BULK.some((b) => b.ean === l.code)),
    register: 1 + Math.floor(rand() * 8),
    cashier: pick(["MARIA G.", "JOSE L.", "ANA R.", "LUIS P.", "CARMEN T.", "DIEGO S.", "ROSA M.", "JORGE H."]),
    folio: String(100000 + Math.floor(rand() * 899999)),
    byCard, tendered, change: tendered - total,
    cardLast4: pick(["4821", "7730", "1096", "5543"]),
    auth: String(Math.floor(rand() * 900000) + 100000),
  };
}

// ---------------------------------------------------------------------------
// Drawing: 640 x H units, mono 19px => 48 columns inside margins.
// ---------------------------------------------------------------------------
const W = 640;
const COLS = 48;
const LEFT = 36;
const SCALE = 1.5;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const padR = (s, n) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));
const padL = (s, n) => (s.length >= n ? s : " ".repeat(n - s.length) + s);
const row = (left, right) => left + " ".repeat(Math.max(1, COLS - left.length - right.length)) + right;

/** Decorative Code-128-looking bars derived from the folio (not scannable). */
const barcode = (folio, x, y, w, h) => {
  const rand = prng(Number(folio));
  let cx = x;
  let out = "";
  while (cx < x + w - 4) {
    const bw = 1 + Math.floor(rand() * 4);
    out += `<rect x="${cx}" y="${y}" width="${bw}" height="${h}" fill="#151515"/>`;
    cx += bw + 1 + Math.floor(rand() * 3);
  }
  return out;
};

export function renderSvg(r) {
  const out = [];
  let y = 54;
  const text = (s, cls = "m", ay = 0) => {
    out.push(`<text x="${LEFT}" y="${y}" class="${cls}" xml:space="preserve">${esc(s)}</text>`);
    y += 25 + ay;
  };
  const center = (s, cls) => {
    out.push(`<text x="${W / 2}" y="${y}" class="${cls} c" xml:space="preserve">${esc(s)}</text>`);
    y += cls === "b" ? 40 : 25;
  };
  const rule = (ch = "-") => text(ch.repeat(COLS), "m");

  center(r.spec.name, "b");
  center(r.spec.branch, "m");
  for (const a of r.spec.address) center(a, "m");
  center(`RFC ${r.spec.rfc}   TEL ${r.spec.phone}`, "s");
  y += 6;
  rule();
  text(row(r.stamp, `TICKET ${r.folio}`));
  text(row(`CAJA ${String(r.register).padStart(2, "0")}`, `CAJERO: ${r.cashier}`));
  rule();
  y += 4;

  for (const l of r.lines) {
    text(`${padR(l.desc, 37)}${padL(money(l.amount), 10)}`);
    const detail = l.weight
      ? `${l.code}  ${l.weight.toFixed(3)} KG x ${money(l.unit)}`
      : l.qty > 1
        ? `${l.code}  ${l.qty} x ${money(l.unit)}`
        : l.code;
    text(`  ${detail}`, "s", -3);
  }

  y += 4;
  rule();
  text(row("SUBTOTAL", money(r.subtotal)));
  text(row("IVA 0%", "0.00"));
  text(row("IVA 16%", money(r.iva16)));
  y += 8;
  out.push(`<text x="${LEFT}" y="${y}" class="b" xml:space="preserve">TOTAL</text>`);
  out.push(`<text x="${W - LEFT}" y="${y}" class="b r" xml:space="preserve">$${money(r.total)}</text>`);
  y += 42;
  rule();
  if (r.byCard) {
    text(row("TARJETA DEBITO ****" + r.cardLast4, money(r.total)));
    text(`AUTORIZACION ${r.auth}   CHIP APROBADO`, "s");
  } else {
    text(row("EFECTIVO", money(r.tendered)));
    text(row("CAMBIO", money(r.change)));
  }
  text(row("ARTICULOS VENDIDOS", String(r.lines.reduce((s, l) => s + (l.weight ? 1 : l.qty), 0))));
  y += 4;
  rule();
  y += 6;
  center("GRACIAS POR SU COMPRA", "m");
  center("CONSERVE SU TICKET PARA ACLARACIONES", "s");
  y += 6;
  out.push(barcode(r.folio, LEFT + 40, y, W - 2 * LEFT - 80, 70));
  y += 92;
  center(`${r.folio} ${r.spec.code}${r.register}`, "s");
  y += 8;
  center("TICKET DE DEMOSTRACIÓN · SUPERGANA", "s");
  y += 20;

  const H = y;
  return {
    height: H,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W * SCALE}" height="${H * SCALE}" viewBox="0 0 ${W} ${H}">
  <style>
    .m { font-family: 'Courier New', Courier, monospace; font-size: 19px; fill: #1b1b1b; }
    .s { font-family: 'Courier New', Courier, monospace; font-size: 16px; fill: #3a3a3a; }
    .b { font-family: 'Courier New', Courier, monospace; font-size: 30px; font-weight: bold; fill: #111; }
    .r { text-anchor: end; }
    .c { text-anchor: middle; }
  </style>
  <defs>
    <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${r.seed}"/><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.05 0"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#f7f5ef"/>
  <rect width="${W}" height="${H}" filter="url(#paper)"/>
  ${out.join("\n  ")}
</svg>`,
  };
}

export async function writeReceipt(r, outPath) {
  const { svg } = renderSvg(r);
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg)).flatten({ background: "#f7f5ef" }).jpeg({ quality: 90 }).toFile(outPath);
}

export const metaOf = (r, file) => ({
  file,
  seed: r.seed,
  store: STORE_NAME, // what the OCR gate reads (config.stores)
  branch: r.storeKey,
  date: r.date,
  total: r.total / 100,
  eligible: r.eligibleCents / 100,
  points: r.points,
  bulk: r.bulk,
  brands: [...new Set(r.lines.filter((l) => l.participant).map((l) => l.brand))],
  lines: r.lines.map((l) => `${l.code} ${l.desc} ${l.weight ? `${l.weight}kg` : l.qty}x${money(l.unit)}=${money(l.amount)}${l.participant ? " *" : ""}`),
});

/** A set: sequential seeds, alternate branches, a third with a bulk SKU, unique (store|date|total). */
export function buildSet({ date, count, startSeed, avoid = [] }) {
  const seen = new Set(avoid);
  const receipts = [];
  let seed = startSeed;
  while (receipts.length < count) {
    const store = receipts.length % 2 === 0 ? "SUC. 014 CHIHUAHUA" : "SUC. 027 CD. JUÁREZ";
    const r = buildReceipt({ seed, date, store, bulk: receipts.length % 3 === 0 });
    const key = `${STORE_NAME.toLowerCase()}|${date}|${r.total}`;
    seed += 1;
    if (seen.has(key)) continue;
    seen.add(key);
    receipts.push(r);
  }
  return receipts;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (process.argv[1]?.endsWith("make-lk-receipt.mjs")) {
  const args = process.argv.slice(2);
  const get = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const set = get("--set");

  if (set) {
    const plan = {
      A: { date: "2026-10-20", count: 6, startSeed: 1000, prefix: "prueba" },
      B: { date: "2026-10-21", count: 16, startSeed: 2000, prefix: "demo" },
    }[set];
    if (!plan) throw new Error("--set debe ser A o B");
    const dir = get("--dir", ".");
    const avoidFile = get("--avoid");
    const avoid = avoidFile
      ? JSON.parse(readFileSync(avoidFile, "utf8")).map((m) => `${m.store.toLowerCase()}|${m.date}|${Math.round(m.total * 100)}`)
      : [];
    const receipts = buildSet({ ...plan, avoid });
    const manifest = [];
    for (const [i, r] of receipts.entries()) {
      const file = `${plan.prefix}-${String(i + 1).padStart(2, "0")}.jpg`;
      await writeReceipt(r, join(dir, file));
      manifest.push(metaOf(r, file));
    }
    writeFileSync(join(dir, `manifest-${set}.json`), JSON.stringify(manifest, null, 2));
    console.log(`ok -> ${dir} (${receipts.length} tickets, set ${set})`);
  } else {
    const outPath = get("--out");
    if (!outPath) {
      console.error('uso: node scripts/make-lk-receipt.mjs --out ticket.jpg [--seed N] [--date YYYY-MM-DD] [--store "SUC. 027 CD. JUÁREZ"] [--bulk]');
      process.exit(1);
    }
    const seed = Number(get("--seed", 1));
    const date = get("--date", new Date().toISOString().slice(0, 10));
    const r = buildReceipt({ seed, date, store: get("--store"), bulk: args.includes("--bulk") ? true : undefined });
    await writeReceipt(r, outPath);
    console.log(`ok -> ${outPath}  ${r.storeKey} ${date} total $${money(r.total)} elegible $${money(r.eligibleCents)} (${r.points} pts)`);
  }
}

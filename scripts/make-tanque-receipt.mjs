/**
 * Demo receipts for the "Ticket al Tanque" campaign (Novamex x Supergana).
 *
 * A US-Hispanic supermarket thermal receipt, 80 mm wide (rendered at ~300 dpi),
 * printed with EXACTLY the alias strings seeded in migration 0033, so the OCR
 * gate can read it and approve it on its own. The two stores are fictional on
 * purpose ("Supergana Market", "Mercado El Tanque").
 *
 * Single receipt (deterministic per seed):
 *   node scripts/make-tanque-receipt.mjs --out ticket.jpg --seed 7 \
 *        --date 2026-10-11 [--store "Mercado El Tanque"] [--eligible-min 30 --eligible-max 45]
 *
 * A whole set (also writes manifest.json with expected totals and points):
 *   node scripts/make-tanque-receipt.mjs --set A --dir out/pruebas
 *   node scripts/make-tanque-receipt.mjs --set B --dir out
 *
 * Anti-duplicate lock is (store | date | total) per campaign. For a single seed
 * the output is deterministic; across seeds, uniqueness of (store, date, total)
 * is guaranteed inside a set (seeds that collide are skipped) and checked by the
 * manifest. Two arbitrary seeds CAN collide by chance if you hand-pick them, so
 * for ad-hoc use compare the printed total.
 *
 * Points = floor(eligible_cents * 10 / 100), eligible = sum of participating
 * lines (pre-tax), exactly like tickets_approve_receipt (migration 0011).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const STORES = {
  "Supergana Market": {
    name: "SUPERGANA MARKET",
    branch: "SUCURSAL #014",
    address: ["1450 TEJAS BLVD", "EL PASO, TX 79925"],
    phone: "(915) 555-0142",
    style: "full", // alias variants as the POS prints them
  },
  "Mercado El Tanque": {
    name: "MERCADO EL TANQUE",
    branch: "TIENDA #027",
    address: ["8802 MONTANA AVE", "EL PASO, TX 79925"],
    phone: "(915) 555-0127",
    style: "short",
  },
};

// Participating products: [upc, alias printed by store style, base price list]
// Aliases are copied verbatim from 0033_demo_tanque_novamex.sql.
const PRODUCTS = [
  { key: "tamarindo", upc: "090478216225", full: "JARRITOS TAMARINDO 1.5L", short: "JARRITOS TAMAR 1.5L", prices: [2.49, 2.79, 2.99] },
  { key: "pina", upc: "090478216270", full: "JARRITOS PINA 1.5L", short: "JARRITOS PINEAP 1.5L", prices: [2.49, 2.79, 2.99] },
  { key: "fresa", upc: "090478216287", full: "JARRITOS FRESA 1.5L", short: "JARRITOS STRAWB 1.5L", prices: [2.49, 2.79, 2.99] },
  { key: "min500", upc: "090478415512", full: "MINERAGUA 500ML", short: "MINERAGUA 16.9OZ", prices: [1.29, 1.39] },
  { key: "min15", upc: "090478216805", full: "MINERAGUA 1.5L", short: "MINERAGUA 1.5L", prices: [1.99, 2.29, 2.49] },
];

// Generic non-participating items. Must never contain a brand or product name
// of the campaign (eligibility = "brand" counts any line naming the brand).
const FILLER = [
  { upc: "004011", name: "AGUACATE HASS", price: 0.99, taxable: false, maxQty: 4 },
  { upc: "004958", name: "LIMONES", price: 1.29, taxable: false, maxQty: 2 },
  { upc: "073210", name: "TORTILLAS MAIZ 30CT", price: 2.49, taxable: false, maxQty: 2 },
  { upc: "072250", name: "PAN BLANCO 20OZ", price: 3.49, taxable: false, maxQty: 1 },
  { upc: "004087", name: "CILANTRO MANOJO", price: 0.79, taxable: false, maxQty: 2 },
  { upc: "021130", name: "QUESO FRESCO 10OZ", price: 3.99, taxable: false, maxQty: 1 },
  { upc: "033844", name: "FRIJOL NEGRO 15OZ", price: 1.19, taxable: false, maxQty: 3 },
  { upc: "000940", name: "TOMATE ROMA LB", price: 1.49, taxable: false, maxQty: 3 },
  { upc: "004664", name: "CEBOLLA BLANCA LB", price: 1.29, taxable: false, maxQty: 2 },
];

const TX_SOFT_DRINK_TAX = 0.0825; // TX taxes soda and bottled water, not groceries

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
const money = (c) => (c / 100).toFixed(2);

/** Build the receipt data (no drawing). Deterministic per (seed, options). */
export function buildReceipt({ seed, date, store, eligibleMin = 30, eligibleMax = 45 }) {
  const rand = prng(seed * 7919 + 13);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const storeKey = store ?? (seed % 2 === 0 ? "Supergana Market" : "Mercado El Tanque");
  const spec = STORES[storeKey];
  if (!spec) throw new Error(`Tienda desconocida: ${storeKey}`);

  // Participating basket: retry until the eligible subtotal lands in range.
  let lines = [];
  let eligibleCents = 0;
  for (let attempt = 0; attempt < 500; attempt++) {
    const kinds = 2 + Math.floor(rand() * 3); // 2-4 distinct products
    const chosen = [];
    const pool = [...PRODUCTS];
    for (let k = 0; k < kinds; k++) chosen.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    lines = chosen.map((p) => {
      const qty = 1 + Math.floor(rand() * 5); // 1-5
      const unit = cents(pick(p.prices));
      return {
        upc: p.upc,
        desc: spec.style === "full" ? p.full : p.short,
        qty,
        unit,
        amount: qty * unit,
        taxable: true,
        participant: true,
      };
    });
    eligibleCents = lines.reduce((s, l) => s + l.amount, 0);
    if (eligibleCents >= cents(eligibleMin) && eligibleCents <= cents(eligibleMax)) break;
    if (attempt === 499) throw new Error("No se pudo armar una canasta en el rango");
  }

  // 2-4 generic items, interleaved with the participating ones like a real POS.
  const fillerPool = [...FILLER];
  const fillerCount = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < fillerCount; i++) {
    const f = fillerPool.splice(Math.floor(rand() * fillerPool.length), 1)[0];
    const qty = 1 + Math.floor(rand() * f.maxQty);
    const unit = cents(f.price);
    lines.push({ upc: f.upc, desc: f.name, qty, unit, amount: qty * unit, taxable: f.taxable, participant: false });
  }
  // Shuffle (Fisher-Yates with the seeded rng).
  for (let i = lines.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [lines[i], lines[j]] = [lines[j], lines[i]];
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const taxable = lines.filter((l) => l.taxable).reduce((s, l) => s + l.amount, 0);
  const tax = Math.round(taxable * TX_SOFT_DRINK_TAX);
  const total = subtotal + tax;

  const hour = 9 + Math.floor(rand() * 12);
  const minute = Math.floor(rand() * 60);
  const [y, m, d] = date.split("-");
  const h12 = ((hour + 11) % 12) + 1;
  const stamp = `${m}/${d}/${y}  ${String(h12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;

  return {
    seed,
    storeKey,
    spec,
    date,
    stamp,
    lines,
    subtotal,
    tax,
    total,
    eligibleCents,
    points: Math.floor((eligibleCents * 10) / 100),
    register: 1 + Math.floor(rand() * 6),
    cashier: pick(["MARIA G.", "JOSE L.", "ANA R.", "LUIS P.", "CARMEN T.", "DIEGO S."]),
    folio: String(100000 + Math.floor(rand() * 899999)),
    cardLast4: pick(["1234"]),
    auth: String(Math.floor(rand() * 900000) + 100000),
  };
}

// ---------------------------------------------------------------------------
// Drawing: 640 x H units, mono 20px (12 px/char => 46 columns inside margins).
// ---------------------------------------------------------------------------
const W = 640;
const COLS = 46;
const LEFT = 36;
const SCALE = 1.5;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const padR = (s, n) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));
const padL = (s, n) => (s.length >= n ? s : " ".repeat(n - s.length) + s);
const row = (left, right) => left + " ".repeat(Math.max(1, COLS - left.length - right.length)) + right;

/** Decorative Code-128-looking bars derived from the folio (not a scannable code). */
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
    const size = cls === "b" ? 34 : 20;
    out.push(`<text x="${W / 2}" y="${y}" class="${cls} c" xml:space="preserve">${esc(s)}</text>`);
    y += size === 34 ? 40 : 25;
  };
  const rule = (ch = "-") => text(ch.repeat(COLS), "m");

  center(r.spec.name, "b");
  center(r.spec.branch, "m");
  for (const a of r.spec.address) center(a, "m");
  center(`TEL ${r.spec.phone}`, "m");
  y += 6;
  rule();
  text(row(r.stamp, `FOLIO ${r.folio}`));
  text(row(`CAJA ${String(r.register).padStart(2, "0")}`, `CAJERO: ${r.cashier}`));
  rule();
  y += 4;

  for (const l of r.lines) {
    const desc = padR(`${l.upc} ${l.desc}`, 37);
    text(`${desc}${padL(money(l.amount), 6)} ${l.taxable ? "T" : " "}`);
    if (l.qty > 1) text(`    ${l.qty} @ ${money(l.unit)}`, "s", -3);
  }

  y += 4;
  rule();
  text(row("SUBTOTAL", money(r.subtotal)));
  text(row("TAX 8.25% (T)", money(r.tax)));
  y += 8;
  out.push(`<text x="${LEFT}" y="${y}" class="b" xml:space="preserve">TOTAL</text>`);
  out.push(`<text x="${W - LEFT}" y="${y}" class="b r" xml:space="preserve">$${money(r.total)}</text>`);
  y += 42;
  rule();
  text(row("VISA DEBITO ****" + r.cardLast4, money(r.total)));
  text(`AUTH ${r.auth}   CHIP APROBADO`, "s");
  text(row("ARTICULOS VENDIDOS", String(r.lines.reduce((s, l) => s + l.qty, 0))));
  y += 4;
  rule();
  y += 6;
  center("GRACIAS POR SU COMPRA", "m");
  center("THANK YOU FOR SHOPPING WITH US", "s");
  y += 6;
  out.push(barcode(r.folio, LEFT + 40, y, W - 2 * LEFT - 80, 70));
  y += 92;
  center(`${r.folio} ${r.spec.branch.replace(/\D/g, "")}${r.register}`, "s");
  y += 8;
  center("TICKET DE DEMOSTRACIÓN · SUPERGANA", "s");
  y += 20;

  const H = y;
  return {
    height: H,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W * SCALE}" height="${H * SCALE}" viewBox="0 0 ${W} ${H}">
  <style>
    .m { font-family: 'Courier New', Courier, monospace; font-size: 20px; fill: #1b1b1b; }
    .s { font-family: 'Courier New', Courier, monospace; font-size: 17px; fill: #3a3a3a; }
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
  store: r.storeKey,
  date: r.date,
  total: r.total / 100,
  eligible: r.eligibleCents / 100,
  points: r.points,
  lines: r.lines.map((l) => `${l.upc} ${l.desc} ${l.qty}x${money(l.unit)}=${money(l.amount)}${l.participant ? " *" : ""}`),
});

/** A set: sequential seeds, half per store, unique (store|date|total). */
export function buildSet({ date, count, startSeed, eligibleMin, eligibleMax }) {
  const seen = new Set();
  const receipts = [];
  let seed = startSeed;
  while (receipts.length < count) {
    // Alternate stores strictly so each store gets half.
    const store = receipts.length % 2 === 0 ? "Supergana Market" : "Mercado El Tanque";
    const r = buildReceipt({ seed, date, store, eligibleMin, eligibleMax });
    const key = `${store.toLowerCase()}|${date}|${r.total}`;
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
if (process.argv[1]?.endsWith("make-tanque-receipt.mjs")) {
  const args = process.argv.slice(2);
  const get = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const set = get("--set");
  const eligibleMin = Number(get("--eligible-min", 30));
  const eligibleMax = Number(get("--eligible-max", 45));

  if (set) {
    const plan = {
      A: { date: "2026-10-10", count: 6, startSeed: 1000, prefix: "prueba" },
      B: { date: "2026-10-11", count: 16, startSeed: 2000, prefix: "demo" },
    }[set];
    if (!plan) throw new Error("--set debe ser A o B");
    const dir = get("--dir", ".");
    const receipts = buildSet({ ...plan, eligibleMin, eligibleMax });
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
      console.error('uso: node scripts/make-tanque-receipt.mjs --out ticket.jpg [--seed N] [--date YYYY-MM-DD] [--store "Supergana Market"]');
      process.exit(1);
    }
    const seed = Number(get("--seed", 1));
    const date = get("--date", new Date().toISOString().slice(0, 10));
    const r = buildReceipt({ seed, date, store: get("--store"), eligibleMin, eligibleMax });
    await writeReceipt(r, outPath);
    console.log(`ok -> ${outPath}  ${r.storeKey} ${date} total $${money(r.total)} elegible $${money(r.eligibleCents)} (${r.points} pts)`);
  }
}

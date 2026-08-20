/**
 * A Del Río receipt, Ciudad Juárez shaped, for exercising Carrera Alaska.
 *
 * Its Novamex sibling (`make-test-receipt.mjs`) prints an El Paso receipt in
 * dollars with the Jarritos catalogue; feeding that to Alaska tests nothing,
 * because the store is not on its list and none of the lines name the brand.
 *
 *   node scripts/make-alaska-receipt.mjs salida.jpg [total] [--sin-alaska]
 *
 * `total` matters more than it looks: the anti-duplicate lock is
 * (tienda | fecha | total), so two test receipts on the same day with the same
 * total are one receipt as far as the database is concerned. Pass a different
 * one every time.
 */
import sharp from "sharp";

const out = process.argv[2];
if (!out) {
  console.error("uso: node scripts/make-alaska-receipt.mjs <salida.jpg> [total] [--sin-alaska]");
  process.exit(1);
}
const withoutAlaska = process.argv.includes("--sin-alaska");
const total = Number(process.argv[3]) || 45.5;

// Printed the way the seeded aliases expect: the printer writes GARRAFON, the
// catalogue says Garrafón, and `normalize` is what sees through that.
const LINES = withoutAlaska
  ? [["SABRITAS ORIGINAL", "18.50"], ["COCA COLA 600ML", "22.00"], ["PAN BIMBO GDE", "5.00"]]
  : [["ALASKA GARRAFON 20L", "11.50"], ["SABRITAS ORIGINAL", "18.50"], ["COCA COLA 600ML", "15.50"]];

const sum = LINES.reduce((a, [, v]) => a + Number(v), 0);
const rows = LINES.map(([name, amount], i) => `
    <text x="40" y="${330 + i * 34}" class="m">${name}</text>
    <text x="520" y="${330 + i * 34}" class="m r">${amount}</text>`).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="820">
  <style>
    .m { font-family: 'Courier New', monospace; font-size: 21px; fill: #1a1a1a; }
    .b { font-family: 'Courier New', monospace; font-size: 27px; font-weight: bold; fill: #111; }
    .s { font-family: 'Courier New', monospace; font-size: 17px; fill: #444; }
    .r { text-anchor: end; }
    .c { text-anchor: middle; }
  </style>
  <rect width="560" height="820" fill="#f6f4ee"/>
  <text x="280" y="70" class="b c">SUPER DEL RIO</text>
  <text x="280" y="102" class="b c">SUCURSAL 0010</text>
  <text x="280" y="132" class="s c">AV. TECNOLOGICO 1234</text>
  <text x="280" y="156" class="s c">CD. JUAREZ, CHIH.</text>
  <text x="280" y="180" class="s c">RFC SDR980417PL2</text>
  <line x1="40" y1="205" x2="520" y2="205" stroke="#999" stroke-dasharray="6 5"/>
  <text x="40" y="238" class="s">${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })}            13:42</text>
  <text x="40" y="264" class="s">CAJA 03   CAJERO 07   TICKET 44102</text>
  <line x1="40" y1="288" x2="520" y2="288" stroke="#999" stroke-dasharray="6 5"/>
  ${rows}
  <line x1="40" y1="520" x2="520" y2="520" stroke="#999" stroke-dasharray="6 5"/>
  <text x="40" y="556" class="m">SUBTOTAL</text>
  <text x="520" y="556" class="m r">${sum.toFixed(2)}</text>
  <text x="40" y="590" class="m">IVA 0%</text>
  <text x="520" y="590" class="m r">0.00</text>
  <text x="40" y="632" class="b">TOTAL</text>
  <text x="520" y="632" class="b r">$${total.toFixed(2)}</text>
  <line x1="40" y1="660" x2="520" y2="660" stroke="#999" stroke-dasharray="6 5"/>
  <text x="40" y="694" class="m">EFECTIVO             ${total.toFixed(2)}</text>
  <text x="40" y="726" class="s">CAMBIO 0.00</text>
  <text x="280" y="778" class="s c">GRACIAS POR SU COMPRA</text>
</svg>`;

await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(out);
console.log(`ok -> ${out}  (total $${total.toFixed(2)}, ${withoutAlaska ? "sin" : "con"} línea Alaska)`);

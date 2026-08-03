// Renders a thermal-receipt JPEG so the participant flow can be exercised with
// something a reviewer could actually read. Lines are printed the way the
// seeded aliases expect them, plus one item outside the catalog.

import sharp from "sharp";

const LINES = [
  ["JARRITOS TAMAR", "2.49"],
  ["CHOC IBARRA 540", "5.99"],
  ["PERRONA 250", "3.29"],
  ["TORTILLAS MAIZ", "2.19"],
  ["LECHE ENTERA GAL", "4.79"],
];

const SUB = 18.75;
const TAX = 1.55;
const TOTAL = 20.3;

const rows = LINES.map(
  ([name, amount], i) => `
    <text x="40" y="${330 + i * 34}" class="m">${name}</text>
    <text x="520" y="${330 + i * 34}" class="m r">${amount}</text>`,
).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="820">
  <style>
    .m { font-family: 'Courier New', monospace; font-size: 21px; fill: #1a1a1a; }
    .b { font-family: 'Courier New', monospace; font-size: 27px; font-weight: bold; fill: #111; }
    .s { font-family: 'Courier New', monospace; font-size: 17px; fill: #444; }
    .r { text-anchor: end; }
    .c { text-anchor: middle; }
  </style>
  <rect width="560" height="820" fill="#f6f4ee"/>
  <text x="280" y="70" class="b c">LA MICHOACANA</text>
  <text x="280" y="102" class="b c">MEAT MARKET #22</text>
  <text x="280" y="132" class="s c">7500 ALAMEDA AVE</text>
  <text x="280" y="156" class="s c">EL PASO, TX 79915</text>
  <text x="280" y="180" class="s c">(915) 555-0142</text>
  <line x1="40" y1="205" x2="520" y2="205" stroke="#999" stroke-dasharray="6 5"/>
  <text x="40" y="238" class="s">07/26/2026            18:05</text>
  <text x="40" y="264" class="s">TERM 09   CAJERO 22   TRN 90551</text>
  <line x1="40" y1="288" x2="520" y2="288" stroke="#999" stroke-dasharray="6 5"/>
  ${rows}
  <line x1="40" y1="520" x2="520" y2="520" stroke="#999" stroke-dasharray="6 5"/>
  <text x="40" y="556" class="m">SUBTOTAL</text>
  <text x="520" y="556" class="m r">${SUB.toFixed(2)}</text>
  <text x="40" y="590" class="m">TAX 8.25%</text>
  <text x="520" y="590" class="m r">${TAX.toFixed(2)}</text>
  <text x="40" y="632" class="b">TOTAL</text>
  <text x="520" y="632" class="b r">$${TOTAL.toFixed(2)}</text>
  <line x1="40" y1="660" x2="520" y2="660" stroke="#999" stroke-dasharray="6 5"/>
  <text x="40" y="694" class="m">VISA ****4417        ${TOTAL.toFixed(2)}</text>
  <text x="40" y="726" class="s">AUTH 042118   CHIP READ</text>
  <text x="280" y="778" class="s c">GRACIAS POR SU COMPRA</text>
</svg>`;

await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(process.argv[2]);
console.log("ok ->", process.argv[2]);

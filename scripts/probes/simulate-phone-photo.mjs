/**
 * Turns a clean receipt JPG into something that looks like a phone photo of the
 * paper: placed on a desk, slightly rotated and skewed (cheap perspective),
 * uneven lighting with a shadow, vignette, soft focus, sensor noise, JPEG q~60.
 *
 *   node scripts/probes/simulate-phone-photo.mjs in.jpg out.jpg [--seed 1] [--hard]
 */
import sharp from "sharp";

const [input, output] = process.argv.slice(2);
const seed = Number(process.argv[process.argv.indexOf("--seed") + 1]) || 1;
const hard = process.argv.includes("--hard");
if (!input || !output) {
  console.error("uso: simulate-phone-photo.mjs in.jpg out.jpg [--seed N] [--hard]");
  process.exit(1);
}
const rand = (() => { let a = seed * 2654435761 >>> 0; return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296); })();

const CW = 1600, CH = 2200; // canvas, ~3.5 MP
const angle = (rand() - 0.5) * (hard ? 14 : 7);
const skewX = (rand() - 0.5) * (hard ? 0.12 : 0.06);
const skewY = (rand() - 0.5) * (hard ? 0.08 : 0.04);

const meta = await sharp(input).metadata();
const targetW = Math.round(CW * 0.62);
const targetH = Math.round((meta.height / meta.width) * targetW);
const paper = await sharp(input)
  .resize(targetW, targetH)
  .blur(hard ? 1.1 : 0.6)
  .affine([[1, skewX], [skewY, 1]], { background: "#00000000" })
  .rotate(angle, { background: "#00000000" })
  .ensureAlpha()
  .png()
  .toBuffer();
const pm = await sharp(paper).metadata();

// Desk + lighting: warm gradient with a diagonal shadow band over the paper.
const light = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.18"/>
      <stop offset="0.5" stop-color="#000" stop-opacity="0.00"/>
      <stop offset="1" stop-color="#000" stop-opacity="${hard ? 0.5 : 0.32}"/>
    </linearGradient>
    <radialGradient id="v" cx="0.5" cy="0.5" r="0.75">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.45"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <polygon points="${CW * 0.15},0 ${CW * 0.45},0 ${CW * 0.1},${CH} ${-CW * 0.2},${CH}" fill="#000" fill-opacity="${hard ? 0.22 : 0.12}"/>
  <rect width="100%" height="100%" fill="url(#v)"/>
</svg>`;

// Sensor noise: random gray tiles blended on top.
const noiseRaw = Buffer.alloc(CW * CH * 3);
for (let i = 0; i < noiseRaw.length; i++) noiseRaw[i] = 128 + Math.floor((rand() - 0.5) * (hard ? 60 : 34));
const noise = await sharp(noiseRaw, { raw: { width: CW, height: CH, channels: 3 } }).png().toBuffer();

await sharp({ create: { width: CW, height: CH, channels: 3, background: "#5b4a3a" } })
  .composite([
    { input: paper, left: Math.round((CW - pm.width) / 2), top: Math.round((CH - pm.height) / 2) },
    { input: Buffer.from(light) },
    { input: noise, blend: "overlay", opacity: 0.5 },
  ])
  .blur(0.5)
  .jpeg({ quality: hard ? 50 : 62 })
  .toFile(output);
console.log(`ok -> ${output} (rot ${angle.toFixed(1)} deg)`);

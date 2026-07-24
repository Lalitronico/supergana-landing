// Knock out a flat chroma-green backdrop from generated character art.
//
// Why this exists alongside strip-bg.mjs: the ML background remover in
// strip-bg.mjs segments by *subject*, which misfires on our palette — it read
// a light-blue lynx as backdrop and erased its colour while keeping a green
// blob behind the torso. When the generator is told to paint a flat chroma
// backdrop, a deterministic colour key is both more accurate and instant.
//
// Usage:
//   node scripts/chroma-key.mjs [--key=green|blue|magenta] <name> [more...]
//
// Pick a key colour the SUBJECT does not contain. Keying green out from behind
// a green dinosaur destroys the dinosaur — the test is hue overlap, not which
// colour is conventional. Blue is the safe default for our warm-toned cast.
//
// Backs up the untouched original to public/generated/_originals/<name>.png
// on first run and always re-keys from that backup, so re-running is safe.

import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const GEN_DIR = path.join(ROOT, "public", "generated");
const BACKUP_DIR = path.join(GEN_DIR, "_originals");

// A pixel is background when green clearly dominates both other channels.
// Generous margins: the generator's "flat" green still varies by a few points,
// and JPEG-ish ringing around the outline needs slack to disappear cleanly.
const DOMINANCE = 60; // how far G must exceed R and B
const FEATHER = 30; // width of the partial-alpha band, in dominance units

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

// Each key defines which channel must dominate the other two.
const KEYS = {
  green: { on: 1, against: [0, 2] },
  blue: { on: 2, against: [0, 1] },
  magenta: { on: -1, against: [] }, // handled specially: R and B both beat G
};

// Flatten a fully-keyed pixel's RGB toward grey so nothing bleeds on rescale.
function neutralise(raw, i, key) {
  const r = raw[i];
  const g = raw[i + 1];
  const b = raw[i + 2];
  if (key === "green") raw[i + 1] = Math.max(r, b);
  else if (key === "blue") raw[i + 2] = Math.max(r, g);
  else {
    raw[i] = g;
    raw[i + 2] = g;
  }
}

function dominanceFor(key, r, g, b) {
  if (key === "green") return g - Math.max(r, b);
  if (key === "blue") return b - Math.max(r, g);
  // magenta: both red and blue must clearly exceed green
  return Math.min(r, b) - g;
}

async function processOne(name, key) {
  const filePath = path.join(GEN_DIR, `${name}.png`);
  const backupPath = path.join(BACKUP_DIR, `${name}.png`);

  if (!(await exists(filePath))) {
    console.log(`  - skip ${name} (not found)`);
    return false;
  }

  if (!(await exists(backupPath))) {
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.copyFile(filePath, backupPath);
  }

  process.stdout.write(`  - ${name} ... `);
  const t0 = Date.now();

  const img = sharp(backupPath).ensureAlpha();
  const { width, height } = await img.metadata();
  const raw = await img.raw().toBuffer();

  let cleared = 0;
  for (let i = 0; i < raw.length; i += 4) {
    const r = raw[i];
    const g = raw[i + 1];
    const b = raw[i + 2];

    const dominance = dominanceFor(key, r, g, b);
    if (dominance <= 0) continue;

    if (dominance >= DOMINANCE) {
      raw[i + 3] = 0;
      // Neutralise the hidden colour too. A fully transparent pixel still
      // carries RGB, and browsers interpolate those values when scaling the
      // image — leaving the saturated key colour there paints a coloured
      // fringe around the artwork at any size other than 1:1.
      neutralise(raw, i, key);
      cleared += 1;
    } else if (dominance >= DOMINANCE - FEATHER) {
      // Edge pixels: fade out proportionally instead of leaving a hard fringe.
      const t = (dominance - (DOMINANCE - FEATHER)) / FEATHER;
      raw[i + 3] = Math.round(raw[i + 3] * (1 - t));
    }
  }

  await sharp(raw, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(filePath);

  const pct = ((cleared / (width * height)) * 100).toFixed(1);
  console.log(`done (${Date.now() - t0}ms, ${pct}% keyed out)`);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const keyArg = args.find((a) => a.startsWith("--key="));
  const key = keyArg ? keyArg.slice("--key=".length) : "green";
  const queue = args.filter((a) => !a.startsWith("--"));

  if (!queue.length || !(key in KEYS)) {
    console.error(
      "Usage: node scripts/chroma-key.mjs [--key=green|blue|magenta] <name> [name...]"
    );
    process.exit(1);
  }

  console.log(`Chroma-keying ${queue.length} asset(s) on ${key}...`);
  let ok = 0;
  let failed = 0;
  for (const name of queue) {
    try {
      if (await processOne(name, key)) ok += 1;
    } catch (err) {
      console.log("FAILED");
      console.error(`      ${err.message}`);
      failed += 1;
    }
  }
  console.log(`\nResult: ${ok} processed, ${failed} failed`);
  if (failed) process.exit(2);
}

main().catch((err) => { console.error(err); process.exit(1); });

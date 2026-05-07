// Strip baked-in background (the checker-grid pixels Nano Banana sometimes
// produces when asked for "transparent background") from generated PNG assets.
//
// Usage:
//   node scripts/strip-bg.mjs                # process all targets
//   node scripts/strip-bg.mjs <name1> <name2> # process specific files
//
// Saves processed file in-place after creating a backup at
// public/generated/_originals/<name>.png on first run.

import { removeBackground } from "@imgly/background-removal-node";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const GEN_DIR = path.join(ROOT, "public", "generated");
const BACKUP_DIR = path.join(GEN_DIR, "_originals");

// Assets that should have transparent backgrounds. Excludes the patterns
// (`pattern-field`, `pattern-halftone`) which are intentionally full-bleed.
const TARGETS = [
  "icon-whistle",
  "icon-ball",
  "icon-trophy",
  "icon-yellow-card",
  "icon-goal-net",
  "icon-megaphone",
  "ornament-confetti",
  "ornament-stars",
  "ornament-motion-lines",
  "kit-box",
  "stadium-silhouette",
  "pennants",
  "scribble-arrow",
];

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function ensureDir(d) {
  await fs.mkdir(d, { recursive: true });
}

async function processOne(name) {
  const filePath = path.join(GEN_DIR, `${name}.png`);
  const backupPath = path.join(BACKUP_DIR, `${name}.png`);

  if (!(await exists(filePath))) {
    console.log(`  - skip ${name} (not found)`);
    return false;
  }

  // Backup once, then always operate on original input to keep deterministic.
  if (!(await exists(backupPath))) {
    await fs.copyFile(filePath, backupPath);
  }

  const inputBytes = await fs.readFile(backupPath);
  // Library accepts Blob, ArrayBuffer, or URL.
  const blob = new Blob([inputBytes], { type: "image/png" });

  process.stdout.write(`  - ${name} ... `);
  const t0 = Date.now();
  const outBlob = await removeBackground(blob);
  const outBuf = Buffer.from(await outBlob.arrayBuffer());
  await fs.writeFile(filePath, outBuf);
  console.log(`done (${Date.now() - t0}ms, ${(outBuf.length / 1024).toFixed(0)}KB)`);
  return true;
}

async function main() {
  await ensureDir(BACKUP_DIR);
  const argTargets = process.argv.slice(2);
  const queue = argTargets.length ? argTargets : TARGETS;

  console.log(`Stripping background from ${queue.length} asset(s)...`);
  let ok = 0;
  let failed = 0;
  for (const name of queue) {
    try {
      if (await processOne(name)) ok += 1;
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

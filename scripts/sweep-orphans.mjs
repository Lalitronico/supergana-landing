/**
 * Runs the orphan sweep by hand, against the same endpoint the cron calls.
 *
 * Deliberately a thin client rather than a second implementation: a cleanup
 * script that deletes files using logic slightly different from the scheduled
 * one is how you end up deleting a live claim on a Tuesday.
 *
 *     node scripts/sweep-orphans.mjs                # local, dry run
 *     node scripts/sweep-orphans.mjs --delete       # local, really deletes
 *     node scripts/sweep-orphans.mjs --delete --url https://supergana.fun
 *
 * Needs CRON_SECRET in .env.local matching the target environment.
 */

import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : (args[i + 1] ?? true);
};

const base = flag("url") ?? "http://localhost:3000";
const dryRun = !args.includes("--delete");
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("Falta CRON_SECRET en .env.local. La ruta se niega a correr sin él,");
  console.error("a propósito: un endpoint que borra archivos no debe quedar abierto.");
  process.exit(1);
}

const url = `${base}/api/tickets/cron/sweep-orphans/${dryRun ? "?dryRun=1" : ""}`;
console.log(`${dryRun ? "SIMULACRO" : "BORRANDO DE VERDAD"} → ${url}\n`);

let res;
try {
  res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
} catch (error) {
  console.error(`No se pudo conectar a ${base}.`);
  console.error(base.includes("localhost") ? "¿Está corriendo `npm run dev`?" : error.message);
  process.exit(1);
}

const body = await res.json().catch(() => ({}));
if (!res.ok && res.status !== 207) {
  console.error(`HTTP ${res.status}:`, body);
  process.exit(1);
}

console.log(`objetos revisados : ${body.scanned}`);
console.log(`huérfanos         : ${body.orphans}`);
console.log(`  dentro de gracia: ${body.tooRecent} (menos de ${body.graceHours} h, se dejan)`);
console.log(`  eliminados      : ${body.deleted}`);
if (body.errors?.length) {
  console.log(`\nerrores:`);
  for (const e of body.errors) console.log(`  · ${e}`);
}
if (dryRun && body.orphans > body.tooRecent) {
  console.log(`\nCorre otra vez con --delete para eliminar ${body.orphans - body.tooRecent}.`);
}
process.exit(body.errors?.length ? 1 : 0);

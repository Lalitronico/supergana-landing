/**
 * Runs the whole attack suite in order and exits non-zero if anything gave.
 *
 *     node scripts/probes/run-all.mjs
 *
 * Order matters: `security` seeds the attacker and victim accounts that
 * `money-rpc` and `storage` then reuse, and `tenant` needs the victim's
 * receipt to aim at across campaigns. `concurrency` is self-contained.
 *
 * These write to the real project. Everything they create is namespaced
 * (`probe.*@supergana.fun`, `*@probe.invalid`, `probe-*` slugs) and torn down
 * afterwards, but do not point this at a campaign with live participants —
 * run it while the campaign is still in draft.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { purgeAccounts } from "./_shared.mjs";

const PROBES = [
  ["security", "aislamiento entre participantes: RLS, IDOR, escrituras"],
  ["money-rpc", "permisos de las funciones que crean recompensas"],
  ["tenant", "aislamiento entre marcas"],
  ["storage", "políticas del bucket privado"],
  ["concurrency", "integridad del dinero en carreras reales"],
  ["pickem-legal", "el consumo no mueve el ranking"],
  ["pickem-streak", "las dos implementaciones de la racha coinciden"],
];

const run = (name) =>
  new Promise((resolve) => {
    // fileURLToPath, not .pathname: on Windows the latter yields "/C:/Users/HP%20ZBOOK/…"
    // — a leading slash and percent-encoded spaces, neither of which resolves.
    const child = spawn(process.execPath, [fileURLToPath(new URL(`${name}.mjs`, import.meta.url))],
      { stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
  });

const failures = [];
for (const [name, what] of PROBES) {
  console.log(`\n${"█".repeat(76)}\n██ ${name} — ${what}\n${"█".repeat(76)}`);
  const code = await run(name);
  if (code !== 0) failures.push(name);
}

// Belt and braces: any probe that threw halfway leaves its accounts behind,
// and an orphaned probe account is indistinguishable from a real participant
// in a console screenshot.
const swept = await purgeAccounts((email) =>
  /@probe\.invalid$/.test(email) || /^probe\..*@supergana\.fun$/.test(email));

console.log(`\n${"=".repeat(76)}`);
console.log(failures.length
  ? `FALLARON: ${failures.join(", ")}`
  : "toda la batería pasó");
if (swept) console.log(`barrido final: ${swept} cuentas de prueba eliminadas`);
process.exit(failures.length ? 1 : 0);

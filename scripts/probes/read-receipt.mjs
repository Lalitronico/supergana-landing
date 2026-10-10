/**
 * Offline OCR + auto-approval gate, against the REAL `tanque` catalogue/config.
 *
 *   node --experimental-strip-types scripts/probes/read-receipt.mjs <img|dir>... [--manifest m.json] [--json out.json] [--concurrency 3] [--model qwen-...] [--as-of 2026-10-12]
 *
 * Reads (SELECT only) the campaign config and product aliases with the service
 * client, calls the same `extractReceipt` the app uses (Qwen via DashScope; it
 * spends tokens) and feeds the result through the same `decideAutomatically`.
 * Nothing is written to the database. With --manifest (written by
 * make-tanque-receipt.mjs --set) it also checks eligible/total/store/date
 * against what was printed.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { admin } from "./_shared.mjs";
import { extractReceipt } from "../../lib/tickets/ocr.ts";
import { decideAutomatically } from "../../lib/tickets/autoreview.ts";
import { parseCampaignConfig } from "../../lib/tickets/config.ts";
import { toMatchable } from "../../lib/tickets/matching.ts";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const flagValues = new Set(["--manifest", "--json", "--concurrency", "--model", "--as-of"].flatMap((f) => (args.includes(f) ? [args[args.indexOf(f) + 1]] : [])));
const inputs = args.filter((a) => !a.startsWith("--") && !flagValues.has(a));
const manifestPath = flag("--manifest");
const concurrency = Number(flag("--concurrency", 3));
// --as-of 2026-10-12 12:00: pretend "today" is Monday, so a receipt dated Sunday
// is past and not `future_date` (only affects the gate, never the API call).
const asOf = flag("--as-of");
if (asOf) {
  const RealDate = Date;
  const fixed = new RealDate(`${asOf}T18:00:00Z`).getTime();
  globalThis.Date = class extends RealDate {
    constructor(...a) { a.length ? super(...a) : super(fixed); }
    static now() { return fixed; }
  };
}
const modelOverride = flag("--model"); // try another model without touching the DB config

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const files = inputs.flatMap((p) =>
  statSync(p).isDirectory()
    ? readdirSync(p).filter((f) => MIME[extname(f).toLowerCase()]).sort().map((f) => join(p, f))
    : [p],
);
if (files.length === 0) {
  console.error("uso: read-receipt.mjs <imagen|carpeta>... [--manifest m.json]");
  process.exit(1);
}
const expected = manifestPath ? Object.fromEntries(JSON.parse(readFileSync(manifestPath, "utf8")).map((m) => [m.file, m])) : {};

const db = admin();
const { data: campaign, error } = await db.from("campaigns").select("id, config").eq("slug", "tanque").single();
if (error) throw error;
const config = parseCampaignConfig(campaign.config);
const { data: rows, error: pErr } = await db
  .from("products")
  .select("id, brand, name, product_aliases(alias_text)")
  .eq("campaign_id", campaign.id)
  .eq("active", true);
if (pErr) throw pErr;
const products = rows.map(toMatchable);

const runOne = async (file) => {
  const bytes = readFileSync(file);
  const t0 = performance.now();
  const extraction = await extractReceipt({
    bytes,
    contentType: MIME[extname(file).toLowerCase()],
    timezone: config.timezone,
    model: modelOverride ?? config.ocr.model,
  });
  const outcome = decideAutomatically({ extraction, config, products, eligibility: config.eligibility });
  const eligibleCents = outcome.action === "approve" ? outcome.capture.eligibleCents : null;
  const name = basename(file);
  const want = expected[name];
  const problems = [];
  if (want) {
    if (outcome.action !== "approve") problems.push("no_approve");
    if (eligibleCents !== Math.round(want.eligible * 100)) problems.push(`eligible(${eligibleCents} vs ${Math.round(want.eligible * 100)})`);
    if (extraction.totalCents !== Math.round(want.total * 100)) problems.push(`total(${extraction.totalCents} vs ${Math.round(want.total * 100)})`);
    if (extraction.purchaseDate !== want.date) problems.push(`date(${extraction.purchaseDate} vs ${want.date})`);
    if (outcome.action === "approve" && outcome.capture.storeName.toLowerCase() !== want.store.toLowerCase()) problems.push(`store(${outcome.capture.storeName})`);
  }
  return { name, ms: performance.now() - t0, extraction, outcome, eligibleCents, want, problems };
};

const results = [];
const queue = [...files];
await Promise.all(
  Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const file = queue.shift();
      const res = await runOne(file).catch((e) => ({ name: basename(file), crashed: String(e), problems: ["crash"] }));
      results.push(res);
    }
  }),
);
results.sort((a, b) => a.name.localeCompare(b.name));

for (const r of results) {
  if (r.crashed) {
    console.log(`\n== ${r.name}\n  CRASH: ${r.crashed}`);
    continue;
  }
  const { extraction: x, outcome: o } = r;
  console.log(`\n== ${r.name}  (${(r.ms / 1000).toFixed(1)} s, ${x.inputTokens ?? "?"}/${x.outputTokens ?? "?"} tok)`);
  console.log(`  status: ${x.status}${x.error ? " " + x.error : ""}  legible: ${x.legible}`);
  console.log(`  tienda: ${x.storeName} | sucursal: ${x.storeBranch}  fecha: ${x.purchaseDate} (${x.purchaseDateRaw}) ${x.purchaseTime ?? ""}`);
  console.log(`  total: ${x.totalPrinted} -> ${x.totalCents}  issues: [${x.issues.join(",")}]`);
  const matched = o.action === "approve" ? o.capture.items : [];
  for (const [i, l] of x.lines.entries()) {
    const it = matched[i];
    console.log(`    ${it && it.productId !== null || it?.aliasMatched ? "*" : " "} ${l.text} | q=${l.quantity} | ${l.amountPrinted}`);
  }
  console.log(`  elegible: ${r.eligibleCents === null ? "-" : (r.eligibleCents / 100).toFixed(2)}  pts: ${r.eligibleCents === null ? "-" : Math.floor(r.eligibleCents / 10)}`);
  console.log(`  decision: ${o.action}${o.reason ? " :: " + o.reason : ""}${r.problems.length ? "   PROBLEMAS: " + r.problems.join(" ") : ""}`);
}

const ok = results.filter((r) => !r.crashed && r.outcome.action === "approve" && r.problems.length === 0).length;
console.log(`\nRESUMEN: ${ok}/${results.length} approve${manifestPath ? " con valores exactos" : ""}`);
const jsonOut = flag("--json");
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 2));
process.exit(ok === results.length ? 0 : 2);

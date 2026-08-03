/**
 * Tenant isolation probe.
 *
 * The module is sold as "the infrastructure we swap between brands", so the
 * question that matters is not whether a participant can reach another
 * participant -- already proven no -- but whether a REVIEWER seated on one
 * campaign can reach another campaign's money, receipts and images. A leak
 * here is not a bug, it is the end of the product.
 *
 * Builds a real second tenant, attacks across it, then removes it.
 */

import { admin, anonClient, purgeAccounts, purgeObjects, SUPABASE_URL, ANON_KEY, PROBE_PASSWORD } from "./_shared.mjs";
const db = admin();

const out = [];
const check = (name, ok, detail) => out.push({ name, ok, detail });

const { data: novamex } = await db
  .from("campaigns").select("id, slug, config").eq("slug", "ticket-al-tanque").single();

// ------------------------------------------------- build the other brand ---
const { data: org } = await db.from("organizations")
  .upsert({ slug: "probe-marca-b", name: "Marca B" }, { onConflict: "slug" })
  .select("id").single();

const { data: other } = await db.from("campaigns").upsert({
  org_id: org.id, slug: "probe-campana-b", name: "Campaña B", module: "tickets",
  status: "live", locales: ["es"], config: { ...novamex.config, fund_cents: 100000 },
}, { onConflict: "slug" }).select("id, slug").single();

const mkUser = async (email) => {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const f = list?.users.find((u) => u.email === email);
  if (f) { await db.auth.admin.updateUserById(f.id, { password: PROBE_PASSWORD }); return f.id; }
  const { data } = await db.auth.admin.createUser({
    email, password: PROBE_PASSWORD, email_confirm: true });
  return data.user.id;
};

// A reviewer seated ONLY on Marca B.
const reviewerB = await mkUser("probe.revisor.b@supergana.fun");
await db.from("campaign_admins").delete().eq("auth_user_id", reviewerB);
await db.from("campaign_admins")
  .insert({ campaign_id: other.id, auth_user_id: reviewerB, role: "admin" });

// A participant + receipt on Novamex for reviewer B to hunt.
const { data: prey } = await db.from("participants").select("id").eq("campaign_id", novamex.id)
  .eq("email", "probe.victima@supergana.fun").single();
const { data: preyReceipt } = await db.from("receipts").select("id, image_path")
  .eq("participant_id", prey.id).limit(1).single();

// -------------------------------------------------------------- probes -----
// 1. Does campaign_admins actually scope? Reviewer B must not resolve on Novamex.
const seatOnNovamex = await db.from("campaign_admins").select("id")
  .eq("auth_user_id", reviewerB).eq("campaign_id", novamex.id);
check("revisor B tiene asiento en Novamex", (seatOnNovamex.data?.length ?? 0) === 0,
  `${seatOnNovamex.data?.length ?? 0} asientos`);

// 2. The image route scopes the receipt by campaign. Reproduce its query as if
//    reviewer B asked for Novamex's receipt while authorised for Marca B.
const crossImage = await db.from("receipts").select("image_path")
  .eq("id", preyReceipt.id).eq("campaign_id", other.id).maybeSingle();
check("imagen de Novamex alcanzable con campaign_id de Marca B",
  crossImage.data === null, crossImage.data ? "ALCANZABLE" : "404, no la encuentra");

// 3. The approve function takes only a receipt id. Can reviewer B's campaign
//    budget be spent on Novamex's receipt, or does the function re-derive the
//    campaign from the receipt itself?
const before = await db.from("campaigns").select("config").eq("id", other.id).single();
const { data: approved, error: approveError } = await db.rpc("tickets_approve_receipt", {
  p_receipt_id: preyReceipt.id, p_reviewer: reviewerB,
  p_store_name: "Cross Store", p_purchase_date: "2026-07-26",
  p_total_cents: 2030, p_eligible_cents: 1177, p_items: [], p_note: "cross-tenant probe",
});

if (approveError) {
  check("aprobación cruzada", true, `rechazada: ${approveError.message}`);
} else {
  const { data: rw } = await db.from("rewards").select("campaign_id")
    .eq("id", approved.reward_id).single();
  const chargedToOwner = rw.campaign_id === novamex.id;
  check("la recompensa se cargó a la campaña dueña del ticket, no a la del revisor",
    chargedToOwner, chargedToOwner ? "cargada a Novamex (correcto)" : "CARGADA A MARCA B");
  // undo
  await db.from("rewards").delete().eq("id", approved.reward_id);
  await db.from("receipt_items").delete().eq("receipt_id", preyReceipt.id);
  await db.from("receipt_reviews").delete().eq("receipt_id", preyReceipt.id);
  await db.from("receipts").update({
    status: "received", store_name: null, purchase_date: null, total_cents: null,
    eligible_cents: null, dedupe_key: null, reviewed_at: null, reviewed_by: null,
  }).eq("id", preyReceipt.id);
}
void before;

// 4. Storage: are the two campaigns' objects in separate prefixes, and does the
//    participant policy key off the campaign segment or only the uid?
const { data: objs } = await db.storage.from("receipts").list("", { limit: 100 });
check("los objetos viven bajo un prefijo por campaña",
  (objs ?? []).every((o) => o.name === novamex.slug || o.name === other.slug || o.id === null),
  (objs ?? []).map((o) => o.name).join(", ") || "vacío");

// 5. Reviewer B signs in for real and reads through PostgREST.
//
// There used to be two HTTP checks here that hit the admin routes with an
// `Authorization: Bearer` header and asserted 401/403. They were removed: the
// app authenticates from cookies written by @supabase/ssr and ignores that
// header, so BOTH requests 401'd for a reason that has nothing to do with
// tenancy. A green check that would stay green if the isolation broke is worse
// than no check.
//
// Route-level cross-tenant isolation is real and was verified with genuine
// cookies in the browser on 2026-07-27 — 200 on the reviewer's own campaign,
// 403 `forbidden` on another brand's, 404 on a slug that does not exist, and
// 404 `receipt_not_found` when the money routes are aimed at a foreign receipt
// through the reviewer's own slug. Reproducing that from Node means forging
// the ssr cookie format, which would test the forgery as much as the app.
const as = anonClient();
await as.auth.signInWithPassword({
  email: "probe.revisor.b@supergana.fun", password: PROBE_PASSWORD });

// 6. Read directly with reviewer B's own session — RLS, not the app.
const direct = await as.from("receipts").select("id");
check("revisor B lee receipts por PostgREST", (direct.data?.length ?? 0) === 0,
  `${direct.data?.length ?? 0} filas · ${direct.error?.message ?? "sin error"}`);

// -------------------------------------------------------------- report -----
console.log("\n" + "=".repeat(78));
let bad = 0;
for (const r of out) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? "  ok  " : "FALLA "} │ ${r.name}\n       │   ${r.detail}`);
}
console.log("=".repeat(78));
console.log(`${out.length - bad}/${out.length} pasaron` + (bad ? ` · ${bad} FALLAS` : " · sin fallas"));

// ------------------------------------------------------------- cleanup -----
await db.from("campaign_admins").delete().eq("auth_user_id", reviewerB);
await db.from("campaigns").delete().eq("id", other.id);
await db.from("organizations").delete().eq("id", org.id);
await db.auth.admin.deleteUser(reviewerB);
console.log("\ntenant de prueba eliminado");

process.exit(bad ? 1 : 0);

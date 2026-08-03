/**
 * Re-probe of the money path with the REAL signatures.
 *
 * The first pass called these with one argument and got "function not found",
 * which proves nothing about authorisation -- PostgREST cannot resolve an
 * overload that does not exist, so the call never reached a permission check.
 * These are the two functions that mint rewards; a vacuous pass here is worse
 * than a failure, because it reads as verified.
 */

import { admin, anonClient, purgeAccounts, purgeObjects, SUPABASE_URL, ANON_KEY, PROBE_PASSWORD } from "./_shared.mjs";
const db = admin();

const { data: victimReceipt } = await db
  .from("receipts").select("id, participant_id")
  .eq("image_path", (await db.from("receipts").select("image_path")
    .like("image_path", "%probe-victim%").single()).data.image_path).single();

const attackerAuth = (await db.auth.admin.listUsers({ perPage: 1000 })).data.users
  .find((u) => u.email === "probe.atacante@supergana.fun");

const PASS = PROBE_PASSWORD;
const as = anonClient();
await as.auth.signInWithPassword({ email: "probe.atacante@supergana.fun", password: PASS });
const anon = anonClient();

const APPROVE = {
  p_receipt_id: victimReceipt.id,
  p_reviewer: attackerAuth.id,
  p_store_name: "Probe Store",
  p_purchase_date: "2026-07-26",
  p_total_cents: 2030,
  p_eligible_cents: 1177,
  p_items: [],
  p_note: "probe",
};
const REVIEW = {
  p_receipt_id: victimReceipt.id,
  p_reviewer: attackerAuth.id,
  p_decision: "approved",
  p_reason: "probe",
};

const run = async (client, who, fn, args) => {
  const { data, error } = await client.rpc(fn, args);
  const denied = Boolean(error) && /permission denied|not find the function/i.test(error.message);
  console.log(`${denied ? "  ok  " : "FALLA "} │ ${who} → ${fn}`);
  console.log(`       │   ${error ? error.message : "SIN ERROR · devolvió " + JSON.stringify(data)}`);
  return denied;
};

let allDenied = true;
allDenied &= await run(as, "participante", "tickets_approve_receipt", APPROVE);
allDenied &= await run(anon, "anon", "tickets_approve_receipt", APPROVE);
allDenied &= await run(as, "participante", "tickets_review_receipt", REVIEW);
allDenied &= await run(anon, "anon", "tickets_review_receipt", REVIEW);

// Sanity: the same call with the service role must actually work, otherwise
// "denied" above could just mean the arguments are wrong for everybody.
const { data: ok, error: okError } = await db.rpc("tickets_approve_receipt", APPROVE);
console.log(`\ncontrol · service_role → tickets_approve_receipt`);
console.log(`       │   ${okError ? "ERROR " + okError.message : "ejecutó · " + JSON.stringify(ok)}`);
console.log(
  okError
    ? "       │   (si esto falla por argumentos, las pruebas de arriba no valen)"
    : "       │   la firma es correcta, así que los rechazos de arriba son de permisos",
);

// Undo whatever the control call did -- this is a real campaign row.
await db.from("rewards").delete().eq("receipt_id", victimReceipt.id);
await db.from("receipt_items").delete().eq("receipt_id", victimReceipt.id);
await db.from("receipt_reviews").delete().eq("receipt_id", victimReceipt.id);
await db.from("receipts").update({
  status: "received", store_name: null, purchase_date: null, total_cents: null,
  eligible_cents: null, dedupe_key: null, reviewed_at: null, reviewed_by: null,
}).eq("id", victimReceipt.id);
console.log("\ncontrol revertido");

// The whole point of this probe: if either role ever gains EXECUTE on the
// functions that mint rewards, this has to fail loudly instead of printing
// and exiting clean.
if (!allDenied) console.error("\nFALLA: alguna función del dinero quedó ejecutable");
process.exit(allDenied ? 0 : 1);

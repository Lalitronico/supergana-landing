/**
 * Active security probe for the tickets module.
 *
 * Not a code review: this signs in as a real participant and tries to reach
 * another participant's data through PostgREST and Storage directly, bypassing
 * the app entirely. That is the boundary that matters -- if RLS holds, no bug
 * in a route handler can leak one participant's receipt to another.
 *
 * Accounts are created with passwords so sign-in never touches the email
 * sender; the project's budget is 2 messages an hour and this would eat it.
 */

import { admin, anonClient, purgeAccounts, purgeObjects, SUPABASE_URL, ANON_KEY, PROBE_PASSWORD } from "./_shared.mjs";
const db = admin();

const results = [];
const check = (name, expectation, ok, detail = "") =>
  results.push({ name, expectation, ok, detail });

// ---------------------------------------------------------------- setup ----
const PASS = "Pr0be!" + Math.abs(Number(process.argv[2] ?? 7)) + "xQz";
const mk = async (email) => {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const found = list?.users.find((u) => u.email === email);
  if (found) {
    await db.auth.admin.updateUserById(found.id, { password: PASS, email_confirm: true });
    return found.id;
  }
  const { data, error } = await db.auth.admin.createUser({
    email, password: PASS, email_confirm: true,
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
};

const { data: campaign } = await db
  .from("campaigns").select("id, slug").eq("slug", "ticket-al-tanque").single();

const attackerId = await mk("probe.atacante@supergana.fun");
const victimId = await mk("probe.victima@supergana.fun");

const upsertParticipant = async (authId, email, last, zip) => {
  const { data, error } = await db.from("participants").upsert({
    campaign_id: campaign.id, auth_user_id: authId, email,
    first_name: "Probe", last_name: last, zip, state: "TX", locale: "es",
  }, { onConflict: "campaign_id,auth_user_id" }).select("id").single();
  if (error) throw new Error(`participant ${email}: ${error.message}`);
  return data.id;
};

const attacker = await upsertParticipant(attackerId, "probe.atacante@supergana.fun", "Atacante", "79930");
const victim = await upsertParticipant(victimId, "probe.victima@supergana.fun", "Victima", "79931");

// A receipt + object + reward belonging to the victim, for the attacker to hunt.
const victimObject = `${campaign.slug}/${victimId}/probe-victim.jpg`;
await db.storage.from("receipts").upload(
  victimObject, Buffer.from("victim receipt bytes"), { contentType: "image/jpeg", upsert: true },
);
await db.from("receipts").delete().eq("participant_id", victim);
const { data: victimReceipt } = await db.from("receipts").insert({
  campaign_id: campaign.id, participant_id: victim, status: "received",
  image_path: victimObject, image_hash: "probe" + "0".repeat(59),
}).select("id").single();
await db.from("consents").insert({
  participant_id: victim, kind: "official_rules", version: "probe", accepted: true,
});

// --------------------------------------------------- attacker's session ----
const as = anonClient();
const { data: signIn, error: signInError } = await as.auth.signInWithPassword({
  email: "probe.atacante@supergana.fun", password: PASS,
});
if (signInError) throw new Error(`sign-in: ${signInError.message}`);
check("Sesión de participante se crea", "ok", Boolean(signIn.session), signIn.user.id);

const anon = anonClient();

// ------------------------------------------------------------- reads -------
const readable = async (client, table, label) => {
  const { data, error } = await client.from(table).select("*");
  return { rows: data?.length ?? 0, error: error?.message ?? null, label };
};

for (const table of ["campaigns", "organizations", "campaign_admins", "products",
                     "product_aliases", "receipt_reviews", "participants",
                     "consents", "receipts", "receipt_items", "rewards"]) {
  const a = await readable(anon, table);
  check(`anon lee ${table}`, "0 filas", a.rows === 0, `${a.rows} filas${a.error ? " · " + a.error : ""}`);
}

// The attacker should see ONLY their own rows, never the victim's.
const own = await as.from("participants").select("id, email, last_name");
check(
  "participante lee participants",
  "solo su propia fila",
  own.data?.length === 1 && own.data[0].id === attacker,
  `${own.data?.length ?? 0} filas: ${JSON.stringify(own.data?.map((r) => r.email))}`,
);

const hunt = await as.from("participants").select("id, email").eq("id", victim);
check("participante busca a la víctima por id", "0 filas", (hunt.data?.length ?? 0) === 0,
  `${hunt.data?.length ?? 0} filas`);

const rcpt = await as.from("receipts").select("id, image_path, participant_id");
check("participante lee receipts", "ninguno de la víctima",
  !(rcpt.data ?? []).some((r) => r.participant_id === victim),
  `${rcpt.data?.length ?? 0} filas`);

const cns = await as.from("consents").select("id, participant_id");
check("participante lee consents", "ninguno de la víctima",
  !(cns.data ?? []).some((r) => r.participant_id === victim),
  `${cns.data?.length ?? 0} filas`);

const rws = await as.from("rewards").select("id, participant_id, amount_cents");
check("participante lee rewards", "ninguno de la víctima",
  !(rws.data ?? []).some((r) => r.participant_id === victim),
  `${rws.data?.length ?? 0} filas`);

for (const table of ["campaigns", "products", "product_aliases", "campaign_admins", "receipt_reviews"]) {
  const r = await readable(as, table);
  check(`participante lee ${table}`, "0 filas", r.rows === 0, `${r.rows} filas`);
}

// ------------------------------------------------------------ writes -------
const w = [];
w.push(["editar su propio perfil", await as.from("participants")
  .update({ zip: "00000" }).eq("id", attacker).select()]);
w.push(["editar el perfil de la víctima", await as.from("participants")
  .update({ zip: "00000" }).eq("id", victim).select()]);
w.push(["aprobar su propio ticket", await as.from("receipts")
  .update({ status: "approved", eligible_cents: 999999 }).eq("participant_id", attacker).select()]);
w.push(["aprobar el ticket de la víctima", await as.from("receipts")
  .update({ status: "approved" }).eq("id", victimReceipt.id).select()]);
w.push(["insertar un ticket a mano", await as.from("receipts")
  .insert({ campaign_id: campaign.id, participant_id: attacker, status: "approved",
            image_path: "x", image_hash: "z".repeat(64), eligible_cents: 999999 }).select()]);
w.push(["regalarse una recompensa", await as.from("rewards")
  .insert({ campaign_id: campaign.id, participant_id: attacker, amount_cents: 500000,
            status: "sent" }).select()]);
w.push(["borrar el ticket de la víctima", await as.from("receipts")
  .delete().eq("id", victimReceipt.id).select()]);
w.push(["darse un asiento de admin", await as.from("campaign_admins")
  .insert({ campaign_id: campaign.id, auth_user_id: attackerId, role: "admin" }).select()]);
w.push(["subir el fondo de la campaña", await as.from("campaigns")
  .update({ status: "live" }).eq("id", campaign.id).select()]);

for (const [name, res] of w) {
  const wrote = (res.data?.length ?? 0) > 0;
  check(name, "rechazado", !wrote, wrote ? "ESCRIBIÓ" : (res.error?.message ?? "0 filas afectadas"));
}

// -------------------------------------------------------------- RPCs -------
for (const fn of ["tickets_approve_receipt", "tickets_review_receipt"]) {
  const { error } = await as.rpc(fn, { p_receipt_id: victimReceipt.id });
  check(`participante llama ${fn}`, "denegado", Boolean(error), error?.message ?? "SIN ERROR");
  const { error: anonError } = await anon.rpc(fn, { p_receipt_id: victimReceipt.id });
  check(`anon llama ${fn}`, "denegado", Boolean(anonError), anonError?.message ?? "SIN ERROR");
}

// ------------------------------------------------------------ storage ------
const st = as.storage.from("receipts");

const dl = await st.download(victimObject);
check("participante baja la imagen de la víctima", "denegado", Boolean(dl.error),
  dl.error?.message ?? `BAJÓ ${(await dl.data?.arrayBuffer())?.byteLength} bytes`);

const intoVictim = await st.upload(
  `${campaign.slug}/${victimId}/injected.jpg`, Buffer.from("x"), { contentType: "image/jpeg" });
check("participante escribe en la carpeta de la víctima", "denegado", Boolean(intoVictim.error),
  intoVictim.error?.message ?? "ESCRIBIÓ");

const intoOwn = await st.upload(
  `${campaign.slug}/${attackerId}/mine-${Date.now() % 100000}.jpg`,
  Buffer.from("mine"), { contentType: "image/jpeg" });
check("participante escribe en su propia carpeta", "permitido", !intoOwn.error,
  intoOwn.error?.message ?? intoOwn.data?.path);

if (intoOwn.data?.path) {
  const rm = await st.remove([intoOwn.data.path]);
  const removed = (rm.data?.length ?? 0) > 0;
  check("participante borra su propia imagen", "denegado (ticket en revisión no debe desaparecer)",
    !removed, removed ? "BORRÓ" : (rm.error?.message ?? "0 objetos borrados"));
}

const listed = await st.list(`${campaign.slug}/${victimId}`);
check("participante lista la carpeta de la víctima", "vacía o denegada",
  (listed.data?.length ?? 0) === 0, `${listed.data?.length ?? 0} objetos`);

const anonDl = await anon.storage.from("receipts").download(victimObject);
check("anon baja una imagen", "denegado", Boolean(anonDl.error), anonDl.error?.message ?? "BAJÓ");

// ------------------------------------------------------------- report ------
console.log("\n" + "=".repeat(78));
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "  ok  " : "FALLA "} │ ${r.name}`);
  console.log(`       │   esperado: ${r.expectation} · obtenido: ${r.detail}`);
}
console.log("=".repeat(78));
console.log(`${results.length - failed}/${results.length} pasaron` + (failed ? ` · ${failed} FALLAS` : " · sin fallas"));

// Non-zero exit so run-all.mjs can tell a real failure from a noisy pass.
process.exit(failed ? 1 : 0);

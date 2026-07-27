/**
 * Storage policy edge: `receipts_upload_own_folder` checks only
 * foldername(name)[2] = auth.uid(). The first segment -- the campaign -- is
 * never checked, and nothing bounds how many objects one account may write.
 *
 * Question this answers: can a signed-in account write outside the campaign it
 * belongs to, and can it keep writing without the app ever knowing?
 */

import { admin, anonClient, purgeAccounts, purgeObjects, SUPABASE_URL, ANON_KEY, PROBE_PASSWORD } from "./_shared.mjs";
const db = admin();

const as = anonClient();
const { data: s, error: e } = await as.auth.signInWithPassword({
  email: "probe.atacante@supergana.fun", password: PROBE_PASSWORD });
if (e) throw new Error(e.message);
const uid = s.user.id;
const st = as.storage.from("receipts");
const written = [];

const tryWrite = async (label, path, bytes = 32) => {
  const { data, error } = await st.upload(path, Buffer.alloc(bytes, 7), {
    contentType: "image/jpeg", upsert: true });
  const ok = !error;
  if (ok) written.push(data.path);
  console.log(`${ok ? "ESCRIBIÓ" : "bloqueó "} │ ${label}`);
  console.log(`         │   ${path}`);
  if (error) console.log(`         │   ${error.message}`);
  return ok;
};

console.log("— prefijo de campaña —");
await tryWrite("campaña a la que sí pertenece", `ticket-al-tanque/${uid}/a.jpg`);
await tryWrite("campaña de OTRA marca", `probe-campana-b/${uid}/a.jpg`);
await tryWrite("campaña que no existe", `campana-inventada/${uid}/a.jpg`);
await tryWrite("prefijo arbitrario", `../../etc/${uid}/a.jpg`);
await tryWrite("sin prefijo de campaña", `${uid}/a.jpg`);

console.log("\n— volumen: ¿algo lo detiene? —");
let n = 0;
for (let i = 0; i < 8; i++) {
  const { error } = await st.upload(`ticket-al-tanque/${uid}/flood-${i}.jpg`,
    Buffer.alloc(256 * 1024, 3), { contentType: "image/jpeg", upsert: true });
  if (error) { console.log(`  se detuvo en el objeto ${i}: ${error.message}`); break; }
  written.push(`ticket-al-tanque/${uid}/flood-${i}.jpg`);
  n++;
}
console.log(`  escribió ${n} objetos de 256 KB seguidos sin que nada los frenara`);

const oversize = await st.upload(`ticket-al-tanque/${uid}/huge.jpg`,
  Buffer.alloc(11 * 1024 * 1024, 1), { contentType: "image/jpeg", upsert: true });
console.log(`  archivo de 11 MB (tope del bucket 10 MB): ${oversize.error ? "bloqueado · " + oversize.error.message : "ESCRIBIÓ"}`);
if (!oversize.error) written.push(`ticket-al-tanque/${uid}/huge.jpg`);

const badType = await st.upload(`ticket-al-tanque/${uid}/script.html`,
  Buffer.from("<script>alert(1)</script>"), { contentType: "text/html", upsert: true });
console.log(`  subir text/html: ${badType.error ? "bloqueado · " + badType.error.message : "ESCRIBIÓ"}`);
if (!badType.error) written.push(`ticket-al-tanque/${uid}/script.html`);

console.log(`\n— ¿la app se entera? —`);
const { count } = await db.from("receipts").select("id", { count: "exact", head: true })
  .in("image_path", written);
console.log(`  ${written.length} objetos escritos, ${count ?? 0} tienen fila en receipts`);

// Clean every object this probe created; participants have no delete policy,
// so only the service role can.
if (written.length) {
  const { error } = await db.storage.from("receipts").remove(written);
  console.log(`\nlimpieza: ${error ? "FALLÓ " + error.message : written.length + " objetos eliminados"}`);
}

// Only the campaign this account actually joined may be written to. Anything
// else getting through is precisely the hole migrations 0008/0009 closed.
const leaked = written.filter((path) => !path.startsWith("ticket-al-tanque/"));
if (leaked.length) {
  console.error(`\nFALLA: escribió fuera de su campaña -> ${leaked.join(", ")}`);
  process.exit(1);
}
console.log("\nsin escrituras fuera de la campaña propia");
process.exit(0);

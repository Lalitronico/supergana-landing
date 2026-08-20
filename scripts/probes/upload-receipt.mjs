/**
 * Sube un ticket como lo haría el navegador del participante, sin un teléfono.
 *
 *   node scripts/probes/upload-receipt.mjs <archivo.jpg> <telefono> [slug] [origen]
 *   node scripts/probes/upload-receipt.mjs ticket.jpg +526561112233 carrera-alaska
 *
 * Existe para poder ejercer la cadena completa —subida → OCR → compuerta→ y ver
 * el resultado en la vista de Lecturas, sin gastar un mensaje de WhatsApp ni
 * depender de que alguien tenga el celular a mano. Sólo sirve en campañas cuyo
 * canal de identidad es el teléfono (0030): la cuenta se deriva del número.
 *
 * Hace exactamente lo que hace el navegador y en el mismo orden: primero el
 * objeto directo a Storage con el token DEL PARTICIPANTE —la política del
 * bucket exige que el segundo segmento de la ruta sea su propio uid— y sólo
 * después el POST que registra el recibo. Al revés no se puede: el servidor lee
 * el objeto de vuelta para hashearlo.
 *
 * Ojo con el candado anti-duplicado (tienda | fecha | total): dos tickets del
 * mismo día, la misma tienda y el mismo total son uno solo. Usa un total
 * distinto en cada prueba — `make-alaska-receipt.mjs` lo toma por argumento.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync("C:/Users/HP ZBOOK/Desktop/Quiniela Claude/supergana/.env.local","utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const [, , file, phone, slug = "carrera-alaska", base = "http://localhost:3001"] = process.argv;
if (!file || !phone) {
  console.error("uso: node scripts/probes/upload-receipt.mjs <archivo> <telefono> [slug] [origen]");
  process.exit(1);
}
const SLUG = slug;
const BASE = base;

// La sesión: la acuñamos igual que la ruta, para no depender de un cookie jar.
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const email = `${phone.replace(/^\+/, "")}@wa.supergana.fun`;
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } });
const { data: sess, error: verr } = await anon.auth.verifyOtp({
  token_hash: link.properties.hashed_token, type: "magiclink" });
if (verr) { console.error("no se pudo abrir sesión:", verr.message); process.exit(1); }
const token = sess.session.access_token;
const uid = sess.user.id;

// 1) El objeto, con el token del participante — la política de Storage exige
//    que el segundo segmento sea su propio uid.
const path = `${SLUG}/${uid}/${crypto.randomUUID()}.jpg`;
const bytes = readFileSync(file);
const up = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/receipts/${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" },
  body: bytes,
});
if (!up.ok) { console.error("storage:", up.status, await up.text()); process.exit(1); }
console.log("objeto subido:", path);

// 2) El registro, con la cookie de sesión que el proxy espera.
const cookie = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]}-auth-token=base64-${Buffer.from(JSON.stringify(sess.session)).toString("base64url")}`;
const res = await fetch(`${BASE}/api/tickets/${SLUG}/receipts/`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ imagePath: path, contentType: "image/jpeg" }),
});
console.log("POST /receipts ->", res.status, await res.text());

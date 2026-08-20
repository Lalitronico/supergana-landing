/**
 * ¿Aguanta `generateLink` el ritmo de un login, o cuenta contra el tope de
 * correo del proyecto (2/hora en Free, sin SMTP propio)?
 *
 * Es el único supuesto sin verificar del diseño de identidad por teléfono. Si
 * las seis acuñaciones pasan, `createUser` + `generateLink` + `verifyOtp` es el
 * camino. Si aparece `over_email_send_rate_limit`, hay que cambiar a contraseña
 * derivada antes de escribir una sola pantalla.
 *
 *   node scripts/probes/session-mint.mjs
 *
 * Deja seis cuentas de prueba en auth.users con el dominio de sondeo; las borra
 * al final salvo que se pase --keep.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
// Cliente anónimo aparte: `verifyOtp` tiene que correr con la llave publicable,
// que es la que en la app lleva el cliente con cookies.
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Dominio de sondeo, NO el de producción: estas cuentas se borran.
const email = (i) => `52999000${String(i).padStart(4, "0")}@probe.supergana.fun`;
const keep = process.argv.includes("--keep");
const ids = [];
let failed = false;

for (let i = 1; i <= 6; i++) {
  const addr = email(i);
  const t0 = Date.now();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: addr,
    email_confirm: true,
  });
  if (createErr && !/already been registered|already exists/i.test(createErr.message)) {
    console.error(`${i}. createUser FALLÓ: ${createErr.message}`);
    failed = true;
    break;
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: addr,
  });
  if (linkErr) {
    console.error(`${i}. generateLink FALLÓ: ${linkErr.message} (status ${linkErr.status ?? "?"})`);
    if (/rate|limit/i.test(linkErr.message)) {
      console.error("\n>>> TOPE DE CORREO. Cambiar a contraseña derivada (plan B).");
    }
    failed = true;
    break;
  }

  const uid = link.user?.id ?? created?.user?.id;
  if (uid) ids.push(uid);

  // Lo que hará la ruta: canjear el token por una sesión de verdad.
  const { data: session, error: verifyErr } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyErr || !session?.session) {
    console.error(`${i}. verifyOtp FALLÓ: ${verifyErr?.message ?? "sin sesión"}`);
    failed = true;
    break;
  }

  const sameUser = session.user?.id === uid;
  console.log(
    `${i}. ok  ${Date.now() - t0}ms  uid=${uid?.slice(0, 8)}  ` +
      `uid de generateLink=${link.user?.id ? "sí" : "NO"}  sesión del mismo uid=${sameUser ? "sí" : "NO"}`,
  );
}

if (!keep) {
  for (const id of ids) await admin.auth.admin.deleteUser(id);
  console.log(`\nlimpieza: ${ids.length} cuentas de sondeo borradas`);
}
console.log(failed ? "\nRESULTADO: generateLink NO sirve — usar plan B." : "\nRESULTADO: generateLink aguanta. Camino principal confirmado.");
process.exit(failed ? 1 : 0);

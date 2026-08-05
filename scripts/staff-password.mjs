/**
 * Sets the console password for a staff account, and optionally seats them.
 *
 *   node scripts/staff-password.mjs <email> [password] [--admin <slug>] [--role <role>]
 *   node scripts/staff-password.mjs jefe@cliente.com --admin carrera-alaska --role reviewer
 *
 * Omit the password and one is generated and printed. Give one and it is used
 * verbatim — Supabase's own minimum is 6 characters, and this refuses under 8.
 *
 * Why this exists: the console signs in with a password now, but the self-serve
 * ways of getting one are both out. `recuperar` sends its link to the project's
 * Site URL, which still points at localhost, and the built-in sender caps at
 * two mails an hour across the whole project. Until that config is fixed,
 * somebody with the service role has to hand the credential over out of band.
 *
 * Fix the Site URL and add real SMTP and this script becomes a convenience
 * rather than the only door. Delete it then.
 *
 * The password is printed to this terminal and nowhere else — it is not stored,
 * logged, or mailed. Pass it on however you would pass on any other secret.
 */

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : (argv[i + 1] ?? null);
};
// Everything that is not a flag or a flag's value, in order: email, password.
const positional = argv.filter((value, i) => {
  if (value.startsWith("--")) return false;
  return !(i > 0 && argv[i - 1].startsWith("--"));
});

const [email, given] = positional;
const adminSlug = flag("admin");
const role = flag("role") ?? "admin";

if (!email) {
  console.error(
    "uso: node scripts/staff-password.mjs <email> [password] [--admin <slug>] [--role <role>]",
  );
  process.exit(1);
}
if (given && given.length < 8) {
  console.error("la contraseña necesita al menos 8 caracteres");
  process.exit(1);
}

// base64url: no quoting hazards in a shell, no characters that look like other
// characters when read aloud over the phone.
const password = given ?? randomBytes(12).toString("base64url");

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
if (listError) {
  console.error("no se pudo leer la lista de cuentas:", listError.message);
  process.exit(1);
}

let user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;

if (!user) {
  // email_confirm: true — the console is not a place to wait on a mail that
  // this project cannot reliably send.
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    console.error("no se pudo crear la cuenta:", createError.message);
    process.exit(1);
  }
  user = created.user;
  console.log(`cuenta creada: ${user.id}`);
} else {
  const { error: updateError } = await db.auth.admin.updateUserById(user.id, { password });
  if (updateError) {
    console.error("no se pudo fijar la contraseña:", updateError.message);
    process.exit(1);
  }
  console.log(`cuenta existente: ${user.id}`);
}

if (adminSlug) {
  const { data: campaign } = await db
    .from("campaigns")
    .select("id")
    .eq("slug", adminSlug)
    .maybeSingle();

  if (!campaign) {
    console.error(`no existe la campaña ${adminSlug}`);
    process.exit(1);
  }
  // Being in auth.users authorises nothing on its own; the seat is the grant.
  const { error: seatError } = await db
    .from("campaign_admins")
    .upsert(
      { campaign_id: campaign.id, auth_user_id: user.id, role },
      { onConflict: "campaign_id,auth_user_id" },
    );
  if (seatError) {
    console.error("no se pudo dar el asiento:", seatError.message);
    process.exit(1);
  }
  console.log(`asiento en ${adminSlug} con rol ${role}`);
}

console.log(`\ncorreo:      ${email}`);
console.log(`contraseña:  ${password}`);
console.log("\nEntra en /admin/<campaña>/ con esos dos datos. No se guarda en ningún lado.");

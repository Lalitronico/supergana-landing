/**
 * Prints a sign-in code for the tickets module without sending any email.
 *
 * Login is email OTP and Supabase is the one that sends it, so until the
 * project has its own SMTP the built-in sender caps out at a handful of
 * messages an hour. This is the operational path: create the account with the
 * service role and read back the same code the email would have carried.
 *
 *   node scripts/tickets-otp.mjs alguien@correo.com
 *   node scripts/tickets-otp.mjs alguien@correo.com --admin ticket-al-tanque
 *
 * With --admin the account also gets a seat in `campaign_admins`, which is
 * what the console checks. Being in auth.users authorises nothing on its own.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// The script runs outside Next, so nothing has loaded .env.local for us.
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const [email, ...rest] = process.argv.slice(2);
if (!email) {
  console.error("uso: node scripts/tickets-otp.mjs <email> [--admin <campaign-slug>] [--role <role>]");
  process.exit(1);
}

const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? null : (rest[i + 1] ?? true);
};
const adminSlug = flag("admin");
const role = flag("role") ?? "admin";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// createUser fails if the address is already registered, which is the common
// case on a second run — fall back to looking it up rather than erroring out.
let { data: created, error: createError } = await db.auth.admin.createUser({
  email,
  email_confirm: true,
});

let user = created?.user ?? null;
if (!user) {
  if (!/already been registered|already exists/i.test(createError?.message ?? "")) {
    console.error("no se pudo crear la cuenta:", createError?.message);
    process.exit(1);
  }
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  user = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  if (!user) {
    console.error("la cuenta existe pero no aparece en listUsers");
    process.exit(1);
  }
  console.log(`cuenta existente: ${user.id}`);
} else {
  console.log(`cuenta creada: ${user.id}`);
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

// generateLink is what mints the OTP; the link it returns comes back through
// the implicit flow, so the code is the half worth using here.
const { data: link, error: linkError } = await db.auth.admin.generateLink({
  type: "magiclink",
  email,
});

if (linkError) {
  console.error("no se pudo generar el código:", linkError.message);
  process.exit(1);
}

console.log(`\ncódigo de acceso: ${link.properties.email_otp}`);
console.log("(un solo uso; vuelve a correr el script para otro)");

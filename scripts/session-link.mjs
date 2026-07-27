/**
 * Mints a fragment link that HashSession adopts, without sending mail.
 * Same implicit-flow shape generateLink returns, so it exercises the app's
 * own supported path rather than a side door.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const email = process.argv[2], dest = process.argv[3] ?? "/c/ticket-al-tanque/panel/";
const PASS = "Sess!" + Math.floor(Date.now() / 86400000) + "xQz";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const u = list.users.find(x => x.email === email);
if (!u) { console.error("no existe", email); process.exit(1); }
await admin.auth.admin.updateUserById(u.id, { password: PASS });
const cli = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { data, error } = await cli.auth.signInWithPassword({ email, password: PASS });
if (error) { console.error(error.message); process.exit(1); }
console.log(`http://localhost:3000${dest}#access_token=${data.session.access_token}&refresh_token=${data.session.refresh_token}&type=magiclink`);

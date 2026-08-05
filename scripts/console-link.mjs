/**
 * Mints a console sign-in link for any origin, without SMTP and without
 * touching the account's password.
 *
 *   node scripts/console-link.mjs <email> [campaign-slug] [origin]
 *   node scripts/console-link.mjs edu@ejemplo.com carrera-alaska https://supergana.fun
 *
 * The campaign is named by slug rather than by path on purpose: Git Bash on
 * Windows rewrites any argument that starts with `/` into a drive path, and
 * `/admin/carrera-alaska/` came back as `C:/Program Files/Git/admin/...`.
 * A slug has no leading slash and survives every shell.
 *
 * Why this exists, next to session-link.mjs:
 *
 * The console signs in with an email OTP and nothing else — SignInGate has no
 * field for a code you already hold, so a code minted out of band (the way
 * tickets-otp.mjs prints one) cannot be used there. Its only button asks
 * Supabase to send a fresh one, which both invalidates the previous code and
 * spends one of the built-in sender's two messages an hour.
 *
 * And the link in that mail lands on the project's Site URL, which is still
 * localhost: an operator on a phone or on a laptop away from a dev server has
 * no way in at all. Fixing the Site URL and the redirect allowlist in the
 * Supabase dashboard is the real repair; this is the operational path until
 * then, and stays useful afterwards for anyone who cannot wait on a mail.
 *
 * generateLink mints the OTP; redeeming it here rather than in a browser turns
 * it into the implicit-flow fragment HashSession already knows how to adopt,
 * so the link exercises the app's supported path. The password is left alone —
 * that is the difference from session-link.mjs, which signs in with one and so
 * has to overwrite it first.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// The script runs outside Next, so nothing has loaded .env.local for us.
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const [email, slug = "carrera-alaska", origin = "https://supergana.fun"] =
  process.argv.slice(2);

if (!email) {
  console.error("uso: node scripts/console-link.mjs <email> [campaign-slug] [origen]");
  process.exit(1);
}

const dest = `/admin/${slug}/`;

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: link, error: linkError } = await db.auth.admin.generateLink({
  type: "magiclink",
  email,
});

if (linkError) {
  console.error("no se pudo generar el enlace:", linkError.message);
  process.exit(1);
}

// Redeem it here. `redirect: manual` matters: following the redirect would send
// the tokens to whatever the project's Site URL says (localhost today) and lose
// them. The fragment we want is in the Location header.
const verify = await fetch(link.properties.action_link, { redirect: "manual" });
const location = verify.headers.get("location");

if (!location || !location.includes("access_token")) {
  console.error("el canje no devolvió una sesión. Location:", location ?? "(sin header)");
  console.error("¿la cuenta existe y está confirmada?");
  process.exit(1);
}

// Everything after the '#' is the session, whatever host the redirect chose.
const fragment = location.slice(location.indexOf("#") + 1);
const params = new URLSearchParams(fragment);

console.log(
  `\n${origin}${dest}#access_token=${params.get("access_token")}` +
    `&refresh_token=${params.get("refresh_token")}&type=magiclink\n`,
);
console.log("Ábrelo una sola vez. El access token dura una hora y el cliente");
console.log("lo renueva solo mientras la pestaña siga viva.");

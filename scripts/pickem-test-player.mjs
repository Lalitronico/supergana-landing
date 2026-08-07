/**
 * Puts a verified pick'em player on the screen, without WhatsApp.
 *
 *   node scripts/pickem-test-player.mjs [slug] [alias] [telefono]
 *   node scripts/pickem-test-player.mjs chapa-pickem-2026 Probador 6560000001
 *
 * Prints a link. Open it, let the page adopt the session from the fragment,
 * then navigate to the programme.
 *
 * WHY THE LINK POINTS AT THE TICKETS ROUTE. `HashSession` is mounted in the
 * tickets layout, and the auth cookie it writes is per-origin — so adopting the
 * session there and then walking over to /p/... works, and the pick'em layout
 * does not have to carry a component it only needs for testing. Production
 * pick'em sessions are anonymous ones created by opening the page; this is a
 * side door for development and deliberately not a path the product uses.
 *
 * It creates, in order: an auth user, a participant with its phone already
 * stamped verified, and the device row that ties the two together. Running it
 * again with the same phone reuses all three.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const SLUG = process.argv[2] ?? "chapa-pickem-2026";
const ALIAS = process.argv[3] ?? "Probador";
const RAW_PHONE = process.argv[4] ?? "6560000001";
const PORT = process.env.PORT ?? "3100";

const digits = RAW_PHONE.replace(/\D/g, "").slice(-10);
if (digits.length !== 10) {
  console.error(`Necesito 10 dígitos, recibí "${RAW_PHONE}".`);
  process.exit(1);
}
const phone = `+52${digits}`;
// Marked in the address itself, so nobody has to guess later which rows in
// auth.users came from a test run.
const email = `pickem-test-${digits}@supergana.invalid`;
const password = `Pk!${Math.floor(Date.now() / 86400000)}xQz`;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: campaign } = await admin
  .from("campaigns")
  .select("id, name, module, status")
  .eq("slug", SLUG)
  .maybeSingle();

if (!campaign) {
  console.error(`No existe la campaña "${SLUG}".`);
  process.exit(1);
}
if (campaign.module !== "pickem") {
  console.error(`"${SLUG}" es un módulo ${campaign.module}, no pickem.`);
  process.exit(1);
}

// --- auth user -------------------------------------------------------------

const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
let user = list.users.find((u) => u.email === email);
if (user) {
  await admin.auth.admin.updateUserById(user.id, { password });
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("no se pudo crear el usuario:", error.message);
    process.exit(1);
  }
  user = data.user;
}

// --- participant -----------------------------------------------------------

const { data: existing } = await admin
  .from("participants")
  .select("id")
  .eq("campaign_id", campaign.id)
  .eq("phone", phone)
  .maybeSingle();

let participantId = existing?.id;

if (participantId) {
  // auth_user_id stays put: it names the device that CREATED the row (0021),
  // and moving it collides with the unique key the moment that device has a
  // participant of its own — the same 23505 the verify route used to hit.
  // The device link below is what points this session at the player.
  await admin
    .from("participants")
    .update({ alias: ALIAS, phone_verified_at: new Date().toISOString() })
    .eq("id", participantId);
} else {
  const { data, error } = await admin
    .from("participants")
    .insert({
      campaign_id: campaign.id,
      auth_user_id: user.id,
      alias: ALIAS,
      phone,
      phone_verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("no se pudo crear el participante:", error.message);
    process.exit(1);
  }
  participantId = data.id;
}

// --- device ----------------------------------------------------------------

const { error: deviceError } = await admin.from("participant_devices").upsert(
  {
    campaign_id: campaign.id,
    auth_user_id: user.id,
    participant_id: participantId,
    last_seen_at: new Date().toISOString(),
  },
  { onConflict: "campaign_id,auth_user_id" },
);
if (deviceError) {
  console.error("no se pudo ligar el dispositivo:", deviceError.message);
  process.exit(1);
}

// --- session ---------------------------------------------------------------

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const { data: session, error: signInError } = await anon.auth.signInWithPassword({
  email,
  password,
});
if (signInError) {
  console.error("no se pudo iniciar sesión:", signInError.message);
  process.exit(1);
}

const base = `http://localhost:${PORT}`;
const fragment = `#access_token=${session.session.access_token}&refresh_token=${session.session.refresh_token}&type=magiclink`;

console.log(`
Jugador listo:  ${ALIAS}  ${phone}
Campaña:        ${campaign.name} (${campaign.status})
participant_id: ${participantId}

1. Abre esto para adoptar la sesión:
   ${base}/c/carrera-alaska/${fragment}

2. Luego ve al programa:
   ${base}/p/${SLUG}/jornada/1/
`);

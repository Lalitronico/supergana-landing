/**
 * Sends one WhatsApp template message straight through the Cloud API, so the
 * real error surfaces. The App Dashboard's "Enviar mensaje" panel disables its
 * button without saying why; Graph answers with a code and a sentence.
 *
 *     node scripts/whatsapp-send-test.mjs 6567767074 [template_name] [code]
 *
 * Reads WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID from .env.local — the same
 * two variables lib/pickem/otp.ts will read in production, so a green here is
 * a rehearsal of the real thing, not a parallel path. The token never appears
 * in argv, output, or the repo.
 *
 * Default template is Meta's own integration test template, which exists on
 * every WABA and needs no approval. Passing a third argument switches to the
 * authentication shape: the code goes in the body AND repeated as the
 * copy-code button's parameter, exactly as MetaSender sends it — Meta rejects
 * the send outright if the button parameter is missing.
 */

import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
if (!token || !phoneNumberId) {
  console.error("Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID en .env.local");
  process.exit(1);
}

const to = (process.argv[2] ?? "").replace(/\D/g, "");
if (to.length < 10) {
  console.error("Uso: node scripts/whatsapp-send-test.mjs <10 dígitos MX> [plantilla] [código]");
  process.exit(1);
}
const e164 = to.length === 10 ? `52${to}` : to;
const template = process.argv[3] ?? "hello_world";
const code = process.argv[4];
// Meta's built-in test templates ship in en_US; everything we author is es_MX.
const language = ["3p_direct_integration_test_template", "hello_world"].includes(template)
  ? "en_US"
  : "es_MX";

const components = code
  ? [
      { type: "body", parameters: [{ type: "text", text: code }] },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
    ]
  : undefined;

const res = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    messaging_product: "whatsapp",
    to: e164,
    type: "template",
    template: { name: template, language: { code: language }, ...(components && { components }) },
  }),
});

const body = await res.json().catch(() => ({}));
if (res.ok) {
  console.log(`ENVIADO a +${e164} — id: ${body.messages?.[0]?.id ?? "?"}`);
  console.log("Revisa el WhatsApp del destinatario.");
} else {
  // Graph's error object is the diagnosis: code, subcode and a human sentence.
  console.error(`RECHAZADO (HTTP ${res.status})`);
  console.error(JSON.stringify(body.error ?? body, null, 2));
  process.exit(1);
}

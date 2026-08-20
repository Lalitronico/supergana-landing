// Run with:  npm test   (node --test --experimental-strip-types over lib/**)
//
// One thing is being protected here: that a verification code never reaches a
// screen on a production deployment. Everything else in this file is scaffolding
// around that single assertion.

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { codeMatches, codeSender, hashCode, newCode, OTP } from "./otp.ts";

const KEYS = [
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_OTP_TEMPLATE",
  "OTP_REHEARSAL",
  "PICKEM_REHEARSAL_OTP",
  "VERCEL_ENV",
  "NODE_ENV",
];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

const env = (values: Record<string, string | undefined>) => {
  for (const k of KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(values)) if (v !== undefined) process.env[k] = v;
};

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const META = {
  WHATSAPP_TOKEN: "t",
  WHATSAPP_PHONE_NUMBER_ID: "1",
  WHATSAPP_OTP_TEMPLATE: "verificacion",
};

test("a production deployment never reveals the code", () => {
  // The assertion this whole file exists for. Every way of reaching production
  // with the flag on, and none of them may produce a revealing sender.
  const productions = [
    { VERCEL_ENV: "production", NODE_ENV: "production", PICKEM_REHEARSAL_OTP: "1" },
    { VERCEL_ENV: "production", NODE_ENV: "development", PICKEM_REHEARSAL_OTP: "1" },
    { NODE_ENV: "production", PICKEM_REHEARSAL_OTP: "1" },
  ];
  for (const e of productions) {
    env(e);
    const sender = codeSender();
    assert.equal(sender, null, `debió negarse con ${JSON.stringify(e)}`);
  }
});

test("credentials always win, in every environment", () => {
  for (const e of [
    { ...META, VERCEL_ENV: "production", NODE_ENV: "production" },
    { ...META, VERCEL_ENV: "preview", NODE_ENV: "production", PICKEM_REHEARSAL_OTP: "1" },
    { ...META, NODE_ENV: "development" },
  ]) {
    env(e);
    const sender = codeSender();
    assert.equal(sender?.name, "meta");
    assert.equal(sender?.revealsCode, false);
  }
});

test("a preview reveals the code only when the flag is set on purpose", () => {
  env({ VERCEL_ENV: "preview", NODE_ENV: "production" });
  assert.equal(codeSender(), null, "sin la bandera debe negarse, no revelar");

  env({ VERCEL_ENV: "preview", NODE_ENV: "production", PICKEM_REHEARSAL_OTP: "1" });
  const sender = codeSender();
  assert.equal(sender?.name, "rehearsal");
  assert.equal(sender?.revealsCode, true);
});

test("both spellings of the rehearsal flag work", () => {
  // `OTP_REHEARSAL` is the platform name. `PICKEM_REHEARSAL_OTP` is still read
  // so the pick'em branch's own .env keeps working the day it merges; drop it
  // only once nothing sets it any more.
  for (const key of ["OTP_REHEARSAL", "PICKEM_REHEARSAL_OTP"]) {
    env({ VERCEL_ENV: "preview", NODE_ENV: "production", [key]: "1" });
    assert.equal(codeSender()?.name, "rehearsal", `${key} debió bastar`);
  }

  // And neither of them can override a production deployment.
  for (const key of ["OTP_REHEARSAL", "PICKEM_REHEARSAL_OTP"]) {
    env({ VERCEL_ENV: "production", NODE_ENV: "production", [key]: "1" });
    assert.equal(codeSender(), null, `${key} no debió alcanzar producción`);
  }
});

test("the salt is the caller's, and it separates recipients", () => {
  // Tickets salts with `${campaignId}:${phone}` because no participant exists
  // when the code is sent; pick'em salts with the participant id. Same code,
  // different salt, must never collide — otherwise a code minted for one
  // campaign would verify in another.
  const code = "4821";
  const alaska = hashCode(code, "camp-a:+526561112233");
  const novamex = hashCode(code, "camp-b:+526561112233");
  assert.notEqual(alaska, novamex);
  assert.equal(codeMatches(code, "camp-a:+526561112233", alaska), true);
  assert.equal(codeMatches(code, "camp-b:+526561112233", alaska), false);
});

test("a local dev server reveals it without any flag", () => {
  env({ NODE_ENV: "development" });
  assert.equal(codeSender()?.revealsCode, true);
});

test("the code is four digits, zero-padded", () => {
  for (let i = 0; i < 300; i++) {
    const c = newCode();
    assert.match(c, /^\d{4}$/, `código inválido: ${c}`);
  }
});

test("the hash is salted per participant", () => {
  // Two people with the same code the same minute must not share a hash: an
  // unsalted sha256 of four digits is ten thousand entries, buildable inside
  // the code's ten-minute life.
  assert.notEqual(hashCode("1234", "participante-a"), hashCode("1234", "participante-b"));
  assert.equal(hashCode("1234", "participante-a"), hashCode("1234", "participante-a"));
});

test("comparing a code accepts the right one and refuses the rest", () => {
  const h = hashCode("4821", "p1");
  assert.equal(codeMatches("4821", "p1", h), true);
  assert.equal(codeMatches("4822", "p1", h), false);
  // Same code, different person: the salt is what makes this false.
  assert.equal(codeMatches("4821", "p2", h), false);
  // A malformed hash must be refused, not thrown at.
  assert.equal(codeMatches("4821", "p1", "no-es-un-hash"), false);
});

test("the limits are the ones the handoff specified", () => {
  assert.equal(OTP.digits, 4);
  assert.equal(OTP.ttlMinutes, 10);
  assert.equal(OTP.maxAttempts, 5);
  assert.equal(OTP.maxResendsPerHour, 3);
});

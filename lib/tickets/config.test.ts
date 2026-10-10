// Run with:  npm test
//
// The identity channel decides which front door a campaign has, and getting it
// wrong in the permissive direction means a campaign whose participants cannot
// prove who they are. These assertions are about failing closed.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCampaignConfig, DEFAULT_AUTH } from "./config.ts";

test("a config nobody edited identifies by email", () => {
  // The one that matters for Ticket al Tanque: its row carries no `auth` key
  // and its behaviour must not change because a parser was deployed.
  assert.equal(parseCampaignConfig({}).auth.channel, "email");
  assert.equal(parseCampaignConfig(null).auth.channel, "email");
  assert.equal(parseCampaignConfig(undefined).auth.channel, "email");
  assert.equal(parseCampaignConfig({}).auth.maxSendsPerHour, DEFAULT_AUTH.maxSendsPerHour);
});

test("phone has to be asked for by name", () => {
  assert.equal(parseCampaignConfig({ auth: { channel: "phone" } }).auth.channel, "phone");
});

test("a typo in the channel falls back to email, not to phone", () => {
  for (const channel of ["Phone", "PHONE", "telefono", "sms", "", 1, true, null]) {
    assert.equal(
      parseCampaignConfig({ auth: { channel } }).auth.channel,
      "email",
      `${JSON.stringify(channel)} no debió abrir el canal de teléfono`,
    );
  }
  // And a malformed `auth` value entirely.
  assert.equal(parseCampaignConfig({ auth: "phone" }).auth.channel, "email");
  assert.equal(parseCampaignConfig({ auth: [] }).auth.channel, "email");
});

test("a phone campaign stops asking for the phone in the profile form", () => {
  // Derived, not configured: the number is already proven, and a form that asks
  // again is a form that can save a different one from the session's.
  const config = parseCampaignConfig({
    auth: { channel: "phone" },
    profile_fields: { phone: "required", zip: "off", state: "off" },
  });
  assert.equal(config.profileFields.phone, "off");
  // The other two are untouched — this derives one thing, not the whole shape.
  assert.equal(config.profileFields.zip, "off");
  assert.equal(config.profileFields.state, "off");
});

test("an email campaign keeps whatever profile fields it asked for", () => {
  const config = parseCampaignConfig({
    profile_fields: { phone: "required", zip: "off", state: "off" },
  });
  assert.equal(config.profileFields.phone, "required");
});

test("the send breaker takes a number and refuses nonsense", () => {
  assert.equal(
    parseCampaignConfig({ auth: { channel: "phone", max_sends_per_hour: 50 } })
      .auth.maxSendsPerHour,
    50,
  );
  assert.equal(
    parseCampaignConfig({ auth: { channel: "phone", max_sends_per_hour: "nope" } })
      .auth.maxSendsPerHour,
    DEFAULT_AUTH.maxSendsPerHour,
  );
});

// ---- per-campaign copy overrides ------------------------------------------

import { parseCopyOverrides } from "./config.ts";

test("copy overrides keep known keys, trimmed, and drop everything else", () => {
  const out = parseCopyOverrides({
    es: { accHeroTitle: "  ¡Cada ticket llena tu tanque!  ", accHeroMark: "tanque", notAKey: "x" },
    en: { accHeroTitle: "Every receipt fills your tank!" },
    fr: { accHeroTitle: "non" },
  });
  assert.deepEqual(out, {
    es: { accHeroTitle: "¡Cada ticket llena tu tanque!", accHeroMark: "tanque" },
    en: { accHeroTitle: "Every receipt fills your tank!" },
  });
});

test("copy overrides ignore non-strings, empties, oversize text and bad shapes", () => {
  assert.deepEqual(parseCopyOverrides(null), {});
  assert.deepEqual(parseCopyOverrides([]), {});
  assert.deepEqual(parseCopyOverrides({ es: [] }), {});
  assert.deepEqual(
    parseCopyOverrides({
      es: { accHeroTitle: 5, accHeroMark: "   ", accHeroSub: "x".repeat(601), __proto__: "y", toString: "z" },
    }),
    {},
  );
});

test("an unedited config has no copy overrides", () => {
  assert.deepEqual(parseCampaignConfig({}).copy, {});
});

import { translator } from "./i18n.ts";

test("the translator prefers a campaign's override and still fills placeholders", () => {
  const t = translator("es", { es: { accHeroTitle: "Gana con {org}, {org}" } });
  assert.equal(t("accHeroTitle", { org: "X" }), "Gana con X, X");
  // Untouched keys and the other locale keep the dictionary's wording.
  assert.equal(t("accHeroMark", { org: "X" }), "X");
  assert.equal(translator("en", { es: { accHeroTitle: "z" } })("accHeroTitle", { org: "X" }), "Win prizes with X!");
});

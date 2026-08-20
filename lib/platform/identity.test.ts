import { test } from "node:test";
import assert from "node:assert/strict";
import { phoneAuthEmail, phoneFromAuthEmail, isPhoneIdentity } from "./identity.ts";

test("a Mexican mobile round-trips", () => {
  const phone = "+526561112233";
  assert.equal(phoneAuthEmail(phone), "526561112233@wa.supergana.fun");
  assert.equal(phoneFromAuthEmail(phoneAuthEmail(phone)), phone);
});

test("case does not decide identity", () => {
  // Supabase lowercases addresses on the way in; a reader that only matched the
  // exact casing would stop recognising its own accounts.
  assert.equal(phoneFromAuthEmail("526561112233@WA.Supergana.Fun"), "+526561112233");
});

test("a real participant address is not a phone identity", () => {
  assert.equal(phoneFromAuthEmail("sergio.lastra@me.com"), null);
  assert.equal(isPhoneIdentity("sergio.lastra@me.com"), false);
});

test("a lookalike domain is refused", () => {
  // The whole domain has to match, not a suffix of it: otherwise anybody who
  // registers `evil-wa.supergana.fun` — or is handed an address at it — gets to
  // choose which phone number they are.
  assert.equal(phoneFromAuthEmail("526561112233@evil-wa.supergana.fun"), null);
  assert.equal(phoneFromAuthEmail("526561112233@wa.supergana.fun.evil.com"), null);
  assert.equal(phoneFromAuthEmail("526561112233@supergana.fun"), null);
});

test("our domain with a local part that is not a number is not an identity", () => {
  assert.equal(phoneFromAuthEmail("hola@wa.supergana.fun"), null);
  assert.equal(phoneFromAuthEmail("52656111223a@wa.supergana.fun"), null);
  // Too short and too long, matching the CHECK on participants.phone.
  assert.equal(phoneFromAuthEmail("123456789@wa.supergana.fun"), null);
  assert.equal(phoneFromAuthEmail("1234567890123456@wa.supergana.fun"), null);
});

test("nothing in, null out", () => {
  assert.equal(phoneFromAuthEmail(null), null);
  assert.equal(phoneFromAuthEmail(undefined), null);
  assert.equal(phoneFromAuthEmail(""), null);
  assert.equal(phoneFromAuthEmail("@wa.supergana.fun"), null);
  assert.equal(isPhoneIdentity(null), false);
});

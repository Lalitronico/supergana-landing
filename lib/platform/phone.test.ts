// Run with:  node --test --experimental-strip-types lib/platform/phone.test.ts
//
// No test framework is installed and this does not add one. `node --test` ships
// with the runtime, and the modules worth testing here were written to have no
// imports precisely so they could be tested without one.

import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMxPhone, normalizeMxPhone } from "./phone.ts";

test("the five ways a Mexican number gets typed collapse to one player", () => {
  // From handoff/02-IDENTIDAD-Y-AUTH.md. Getting this wrong does not throw —
  // it silently splits one person's season across several leaderboard rows.
  const same = [
    "6561112233",
    "656-111-2233",
    "+52 656 111 2233",
    "52 656 111 2233",
    "521 656 111 2233",
  ];
  for (const typed of same) {
    assert.equal(normalizeMxPhone(typed), "+526561112233", `falló: ${typed}`);
  }
});

test("the retired long-distance prefixes still on business cards", () => {
  assert.equal(normalizeMxPhone("044 656 111 2233"), "+526561112233");
  assert.equal(normalizeMxPhone("045 656 111 2233"), "+526561112233");
});

test("a US number is a different country, not a badly typed Mexican one", () => {
  // Ciudad Juárez is a border city and El Paso numbers get typed into this box.
  // Stripping the +1 would produce +52 915 555 0134 — a real number belonging
  // to somebody else, and where a prize notification would land.
  assert.equal(normalizeMxPhone("+1 915 555 0134"), null);
  assert.equal(normalizeMxPhone("+34 600 000 000"), null);
});

test("anything that is not ten national digits is refused, not half-stored", () => {
  for (const bad of ["", "   ", "65611122", "656111223344", "no es un teléfono", "+52"]) {
    assert.equal(normalizeMxPhone(bad), null, `debió rechazar: ${JSON.stringify(bad)}`);
  }
});

test("normalising is idempotent", () => {
  const once = normalizeMxPhone("656 111 2233");
  assert.equal(normalizeMxPhone(once!), once);
});

test("what we show back is what we will dial", () => {
  assert.equal(formatMxPhone("+526561112233"), "+52 656 111 2233");
});

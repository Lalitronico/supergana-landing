// Run with:  npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAvatarChoice } from "./avatar.ts";

const cast = [{ id: "oso" }, { id: "dino" }];

test("an absent avatar leaves the stored choice alone", () => {
  assert.deepEqual(parseAvatarChoice(cast, undefined), { kind: "unchanged" });
});

test("null is an explicit choice of nobody", () => {
  assert.deepEqual(parseAvatarChoice(cast, null), { kind: "clear" });
});

test("a member of the campaign's cast is accepted, trimmed", () => {
  assert.deepEqual(parseAvatarChoice(cast, " dino "), { kind: "set", id: "dino" });
});

test("anything outside the cast is refused", () => {
  for (const raw of ["gato", "", "OSO", 7, true, {}, ["oso"]]) {
    assert.deepEqual(parseAvatarChoice(cast, raw), { kind: "invalid" }, JSON.stringify(raw));
  }
  // A campaign with no cast accepts no avatar at all.
  assert.deepEqual(parseAvatarChoice([], "oso"), { kind: "invalid" });
});

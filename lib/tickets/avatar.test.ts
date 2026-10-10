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

import { resolveAvatar } from "./avatar.ts";

test("resolveAvatar keeps a valid choice", () => {
  assert.equal(resolveAvatar("dino", "any-id", cast), "dino");
});

test("resolveAvatar falls back to a stable pick from the cast", () => {
  const first = resolveAvatar(null, "participant-1", cast);
  assert.ok(first === "oso" || first === "dino");
  // Same key, same character, every time and for every kind of "no choice".
  assert.equal(resolveAvatar(undefined, "participant-1", cast), first);
  assert.equal(resolveAvatar("removed-from-cast", "participant-1", cast), first);
});

test("resolveAvatar spreads participants across the cast", () => {
  const seen = new Set<string | null>();
  for (let i = 0; i < 40; i += 1) seen.add(resolveAvatar(null, `id-${i}`, cast));
  assert.deepEqual([...seen].sort(), ["dino", "oso"]);
});

test("resolveAvatar is null without a cast", () => {
  assert.equal(resolveAvatar("oso", "x", []), null);
  assert.equal(resolveAvatar(null, "x", []), null);
});

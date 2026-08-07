// Run with:  node --test --experimental-strip-types lib/pickem/teams.test.ts
//
// The club table is data, and data this static is not usually worth a test.
// What is worth one is the join between the table and the filesystem: since
// 2026-08-08 every club points at a crest under public/nfl/, and a path that
// points at nothing fails silently — a 404 on a 34px image is an empty tile
// nobody notices in review and everybody notices on a phone.
//
// So this asserts the crest of every club actually exists on disk, which is
// the one thing TypeScript cannot check. It also pins WSH, the single club
// whose ESPN abbreviation differs from its own, because that is where a
// filename gets "corrected" to was.png by someone being helpful.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { TEAMS, crestPath, teamOf } from "./teams.ts";

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");

test("the league has 32 clubs", () => {
  assert.equal(Object.keys(TEAMS).length, 32);
});

test("every club's crest exists under public/", () => {
  const missing = Object.entries(TEAMS)
    .filter(([, team]) => !team.crest || !existsSync(path.join(PUBLIC_DIR, team.crest)))
    .map(([abbr]) => abbr);
  assert.deepEqual(missing, [], `crests missing from public/nfl: ${missing.join(", ")}`);
});

test("crest paths are lowercase, because deploy filesystems are case-sensitive", () => {
  for (const [abbr, team] of Object.entries(TEAMS)) {
    assert.equal(team.crest, `/nfl/${abbr.toLowerCase()}.png`);
  }
});

test("Washington is WSH, in the table and in the filename", () => {
  assert.ok(TEAMS.WSH, "ESPN calls Washington WSH, not WAS");
  assert.equal(crestPath("WSH"), "/nfl/wsh.png");
});

test("a club the table does not know falls back to the tile, with no crest", () => {
  const unknown = teamOf("XYZ");
  assert.equal(unknown.crest, null);
  assert.equal(unknown.name, "XYZ");
});

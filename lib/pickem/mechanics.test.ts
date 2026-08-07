// Run with:  node --test --experimental-strip-types lib/pickem/mechanics.test.ts
//
// The numbers this file guards are the ones the rules screen publishes.
//
// `app/p/[programa]/reglas/page.tsx` generates the official rules from
// `pickem_programs.mechanics`, on the principle that prose cannot be allowed to
// disagree with the scorer — a published rule that says "10 puntos por acierto"
// while the programme pays 8 is a promise the ledger will not keep. Reading the
// mechanics is what makes that impossible.
//
// But there are THREE copies of the defaults, and they are only defaults until
// a key goes missing, at which point they decide a real score:
//
//   1. DEFAULT_MECHANICS in schema.ts     — what TypeScript falls back to
//   2. the column default in 0022         — what a new programme is created with
//   3. the coalesce()s in pickem_score_entry (0023) — what SQL falls back to
//
// A programme whose config lost a key must not be scored one way by the panel
// and another by the settle, and must not be described to the player as a third
// thing. The tests below read all three out of the actual files and assert they
// say the same numbers. This is the reason it is worth the file reading: a unit
// test of DEFAULT_MECHANICS against itself would pass forever.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_MECHANICS, parseMechanics, type Mechanics } from "./schema.ts";

const MIGRATION_0022 = new URL("../../supabase/migrations/0022_pickem_module.sql", import.meta.url);
const MIGRATION_0023 = new URL("../../supabase/migrations/0023_pickem_rpcs.sql", import.meta.url);

const KEYS = Object.keys(DEFAULT_MECHANICS) as (keyof Mechanics)[];

test("the column default in 0022 is the same config TypeScript falls back to", () => {
  const sql = readFileSync(MIGRATION_0022, "utf8");
  const match = /mechanics jsonb not null default '(\{[\s\S]*?\})'::jsonb/.exec(sql);
  assert.ok(match, "no se encontró el default de pickem_programs.mechanics en 0022");

  const fromSql = JSON.parse(match[1]) as Record<string, number>;

  // Every key, both ways: a default that gained a key TypeScript does not know
  // is a mechanic the rules screen would silently omit.
  assert.deepEqual(
    Object.keys(fromSql).sort(),
    [...KEYS].sort(),
    "0022 y DEFAULT_MECHANICS no tienen las mismas llaves",
  );
  for (const key of KEYS) {
    assert.equal(fromSql[key], DEFAULT_MECHANICS[key], `mecánica "${key}"`);
  }
});

test("the fallbacks inside pickem_score_entry are the same numbers again", () => {
  const sql = readFileSync(MIGRATION_0023, "utf8");
  const found = new Map<string, number>();
  for (const m of sql.matchAll(/coalesce\(\(v_m ->> '(\w+)'\)::int,\s*(-?\d+)\)/g)) {
    // The same key is read more than once; every reading must agree with
    // itself before it is worth comparing to anything else.
    const previous = found.get(m[1]);
    if (previous !== undefined) {
      assert.equal(Number(m[2]), previous, `0023 usa dos defaults distintos para "${m[1]}"`);
    }
    found.set(m[1], Number(m[2]));
  }

  assert.equal(found.size, KEYS.length, `0023 lee ${found.size} mecánicas, hay ${KEYS.length}`);
  for (const key of KEYS) {
    assert.equal(found.get(key), DEFAULT_MECHANICS[key], `mecánica "${key}" en 0023`);
  }
});

test("a half-filled config is completed key by key, never wholesale", () => {
  // A tenant who configures only the hit must still get a scoreable programme,
  // and the rules screen must still have a number to print for every line. The
  // failure this rules out is a parser that sees one bad key and hands back the
  // whole default object, silently discarding the tenant's other choices.
  const parsed = parseMechanics({ hit: 8, streak6: 90, tiebreak: "quince" });
  assert.equal(parsed.hit, 8);
  assert.equal(parsed.streak6, 90);
  assert.equal(parsed.tiebreak, DEFAULT_MECHANICS.tiebreak);
  assert.equal(parsed.earlyHours, DEFAULT_MECHANICS.earlyHours);
});

test("nothing that is not a finite number reaches the rules screen", () => {
  // Every one of these renders as "+NaN puntos por acierto" or "+undefined" on
  // a published rules page if it gets through.
  for (const bad of [NaN, Infinity, -Infinity, null, "10", true, [10], {}]) {
    assert.equal(parseMechanics({ hit: bad }).hit, DEFAULT_MECHANICS.hit, `hit = ${String(bad)}`);
  }
  for (const notAnObject of [null, undefined, "", 0, "mechanics", []]) {
    // An array is an object to typeof and must not be mistaken for a config.
    const parsed = parseMechanics(notAnObject);
    for (const key of KEYS) assert.equal(parsed[key], DEFAULT_MECHANICS[key]);
  }
});

test("multipliers add, so check-in and a double week are ×3 and never ×4", () => {
  // 10-MECANICAS, and the comment in pickem_score_entry: "Multipliers ADD to
  // the multiplier, they do not multiply each other". The rules screen states
  // the combined figure out loud, so this is the arithmetic it states.
  const combined = (m: Mechanics) => 1 + m.checkinMult + m.promoMult;

  assert.equal(combined(DEFAULT_MECHANICS), 3);
  assert.notEqual(combined(DEFAULT_MECHANICS), (1 + DEFAULT_MECHANICS.checkinMult) * (1 + DEFAULT_MECHANICS.promoMult));

  // With defaults the two happen to coincide at 4 vs 3, which is a small enough
  // gap to look like a rounding difference. A tenant with bigger levers shows
  // what the rule is actually worth.
  const generous = parseMechanics({ ...DEFAULT_MECHANICS, checkinMult: 2, promoMult: 3 });
  assert.equal(combined(generous), 6);
  assert.equal((1 + generous.checkinMult) * (1 + generous.promoMult), 12);
});

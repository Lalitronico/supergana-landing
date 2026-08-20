// Run with:  node --test --experimental-strip-types lib/platform/tour.test.ts
//
// Same trade as phone.test.ts: no framework, because the module under test was
// written to have no imports. What is worth testing here is the skipping rule —
// the part of a tour that fails silently and looks like a bug in the browser.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fillLabel,
  nextUsable,
  stepIsUsable,
  tourRunKey,
  tourStorageKey,
  type TourStep,
} from "./tour.ts";

const step = (id: string, anchor: string | null, optional = true): TourStep => ({
  id,
  anchor,
  href: null,
  title: id,
  body: [],
  optional,
});

test("the storage key carries the version, so a bump is a clean slate", () => {
  const d = { id: "pickem", scope: "chapa-pickem-2026", version: 1 };
  assert.equal(tourStorageKey(d), "sg:tour:pickem:chapa-pickem-2026:v1");
  // A bumped version must not collide with the old one — that is the whole
  // mechanism by which a re-cut tour gets shown again.
  assert.notEqual(tourStorageKey({ ...d, version: 2 }), tourStorageKey(d));
});

test("the run key is version-free: a resume outlives a version bump by dying", () => {
  assert.equal(
    tourRunKey({ id: "pickem", scope: "chapa-pickem-2026" }),
    "sg:tour-run:pickem:chapa-pickem-2026",
  );
});

test("placeholders fill, and an unknown one is left visible rather than blanked", () => {
  assert.equal(fillLabel("Paso {n} de {total}", { n: 3, total: 7 }), "Paso 3 de 7");
  // Leaving "{missing}" on screen is ugly and obvious. Replacing it with "" is
  // invisible in review and ships.
  assert.equal(fillLabel("Paso {n} de {missing}", { n: 3 }), "Paso 3 de {missing}");
});

test("a step with no anchor never needs one", () => {
  assert.equal(stepIsUsable(step("welcome", null), false), true);
});

test("an optional step with a missing anchor is skippable; a required one is not", () => {
  assert.equal(stepIsUsable(step("countdown", "portada-countdown"), false), false);
  assert.equal(stepIsUsable(step("countdown", "portada-countdown"), true), true);
  // Not optional: it renders anyway, centred, so the absence is visible.
  assert.equal(stepIsUsable(step("tabs", "tab-jugar", false), false), true);
});

test("forward skipping walks over every absent anchor in a row", () => {
  const steps = [step("a", null), step("b", "gone"), step("c", "also-gone"), step("d", null)];
  const present = () => false;
  assert.equal(nextUsable(steps, 0, 1, (s) => stepIsUsable(s, present())), 3);
});

test("backward skipping does the same, which is what stops Back from bouncing", () => {
  // The bug this prevents: skip 1 and 2 going forward, then press Back from 3.
  // A naive `index - 1` lands on 2, finds it unusable, skips FORWARD to 3, and
  // the player can never reach 0.
  const steps = [step("a", null), step("b", "gone"), step("c", "gone"), step("d", null)];
  assert.equal(nextUsable(steps, 3, -1, (s) => stepIsUsable(s, false)), 0);
});

test("running out in either direction is null, not a clamp", () => {
  const steps = [step("a", null), step("b", null)];
  // Null is "the tour is over"; clamping to 0 or length-1 would loop the last
  // step forever on a double tap.
  assert.equal(nextUsable(steps, 1, 1, () => true), null);
  assert.equal(nextUsable(steps, 0, -1, () => true), null);
});

test("a tour whose every anchor is missing ends instead of stalling", () => {
  const steps = [step("a", "gone"), step("b", "gone")];
  assert.equal(nextUsable(steps, -1, 1, (s) => stepIsUsable(s, false)), null);
});

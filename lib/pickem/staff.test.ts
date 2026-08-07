// Run with:  node --test --experimental-strip-types lib/pickem/staff.test.ts
//
// Only the pure half of staff.ts is exercised here, and it is the half that
// decides what a person is told: whether a typed code is worth looking up,
// whether a correction may be written to an append-only ledger, and whether a
// jornada may be closed. The service-role half is a thin wrapper over four
// RPCs and belongs to a database probe, not to a unit test.
//
// The normalisation cases are the expensive ones. They mirror an expression
// that also exists in SQL (`pickem_redeem_award`, `pickem_find_award`), and if
// the two ever disagree the failure looks, from the customer's side, exactly
// like a prize that does not exist.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADJUSTMENT_CONFIRM_AT,
  ADJUSTMENT_MAX,
  canOperateWeek,
  canRedeemAward,
  formatAwardCode,
  looksLikeAwardCode,
  normalizeAwardCode,
  readinessOf,
  staffMessage,
  staffStatusFor,
  validateAdjustment,
  type PanelGame,
} from "./staff.ts";

// ---------------------------------------------------------------------------
// The code across the counter
// ---------------------------------------------------------------------------

test("every way a cashier can type a code collapses to one string", () => {
  const canonical = "CHAW3K7M2QX";
  for (const typed of [
    "CHA-W3-K7M2QX",
    "cha-w3-k7m2qx",
    "CHA W3 K7M2QX",
    "chaw3k7m2qx",
    "  CHA-W3-K7M2QX  ",
    "CHA–W3–K7M2QX", // en dash: what a phone keyboard offers after a long press
  ]) {
    assert.equal(normalizeAwardCode(typed), canonical, `no colapsó: ${typed}`);
  }
});

test("an empty box normalises to an empty string, not to a crash", () => {
  assert.equal(normalizeAwardCode(""), "");
  assert.equal(normalizeAwardCode("---"), "");
});

test("the dashes go back in the right places, including a two-digit jornada", () => {
  assert.equal(formatAwardCode("chaw3k7m2qx"), "CHA-W3-K7M2QX");
  assert.equal(formatAwardCode("CHAW17K7M2QX"), "CHA-W17-K7M2QX");
});

test("a half-typed code is left alone rather than decorated wrongly", () => {
  // Ten characters is the shortest real code (3 + 'W' + 1 digit + 6).
  assert.equal(formatAwardCode("CHAW3"), "CHAW3");
  assert.equal(looksLikeAwardCode("CHA-W3-K7M2"), false);
  assert.equal(looksLikeAwardCode("CHA-W3-K7M2QX"), true);
  assert.equal(looksLikeAwardCode("chaw3k7m2qx"), true);
});

// ---------------------------------------------------------------------------
// Is the jornada closeable
// ---------------------------------------------------------------------------

const game = (over: Partial<PanelGame> & { id: string }): PanelGame => ({
  week: 3,
  away: "PHI",
  home: "DAL",
  kickoffAt: "2026-09-27T17:00:00Z",
  network: null,
  awayScore: null,
  homeScore: null,
  voided: false,
  ...over,
});

test("a jornada with every live score captured is ready", () => {
  const r = readinessOf([
    game({ id: "a", awayScore: 24, homeScore: 17 }),
    game({ id: "b", awayScore: 10, homeScore: 13 }),
  ]);
  assert.equal(r.ready, true);
  assert.equal(r.scored, 2);
  assert.equal(r.missing.length, 0);
});

test("one missing score blocks the close and the game is named", () => {
  const r = readinessOf([
    game({ id: "a", awayScore: 24, homeScore: 17 }),
    game({ id: "b", away: "SF", home: "MIN" }),
  ]);
  assert.equal(r.ready, false);
  assert.deepEqual(
    r.missing.map((g) => g.id),
    ["b"],
  );
});

test("a voided game does not hold the jornada hostage", () => {
  // The whole point of `voided`: a postponed game is the one thing that lets
  // the rest of the week close instead of freezing it forever.
  const r = readinessOf([
    game({ id: "a", awayScore: 24, homeScore: 17 }),
    game({ id: "b", voided: true }),
  ]);
  assert.equal(r.ready, true);
  assert.equal(r.live, 1);
  assert.equal(r.voided, 1);
  assert.equal(r.total, 2);
});

test("a jornada with every game annulled is NOT ready", () => {
  // There is nothing to score. Letting the settle run would credit a room full
  // of zeroes and advance the season past a week that never happened.
  const r = readinessOf([game({ id: "a", voided: true })]);
  assert.equal(r.ready, false);
  assert.equal(r.live, 0);
});

test("missing games come back in kickoff order", () => {
  const r = readinessOf([
    game({ id: "late", kickoffAt: "2026-09-28T00:20:00Z" }),
    game({ id: "early", kickoffAt: "2026-09-27T17:00:00Z" }),
  ]);
  assert.deepEqual(
    r.missing.map((g) => g.id),
    ["early", "late"],
  );
});

test("half a score is no score", () => {
  // sport_games_score_pairing forbids this in the database, and the panel must
  // not report a game as settled if it ever slipped through.
  const r = readinessOf([game({ id: "a", awayScore: 24, homeScore: null })]);
  assert.equal(r.ready, false);
});

// ---------------------------------------------------------------------------
// The correction that gets written to an append-only ledger
// ---------------------------------------------------------------------------

test("a correction needs a reason somebody can read in six months", () => {
  assert.deepEqual(validateAdjustment(120, ""), { ok: false, error: "note_required" });
  assert.deepEqual(validateAdjustment(120, "   "), { ok: false, error: "note_required" });
  assert.deepEqual(validateAdjustment(120, "ajus"), { ok: false, error: "note_too_short" });
  assert.deepEqual(validateAdjustment(120, "x".repeat(201)), {
    ok: false,
    error: "note_too_long",
  });
});

test("a real correction passes and comes back trimmed", () => {
  const r = validateAdjustment(120, "  Marcador de PHI-DAL invertido, J7  ");
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.points, 120);
  assert.equal(r.note, "Marcador de PHI-DAL invertido, J7");
  assert.equal(r.confirm, false);
});

test("a negative correction is legitimate: the ledger is signed", () => {
  const r = validateAdjustment(-40, "Doble acreditación de la J4");
  assert.equal(r.ok, true);
});

test("zero corrects nothing", () => {
  assert.deepEqual(validateAdjustment(0, "Motivo suficiente"), {
    ok: false,
    error: "zero_adjustment",
  });
});

test("only whole points; the ledger column is an int", () => {
  assert.deepEqual(validateAdjustment(12.5, "Motivo suficiente"), {
    ok: false,
    error: "not_a_number",
  });
  assert.deepEqual(validateAdjustment("120", "Motivo suficiente"), {
    ok: false,
    error: "not_a_number",
  });
  assert.deepEqual(validateAdjustment(Number.NaN, "Motivo suficiente"), {
    ok: false,
    error: "not_a_number",
  });
});

test("an extra digit is caught, and the confirmation threshold sits below it", () => {
  assert.deepEqual(validateAdjustment(ADJUSTMENT_MAX + 1, "Motivo suficiente"), {
    ok: false,
    error: "too_large",
  });
  const big = validateAdjustment(ADJUSTMENT_CONFIRM_AT, "Motivo suficiente");
  assert.equal(big.ok, true);
  if (!big.ok) return;
  assert.equal(big.confirm, true, "un ajuste de cuatro dígitos debe pedir confirmación");
  assert.ok(ADJUSTMENT_CONFIRM_AT < ADJUSTMENT_MAX);
});

// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

test("closing a jornada is a supervisor's call, not a reviewer's", () => {
  assert.equal(canOperateWeek("supervisor"), true);
  assert.equal(canOperateWeek("admin"), true);
  assert.equal(canOperateWeek("reviewer"), false);
  assert.equal(canOperateWeek("finance"), false);
});

test("anybody with a seat can redeem a code at the counter", () => {
  // Deliberately the widest door in the module: the branch has one tablet and
  // whoever is at the counter uses it. Narrowing this means the prize can only
  // be collected when the supervisor happens to be in the building.
  for (const role of ["reviewer", "supervisor", "finance", "admin"] as const) {
    assert.equal(canRedeemAward(role), true);
  }
});

// ---------------------------------------------------------------------------
// What the screen says
// ---------------------------------------------------------------------------

test("every machine code these RPCs raise has Spanish copy", () => {
  const raised = [
    "campaign_not_found",
    "week_incomplete",
    "week_not_settled",
    "no_winners",
    "not_tied_at_top",
    "no_week_prize",
    "already_awarded",
    "game_not_found",
    "week_settled",
    "participant_not_found",
    "note_required",
    "zero_adjustment",
    "award_not_found",
    "already_redeemed",
    "award_expired",
    "award_canceled",
    "unknown_venue",
  ];
  for (const code of raised) {
    const message = staffMessage(code);
    assert.notEqual(message, "No pudimos completar la operación.", `sin copy: ${code}`);
    assert.ok(message.length > 12, `copy demasiado corto: ${code}`);
  }
});

test("an unknown code degrades to a sentence rather than to the raw string", () => {
  assert.equal(staffMessage("something_new"), "No pudimos completar la operación.");
});

test("a rule refusal is a 409, a missing thing is a 404", () => {
  assert.equal(staffStatusFor("already_redeemed"), 409);
  assert.equal(staffStatusFor("week_incomplete"), 409);
  assert.equal(staffStatusFor("week_settled"), 409);
  assert.equal(staffStatusFor("award_not_found"), 404);
  assert.equal(staffStatusFor("participant_not_found"), 404);
  assert.equal(staffStatusFor("campaign_not_found"), 404);
  assert.equal(staffStatusFor("db_error"), 500);
});

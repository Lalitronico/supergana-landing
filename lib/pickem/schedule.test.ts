// Run with:  node --test --experimental-strip-types lib/pickem/schedule.test.ts
//
// The timezone cases below are the expensive ones. They are wrong by exactly
// one hour for half a season if anybody replaces Intl with offset arithmetic,
// and an hour is the difference between a player thinking they have time to
// send their picks and finding the week locked.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closingGame,
  countdownTo,
  formatKickoff,
  formatTime,
  lockOf,
  qualifiesEarly,
  weekStateOf,
} from "./schedule.ts";
import type { Game } from "./schema.ts";

const JZ = "America/Ciudad_Juarez";

const game = (over: Partial<Game> & { id: string; kickoffAt: string }): Game => ({
  week: 1,
  away: "AAA",
  home: "BBB",
  network: null,
  venueNote: null,
  awayScore: null,
  homeScore: null,
  voided: false,
  ...over,
});

test("Ciudad Juárez is Mountain time, and it changes mid-season", () => {
  // Real kickoffs from the seeded 2026 schedule. Week 1 is MDT, week 9 is MST:
  // daylight saving ends 1 November 2026, in the middle of the eighteen weeks.
  // Juárez is synced to El Paso, NOT Central like the rest of Chihuahua.
  assert.equal(formatKickoff("2026-09-10T00:20:00Z", JZ), "Mié 9 sep · 6:20 PM");
  assert.equal(formatKickoff("2026-11-06T01:15:00Z", JZ), "Jue 5 nov · 6:15 PM");

  // The proof that it is not a fixed offset: the two above are 6 hours and 7
  // hours behind UTC respectively. Anything that subtracts a constant gets one
  // of them wrong.
  assert.equal(formatTime("2026-09-10T00:20:00Z", JZ), "6:20 PM");
  assert.equal(formatTime("2026-11-06T01:15:00Z", JZ), "6:15 PM");
});

test("the London games really are breakfast in Juárez", () => {
  // Sold to the client as five Sundays of football at breakfast. If this ever
  // stops being true the pitch is wrong, not just the screen.
  assert.equal(formatTime("2026-10-04T13:30:00Z", JZ), "7:30 AM");
});

test("the lock is the first kickoff, never a weekday", () => {
  // The deck says "picks close at Thursday kickoff". Week 1 of 2026 opens on a
  // Wednesday. Reading the calendar is the only thing that is right both times.
  const games = [
    game({ id: "b", kickoffAt: "2026-09-13T17:00:00Z" }),
    game({ id: "a", kickoffAt: "2026-09-10T00:20:00Z" }),
    game({ id: "c", kickoffAt: "2026-09-14T00:20:00Z" }),
  ];
  assert.equal(lockOf(games), "2026-09-10T00:20:00Z");
  assert.equal(formatKickoff(lockOf(games)!, JZ), "Mié 9 sep · 6:20 PM");
});

test("a voided game does not hold the lock", () => {
  const games = [
    game({ id: "a", kickoffAt: "2026-09-10T00:20:00Z", voided: true }),
    game({ id: "b", kickoffAt: "2026-09-13T17:00:00Z" }),
  ];
  assert.equal(lockOf(games), "2026-09-13T17:00:00Z");
  assert.equal(lockOf([]), null);
});

test("the closing game is the last to kick off, ties broken by id", () => {
  const games = [
    game({ id: "a", kickoffAt: "2026-09-13T17:00:00Z" }),
    game({ id: "z", kickoffAt: "2026-09-14T00:20:00Z" }),
    game({ id: "y", kickoffAt: "2026-09-14T00:20:00Z" }),
  ];
  // Same rule as pickem_closing_game in SQL, so the screen names the match the
  // scorer will actually use for the tiebreak.
  assert.equal(closingGame(games)?.id, "z");
});

test("a week is open only while it is the open week and before its lock", () => {
  const lock = "2026-09-10T00:20:00Z";
  const before = new Date("2026-09-08T00:00:00Z");
  const after = new Date("2026-09-11T00:00:00Z");

  assert.equal(weekStateOf(1, 1, lock, false, before), "open");
  // Kickoff passed but the Tuesday cron has not run. Frozen, not open — and
  // not settled either, which is the state between the last whistle and the
  // points landing.
  assert.equal(weekStateOf(1, 1, lock, false, after), "running");
  assert.equal(weekStateOf(1, 1, lock, true, after), "settled");
  assert.equal(weekStateOf(2, 1, lock, false, before), "upcoming");
  // Behind the open week and unsettled: the games happened, nobody closed it.
  assert.equal(weekStateOf(1, 3, lock, false, after), "running");
});

test("the early-bird window is measured against the lock", () => {
  const lock = "2026-09-10T00:20:00Z";
  assert.equal(qualifiesEarly(lock, 24, new Date("2026-09-08T00:00:00Z")), true);
  assert.equal(qualifiesEarly(lock, 24, new Date("2026-09-09T12:00:00Z")), false);
  assert.equal(qualifiesEarly(null, 24, new Date("2026-09-08T00:00:00Z")), false);
});

test("the countdown counts down, and stops at zero", () => {
  const target = "2026-09-10T00:20:00Z";
  const parts = countdownTo(target, new Date("2026-09-08T22:15:30Z"));
  assert.deepEqual(parts, { days: 1, hours: 2, minutes: 4, seconds: 30, done: false });

  const past = countdownTo(target, new Date("2026-09-11T00:00:00Z"));
  assert.equal(past.done, true);
  assert.equal(past.seconds, 0);
});

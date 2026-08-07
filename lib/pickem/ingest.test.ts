// Run with:  node --test --experimental-strip-types lib/pickem/ingest.test.ts
//
// These cover the decisions the Tuesday cron makes without anybody watching.
// Two of them protect against a specific, expensive failure:
//
//   · blanking a stored score would un-settle a week that has already handed
//     somebody a prize across a counter;
//   · trusting week 18's placeholder kickoff would close the last jornada's
//     picks at a time that was never real.
//
// Both only happen in January, on a season that has not started. Which is
// exactly why they are asserted in August.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkFullSeason,
  gameKey,
  isPlaceholderWeek,
  missingTeams,
  parseScoreboard,
  planWrite,
  venueNote,
  weeksAround,
  type ExistingGame,
  type IngestGame,
} from "./ingest.ts";

const SEASON = "11111111-1111-1111-1111-111111111111";

// ---------------------------------------------------------------------------
// Fixtures shaped like ESPN's scoreboard
// ---------------------------------------------------------------------------

const event = (
  away: string,
  home: string,
  date: string,
  extra: {
    completed?: boolean;
    awayScore?: string;
    homeScore?: string;
    network?: string;
    city?: string;
    country?: string;
  } = {},
) => ({
  date,
  competitions: [
    {
      status: { type: { completed: extra.completed ?? false } },
      broadcasts: extra.network ? [{ names: [extra.network] }] : [],
      venue: extra.city ? { address: { city: extra.city, country: extra.country } } : undefined,
      competitors: [
        { homeAway: "home", score: extra.homeScore, team: { abbreviation: home } },
        { homeAway: "away", score: extra.awayScore, team: { abbreviation: away } },
      ],
    },
  ],
});

const incoming = (over: Partial<IngestGame> = {}): IngestGame => ({
  week: 5,
  away: "NE",
  home: "SEA",
  kickoffAt: "2026-10-11T17:00:00Z",
  network: "CBS",
  venueNote: null,
  awayScore: null,
  homeScore: null,
  ...over,
});

const stored = (over: Partial<ExistingGame> = {}): ExistingGame => ({
  id: "game-1",
  week: 5,
  away: "NE",
  home: "SEA",
  kickoffAt: "2026-10-11T17:00:00Z",
  network: "CBS",
  venueNote: null,
  awayScore: null,
  ...over,
});

// ---------------------------------------------------------------------------
// Parsing ESPN
// ---------------------------------------------------------------------------

test("a finished game yields its score, an unfinished one yields nothing", () => {
  const { games } = parseScoreboard(
    {
      events: [
        event("NE", "SEA", "2026-09-10T00:20:00Z", {
          completed: true,
          awayScore: "20",
          homeScore: "13",
        }),
        // Live: ESPN already carries a running score. Reading it as final would
        // settle a week on a result that has not happened.
        event("KC", "LAC", "2026-09-13T17:00:00Z", { awayScore: "7", homeScore: "3" }),
      ],
    },
    1,
  );

  assert.equal(games.length, 2);
  assert.deepEqual([games[0].awayScore, games[0].homeScore], [20, 13]);
  assert.deepEqual([games[1].awayScore, games[1].homeScore], [null, null]);
});

test("no broadcast assigned is null, not an empty string", () => {
  // Weeks 16-18 of 2026 arrive this way: 24 games with no network. The screens
  // say "cadena por definir", which they can only do if this is null.
  const { games } = parseScoreboard({ events: [event("NE", "SEA", "2026-12-27T18:00:00Z")] }, 17);
  assert.equal(games[0].network, null);
});

test("a payload with no events is empty rather than a throw", () => {
  assert.deepEqual(parseScoreboard({}, 3).games, []);
  assert.deepEqual(parseScoreboard(null, 3).games, []);
});

test("kickoffs are normalised to UTC ISO regardless of how ESPN writes them", () => {
  // ESPN returns "2026-09-10T00:20Z" — no seconds. The table stores timestamptz
  // and the write decision compares strings, so both sides must be one shape.
  const { games } = parseScoreboard({ events: [event("NE", "SEA", "2026-09-10T00:20Z")] }, 1);
  assert.equal(games[0].kickoffAt, "2026-09-10T00:20:00.000Z");
});

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

test("the label is derived from the Eastern slot, hour gate included", () => {
  // The bug this replaced: a rule that only read the weekday called a week 12
  // Wednesday game "kickoff de temporada" and the Thanksgiving lunch games
  // "Thursday Night".
  assert.equal(venueNote("2026-09-10T00:20:00Z", 1), "Kickoff de temporada"); // Wed, wk 1
  assert.equal(venueNote("2026-11-26T01:15:00Z", 12), "Partido de miércoles"); // Wed, wk 12
  assert.equal(venueNote("2026-11-26T17:00:00Z", 12), "Thanksgiving"); // Thu 12:00 ET
  assert.equal(venueNote("2026-11-27T01:15:00Z", 12), "Thursday Night"); // Thu 20:15 ET
  assert.equal(venueNote("2026-10-13T00:15:00Z", 5), "Monday Night"); // Mon 20:15 ET
  assert.equal(venueNote("2026-10-11T17:00:00Z", 5), null); // Sun 13:00 ET
  assert.equal(venueNote("2026-10-12T00:20:00Z", 5), "Sunday Night"); // Sun 20:20 ET
});

test("an international venue outranks the broadcast slot", () => {
  // A Sunday morning in London is not "Sunday Night", and the city is the more
  // interesting fact: five of them are breakfast in Ciudad Juárez.
  assert.equal(
    venueNote("2026-10-04T13:30:00Z", 4, { city: "London", country: "England" }),
    "London, England",
  );
  assert.equal(
    venueNote("2026-11-15T21:00:00Z", 11, { city: "Ciudad de México", country: "Mexico" }),
    "Ciudad de México, Mexico",
  );
  // A US venue falls through to the slot rule rather than naming the city.
  assert.equal(
    venueNote("2026-10-12T00:20:00Z", 5, { city: "Seattle", country: "USA" }),
    "Sunday Night",
  );
});

// ---------------------------------------------------------------------------
// Week 18's placeholder
// ---------------------------------------------------------------------------

test("sixteen games on one instant is a week the league has not scheduled", () => {
  const same = Array.from({ length: 16 }, () => "2027-01-10T18:00:00Z");
  assert.equal(isPlaceholderWeek(same), true);
  // A real Sunday slot is crowded but never the whole week: the late window and
  // the night game are always somewhere else.
  assert.equal(isPlaceholderWeek([...same.slice(0, 9), "2027-01-10T21:25:00Z"]), false);
  assert.equal(isPlaceholderWeek(["2027-01-10T18:00:00Z"]), false);
  assert.equal(isPlaceholderWeek([]), false);
});

test("a placeholder week is flagged and its labels are not invented", () => {
  const teams = ["NYJ", "BUF", "MIA", "NE", "KC", "LAC", "DEN", "LV", "DAL", "PHI",
    "NYG", "WSH", "GB", "CHI", "MIN", "DET", "SF", "SEA", "ARI", "LAR",
    "TB", "ATL", "NO", "CAR", "BAL", "PIT", "CLE", "CIN", "HOU", "IND", "JAX", "TEN"];
  const events = [];
  for (let i = 0; i < 32; i += 2) {
    events.push(event(teams[i], teams[i + 1], "2027-01-10T18:00:00Z"));
  }
  const parsed = parseScoreboard({ events }, 18);

  assert.equal(parsed.placeholder, true);
  assert.equal(parsed.games.length, 16);
  // 18:00Z is 13:00 ET on a Sunday, which derives to null anyway — but a
  // placeholder at 20:20Z would derive "Sunday Night" for all sixteen, and that
  // is a label about nothing. Blanked here, preserved by planWrite.
  assert.ok(parsed.games.every((g) => g.venueNote === null));
});

// ---------------------------------------------------------------------------
// The write decision
// ---------------------------------------------------------------------------

test("a stored score is never blanked by an unscored payload", () => {
  // The shape of a transient ESPN hiccup. Writing it back would un-settle a
  // week that already paid out.
  const plan = planWrite(incoming(), stored({ awayScore: 20 }), { seasonId: SEASON });
  assert.deepEqual(plan, { kind: "skip", reason: "already_scored" });
});

test("a scored game is never moved", () => {
  // ESPN re-stating a played game at a different instant must not rewrite the
  // kickoff or the label: once the whistle is a fact, the slot is history.
  const plan = planWrite(
    incoming({ kickoffAt: "2026-10-12T00:20:00Z", awayScore: 20, homeScore: 13, venueNote: "Sunday Night" }),
    stored({ awayScore: 20 }),
    { seasonId: SEASON },
  );
  assert.equal(plan.kind, "score");
  assert.deepEqual(
    plan,
    { kind: "score", id: "game-1", awayScore: 20, homeScore: 13, network: "CBS" },
  );
});

test("a known broadcast is never overwritten with nothing", () => {
  // Weeks 16-18 arrive unassigned and fill in over months. Blanking a network
  // every Tuesday would lose the information as fast as it arrives.
  const plan = planWrite(incoming({ network: null }), stored({ network: "NBC" }), {
    seasonId: SEASON,
  });
  assert.equal(plan.kind, "upsert");
  assert.equal(plan.kind === "upsert" && plan.row.network, "NBC");
});

test("a new broadcast does replace an old one", () => {
  const plan = planWrite(incoming({ network: "FOX" }), stored({ network: "NBC" }), {
    seasonId: SEASON,
  });
  assert.equal(plan.kind === "upsert" && plan.row.network, "FOX");
});

test("a label survives a placeholder re-read but not a real reschedule", () => {
  // Same kickoff, no label from the source: the derivation is deterministic, so
  // this is ESPN dropping the venue, not the game losing its slot.
  const kept = planWrite(incoming({ venueNote: null }), stored({ venueNote: "Sunday Night" }), {
    seasonId: SEASON,
  });
  assert.equal(kept.kind === "upsert" && kept.row.venue_note, "Sunday Night");

  // Moved to a Sunday afternoon: it really is not a night game any more.
  const moved = planWrite(
    incoming({ kickoffAt: "2026-10-11T17:00:00Z", venueNote: null }),
    stored({ kickoffAt: "2026-10-12T00:20:00Z", venueNote: "Sunday Night" }),
    { seasonId: SEASON },
  );
  assert.equal(moved.kind === "upsert" && moved.row.venue_note, null);
});

test("a rescheduled unplayed game does move", () => {
  // The other half of week 18: the placeholder kickoff has to be replaceable,
  // or the last jornada locks at a time that was never real.
  const plan = planWrite(
    incoming({ week: 18, kickoffAt: "2027-01-10T21:25:00Z" }),
    stored({ week: 18, kickoffAt: "2027-01-10T18:00:00Z" }),
    { seasonId: SEASON },
  );
  assert.equal(plan.kind === "upsert" && plan.row.kickoff_at, "2027-01-10T21:25:00Z");
});

test("an unseen game is an insert, and voided is never in the payload", () => {
  const plan = planWrite(incoming(), null, { seasonId: SEASON });
  assert.equal(plan.kind, "upsert");
  assert.equal(plan.kind === "upsert" && plan.existing, false);
  // `voided` is the supervisor's decision about a postponed game. An ingest
  // that wrote it would un-annul a game the tenant took out of the scoring.
  assert.ok(plan.kind === "upsert" && !("voided" in plan.row));
});

test("half a score is no score", () => {
  // sport_games_score_pairing refuses it in SQL; refusing it here means the
  // insert never gets that far.
  const plan = planWrite(incoming({ awayScore: 20, homeScore: null }), null, { seasonId: SEASON });
  assert.equal(plan.kind === "upsert" && plan.row.away_score, null);
});

test("scores-only touches nothing it was not asked to", () => {
  const opts = { seasonId: SEASON, scoresOnly: true };
  // Never seeded: the scores pass is not a seeding pass.
  assert.deepEqual(planWrite(incoming({ awayScore: 20, homeScore: 13 }), null, opts), {
    kind: "skip",
    reason: "not_seeded",
  });
  // Not played yet: the normal answer for most of a Tuesday morning read.
  assert.deepEqual(planWrite(incoming(), stored(), opts), { kind: "skip", reason: "no_score_yet" });
  // Played: the one thing it does.
  assert.deepEqual(
    planWrite(incoming({ awayScore: 20, homeScore: 13 }), stored(), opts),
    { kind: "score", id: "game-1", awayScore: 20, homeScore: 13, network: "CBS" },
  );
});

test("a zero is a score", () => {
  // The falsy trap. A 0-0 game is rare and a 20-0 game is not, and `!score`
  // would read either as "not played".
  const plan = planWrite(incoming({ awayScore: 0, homeScore: 0 }), stored(), {
    seasonId: SEASON,
    scoresOnly: true,
  });
  assert.equal(plan.kind, "score");
});

// ---------------------------------------------------------------------------
// Which weeks to pull
// ---------------------------------------------------------------------------

test("the window is the open week and the two ahead of it", () => {
  // On Tuesday morning the open week is still the one that just finished — the
  // settle runs an hour later — so this covers the closed week and what players
  // are about to look at.
  assert.deepEqual(weeksAround(1, 18), [1, 2, 3]);
  assert.deepEqual(weeksAround(9, 18), [9, 10, 11]);
});

test("near the end the window slides back instead of shrinking", () => {
  // Week 18 is the one that arrives as a placeholder and MUST be re-read. It
  // stays in the window for the last three Tuesdays rather than falling out.
  assert.deepEqual(weeksAround(17, 18), [16, 17, 18]);
  assert.deepEqual(weeksAround(18, 18), [16, 17, 18]);
  // Past the end: the season is over, but the call still returns real weeks
  // rather than 19 and 20.
  assert.deepEqual(weeksAround(19, 18), [16, 17, 18]);
  assert.deepEqual(weeksAround(1, 2), [1, 2]);
});

// ---------------------------------------------------------------------------
// The arithmetic that catches a missing week
// ---------------------------------------------------------------------------

test("272 = 32 × 17 ÷ 2, and anything else stops the write", () => {
  const teams = ["NE", "SEA", "KC", "LAC"];
  const full: IngestGame[] = [];
  for (let i = 0; i < 272; i += 1) {
    full.push(incoming({ away: teams[i % 2], home: teams[2 + (i % 2)] }));
  }
  // Right count, wrong teams: still a failure, and it has to be, because the
  // count alone would pass a season that lost a franchise.
  assert.equal(checkFullSeason(full).ok, false);
  assert.equal(checkFullSeason(full).games, 272);

  assert.equal(checkFullSeason(full.slice(0, 271)).ok, false);
  assert.match(checkFullSeason([]).reason ?? "", /272 partidos y 32 equipos/);
});

test("a game without both teams stops everything", () => {
  const bad = missingTeams([incoming(), incoming({ home: "" })]);
  assert.equal(bad.length, 1);
});

test("the key that matches a payload to a stored row", () => {
  assert.equal(gameKey({ week: 5, away: "NE", home: "SEA" }), "5|NE|SEA");
  // Washington is WSH in ESPN, not WAS — the only team whose own abbreviation
  // and ESPN's disagree, and the key is what would silently duplicate it.
  assert.notEqual(gameKey({ week: 5, away: "WSH", home: "DAL" }), gameKey({ week: 5, away: "WAS", home: "DAL" }));
});

// Reading the calendar, and saying what time it is in the tenant's town.
//
// Pure except for `now`, which every function takes as an argument rather than
// calling Date.now() itself. That is what makes "is this week open" testable
// at any point in a season that has not happened yet.

import type { Game, Week, WeekState } from "./schema";

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------
//
// THE RULE: format with Intl in the tenant's zone. Never arithmetic on offsets.
//
// Ciudad Juárez runs on Mountain time, synced to El Paso rather than Central
// like the rest of Chihuahua, and daylight saving ends on 1 November 2026 —
// week 9 of an eighteen-week season. A fixed ET−2 is correct until then and
// wrong afterwards, by exactly one hour. One hour is the difference between a
// player thinking they have time to send their picks and finding the week
// locked, which is a complaint they would be right to make.

const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * "Mié 9 sep" — the weekday and date a player recognises.
 *
 * es-MX renders this as "mié, 9 de sep." Correct Spanish, and three tokens of
 * punctuation and preposition on a line that also has to carry a kickoff time
 * and a TV network inside 390px. The demo dropped them and the client signed
 * off on that, so the comma, the periods and the "de" come out here rather
 * than being fought with CSS.
 */
export const formatDay = (iso: string, tz: string, locale = "es-MX"): string =>
  capitalise(
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: tz,
    })
      .format(new Date(iso))
      .replace(/\./g, "")
      .replace(/,/g, "")
      .replace(/\bde\b\s*/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );

/**
 * "6:20 PM".
 *
 * es-MX renders the marker as "p. m." — lowercase, with periods and a space
 * inside it. Correct Spanish typography, and four extra characters on a line
 * that already wraps on a 390px phone. The periods come out and the whole thing
 * goes uppercase, which is what the demo showed the client.
 */
export const formatTime = (iso: string, tz: string, locale = "es-MX"): string =>
  new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  })
    .format(new Date(iso))
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

/** "mié 9 sep · 6:20 PM". */
export const formatKickoff = (iso: string, tz: string, locale = "es-MX"): string =>
  `${formatDay(iso, tz, locale)} · ${formatTime(iso, tz, locale)}`;

/** Whether two instants land on the same calendar day in the tenant's zone. */
export const sameLocalDay = (a: string, b: string, tz: string): boolean => {
  const key = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: tz,
    }).format(new Date(iso));
  return key(a) === key(b);
};

// ---------------------------------------------------------------------------
// Weeks
// ---------------------------------------------------------------------------

/**
 * When a week's picks close: its first kickoff.
 *
 * Never a weekday. The deck promised "picks close at Thursday kickoff" and
 * week 1 of 2026 opens on a Wednesday — 9 September, 6:20 PM Juárez. Voided
 * games are excluded, so annulling the only Wednesday game moves the lock to
 * the next one rather than leaving it in the past.
 */
export const lockOf = (games: Game[]): string | null => {
  const live = games.filter((g) => !g.voided);
  if (!live.length) return null;
  return live.reduce((min, g) => (g.kickoffAt < min ? g.kickoffAt : min), live[0].kickoffAt);
};

/**
 * The game whose total points the tiebreak predicts: the last to kick off.
 * Mirrors `pickem_closing_game` in SQL, including the id tiebreak, so the
 * screen names the same match the scorer will use.
 */
export const closingGame = (games: Game[]): Game | null => {
  const live = games.filter((g) => !g.voided);
  if (!live.length) return null;
  return live.reduce((last, g) => {
    if (g.kickoffAt > last.kickoffAt) return g;
    if (g.kickoffAt === last.kickoffAt && g.id > last.id) return g;
    return last;
  }, live[0]);
};

/**
 * Where a week stands.
 *
 * `openWeek` comes from the programme and is the only week that accepts picks.
 * The clock decides the rest, because a week whose kickoff has passed is frozen
 * whether or not anybody has settled it yet — the cron runs Tuesday morning and
 * the games end Monday night, and nothing may be editable in between.
 */
export const weekStateOf = (
  week: number,
  openWeek: number,
  lockAt: string | null,
  settled: boolean,
  now: Date,
): WeekState => {
  if (settled) return "settled";
  if (week > openWeek) return "upcoming";
  if (lockAt && now.getTime() >= new Date(lockAt).getTime()) return "running";
  if (week === openWeek) return "open";
  // Behind the open week but unsettled: the games are played, the settle has
  // not run. Same frozen state as `running`; there is nothing else to say.
  return "running";
};

export const buildWeek = (
  week: number,
  games: Game[],
  openWeek: number,
  settled: boolean,
  now: Date,
): Week => {
  const ordered = [...games].sort((a, b) =>
    a.kickoffAt === b.kickoffAt ? a.id.localeCompare(b.id) : a.kickoffAt.localeCompare(b.kickoffAt),
  );
  const lockAt = lockOf(ordered);
  return {
    week,
    state: weekStateOf(week, openWeek, lockAt, settled, now),
    games: ordered,
    lockAt,
  };
};

// ---------------------------------------------------------------------------
// Counting down
// ---------------------------------------------------------------------------

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True once the lock has passed. */
  done: boolean;
}

export const countdownTo = (iso: string, now: Date): Countdown => {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    done: false,
  };
};

/**
 * Whether picks sent now would earn the early-bird bonus.
 *
 * Shown before the player commits, because a bonus nobody knows about does not
 * change when they play — and moving the Sunday-night rush earlier is the whole
 * reason the bonus exists.
 */
export const qualifiesEarly = (lockAt: string | null, earlyHours: number, now: Date): boolean =>
  lockAt !== null && new Date(lockAt).getTime() - now.getTime() >= earlyHours * 3600 * 1000;

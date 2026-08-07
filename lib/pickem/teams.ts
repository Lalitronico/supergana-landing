// The 32 clubs: how each one is named, the colour that identifies it, and its
// crest.
//
// CRESTS: on 2026-08-08 the product owner decided the programme ships with the
// official club crests. The trademark exposure was raised twice and the call
// was made with it on the table; this file records the decision, it does not
// re-argue it. The art lives in public/nfl/<abbr>.png — 32 PNGs at 160×160
// with transparency, served from our own origin rather than hotlinked from
// ESPN's CDN the way the demo did it.
//
// The colour + abbreviation tile that used to be the only rendering is NOT
// gone. It is the fallback now: `crest` is null for any club this table does
// not know, and TeamMark falls back to the tile whenever it is. That path
// stays alive because a schedule ingested from an external API will eventually
// carry a code nobody added here, and a relocation or expansion club will
// arrive months before anyone finds art for it.
//
// The tile stays LIGHT regardless of the club, crest or not. A navy crest on
// navy (Cowboys) or a purple one on purple (Ravens) vanishes into its own
// background, and on the dark surfaces of the system it disappears entirely.
// The colour belongs in the underline, not behind the mark.
//
// Abbreviations are ESPN's, because ESPN is where the schedule comes from and
// a second vocabulary would need a translation table that could disagree.
// WASHINGTON IS "WSH" THERE, NOT "WAS" — the one club whose own abbreviation
// and ESPN's do not match. The crest files follow the same vocabulary
// (public/nfl/wsh.png), so the filename never needs a translation either.

export interface Team {
  /** Club name, as a fan says it. */
  name: string;
  /** City, shown small under the name. Spanish where Spanish is what is said. */
  city: string;
  /** Primary colour. Used in the tile's underline, never as a background. */
  color: string;
  /**
   * Public path to the club's crest, or null when there is none and the
   * colour + abbreviation tile has to carry the mark on its own.
   */
  crest: string | null;
}

/**
 * Name, city and colour. The crest path is derived below rather than written
 * out 32 times: one PNG per entry is exactly the invariant, and repeating
 * `crest: "/nfl/ari.png"` on every line is 32 chances to typo a filename into
 * a 404 that nothing would catch.
 */
const CLUBS: Record<string, Omit<Team, "crest">> = {
  ARI: { name: "Cardinals", city: "Arizona", color: "#97233F" },
  ATL: { name: "Falcons", city: "Atlanta", color: "#A71930" },
  BAL: { name: "Ravens", city: "Baltimore", color: "#241773" },
  BUF: { name: "Bills", city: "Buffalo", color: "#00338D" },
  CAR: { name: "Panthers", city: "Carolina", color: "#0085CA" },
  CHI: { name: "Bears", city: "Chicago", color: "#0B162A" },
  CIN: { name: "Bengals", city: "Cincinnati", color: "#FB4F14" },
  CLE: { name: "Browns", city: "Cleveland", color: "#FF3C00" },
  DAL: { name: "Cowboys", city: "Dallas", color: "#041E42" },
  DEN: { name: "Broncos", city: "Denver", color: "#FB4F14" },
  DET: { name: "Lions", city: "Detroit", color: "#0076B6" },
  GB: { name: "Packers", city: "Green Bay", color: "#203731" },
  HOU: { name: "Texans", city: "Houston", color: "#03202F" },
  IND: { name: "Colts", city: "Indianapolis", color: "#002C5F" },
  JAX: { name: "Jaguars", city: "Jacksonville", color: "#006778" },
  KC: { name: "Chiefs", city: "Kansas City", color: "#E31837" },
  LAC: { name: "Chargers", city: "Los Angeles", color: "#0080C6" },
  LAR: { name: "Rams", city: "Los Angeles", color: "#003594" },
  LV: { name: "Raiders", city: "Las Vegas", color: "#A5ACAF" },
  MIA: { name: "Dolphins", city: "Miami", color: "#008E97" },
  MIN: { name: "Vikings", city: "Minnesota", color: "#4F2683" },
  NE: { name: "Patriots", city: "New England", color: "#002244" },
  NO: { name: "Saints", city: "New Orleans", color: "#D3BC8D" },
  NYG: { name: "Giants", city: "Nueva York", color: "#0B2265" },
  NYJ: { name: "Jets", city: "Nueva York", color: "#125740" },
  PHI: { name: "Eagles", city: "Philadelphia", color: "#004C54" },
  PIT: { name: "Steelers", city: "Pittsburgh", color: "#FFB612" },
  SEA: { name: "Seahawks", city: "Seattle", color: "#69BE28" },
  SF: { name: "49ers", city: "San Francisco", color: "#AA0000" },
  TB: { name: "Buccaneers", city: "Tampa Bay", color: "#D50A0A" },
  TEN: { name: "Titans", city: "Tennessee", color: "#4B92DB" },
  WSH: { name: "Commanders", city: "Washington", color: "#5A1414" },
};

/**
 * Where a club's crest lives, by its ESPN abbreviation. Lowercased because
 * that is how the files are named, and case-sensitive filesystems (Vercel's
 * build container, unlike Windows) would 404 on `/nfl/ARI.png`.
 */
export const crestPath = (abbr: string): string => `/nfl/${abbr.toLowerCase()}.png`;

export const TEAMS: Record<string, Team> = Object.fromEntries(
  Object.entries(CLUBS).map(([abbr, club]) => [abbr, { ...club, crest: crestPath(abbr) }]),
);

/**
 * A club the table does not know still renders, as its own abbreviation in
 * grey and with no crest. The alternative is a blank tile or a crash on a
 * relocation or an expansion team, and a schedule ingested from an external
 * API will eventually carry a code nobody added here.
 */
export const teamOf = (abbr: string): Team =>
  TEAMS[abbr] ?? { name: abbr, city: "", color: "#6b665b", crest: null };

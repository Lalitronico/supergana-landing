// The 32 clubs: how each one is named, and the colour that identifies it.
//
// NO LOGOS. The league's shield and every club crest are registered
// trademarks, and the programme launches without a licence for them. The demo
// embedded all 32 from ESPN's CDN, which was fine for a private artifact shown
// to one client and is not fine for a page on the open internet.
//
// What replaces them is a light tile carrying the three-letter abbreviation,
// with the club's colour in an underline. It reads well and creates no
// exposure. If a licence is ever obtained, `crest` is where the art goes and
// nothing else has to change — which is why the fallback was built first
// rather than as a contingency.
//
// The tile stays LIGHT regardless of the club. A navy crest on navy (Cowboys)
// or a purple one on purple (Ravens) vanishes into its own background, and on
// the dark surfaces of the system it disappears entirely. The colour belongs
// in the underline, not behind the mark.
//
// Abbreviations are ESPN's, because ESPN is where the schedule comes from and
// a second vocabulary would need a translation table that could disagree.
// WASHINGTON IS "WSH" THERE, NOT "WAS" — the one club whose own abbreviation
// and ESPN's do not match.

export interface Team {
  /** Club name, as a fan says it. */
  name: string;
  /** City, shown small under the name. Spanish where Spanish is what is said. */
  city: string;
  /** Primary colour. Used in the tile's underline, never as a background. */
  color: string;
}

export const TEAMS: Record<string, Team> = {
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
 * A club the table does not know still renders, as its own abbreviation in
 * grey. The alternative is a blank tile or a crash on a relocation or an
 * expansion team, and a schedule ingested from an external API will eventually
 * carry a code nobody added here.
 */
export const teamOf = (abbr: string): Team =>
  TEAMS[abbr] ?? { name: abbr, city: "", color: "#6b665b" };

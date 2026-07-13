import { SEMIFINALISTS, type MundialTeamId } from "./teams";

// Player data for the final's extra questions. Verified 2026-07-07 against
// tournament coverage (Olympics/CNN goleadores + ESPN/El Tiempo team profiles):
// Messi leads scoring (8), Mbappé & Haaland (7). Team stars confirmed active
// in the 2026 squads. Belgium star (Lukaku) chosen by the client.

export interface MundialPlayer {
  id: string;
  name: string;
  team: MundialTeamId;
}

// One marquee star per remaining team — options for "estrella de la final".
export const FINAL_STARS: MundialPlayer[] = [
  { id: "messi", name: "Lionel Messi", team: "arg" },
  { id: "mbappe", name: "Kylian Mbappé", team: "fra" },
  { id: "yamal", name: "Lamine Yamal", team: "esp" },
  { id: "lukaku", name: "Romelu Lukaku", team: "bel" },
  { id: "haaland", name: "Erling Haaland", team: "nor" },
  { id: "kane", name: "Harry Kane", team: "eng" },
  { id: "hakimi", name: "Achraf Hakimi", team: "mar" },
  { id: "xhaka", name: "Granit Xhaka", team: "sui" },
];

// Top-scorer candidates — current leaders plus dangerous strikers of the 8
// remaining teams. "otro" covers anyone outside the shortlist.
export const TOP_SCORER_CANDIDATES: MundialPlayer[] = [
  { id: "messi", name: "Lionel Messi", team: "arg" },
  { id: "mbappe", name: "Kylian Mbappé", team: "fra" },
  { id: "haaland", name: "Erling Haaland", team: "nor" },
  { id: "kane", name: "Harry Kane", team: "eng" },
  { id: "julian", name: "Julián Álvarez", team: "arg" },
  { id: "lautaro", name: "Lautaro Martínez", team: "arg" },
  { id: "bellingham", name: "Jude Bellingham", team: "eng" },
  { id: "yamal", name: "Lamine Yamal", team: "esp" },
  { id: "embolo", name: "Breel Embolo", team: "sui" },
  { id: "lukaku", name: "Romelu Lukaku", team: "bel" },
];

export const TOP_SCORER_IDS = [...TOP_SCORER_CANDIDATES.map((p) => p.id), "otro"] as const;
export const FINAL_STAR_IDS = FINAL_STARS.map((p) => p.id) as [string, ...string[]];

// New entries only pick a final star whose team can still reach the final.
// The full FINAL_STARS list stays for resolving labels of older entries.
export const FINAL_STARS_ACTIVE = FINAL_STARS.filter((p) =>
  SEMIFINALISTS.includes(p.team),
);
export const FINAL_STAR_ACTIVE_IDS = FINAL_STARS_ACTIVE.map((p) => p.id) as [
  string,
  ...string[],
];

export const FINAL_ENDINGS = [
  { id: "90", label: "En los 90 minutos" },
  { id: "et", label: "En tiempo extra" },
  { id: "pens", label: "En penales" },
] as const;

export const FINAL_ENDING_IDS = FINAL_ENDINGS.map((e) => e.id) as [string, ...string[]];

const scorerById = new Map(TOP_SCORER_CANDIDATES.map((p) => [p.id, p]));
const starById = new Map(FINAL_STARS.map((p) => [p.id, p]));

export const topScorerLabel = (id: string | null | undefined): string =>
  id === "otro"
    ? "Otro jugador"
    : (scorerById.get(id ?? "")?.name ?? id ?? "");

export const finalStarLabel = (id: string | null | undefined): string =>
  starById.get(id ?? "")?.name ?? id ?? "";

export const finalEndingLabel = (id: string | null | undefined): string =>
  FINAL_ENDINGS.find((e) => e.id === id)?.label ?? id ?? "";

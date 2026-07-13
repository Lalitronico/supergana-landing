// World Cup 2026 knockout bracket — verified 2026-07-07 (SI, CNN, ESPN, NBC).
// QF4 is decided by tonight's round-of-16 games (Argentina-Egipto and
// Suiza-Colombia). All four candidates live in the registry; update QF4 below
// as soon as the winners are known and flip `pendingConfirmation` to false.

export type MundialTeamId =
  | "fra"
  | "mar"
  | "esp"
  | "bel"
  | "nor"
  | "eng"
  | "arg"
  | "egy"
  | "sui"
  | "col";

export interface MundialTeam {
  id: MundialTeamId;
  name: string;
  flag: string;
  color: string;
}

export const MUNDIAL_TEAMS: Record<MundialTeamId, MundialTeam> = {
  fra: { id: "fra", name: "Francia", flag: "🇫🇷", color: "#1E90FF" },
  mar: { id: "mar", name: "Marruecos", flag: "🇲🇦", color: "#E63946" },
  esp: { id: "esp", name: "España", flag: "🇪🇸", color: "#F5C211" },
  bel: { id: "bel", name: "Bélgica", flag: "🇧🇪", color: "#FF4757" },
  nor: { id: "nor", name: "Noruega", flag: "🇳🇴", color: "#1769BF" },
  eng: { id: "eng", name: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", color: "#2ECC71" },
  arg: { id: "arg", name: "Argentina", flag: "🇦🇷", color: "#1E90FF" },
  egy: { id: "egy", name: "Egipto", flag: "🇪🇬", color: "#E63946" },
  sui: { id: "sui", name: "Suiza", flag: "🇨🇭", color: "#FF4757" },
  col: { id: "col", name: "Colombia", flag: "🇨🇴", color: "#FFD93D" },
};

// CONFIRMADO 2026-07-07: Argentina 3-2 Egipto y Suiza eliminó a Colombia.
// Cuarto de final 4: Argentina vs Suiza.
const QF4_HOME: MundialTeamId = "arg";
const QF4_AWAY: MundialTeamId = "sui";
const QF4_PENDING = false;

export type QuarterfinalId = "qf1" | "qf2" | "qf3" | "qf4";

export interface QuarterfinalMatch {
  id: QuarterfinalId;
  home: MundialTeamId;
  away: MundialTeamId;
  venue: string;
  kickoff: string; // UTC ISO
  kickoffLabel: string; // human label, hora CDMX
  pendingConfirmation?: boolean;
}

export const QUARTERFINALS: QuarterfinalMatch[] = [
  {
    id: "qf1",
    home: "fra",
    away: "mar",
    venue: "Boston",
    kickoff: "2026-07-09T20:00:00Z",
    kickoffLabel: "Jue 9 jul · 14:00 CDMX",
  },
  {
    id: "qf2",
    home: "esp",
    away: "bel",
    venue: "Los Ángeles",
    kickoff: "2026-07-10T19:00:00Z",
    kickoffLabel: "Vie 10 jul · 13:00 CDMX",
  },
  {
    id: "qf3",
    home: "nor",
    away: "eng",
    venue: "Miami",
    kickoff: "2026-07-11T21:00:00Z",
    kickoffLabel: "Sáb 11 jul · 15:00 CDMX",
  },
  {
    id: "qf4",
    home: QF4_HOME,
    away: QF4_AWAY,
    venue: "Kansas City",
    kickoff: "2026-07-12T01:00:00Z",
    kickoffLabel: "Sáb 11 jul · 19:00 CDMX",
    pendingConfirmation: QF4_PENDING,
  },
];

// Bracket sides: winners of qf1/qf2 meet in semifinal 1 (Dallas, 14 jul);
// winners of qf3/qf4 meet in semifinal 2 (Atlanta, 15 jul).
export interface SemifinalSlot {
  id: "sf1" | "sf2";
  label: string;
  detail: string;
  candidates: MundialTeamId[];
}

// CONFIRMADO 2026-07-13 (resultados de cuartos capturados en el admin):
// avanzan Francia, España, Inglaterra y Argentina.
export const SEMIFINALISTS: MundialTeamId[] = ["fra", "esp", "eng", "arg"];

export const SEMIFINALS: SemifinalSlot[] = [
  {
    id: "sf1",
    label: "Finalista del lado A",
    detail: "Semifinal 1 · Dallas · Mar 14 jul — Francia vs España",
    candidates: ["fra", "esp"],
  },
  {
    id: "sf2",
    label: "Finalista del lado B",
    detail: "Semifinal 2 · Atlanta · Mié 15 jul — Inglaterra vs Argentina",
    candidates: ["eng", "arg"],
  },
];

/** Every team still alive (the 8 quarterfinalists). */
export const ALIVE_TEAMS: MundialTeamId[] = QUARTERFINALS.flatMap((m) => [
  m.home,
  m.away,
]);

export const teamById = (id: string): MundialTeam | null =>
  (MUNDIAL_TEAMS as Record<string, MundialTeam>)[id] ?? null;

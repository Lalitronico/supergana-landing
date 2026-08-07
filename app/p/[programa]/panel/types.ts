// The panel's payload, exactly as `/api/pickem/[programa]/panel/` sends it.
//
// Declared here rather than imported from lib/pickem/staff.ts on purpose: that
// module is server-only — it reaches for the service-role client — and these
// are the shapes a Client Component holds. Same discipline as
// app/admin/[campana]/types.ts.

export type StaffRole = "reviewer" | "supervisor" | "finance" | "admin";
export type ProgramStatus = "draft" | "live" | "paused" | "closed";
export type AwardStatus = "pending" | "redeemed" | "expired" | "canceled";

export interface PanelProgram {
  slug: string;
  name: string;
  orgName: string;
  status: ProgramStatus;
  openWeek: number;
  totalWeeks: number;
  timezone: string;
  venues: string[];
}

export interface PanelStaff {
  email: string;
  role: StaffRole;
  /** Closing, breaking a tie, annulling a game, correcting the ledger. */
  canOperate: boolean;
  /** Validating a code at the counter. Every seat has this one. */
  canRedeem: boolean;
}

export interface PanelGame {
  id: string;
  week: number;
  away: string;
  home: string;
  kickoffAt: string;
  network: string | null;
  awayScore: number | null;
  homeScore: number | null;
  voided: boolean;
}

export interface WeekReadiness {
  total: number;
  live: number;
  voided: number;
  scored: number;
  missing: PanelGame[];
  ready: boolean;
}

export interface TieRow {
  participantId: string;
  alias: string;
  venue: string | null;
  points: number;
}

export interface TieState {
  top: number;
  rows: TieRow[];
  tied: boolean;
  awarded: boolean;
}

export interface WeekAward {
  id: string;
  code: string;
  alias: string;
  place: number;
  status: AwardStatus;
  prizeName: string;
  expiresAt: string;
  redeemedAt: string | null;
  redeemedVenue: string | null;
}

export interface WeekSnapshot {
  week: number;
  openWeek: number;
  totalWeeks: number;
  games: PanelGame[];
  readiness: WeekReadiness;
  entries: { total: number; settled: number };
  settled: boolean;
  tie: TieState | null;
  awards: WeekAward[];
}

export interface PanelData {
  program: PanelProgram;
  staff: PanelStaff;
  week: WeekSnapshot;
  pendingAwards: WeekAward[];
}

export interface AwardLookup {
  code: string;
  alias: string;
  prize: string;
  detail: string | null;
  week: number | null;
  place: number;
  status: AwardStatus;
  /** The deadline has passed, whatever the stored status still says. */
  expired: boolean;
  expiresAt: string;
  redeemedAt: string | null;
  redeemedVenue: string | null;
}

export interface PlayerHit {
  participantId: string;
  alias: string;
  phone: string | null;
  verified: boolean;
}

export interface LedgerLine {
  id: string;
  kind: string;
  points: number;
  note: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface PlayerLedger {
  participantId: string;
  alias: string;
  total: number;
  lines: LedgerLine[];
}

/** The three screens. `caja` is the one a branch tablet stays on all day. */
export type PanelView = "jornada" | "caja" | "ajustes";

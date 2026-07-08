import { z } from "zod";
import { ALIVE_TEAMS, SEMIFINALS } from "./teams";
import { FINAL_ENDING_IDS, FINAL_STAR_IDS, TOP_SCORER_IDS } from "./players";

const teamId = z.enum(ALIVE_TEAMS as [string, ...string[]]);

const sf1Candidates = SEMIFINALS[0].candidates as [string, ...string[]];
const sf2Candidates = SEMIFINALS[1].candidates as [string, ...string[]];

// A predicted / real exact score. Compared unordered when scoring (2-1 == 1-2)
// because the semis/final teams are unknown at fill time.
export const scoreSchema = z.object({
  home: z.number().int().min(0).max(9),
  away: z.number().int().min(0).max(9),
});
export type ScorePrediction = z.infer<typeof scoreSchema>;

// Answers stored as jsonb in mundial_entries.answers: 4 quarterfinal winners,
// the 2 finalists, the champion, plus one exact-score tiebreaker per stage.
// A stage prize goes to the entrant(s) who hit that stage AND land closest to
// its key-match score.
export const mundialAnswersSchema = z.object({
  qf1: teamId,
  qf2: teamId,
  qf3: teamId,
  qf4: teamId,
  sf1: z.enum(sf1Candidates),
  sf2: z.enum(sf2Candidates),
  champion: teamId,
  tiebreakers: z.object({
    cuartos: scoreSchema,
    semis: scoreSchema,
    final: scoreSchema,
  }),
  // Extra final questions (also act as deeper tiebreakers for the final prize).
  topScorer: z.enum(TOP_SCORER_IDS as unknown as [string, ...string[]]),
  finalStar: z.enum(FINAL_STAR_IDS),
  finalEnding: z.enum(FINAL_ENDING_IDS),
});

export type MundialAnswers = z.infer<typeof mundialAnswersSchema>;

export const mundialSubmissionSchema = z.object({
  ticket: z.uuid(),
  fullName: z.string().trim().min(2).max(80),
  email: z.email(),
  phone: z.string().trim().min(7).max(24),
  acceptedRules: z.literal(true),
  answers: mundialAnswersSchema,
});

export type MundialSubmission = z.infer<typeof mundialSubmissionSchema>;

// Rows as read by the admin panel / API routes (service role).
export interface MundialTicketRow {
  id: string;
  email: string | null;
  source: "stripe" | "manual";
  stripe_session_id: string | null;
  amount_usd: number;
  status: "paid" | "refunded";
  note: string | null;
  created_at: string;
  used_at: string | null;
}

export interface MundialEntryRow {
  id: string;
  ticket_id: string;
  full_name: string;
  email: string;
  phone: string;
  answers: MundialAnswers;
  created_at: string;
}

export interface MundialResultsRow {
  qf_winners: Partial<Record<"qf1" | "qf2" | "qf3" | "qf4", string>>;
  finalists: string[];
  champion: string | null;
  tiebreaker_scores: Partial<Record<"cuartos" | "semis" | "final", ScorePrediction>>;
  final_extras: { topScorer?: string; star?: string; ending?: string };
}

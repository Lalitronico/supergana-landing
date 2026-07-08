// Winner computation per stage:
// - Cuartos: acertar LOS 4 equipos que avanzan a semifinales.
// - Semifinales: acertar LOS 2 finalistas.
// - Final: acertar al campeón.
// The stage prize goes to the entrant(s) who hit the stage AND land closest to
// the exact score of that stage's key match (the tiebreaker). Exact score =
// distance 0; among equal-distance hitters the prize splits.
// If NOBODY hits a stage, its pot rolls over to the final prize.
// Scores are compared unordered (2-1 == 1-2) — semis/final teams are unknown
// at fill time.

import { eligibleStages, type Stage } from "./config";
import type { MundialEntryRow, MundialResultsRow, ScorePrediction } from "./schema";

export interface StageWinnerRow {
  entryId: string;
  fullName: string;
  email: string;
  submittedAt: string;
  distance: number; // goal distance to the real key-match score (0 = exact)
}

export interface StageOutcome {
  stage: Stage;
  /** Both the stage result AND its tiebreaker score must be captured. */
  ready: boolean;
  eligibleCount: number;
  hitCount: number; // how many eligible entries hit the stage perfectly
  winners: StageWinnerRow[]; // hitters closest on the tiebreaker
}

// Cuartos compares ordered (teams are known: home = Argentina, away = Suiza).
// Semis/final compare unordered (2-1 == 1-2) since their teams are unknown at
// fill time.
export const scoreDistance = (
  a: ScorePrediction,
  b: ScorePrediction,
  ordered: boolean,
): number => {
  if (ordered) {
    return Math.abs(a.home - b.home) + Math.abs(a.away - b.away);
  }
  const pa = [a.home, a.away].sort((x, y) => x - y);
  const pb = [b.home, b.away].sort((x, y) => x - y);
  return Math.abs(pa[0] - pb[0]) + Math.abs(pa[1] - pb[1]);
};

const eligibleFor = (stage: Stage, entries: MundialEntryRow[]) =>
  entries.filter((e) => eligibleStages(new Date(e.created_at)).includes(stage));

const stageHitters = (
  stage: Stage,
  entries: MundialEntryRow[],
  results: MundialResultsRow,
): { hitters: MundialEntryRow[]; resultReady: boolean } => {
  const eligible = eligibleFor(stage, entries);

  if (stage === "cuartos") {
    const matches = ["qf1", "qf2", "qf3", "qf4"] as const;
    const resultReady = matches.every((m) => Boolean(results.qf_winners[m]));
    const hitters = resultReady
      ? eligible.filter((e) => matches.every((m) => e.answers[m] === results.qf_winners[m]))
      : [];
    return { hitters, resultReady };
  }

  if (stage === "semis") {
    const resultReady = results.finalists.length === 2;
    const finalists = new Set(results.finalists);
    const hitters = resultReady
      ? eligible.filter((e) => finalists.has(e.answers.sf1) && finalists.has(e.answers.sf2))
      : [];
    return { hitters, resultReady };
  }

  const resultReady = Boolean(results.champion);
  const hitters = resultReady
    ? eligible.filter((e) => e.answers.champion === results.champion)
    : [];
  return { hitters, resultReady };
};

export function stageOutcome(
  stage: Stage,
  entries: MundialEntryRow[],
  results: MundialResultsRow,
): StageOutcome {
  const eligibleCount = eligibleFor(stage, entries).length;
  const { hitters, resultReady } = stageHitters(stage, entries, results);
  const realScore = results.tiebreaker_scores[stage];

  // Need the stage result to know who hit; need the key-match score to rank
  // them. A stage with hitters but no captured score is not final.
  const ready = resultReady && (hitters.length === 0 || Boolean(realScore));

  let winners: StageWinnerRow[] = [];
  if (resultReady && hitters.length > 0 && realScore) {
    const ordered = stage === "cuartos";
    const extras = results.final_extras ?? {};
    const ranked = hitters.map((e) => {
      const distance = scoreDistance(e.answers.tiebreakers[stage], realScore, ordered);
      // The final has three deeper tiebreakers after the score: how it ended,
      // top scorer, final star. Each only counts if its real value is captured.
      // A single lexicographic key keeps score >> ending >> scorer >> star.
      let rank = distance;
      if (stage === "final") {
        const endingWrong = extras.ending && e.answers.finalEnding !== extras.ending ? 1 : 0;
        const scorerWrong = extras.topScorer && e.answers.topScorer !== extras.topScorer ? 1 : 0;
        const starWrong = extras.star && e.answers.finalStar !== extras.star ? 1 : 0;
        rank = distance * 1000 + endingWrong * 100 + scorerWrong * 10 + starWrong;
      }
      return {
        entryId: e.id,
        fullName: e.full_name,
        email: e.email,
        submittedAt: e.created_at,
        distance,
        rank,
      };
    });
    const best = Math.min(...ranked.map((r) => r.rank));
    winners = ranked
      .filter((r) => r.rank === best)
      .map((r) => ({
        entryId: r.entryId,
        fullName: r.fullName,
        email: r.email,
        submittedAt: r.submittedAt,
        distance: r.distance,
      }))
      .sort(
        (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
      );
  }

  return { stage, ready, eligibleCount, hitCount: hitters.length, winners };
}

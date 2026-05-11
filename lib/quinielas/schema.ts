export type TeamId = "psg" | "arsenal";

export type QuestionCategory =
  | "resultado"
  | "goles"
  | "disciplina"
  | "show"
  | "legendaria"
  | "tiebreaker";

export type QuestionType =
  | "team-duel"
  | "score-picker"
  | "player-card"
  | "choice"
  | "yes-no"
  | "range-choice"
  | "drama-meter"
  | "time-tiebreaker";

export interface TeamInfo {
  id: TeamId;
  label: string;
  shortLabel: string;
  color: string;
  accent: string;
  crestAsset: string;
  mascotAsset: string;
}

export interface PlayerOption {
  id: string;
  label: string;
  team: TeamId | "neutral";
  asset?: string;
  assetFit?: "photo" | "sticker";
  meta?: string;
}

export interface ChoiceOption {
  id: string;
  label: string;
  caption?: string;
  asset?: string;
  color?: string;
}

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  category: QuestionCategory;
  prompt: string;
  kicker: string;
  shortLabel: string;
  points: number;
  badge?: "bonus" | "legendaria" | "multiplicador";
  helper?: string;
  sceneAsset?: string;
  sidekickAsset?: string;
  sidekickText?: string;
}

export interface TeamDuelQuestion extends BaseQuestion {
  type: "team-duel";
  allowNone?: boolean;
  noneLabel?: string;
  noneCaption?: string;
  noneAsset?: string;
}

export interface ScorePickerQuestion extends BaseQuestion {
  type: "score-picker";
  max: number;
}

export interface PlayerCardQuestion extends BaseQuestion {
  type: "player-card";
  options: PlayerOption[];
}

export interface ChoiceQuestion extends BaseQuestion {
  type: "choice";
  options: ChoiceOption[];
}

export interface YesNoQuestion extends BaseQuestion {
  type: "yes-no";
  yesLabel?: string;
  noLabel?: string;
  yesCaption?: string;
  noCaption?: string;
  yesAsset?: string;
  noAsset?: string;
}

export interface RangeChoiceQuestion extends BaseQuestion {
  type: "range-choice";
  options: ChoiceOption[];
}

export interface DramaMeterQuestion extends BaseQuestion {
  type: "drama-meter";
  options: ChoiceOption[];
}

export interface TimeTiebreakerQuestion extends BaseQuestion {
  type: "time-tiebreaker";
  points: 0;
}

export type Question =
  | TeamDuelQuestion
  | ScorePickerQuestion
  | PlayerCardQuestion
  | ChoiceQuestion
  | YesNoQuestion
  | RangeChoiceQuestion
  | DramaMeterQuestion
  | TimeTiebreakerQuestion;

export type AnswerValue =
  | string
  | {
      home: number;
      away: number;
    }
  | {
      minute: number | null;
      noGoal: boolean;
    };

export type AnswersMap = Record<string, AnswerValue>;

export interface QuinielaTheme {
  teams: {
    home: TeamInfo;
    away: TeamInfo;
  };
  assets: {
    poster: string;
    trophy: string;
    confetti: string;
    shareFrame: string;
    celebratingMascot: string;
    varSticker: string;
    fanSticker: string;
    memeSticker: string;
    medals: string;
  };
}

export interface PrizeTeaser {
  title: string;
  caption: string;
}

export interface QuinielaContent {
  slug: string;
  title: string;
  subtitle: string;
  eventName: string;
  venue: string;
  eventDate: string;
  closesAt: string;
  status: "open" | "closed" | "scored";
  theme: QuinielaTheme;
  questions: Question[];
  prizes: PrizeTeaser[];
}

export interface PlayerRegistration {
  nickname: string;
  email: string;
}

export interface ProvisionalLeaderboardRow {
  submission_id: string;
  nickname: string;
  provisional_score: number;
  final_score: number | null;
  rank: number;
  created_at: string;
}

export interface SubmissionSuccess {
  submissionId: string;
  shareId: string;
  provisionalScore: number;
  provisionalRank: number;
  leaderboard: ProvisionalLeaderboardRow[];
}

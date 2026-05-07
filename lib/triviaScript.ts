export type TriviaStep = {
  id: string;
  question: string;
  eyebrow: string;
  options: { label: string; icon: string; points: number }[];
  correctIndex: number;
  pickIndex: number;
};

export type LeaderboardEntry = {
  name: string;
  points: number;
  avatarColor: "yellow" | "pink" | "blue";
};

export const TRIVIA_STEPS: TriviaStep[] = [
  {
    id: "primer-gol",
    eyebrow: "Pregunta 1 · Pronóstico",
    question: "¿Quién anota el primer gol?",
    options: [
      { label: "Lozano", icon: "⚡", points: 15 },
      { label: "Pulisic", icon: "🎯", points: 12 },
      { label: "Jiménez", icon: "🦁", points: 18 },
      { label: "Reyna", icon: "🚀", points: 10 },
    ],
    correctIndex: 0,
    pickIndex: 0,
  },
  {
    id: "penal",
    eyebrow: "Pregunta 2 · Trivia",
    question: "¿Habrá penal en el partido?",
    options: [
      { label: "Sí, claro", icon: "🟨", points: 10 },
      { label: "No", icon: "🛑", points: 8 },
      { label: "Solo por VAR", icon: "📺", points: 20 },
      { label: "Imposible", icon: "🤞", points: 6 },
    ],
    correctIndex: 0,
    pickIndex: 2,
  },
  {
    id: "marcador",
    eyebrow: "Pregunta 3 · Marcador",
    question: "Resultado final",
    options: [
      { label: "2-1 MEX", icon: "🇲🇽", points: 25 },
      { label: "1-1", icon: "🤝", points: 12 },
      { label: "1-2 USA", icon: "🇺🇸", points: 22 },
      { label: "3-0 MEX", icon: "🔥", points: 30 },
    ],
    correctIndex: 0,
    pickIndex: 0,
  },
];

export const LEADERBOARD: LeaderboardEntry[] = [
  { name: "Sofía R.", points: 28, avatarColor: "yellow" },
  { name: "Diego M.", points: 24, avatarColor: "pink" },
  { name: "Tú", points: 22, avatarColor: "blue" },
];

export const TIMING = {
  questionEnter: 0,
  optionsStagger: 0.3,
  cursorMove: 1800,
  pick: 2400,
  feedback: 2900,
  exit: 4200,
  total: 4800,
  leaderboardMs: 2600,
} as const;

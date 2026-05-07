import { character } from "./config";

export type CaseId = "mundial" | "liga" | "clasicos" | "aniversarios";

export type CaseData = {
  id: CaseId;
  eyebrow: string;
  shortLabel: string;
  icon: string;
  title: string;
  body: string;
  character: string;
  bg: string;
  text: string;
  badge: string;
};

export const CASES: CaseData[] = [
  {
    id: "mundial",
    eyebrow: "Mundial",
    shortLabel: "Mundial",
    icon: "🏆",
    title: "Activa el mes más visto del planeta",
    body: "Una quiniela por fase: grupos, octavos, finales. Tu marca presente cada vez que abren el celular para revisar resultados.",
    character: character("bandana"),
    bg: "bg-red",
    text: "text-cream",
    badge: "5,000M de espectadores",
  },
  {
    id: "liga",
    eyebrow: "Liga MX & Champions",
    shortLabel: "LigaMX",
    icon: "📅",
    title: "Aprovecha cada jornada",
    body: "Activaciones recurrentes que mantienen tu comunidad jugando todo el torneo. Ideal para marcas con presencia continua.",
    character: character("dino"),
    bg: "bg-green",
    text: "text-ink",
    badge: "17 jornadas seguidas",
  },
  {
    id: "clasicos",
    eyebrow: "Clásicos",
    shortLabel: "Clásicos",
    icon: "⚡",
    title: "El partido que detiene a México",
    body: "América-Chivas, Madrid-Barça, Boca-River. Conversación garantizada — tu marca en el centro de la afición.",
    character: character("oso"),
    bg: "bg-blue",
    text: "text-cream",
    badge: "Top 1 trending del día",
  },
  {
    id: "aniversarios",
    eyebrow: "Lanzamientos & aniversarios",
    shortLabel: "Aniversarios",
    icon: "🎉",
    title: "Celebra con tu audiencia",
    body: "¿Lanzas producto? ¿Cumples 10 años? Una quiniela es la forma menos genérica de hacer ruido con tu comunidad.",
    character: character("lince"),
    bg: "bg-pink",
    text: "text-ink",
    badge: "+47% engagement vs post",
  },
];

export const ROTATION_MS = 6000;

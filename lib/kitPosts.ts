export type KitTag =
  | "Link público"
  | "Reglas"
  | "Copys"
  | "Visuales"
  | "Leads"
  | "Métricas";

export type CounterState = {
  tick: number;
  igLikes: number;
  igStoryViews: number;
  xRts: number;
  xReplies: number;
  xLikes: number;
  fbReactions: number;
  fbShares: number;
  fbComments: number;
  metricsPlayers: number;
  metricsLeads: number;
  metricsEngagement: number;
};

export const COUNTER_INITIAL: CounterState = {
  tick: 0,
  igLikes: 1247,
  igStoryViews: 4200,
  xRts: 89,
  xReplies: 12,
  xLikes: 612,
  fbReactions: 234,
  fbShares: 56,
  fbComments: 31,
  metricsPlayers: 12847,
  metricsLeads: 1832,
  metricsEngagement: 243,
};

export function advanceCounters(prev: CounterState): CounterState {
  const t = prev.tick + 1;
  return {
    tick: t,
    igLikes: prev.igLikes + 7 + (t % 4) * 3,
    igStoryViews: prev.igStoryViews + 38 + (t % 3) * 12,
    xRts: prev.xRts + 2 + (t % 5),
    xReplies: prev.xReplies + (t % 4 === 0 ? 1 : 0),
    xLikes: prev.xLikes + 9 + (t % 6),
    fbReactions: prev.fbReactions + 5 + (t % 3),
    fbShares: prev.fbShares + 1 + (t % 4 === 0 ? 2 : 0),
    fbComments: prev.fbComments + (t % 3 === 0 ? 1 : 0),
    metricsPlayers: prev.metricsPlayers + 23 + (t % 5) * 4,
    metricsLeads: prev.metricsLeads + 4 + (t % 3),
    metricsEngagement: prev.metricsEngagement + (t % 7 === 0 ? 1 : 0),
  };
}

export function formatK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toString();
}

export function formatNum(n: number): string {
  return n.toLocaleString("es-MX");
}

export const COPY = {
  igPost: {
    handle: "tumarca.mx",
    sponsored: "Patrocinado",
    headline: "MEX vs USA",
    subhead: "QUINIELA MUNDIAL",
    cta: "Juega y gana",
    caption:
      "¿Listos para el debut? 🇲🇽 Adivina el resultado y gana premios. Link en bio. #MundialQuiniela",
  },
  igStory: {
    handle: "tumarca.mx",
    timeAgo: "2h",
    title: "Reglas de la quiniela",
    rules: [
      { icon: "✅", text: "3 partidos por jornada" },
      { icon: "🏆", text: "Premio: AirPods Pro" },
      { icon: "📅", text: "Cierra al silbatazo" },
    ],
    pollQuestion: "¿Quién gana hoy?",
    pollOptionA: { label: "MEX", percent: 64 },
    pollOptionB: { label: "USA", percent: 36 },
  },
  waShare: {
    contact: "Marketing TuMarca",
    status: "en línea",
    bubble: "¡Ya está! Aquí va el link de la quiniela 👇",
    linkTitle: "QUINIELA MUNDIAL · TUMARCA",
    linkUrl: "quiniela.tumarca.mx",
    linkDesc:
      "Pronostica MEX vs USA, gana puntos en cada jornada y entra al ranking en vivo.",
    typing: "Marketing TuMarca está escribiendo…",
    time: "11:42",
  },
  xPost: {
    handle: "@tumarca",
    name: "TuMarca",
    timeAgo: "18m",
    text: "🚨 ÚLTIMA HORA: Lozano titular ante USA. ¿Cambia tu pronóstico? Tienes hasta el silbatazo →",
    link: "quiniela.tumarca.mx",
  },
  fbPost: {
    name: "TuMarca",
    label: "Patrocinado",
    body: "Regístrate y juega gratis la Quiniela del Mundial 🏆 — completa tus datos y entra al ranking en vivo.",
    formTitle: "Quiero jugar",
    fields: [
      { label: "Email", placeholder: "tucorreo@mail.com" },
      { label: "Teléfono", placeholder: "+52 55…" },
    ],
    cta: "Registrarme",
  },
  metrics: {
    title: "Reporte de campaña",
    subtitle: "MEX vs USA · Cerrado hoy",
    kpis: [
      { label: "Jugadores", key: "players" as const, suffix: "" },
      { label: "Engagement", key: "engagement" as const, suffix: "%" },
      { label: "Leads", key: "leads" as const, suffix: "" },
      { label: "Retención", key: "retention" as const, value: "47%" },
    ],
    bars: [
      { day: "Lun", value: 45 },
      { day: "Mar", value: 68 },
      { day: "Mié", value: 52 },
      { day: "Jue", value: 78 },
      { day: "Vie", value: 92 },
      { day: "Sáb", value: 100 },
    ],
    channels: [
      { name: "Instagram", percent: 48, color: "bg-pink" },
      { name: "Facebook", percent: 32, color: "bg-blue" },
      { name: "WhatsApp", percent: 20, color: "bg-green" },
    ],
  },
};

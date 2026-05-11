import type { PlayerOption } from "./schema";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const asset = (path: string) => `${BASE}${path}`;
const v5 = (name: string) => asset(`/generated/v5/quiniela/${name}`);

export const PLAYER_OPTIONS: Record<string, PlayerOption> = {
  dembele: {
    id: "dembele",
    label: "Ousmane Dembélé",
    team: "psg",
    meta: "caos elegante",
    asset: asset("/players/psg/dembele.jpg"),
    assetFit: "photo",
  },
  barcola: {
    id: "barcola",
    label: "Bradley Barcola",
    team: "psg",
    meta: "modo sprint",
    asset: asset("/players/psg/barcola.png"),
    assetFit: "photo",
  },
  kvaratskhelia: {
    id: "kvaratskhelia",
    label: "Kvaratskhelia",
    team: "psg",
    meta: "regate drama",
    asset: asset("/players/psg/kvaratskhelia.png"),
    assetFit: "photo",
  },
  hakimi: {
    id: "hakimi",
    label: "Achraf Hakimi",
    team: "psg",
    meta: "turbo lateral",
    asset: asset("/players/psg/hakimi.jpg"),
    assetFit: "photo",
  },
  saka: {
    id: "saka",
    label: "Bukayo Saka",
    team: "arsenal",
    meta: "estrella roja",
    asset: asset("/players/arsenal/saka.jpg"),
    assetFit: "photo",
  },
  rice: {
    id: "rice",
    label: "Declan Rice",
    team: "arsenal",
    meta: "capitán de caos",
    asset: v5("scenes/player-rice-gpt.png"),
    assetFit: "sticker",
  },
  saliba: {
    id: "saliba",
    label: "William Saliba",
    team: "arsenal",
    meta: "muralla final",
    asset: v5("scenes/player-saliba-gpt.png"),
    assetFit: "sticker",
  },
  martinelli: {
    id: "martinelli",
    label: "Gabriel Martinelli",
    team: "arsenal",
    meta: "picante por banda",
    asset: asset("/players/arsenal/martinelli.jpg"),
    assetFit: "photo",
  },
  otro: {
    id: "otro",
    label: "Otro jugador",
    team: "neutral",
    meta: "plot twist",
    asset: v5("scenes/player-other-gpt.png"),
    assetFit: "sticker",
  },
  ninguno: {
    id: "ninguno",
    label: "No hay goles",
    team: "neutral",
    meta: "0-0 y tensión",
    asset: v5("scenes/player-no-goal-gpt.png"),
    assetFit: "sticker",
  },
};

export const getPlayerOption = (id: string) => PLAYER_OPTIONS[id] ?? null;

import { asset, landingAsset } from "./config";

/**
 * Character art registry for the landing.
 *
 * The design prototype marks every character slot with a labelled placeholder
 * circle ("PERSONAJE — CON TICKET"). This map is where those slots resolve to
 * real art. Poses we don't have yet stay `null` and render as a labelled
 * placeholder, so a missing asset is visible in the page rather than a broken
 * image — and so the landing can ship before the art does.
 *
 * When new art lands, bump LANDING_CHARACTER_DIR (see feedback on asset
 * versioning: replacing files in place does not reliably bust caches).
 */

const LANDING_CHARACTER_DIR = "v2";

const existing = (name: string) =>
  asset(`/characters/${LANDING_CHARACTER_DIR}/${name}.png`);

export type CharacterPose = {
  /** Resolved image path, or null while the pose is still unillustrated. */
  src: string | null;
  /** Alt text. Empty for purely decorative instances. */
  alt: string;
  /** Placeholder label, shown only while `src` is null. */
  label: string;
  /** Placeholder fill, so the unillustrated layout still reads correctly. */
  placeholderTone: string;
};

export const POSES = {
  celebrando: {
    src: existing("lince"),
    alt: "Personaje de Supergana celebrando",
    label: "PERSONAJE — CELEBRANDO",
    placeholderTone: "bg-pink",
  },
  // gato is the only character illustrated holding the trophy.
  conTrofeo: {
    src: existing("gato"),
    alt: "",
    label: "PERSONAJE — CON TROFEO",
    placeholderTone: "bg-green",
  },
  conBalon: {
    src: existing("oso"),
    alt: "",
    label: "PERSONAJE — CON BALÓN",
    placeholderTone: "bg-yellow",
  },
  saludando: {
    src: existing("bandana"),
    alt: "",
    label: "PERSONAJE — SALUDANDO",
    placeholderTone: "bg-pink",
  },
  festejando: {
    src: existing("dino"),
    alt: "",
    label: "PERSONAJE — FESTEJANDO",
    placeholderTone: "bg-blue",
  },

  // --- Awaiting illustration (briefed to Codex) -------------------------
  senalando: {
    src: landingAsset("senalando"),
    alt: "",
    label: "PERSONAJE — SEÑALANDO LOS PASOS",
    placeholderTone: "bg-blue",
  },
  conTicket: {
    src: landingAsset("con-ticket"),
    alt: "",
    label: "PERSONAJE — CON TICKET",
    placeholderTone: "bg-pink",
  },
  deCompras: {
    src: landingAsset("de-compras"),
    alt: "",
    label: "PERSONAJE — DE COMPRAS",
    placeholderTone: "bg-blue",
  },
  invitando: {
    src: landingAsset("invitando"),
    alt: "",
    label: "PERSONAJE — INVITANDO",
    placeholderTone: "bg-yellow",
  },
} as const satisfies Record<string, CharacterPose>;

export type PoseName = keyof typeof POSES;

/**
 * The seven-character lineup for the "mundo propio" section, ordered so sizes
 * step up to the middle and back down (110 → 170 → 110).
 */
export const LINEUP = [
  { name: "gato", size: 110, rotate: -3, duration: 4.5, delay: 0 },
  { name: "cebra", size: 130, rotate: 2, duration: 5.2, delay: 0.3 },
  { name: "goblin", size: 150, rotate: -2, duration: 4.8, delay: 0.6 },
  { name: "oso", size: 170, rotate: 3, duration: 5.6, delay: 0.15 },
  { name: "lince", size: 150, rotate: -1, duration: 5, delay: 0.8 },
  { name: "dino", size: 130, rotate: 2, duration: 4.6, delay: 0.45 },
  { name: "bandana", size: 110, rotate: -2, duration: 5.4, delay: 0.95 },
].map((c) => ({ ...c, src: existing(c.name) }));

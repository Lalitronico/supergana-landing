import { premioAsset } from "./config";

export type PremioTier = "estrella" | "top" | "participacion";

export type PremioData = {
  id: string;
  name: string;
  body: string;
  tier: PremioTier;
  audience: "ambos" | "corporativo" | "marca";
  image: string;
  bg: string;
  text: string;
};

const TIER_LABEL: Record<PremioTier, string> = {
  estrella: "Premio estrella",
  top: "Top performers",
  participacion: "Participación",
};

export const tierLabel = (tier: PremioTier) => TIER_LABEL[tier];

export const PREMIOS: PremioData[] = [
  {
    id: "viaje",
    name: "Viaje a la playa",
    body: "Para el ganador absoluto. Tu marca o empresa firma la postal.",
    tier: "estrella",
    audience: "ambos",
    image: premioAsset("premio-viaje"),
    bg: "bg-yellow",
    text: "text-ink",
  },
  {
    id: "tv",
    name: "Pantalla / Smart TV",
    body: "Premio mayor alternativo. Ideal para activaciones con planta grande.",
    tier: "estrella",
    audience: "ambos",
    image: premioAsset("premio-tv"),
    bg: "bg-pink",
    text: "text-ink",
  },
  {
    id: "bono",
    name: "Días libres / bono",
    body: "Sólo corporativo. El premio que sí mueve la balanza en una planta.",
    tier: "estrella",
    audience: "corporativo",
    image: premioAsset("premio-bono"),
    bg: "bg-red",
    text: "text-cream",
  },
  {
    id: "jersey",
    name: "Jersey selección mexicana",
    body: "Para los top 5 del tablero. Talla y dedicatoria personalizables.",
    tier: "top",
    audience: "ambos",
    image: premioAsset("premio-jersey"),
    bg: "bg-green",
    text: "text-ink",
  },
  {
    id: "parrillero",
    name: "Kit parrillero",
    body: "Para los top 10. Delantal, pinzas, tabla — todo branded.",
    tier: "top",
    audience: "ambos",
    image: premioAsset("premio-parrillero"),
    bg: "bg-blue",
    text: "text-cream",
  },
  {
    id: "kit",
    name: "Kit Supergana de participación",
    body: "Para todos los que llenaron la quiniela. Calcas, lonas, posters.",
    tier: "participacion",
    audience: "ambos",
    image: premioAsset("premio-kit-participacion"),
    bg: "bg-cream",
    text: "text-ink",
  },
];

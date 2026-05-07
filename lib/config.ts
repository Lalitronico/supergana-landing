export const SITE = {
  name: "Supergana",
  tagline: "Quinielas listas para tu marca",
  bookingUrl: "https://cal.com/supergana/demo",
  contactEmail: "hola@supergana.mx",
  whatsapp: "https://wa.me/521000000000",
  social: {
    instagram: "https://instagram.com/supergana",
    linkedin: "https://linkedin.com/company/supergana",
  },
} as const;

// Versioned subdir: bumping this folder invalidates all cached assets.
const ASSET_DIR = "v3";

// basePath injected at build time (e.g. "/supergana-landing" for GitHub Pages,
// empty for local dev). Manually prefixed because Next.js 16 + output:export
// + images.unoptimized doesn't auto-apply basePath to <Image src>.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const asset = (path: string) =>
  `${BASE}${path.startsWith("/") ? path : `/${path}`}`;

export const gen = (name: string) => asset(`/generated/${ASSET_DIR}/${name}.png`);
export const character = (name: string) => asset(`/characters/v2/${name}.png`);

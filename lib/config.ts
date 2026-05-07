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
// (Cleaner than ?v= query strings, which require images.localPatterns config.)
const ASSET_DIR = "v3";

export const gen = (name: string) => `/generated/${ASSET_DIR}/${name}.png`;
export const character = (name: string) => `/characters/v2/${name}.png`;

import type { QuinielaContent } from "./schema";
import { psgArsenal } from "./psg-arsenal";

// Add new quinielas here. Slug must match the file's slug field.
const REGISTRY: Record<string, QuinielaContent> = {
  [psgArsenal.slug]: psgArsenal,
};

export const getQuiniela = (slug: string): QuinielaContent | null =>
  REGISTRY[slug] ?? null;

export const allQuinielaSlugs = (): string[] => Object.keys(REGISTRY);

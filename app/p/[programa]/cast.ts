/**
 * Where a tenant's cast of characters lives, and what the poses are called.
 *
 * A MODULE OF ITS OWN, and not part of ChapaCharacter.tsx, because that file is
 * `"use client"`: every export of a client module becomes a client reference,
 * and a server component that calls one gets "Attempted to call characterDir()
 * from the server but characterDir is on the client" at request time — a
 * runtime failure `next build` does not catch, since the build only type-checks
 * and compiles the call. The screens that need the folder are server
 * components, so the function has to live somewhere with no directive on it.
 *
 * WHY THE FOLDER IS DERIVED AND NOT WRITTEN DOWN.
 *
 * The cast is drawn per tenant — the same characters, wearing that tenant's
 * colours — so the art cannot live at one fixed path shared by every campaign.
 * It also must not live behind `if (slug === "chapa")`: a second tenant is
 * configuration, not a branch. So the folder is derived from the one tenant
 * asset the theme already carries, `logo_url`, which parseOrgTheme has
 * validated to be a path under `/brands/<org>/`. Its directory plus
 * `personajes/` is where that org's cast lives, and a tenant with no logo has
 * no cast and renders none.
 */

/** The poses the module asks for, one per screen. These are the file names. */
export type CharacterName =
  | "bandana-portada"
  | "oso-registro"
  | "lince-verificacion"
  | "cebra-picks"
  | "dino-picks"
  | "goblin-perfil"
  | "bandana-ranking"
  | "oso-premios"
  | "cebra-resultados"
  | "lince-ranking-final"
  | "dino-reglas"
  | "goblin-acceso";

/**
 * `/brands/chapa/chapa-emblema-256.png` → `/brands/chapa/personajes`.
 * Null when the tenant has no logo, which is also the answer for "no cast".
 */
export const characterDir = (logoUrl: string | null | undefined): string | null => {
  if (!logoUrl) return null;
  const cut = logoUrl.lastIndexOf("/");
  if (cut < 1) return null;
  return `${logoUrl.slice(0, cut)}/personajes`;
};

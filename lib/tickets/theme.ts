// Per-organization theming: how a tenant's brand enters the Supergana system.
//
// The rule this file encodes is the one the platform is sold on: a new client is
// configuration, not code. A tenant gets a logo and a brand colour; it does NOT
// get its own stylesheet, its own components or an `if` on the slug. What the
// theme can repaint is deliberately narrow — everything else stays the product's
// language, the same way Chapa lives inside Pick'em.
//
// Division of labour between the two colours (decided with the client, 2026-08-03):
//   · ACTION stays Supergana yellow. The ticket, the buttons and the stamps are
//     the system's vocabulary for "this is what you press"; a tenant repainting
//     them would be a tenant forking the product.
//   · BRAND is the tenant's. It marks the headline word, the badges and the
//     progress fills — identity, never affordance.
//
// No server imports: the shell, the console and any future surface read this.

/** Named by role in the product, not by drawing, so a repose doesn't rename a key. */
export const MASCOT_POSES = ["greet", "celebrate", "ticket", "point"] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

export interface OrgTheme {
  /** Client logo for the co-brand header. Null → the header shows Supergana alone. */
  logoUrl: string | null;
  /** Alt text. Falls back to the org name at the call site, never to "logo". */
  logoAlt: string | null;
  /**
   * The tenant's identity colour: headline word, badges, progress fills.
   * Null → the system's own blue. Never used for small text — see `brandInk`.
   */
  brand: string | null;
  /**
   * A darker variant of `brand`, dark enough for body text on cream. Kept as a
   * separate key rather than derived because "darken until it passes AA" is a
   * judgement about a specific brand, and guessing it produces muddy colour.
   */
  brandInk: string | null;
  /** Whether the header signs the work. Only meaningful alongside a logo. */
  poweredBy: boolean;
  /** Optional per-pose artwork. Missing poses simply don't render. */
  mascots: Partial<Record<MascotPose, string>>;
}

export const EMPTY_THEME: OrgTheme = {
  logoUrl: null,
  logoAlt: null,
  brand: null,
  brandInk: null,
  poweredBy: true,
  mascots: {},
};

/** A theme is only worth a co-brand header once there is a logo to put in it. */
export const isCobranded = (theme: OrgTheme): boolean => theme.logoUrl !== null;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------
//
// Both validators below exist because these values end up inside a CSS custom
// property and an <img src>. `organizations.theme` is written by staff through
// the console, but "written by someone we trust" is not the same as "safe to
// interpolate into the page" — a row edited by hand in the Supabase dashboard
// reaches the browser through exactly this path. Anything that doesn't match
// is dropped, and the campaign renders unthemed rather than half-themed.

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const asColor = (value: unknown): string | null =>
  typeof value === "string" && HEX.test(value.trim()) ? value.trim() : null;

/**
 * Assets live in `public/brands/<org>/`, so a bare path under `/brands/` is the
 * normal case. An https URL is allowed for the day these move to storage; every
 * other scheme — `javascript:`, `data:`, protocol-relative `//host` — is not.
 */
const LOCAL_ASSET = /^\/brands\/[a-z0-9][a-z0-9/_-]*\.(?:png|svg|webp|jpg|jpeg)$/i;

const asAssetUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (LOCAL_ASSET.test(url)) return url;
  if (/^https:\/\/[^\s"'<>]+$/i.test(url)) return url;
  return null;
};

const asMascots = (value: unknown): Partial<Record<MascotPose, string>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const out: Partial<Record<MascotPose, string>> = {};
  for (const pose of MASCOT_POSES) {
    const url = asAssetUrl(raw[pose]);
    if (url) out[pose] = url;
  }
  return out;
};

export const parseOrgTheme = (raw: unknown): OrgTheme => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_THEME;
  const t = raw as Record<string, unknown>;
  return {
    logoUrl: asAssetUrl(t.logo_url),
    logoAlt: typeof t.logo_alt === "string" && t.logo_alt.trim() ? t.logo_alt.trim() : null,
    brand: asColor(t.brand),
    brandInk: asColor(t.brand_ink),
    // Opt-out, not opt-in: a tenant that says nothing gets the platform's
    // signature. Removing it is a commercial decision somebody has to make.
    poweredBy: t.powered_by !== false,
    mascots: asMascots(t.mascots),
  };
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * The theme's whole reach over the stylesheet: two custom properties.
 *
 * `tickets.css` declares defaults for both on `.tk-app`, so an absent key means
 * "use the system's" without any component knowing whether a theme exists. The
 * tint used behind badges is derived in CSS with color-mix rather than asked of
 * the tenant — one fewer value to get wrong per client.
 */
export const themeCssVars = (theme: OrgTheme): Record<string, string> => {
  const vars: Record<string, string> = {};
  if (theme.brand) vars["--tk-brand"] = theme.brand;
  if (theme.brandInk) vars["--tk-brand-ink"] = theme.brandInk;
  return vars;
};

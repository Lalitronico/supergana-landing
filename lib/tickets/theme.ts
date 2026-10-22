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

/**
 * One member of a tenant's cast: a platform character dressed for this client,
 * usually holding one of its products. The cast is what a multi-brand campaign
 * shows instead of a single mascot — the hero stage, the brand cards, the
 * celebration (the character of the brand you bought), the live screen — and
 * it is the list participants pick their own character from.
 */
export interface CastMember {
  /** Stable key, also what `participants.avatar` stores. */
  id: string;
  /** Display name ("Gato", "Dino"…). */
  name: string;
  /** Full-body art. */
  image: string;
  /** Square bust for avatars; falls back to `image` when absent. */
  avatar: string | null;
  /** The brand this character holds, matched against `config.brands[].name`. */
  brand: string | null;
}

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
  /** Optional cast. Empty → screens fall back to the mascot poses. */
  cast: CastMember[];
}

export const EMPTY_THEME: OrgTheme = {
  logoUrl: null,
  logoAlt: null,
  brand: null,
  brandInk: null,
  poweredBy: true,
  mascots: {},
  cast: [],
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

export const asAssetUrl = (value: unknown): string | null => {
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

const CAST_ID = /^[a-z0-9-]{1,32}$/;
const MAX_CAST = 12;

const asCast = (value: unknown): CastMember[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: CastMember[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const id = typeof e.id === "string" ? e.id.trim() : "";
    const image = asAssetUrl(e.image);
    // A member without an id or a picture cannot be shown or picked, and a
    // duplicate id would make two characters answer to one avatar.
    if (!CAST_ID.test(id) || !image || seen.has(id)) continue;
    seen.add(id);
    const name = typeof e.name === "string" && e.name.trim() ? e.name.trim().slice(0, 40) : id;
    const brand = typeof e.brand === "string" && e.brand.trim() ? e.brand.trim() : null;
    out.push({ id, name, image, avatar: asAssetUrl(e.avatar), brand });
    if (out.length >= MAX_CAST) break;
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
    cast: asCast(t.cast),
  };
};

/**
 * A campaign's theme: the organisation's, with the campaign's own keys on top.
 *
 * For a parent company that runs one campaign per brand (Grupo Bafar → Love &
 * Kitchen; Novamex → its seven brands). Shallow on purpose: a campaign that
 * sets `cast` replaces the org's cast whole, because half of one company's
 * characters mixed with half of another brand's is never what anyone meant.
 * Both inputs are raw jsonb; the result goes through `parseOrgTheme`, so a
 * campaign override is validated exactly like an org theme.
 */
export const campaignTheme = (orgTheme: unknown, override: unknown): OrgTheme => {
  const isObject = (v: unknown): v is Record<string, unknown> =>
    Boolean(v) && typeof v === "object" && !Array.isArray(v);
  if (!isObject(override)) return parseOrgTheme(orgTheme);
  return parseOrgTheme({ ...(isObject(orgTheme) ? orgTheme : {}), ...override });
};

/**
 * The character who holds a given brand, for "the cast member of what you
 * bought". Accent- and case-insensitive, because the brand name in the cast
 * and in `config.brands` / `products.brand` are typed by different people.
 */
export const castForBrand = (theme: OrgTheme, brand: string | null | undefined): CastMember | null => {
  if (!brand) return null;
  const key = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const wanted = key(brand);
  return theme.cast.find((m) => m.brand !== null && key(m.brand) === wanted) ?? null;
};

/** The cast member a participant picked, if it still exists in the theme. */
export const castMember = (theme: OrgTheme, id: string | null | undefined): CastMember | null =>
  (id && theme.cast.find((m) => m.id === id)) || null;

// ---------------------------------------------------------------------------
// Brand tone
// ---------------------------------------------------------------------------
//
// A tenant's colour is not always one that can be written in. Novamex's yellow
// is 1.6:1 on the cream paper — invisible as a headline word, perfect as a
// highlighter. The shell reads this to decide HOW the brand marks emphasis:
// "dark" → brand-coloured text (the original behaviour), "light" → ink text on
// a brand-coloured marker band. Decided from the colour, so no tenant has to
// know the rule exists.

const CREAM = "#FAF7F0";

const luminance = (hex: string): number => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * "light" below 2:1 on the paper. Not the 3:1 large-text bar on purpose:
 * Alaska's sky blue sits at 2.9:1 as a 34 px headline word and was accepted
 * that way with the client (2026-08-03); the marker is for colours that cannot
 * be read as words at all, like Novamex's yellow at 1.6:1.
 */
export const brandTone = (theme: OrgTheme): "light" | "dark" | null =>
  theme.brand ? (contrastRatio(theme.brand, CREAM) < 2 ? "light" : "dark") : null;

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

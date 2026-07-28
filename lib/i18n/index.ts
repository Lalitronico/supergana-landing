import { es, type LandingCopy } from "./landing.es";
import { en } from "./landing.en";

export type { LandingCopy };

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const LANDING: Record<Locale, LandingCopy> = { es, en };

/**
 * Where each locale's landing lives.
 *
 * Spanish is the site default and keeps `/` — the domain has been shared in
 * Spanish since launch and moving it to `/es/` would break every link already
 * in the wild, including the QR codes printed for the Rotary campaign.
 *
 * Trailing slashes are mandatory: `trailingSlash: true` in next.config.ts, so
 * `/en` costs a 308 redirect on every visit.
 */
export const LOCALE_HOME: Record<Locale, string> = {
  es: "/",
  en: "/en/",
};

/** Short label for the ES/EN switch. */
export const LOCALE_LABEL: Record<Locale, string> = {
  es: "ES",
  en: "EN",
};

/** Full name of each language, in that language — for the switch's title. */
export const LOCALE_NAME: Record<Locale, string> = {
  es: "Español",
  en: "English",
};

/**
 * `hreflang` map for the metadata `alternates`. `x-default` points at Spanish
 * because that is what an unmatched visitor gets today.
 */
export const LANGUAGE_ALTERNATES = {
  "es-MX": LOCALE_HOME.es,
  "en-US": LOCALE_HOME.en,
  "x-default": LOCALE_HOME.es,
};

/**
 * Substitutes `{name}` placeholders in a dictionary string.
 *
 * Copy that needs a runtime value uses a placeholder rather than a function so
 * the dictionary stays a plain object — client components like
 * `ModulosCarousel` receive slices of it as props, and a function value would
 * fail to cross the server/client boundary.
 */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}

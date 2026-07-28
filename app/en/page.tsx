import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { LANDING, LANGUAGE_ALTERNATES, LOCALE_HOME } from "@/lib/i18n";

const copy = LANDING.en;

/**
 * The English landing.
 *
 * A static `en` segment rather than an `app/[lang]` rewrite of the whole app:
 * only this page is translated so far, and the site's other routes (/mundial,
 * /q, /c, /modulos, /admin) would all have had to move under the dynamic
 * segment for it. When a second page needs translating, that is the migration
 * to make — the dictionary in `lib/i18n/` is already shaped for it.
 *
 * Title and description come from the dictionary so the tab and the link
 * preview a US client sees are in English too, not just the page body.
 */
export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
  keywords: copy.meta.keywords,
  alternates: {
    canonical: LOCALE_HOME.en,
    languages: LANGUAGE_ALTERNATES,
  },
  openGraph: {
    title: copy.meta.title,
    description: copy.meta.description,
    type: "website",
    locale: copy.meta.ogLocale,
    siteName: "Supergana",
  },
  twitter: {
    card: "summary_large_image",
    title: copy.meta.title,
    description: copy.meta.description,
  },
};

export default function EnglishHome() {
  return <LandingPage locale="en" />;
}

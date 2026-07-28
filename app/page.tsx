import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { LANDING, LANGUAGE_ALTERNATES, LOCALE_HOME } from "@/lib/i18n";

const copy = LANDING.es;

/**
 * Spanish keeps `/` — it is the address the domain has been shared under since
 * launch, including on the printed Rotary campaign material, so it cannot move
 * to `/es/`. The English landing lives at `/en/`; see `app/en/page.tsx`.
 */
export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
  keywords: copy.meta.keywords,
  alternates: {
    canonical: LOCALE_HOME.es,
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

export default function Home() {
  return <LandingPage locale="es" />;
}

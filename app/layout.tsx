import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { CalProvider } from "@/components/CalProvider";
import { LANDING } from "@/lib/i18n";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Site-wide defaults, inherited by every route that does not set its own —
// /mundial, /q, /c and the module pages, all of which are Spanish-only. The
// two landings override title, description and openGraph per locale.
const { title: TITLE, description: DESCRIPTION, keywords } = LANDING.es.meta;

export const metadata: Metadata = {
  // supergana.fun is the live domain — the .mx that used to sit here was never
  // provisioned, which silently broke every absolute OG/Twitter image URL.
  metadataBase: new URL("https://supergana.fun"),
  title: TITLE,
  description: DESCRIPTION,
  keywords,
  authors: [{ name: "Supergana" }],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: LANDING.es.meta.ogLocale,
    siteName: "Supergana",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Spanish is the site default: every route but /en/ is Spanish-only. The
    // English landing corrects this attribute on mount via <HtmlLang> — a
    // server component here has no way to know which path it is rendering.
    <html lang="es-MX" className={`${bricolage.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-cream text-ink antialiased">
        <CalProvider />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { CalProvider } from "@/components/CalProvider";
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

const TITLE = "Supergana — Tu marca, hecha juego";
const DESCRIPTION =
  "Experiencias gamificadas white-label para marketing, RH y lealtad: quinielas, carrera de tickets y tienda de puntos con tu identidad y premios reales en +200 países. Nosotros la montamos y la operamos.";

export const metadata: Metadata = {
  // supergana.fun is the live domain — the .mx that used to sit here was never
  // provisioned, which silently broke every absolute OG/Twitter image URL.
  metadataBase: new URL("https://supergana.fun"),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "experiencias gamificadas",
    "gamificación para marcas",
    "plataforma white label",
    "activación de marca",
    "programa de lealtad",
    "quinielas para empresas",
    "engagement recursos humanos",
    "premios multi país",
  ],
  authors: [{ name: "Supergana" }],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: "es_MX",
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
    <html lang="es-MX" className={`${bricolage.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-cream text-ink antialiased">
        <CalProvider />
        {children}
      </body>
    </html>
  );
}

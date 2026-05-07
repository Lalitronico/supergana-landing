import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://supergana.mx"),
  title: "Supergana — Quinielas listas para tu marca",
  description:
    "Activa una quiniela de fútbol para tu marca en días, no semanas. Kit completo: link público, dinámica, copys, visuales y métricas. Sin configurar nada.",
  keywords: [
    "quinielas para marcas",
    "quiniela mundial",
    "campañas deportivas",
    "marketing fútbol",
    "engagement redes sociales",
    "activación de marca",
    "quinielas as a service",
  ],
  authors: [{ name: "Supergana" }],
  openGraph: {
    title: "Supergana — Quinielas listas para tu marca",
    description:
      "Tu marca aprovecha el momento deportivo sin pelearse con plataformas. Te entregamos la campaña lista.",
    type: "website",
    locale: "es_MX",
    siteName: "Supergana",
  },
  twitter: {
    card: "summary_large_image",
    title: "Supergana — Quinielas listas para tu marca",
    description:
      "Tu marca aprovecha el momento deportivo sin pelearse con plataformas. Te entregamos la campaña lista.",
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
        {children}
      </body>
    </html>
  );
}

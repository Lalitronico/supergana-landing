import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Pitch } from "@/components/Pitch";
import { HowItWorks } from "@/components/HowItWorks";
import { WhatsIncluded } from "@/components/WhatsIncluded";
import { UseCases } from "@/components/UseCases";
import { Corporate } from "@/components/Corporate";
import { Premios } from "@/components/Premios";
import { Benefits } from "@/components/Benefits";
import { FAQ } from "@/components/FAQ";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";

/**
 * The Quinielas module page.
 *
 * This is the previous supergana.fun landing, reused rather than deleted: it
 * was already entirely about quinielas, so as a module-level sales page the
 * copy still holds. The platform landing at `/` now sits above it, and its
 * "Ver módulo →" CTA points here.
 *
 * The old Navbar's anchors (#como-funciona, #casos, #empresas, #premios, #faq)
 * all resolve to sections rendered on this page, and its logo links to `/`,
 * which now correctly means "back to the platform landing".
 *
 * Next step (phase 2): the CTAs here point at the real participant app once it
 * exists, instead of at the booking modal.
 */

export const metadata: Metadata = {
  title: "Módulo Quinielas — Supergana",
  description:
    "Quinielas de fútbol con la identidad de tu marca: Mundial, ligas y torneos internos. Nosotros la montamos, la operamos y entregamos los premios.",
  openGraph: {
    title: "Módulo Quinielas — Supergana",
    description:
      "Quinielas de fútbol con la identidad de tu marca. Montadas y operadas por nosotros, con premios reales.",
    type: "website",
    locale: "es_MX",
    siteName: "Supergana",
  },
};

export default function ModuloQuinielas() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Pitch />
        <HowItWorks />
        <WhatsIncluded />
        <UseCases />
        <Corporate />
        <Premios />
        <Benefits />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}

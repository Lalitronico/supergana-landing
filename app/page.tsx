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
import { MundialPromoModal } from "@/components/MundialPromoModal";

export default function Home() {
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
      <MundialPromoModal />
    </>
  );
}

import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Pitch } from "@/components/Pitch";
import { HowItWorks } from "@/components/HowItWorks";
import { WhatsIncluded } from "@/components/WhatsIncluded";
import { UseCases } from "@/components/UseCases";
import { Benefits } from "@/components/Benefits";
import { FAQ } from "@/components/FAQ";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";

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
        <Benefits />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}

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
import { QuinielaPromoModal } from "@/components/QuinielaPromoModal";
import { quinielaCharacter } from "@/lib/config";
import { getQuiniela } from "@/lib/quinielas/registry";

const promoQuiniela = getQuiniela("psg-arsenal");

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
      {promoQuiniela?.status === "open" ? (
        <QuinielaPromoModal
          slug={promoQuiniela.slug}
          status={promoQuiniela.status}
          assets={{
            homeCrest: promoQuiniela.theme.teams.home.crestAsset,
            awayCrest: promoQuiniela.theme.teams.away.crestAsset,
            homeMascot: promoQuiniela.theme.teams.home.mascotAsset,
            awayMascot: quinielaCharacter("gato-arsenal"),
            trophy: promoQuiniela.theme.assets.trophy,
            confetti: promoQuiniela.theme.assets.confetti,
          }}
        />
      ) : null}
    </>
  );
}

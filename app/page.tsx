import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/ui/Marquee";
import { Promo } from "@/components/landing/Promo";
import { ComoFunciona } from "@/components/landing/ComoFunciona";
import { Modulos } from "@/components/landing/Modulos";
import { Premios } from "@/components/landing/Premios";
import { MundoPropio } from "@/components/landing/MundoPropio";
import { OperamosTodo } from "@/components/landing/OperamosTodo";
import { Casos } from "@/components/landing/Casos";
import { CtaFinal } from "@/components/landing/CtaFinal";
import { Footer } from "@/components/landing/Footer";

const VERTICALS = [
  "MARKETING",
  "RECURSOS HUMANOS",
  "LEALTAD",
  "ACTIVACIONES",
  "COMUNIDADES",
  "AGENCIAS",
];

// Second band. Doubles as the divider between the promo and "Operamos todo" —
// the one place where two cream sections meet with nothing between them — and
// previews what that next section spells out.
const OPERAMOS = [
  "DISEÑO Y MONTAJE",
  "OPERACIÓN COMPLETA",
  "PREMIOS Y ENTREGA",
  "REGLAS Y CUMPLIMIENTO",
  "SOPORTE",
];

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Marquee items={VERTICALS} />
        <ComoFunciona />
        <Modulos />
        <Premios />
        <MundoPropio />
        {/* Lands after "mundo propio" rather than up top: by this point the
            proposition, the catálogo and the cast have all been stated, so the
            promo plays as the payoff that shows them moving. */}
        <Promo />
        <Marquee items={OPERAMOS} tone="yellow" rotate={1} duration={26} />
        <OperamosTodo />
        <Casos />
        <CtaFinal />
      </main>
      <Footer />
    </>
  );
}

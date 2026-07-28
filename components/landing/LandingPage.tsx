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
import { HtmlLang } from "@/components/HtmlLang";
import { LANDING, type Locale } from "@/lib/i18n";

/**
 * The whole landing, in one language.
 *
 * Section order lives here rather than in the route files so `/` and `/en/`
 * cannot drift — the two pages differ only in which locale they pass in. The
 * background rhythm the order encodes (cream → ink → stripes → … , no two
 * neighbouring content sections sharing a floor) is fragile enough without
 * maintaining it twice.
 */
export function LandingPage({ locale }: { locale: Locale }) {
  const copy = LANDING[locale];

  return (
    <>
      <HtmlLang lang={copy.meta.htmlLang} />
      <Navbar copy={copy.nav} locale={locale} />
      {/* `lang` on <main> rather than on <html>: the two locales share one root
          layout, which is a server component with no access to the pathname.
          The nearest enclosing lang is what assistive tech reads, so this is
          correct for the content; `HtmlLang` fixes the root element for
          everything that reads it instead. */}
      <main lang={copy.meta.htmlLang}>
        <Hero copy={copy.hero} />
        <Marquee items={copy.marquee.verticals} />
        <ComoFunciona copy={copy.comoFunciona} />
        <Modulos copy={copy.modulos} />
        <Premios copy={copy.premios} />
        <MundoPropio copy={copy.mundoPropio} />
        {/* Lands after "mundo propio" rather than up top: by this point the
            proposition, the catálogo and the cast have all been stated, so the
            promo plays as the payoff that shows them moving. */}
        <Promo copy={copy.promo} locale={locale} />
        {/* Second band. Doubles as the divider between the promo and "Operamos
            todo" — the one place where two cream sections meet with nothing
            between them — and previews what that next section spells out. */}
        <Marquee
          items={copy.marquee.operamos}
          tone="yellow"
          rotate={1}
          duration={26}
        />
        <OperamosTodo copy={copy.operamosTodo} />
        <Casos copy={copy.casos} />
        <CtaFinal copy={copy.ctaFinal} />
      </main>
      <Footer copy={copy.footer} />
    </>
  );
}

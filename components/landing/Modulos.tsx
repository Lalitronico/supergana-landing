import { Pill } from "@/components/ui/Pill";
import type { LandingCopy } from "@/lib/i18n";
import { ModulosCarousel, type ModuleSlide } from "./ModulosCarousel";
import { QuinielaMock } from "./modulos/QuinielaMock";
import { TicketsMock } from "./modulos/TicketsMock";
import { TiendaMock } from "./modulos/TiendaMock";

type ModulosCopy = LandingCopy["modulos"];

/** Everything about a slide that is the same in every language. */
type ModuleStyle = Omit<ModuleSlide, "eyebrow" | "title" | "body" | "idealPara">;

// Quinielas has its own page (the previous landing, reused). The other two
// have no page yet, so they route to the booking CTA — `href` is the one place
// to change that as each module page ships.
//
// That page is Spanish-only for now, so the English slide links to the same
// URL and lands a US visitor on Spanish content. Left as is deliberately:
// pointing English visitors at `#demo` instead would hide the one module that
// has a real page behind it, which is the worse trade until the module page is
// translated too.
const MODULE_STYLES = (
  copy: ModulosCopy,
): ModuleStyle[] => [
  {
    number: "01",
    tone: "bg-blue text-cream",
    numberTone: "bg-blue text-cream",
    frame: "bg-blue",
    frameRotate: -1.2,
    mock: <QuinielaMock copy={copy.mocks.quiniela} />,
    href: "/modulos/quinielas",
    character: {
      pose: "conBalon",
      size: 120,
      bob: "bob2",
      className: "absolute -bottom-14 left-[-52px] z-2 hidden lg:block",
    },
  },
  {
    number: "02",
    tone: "bg-red text-cream",
    numberTone: "bg-red text-cream",
    frame: "bg-red",
    frameRotate: 1.2,
    mock: <TicketsMock copy={copy.mocks.tickets} />,
    href: "#demo",
    character: {
      pose: "conTicket",
      size: 120,
      bob: "bob3",
      className: "absolute -bottom-12 left-[-56px] z-2 hidden lg:block",
    },
  },
  {
    number: "03",
    tone: "bg-green text-ink",
    numberTone: "bg-green text-ink",
    frame: "bg-green",
    frameRotate: -1,
    mock: <TiendaMock copy={copy.mocks.tienda} />,
    href: "#demo",
    character: {
      pose: "deCompras",
      size: 120,
      bob: "bob",
      className: "absolute -bottom-12 left-[-50px] z-2 hidden lg:block",
    },
  },
];

export function Modulos({ copy }: { copy: ModulosCopy }) {
  const slides: ModuleSlide[] = MODULE_STYLES(copy).map((style, i) => ({
    ...style,
    ...copy.items[i],
  }));

  return (
    // Spacing scales with viewport height so the carousel card is not pushed
    // below the fold by fixed padding on a short laptop screen.
    <section
      id="modulos"
      className="mx-auto max-w-[1100px] px-6 pb-[clamp(48px,7vh,80px)] pt-[clamp(56px,9vh,120px)]"
    >
      <Pill tone="yellow" shadow rotate={1} className="mb-[clamp(14px,2.2vh,22px)]">
        {copy.pill}
      </Pill>

      <h2 className="font-display m-0 mb-[clamp(12px,2vh,18px)] text-[clamp(34px,5.5vw,58px)] leading-[1.06]">
        {copy.titleLead} <span className="marker-yellow">{copy.titleMark}</span>
      </h2>

      <p className="mb-[clamp(28px,4.5vh,70px)] max-w-[560px] text-[17px] leading-[1.55]">
        {copy.intro}
      </p>

      <ModulosCarousel slides={slides} labels={copy} />

      <p className="mb-0 mt-[clamp(32px,5vh,64px)] text-center text-base font-semibold">
        {copy.outroLead}{" "}
        <a
          href="#demo"
          className="border-b-[3px] border-yellow font-extrabold text-ink hover:border-yellow-deep"
        >
          {copy.outroLink}
        </a>
      </p>
    </section>
  );
}

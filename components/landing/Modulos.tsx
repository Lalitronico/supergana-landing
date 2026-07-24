import { Pill } from "@/components/ui/Pill";
import { ModulosCarousel, type ModuleSlide } from "./ModulosCarousel";
import { QuinielaMock } from "./modulos/QuinielaMock";
import { TicketsMock } from "./modulos/TicketsMock";
import { TiendaMock } from "./modulos/TiendaMock";

// Quinielas has its own page (the previous landing, reused). The other two
// have no page yet, so they route to the booking CTA — `href` is the one place
// to change that as each module page ships.
const MODULES: ModuleSlide[] = [
  {
    number: "01",
    eyebrow: "Probado en producción",
    title: "Quinielas",
    body: "Predicciones deportivas que enganchan a tu equipo o comunidad: Mundial, ligas, torneos internos. Participación recurrente semana tras semana.",
    idealPara: "RH · comunidades · asociaciones",
    tone: "bg-blue text-cream",
    numberTone: "bg-blue text-cream",
    frame: "bg-blue",
    frameRotate: -1.2,
    mock: <QuinielaMock />,
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
    eyebrow: "El sweepstakes, evolucionado",
    title: "Carrera de Tickets",
    body: "Convierte compras en juego: tus consumidores suben su ticket, acumulan puntos y compiten. Tu promoción de retail como nunca la habías visto.",
    idealPara: "marcas de consumo · retail",
    tone: "bg-red text-cream",
    numberTone: "bg-red text-cream",
    frame: "bg-red",
    frameRotate: 1.2,
    mock: <TicketsMock />,
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
    eyebrow: "Lealtad que sí se usa",
    title: "Tienda de Puntos",
    body: "Los puntos se vuelven premios de verdad: gift cards, experiencias, cash. Lealtad que tu gente sí quiere usar.",
    idealPara: "programas de lealtad · incentivos internos",
    tone: "bg-green text-ink",
    numberTone: "bg-green text-ink",
    frame: "bg-green",
    frameRotate: -1,
    mock: <TiendaMock />,
    href: "#demo",
    character: {
      pose: "deCompras",
      size: 120,
      bob: "bob",
      className: "absolute -bottom-12 left-[-50px] z-2 hidden lg:block",
    },
  },
];

export function Modulos() {
  return (
    // Spacing scales with viewport height so the carousel card is not pushed
    // below the fold by fixed padding on a short laptop screen.
    <section
      id="modulos"
      className="mx-auto max-w-[1100px] px-6 pb-[clamp(48px,7vh,80px)] pt-[clamp(56px,9vh,120px)]"
    >
      <Pill tone="yellow" shadow rotate={1} className="mb-[clamp(14px,2.2vh,22px)]">
        El catálogo
      </Pill>

      <h2 className="font-display m-0 mb-[clamp(12px,2vh,18px)] text-[clamp(34px,5.5vw,58px)] leading-[1.06]">
        Un módulo para cada <span className="marker-yellow">objetivo</span>
      </h2>

      <p className="mb-[clamp(28px,4.5vh,70px)] max-w-[560px] text-[17px] leading-[1.55]">
        Dinámicas empaquetadas como soluciones: elige una, la vestimos con tu
        marca y queda lista para jugar.
      </p>

      <ModulosCarousel slides={MODULES} />

      <p className="mb-0 mt-[clamp(32px,5vh,64px)] text-center text-base font-semibold">
        ¿Tienes una dinámica en mente que no está aquí?{" "}
        <a
          href="#demo"
          className="border-b-[3px] border-yellow font-extrabold text-ink hover:border-yellow-deep"
        >
          La diseñamos contigo.
        </a>
      </p>
    </section>
  );
}

import { Character } from "@/components/ui/Character";

/**
 * Four flat cream cards was the least on-brand block on the page: everywhere
 * else the identity is saturated colour behind a 3px ink border. These carry
 * the module colours instead, with a cream icon tile so it still reads against
 * the fill.
 *
 * No vertical stagger. Offsetting the cards fought the grid — a row sizes to
 * its tallest item *including margins*, so a `mt-8` on one card inflated the
 * row and its neighbour stretched into the extra space, leaving dead air under
 * short copy. It read as a layout bug, not as hand placement. The ±1deg
 * rotations carry the hand-made feel on their own.
 */
const BULLETS = [
  {
    icon: "🎨",
    fill: "bg-yellow text-ink",
    title: "Diseño y montaje",
    body: "Tu campaña lista en días, con tu identidad.",
    rotate: -0.8,
  },
  {
    icon: "⚙️",
    fill: "bg-blue text-cream",
    title: "Operación completa",
    body: "Nosotros la corremos de inicio a fin; tú ves el dashboard.",
    rotate: 0.7,
  },
  {
    icon: "📦",
    fill: "bg-green text-ink",
    title: "Premios y entrega",
    body: "Del catálogo al ganador, sin logística de tu lado.",
    rotate: 0.6,
  },
  {
    icon: "📋",
    fill: "bg-pink text-ink",
    title: "Reglas y cumplimiento",
    // The regulatory research found no competitor offering this at all, so the
    // copy names the actual instruments rather than saying "compliance".
    body: "Reglas oficiales, aviso PROFECO y entrada gratuita alternativa donde aplique. Resuelto antes de lanzar.",
    rotate: -0.7,
  },
];

export function OperamosTodo() {
  return (
    <section className="relative mx-auto max-w-[1100px] px-6 pb-[clamp(70px,10vh,110px)] pt-[clamp(48px,7vh,60px)]">
      <div className="mb-[clamp(34px,5vh,54px)] flex flex-wrap items-end justify-between gap-6">
        <h2 className="font-display m-0 max-w-[760px] text-[clamp(34px,5.5vw,58px)] leading-[1.06]">
          Tú pones la marca.{" "}
          <span className="marker-yellow">Nosotros, todo lo demás.</span>
        </h2>

        {/* Pushed down out of the heading's eyeline: aligned to the h2 baseline
            the character floats up near the marquee band instead of reading as
            part of this section. */}
        <div className="relative hidden shrink-0 translate-y-10 lg:block">
          <Character pose="senalando" size={128} bob="bob" duration={5.2} />
          {/* The sticker used to float loose in the corner. Placed up and to
              the right it lands exactly where this character is pointing, so
              the pose does some work instead of being decoration. */}
          <div className="font-display absolute -top-11 right-[-84px] rotate-3 whitespace-nowrap rounded-[14px] border-[3px] border-ink bg-red px-5 py-2.5 text-lg tracking-[0.02em] text-cream shadow-[5px_5px_0_0_var(--color-ink)]">
            LLAVE EN MANO
          </div>
        </div>
      </div>

      <div className="grid gap-7 sm:grid-cols-2">
        {BULLETS.map((bullet) => (
          <div
            key={bullet.title}
            className={`flex items-start gap-4 rounded-[18px] border-[3px] border-ink p-[26px] shadow-cartoon-md ${bullet.fill}`}
            style={{ transform: `rotate(${bullet.rotate}deg)` }}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-[3px] border-ink bg-cream text-[22px] shadow-[3px_3px_0_0_var(--color-ink)]">
              {bullet.icon}
            </div>
            <div>
              <p className="font-display m-0 mb-1.5 text-lg">{bullet.title}</p>
              <p className="m-0 text-[15px] leading-[1.5]">{bullet.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

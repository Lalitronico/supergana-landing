import Image from "next/image";
import { LINEUP } from "@/lib/characters";
import { Pill } from "@/components/ui/Pill";

/**
 * The differentiator section. Per the competitive research, every rival in the
 * category ships "templates + bring your own assets" — owning a cast is the one
 * thing none of them can copy quickly, so it earns its own section.
 */
export function MundoPropio() {
  return (
    // Striped rather than plain cream: this sits between the ink prizes band
    // and "Operamos todo", and three flat cream sections in a row read as one
    // undifferentiated block.
    // Tight bottom padding: the promo's colour band now opens directly below,
    // so this padding is no longer breathing room — it is the distance between
    // the lineup's feet and the zigzag teeth. At the old 90px the characters
    // read as floating above an unexplained gap.
    <section className="section-stripes relative px-6 pb-[44px] pt-[110px] text-center">
      <Pill tone="pink" shadow rotate={-1} className="mb-[22px]">
        Único en la categoría
      </Pill>

      <h2 className="font-display mx-auto mb-5 max-w-[800px] text-[clamp(34px,5.5vw,58px)] leading-[1.06]">
        La única plataforma con <span className="marker-yellow">mundo propio</span>
      </h2>

      <p className="mx-auto mb-16 max-w-[620px] text-[17px] leading-[1.6]">
        Siete personajes rubber-hose y un universo visual que le da vida a cada
        campaña. La competencia vende plantillas genéricas; nosotros ponemos
        personalidad — o la guardamos para que tu marca brille sola. Tú decides.
      </p>

      {/* Not held to the 1100px text measure: the seven characters total 950px
          of art plus gaps, which would wrap the last one onto its own row and
          break the stepped silhouette. */}
      <div className="flex flex-wrap items-end justify-center gap-5">
        {LINEUP.map((char) => (
          <div
            key={char.name}
            style={{
              animation: `bob ${char.duration}s ease-in-out ${char.delay}s infinite`,
            }}
          >
            <Image
              src={char.src}
              alt=""
              aria-hidden
              width={char.size}
              height={char.size}
              draggable={false}
              className="h-auto select-none drop-shadow-[5px_6px_0_rgba(10,10,10,0.18)]"
              style={{
                width: char.size,
                transform: `rotate(${char.rotate}deg)`,
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

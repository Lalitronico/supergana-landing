import Image from "next/image";
import { CharacterFloat } from "./CharacterFloat";
import { BookDemoButton } from "./BookDemoButton";
import { gen, character } from "@/lib/config";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b-[3px] border-ink">
      <div className="relative bg-cream">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #0A0A0A 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        {/* Left-side motion lines */}
        <Image
          src={gen("ornament-motion-lines")}
          alt=""
          width={1024}
          height={1024}
          aria-hidden
          className="pointer-events-none absolute -left-12 top-40 w-[260px] opacity-25 md:w-[340px]"
        />
        {/* Right-side motion lines (mirrored) */}
        <Image
          src={gen("ornament-motion-lines")}
          alt=""
          width={1024}
          height={1024}
          aria-hidden
          className="pointer-events-none absolute -right-16 bottom-32 hidden w-[220px] -scale-x-100 opacity-15 md:block lg:w-[300px]"
        />

        {/* Confetti cluster, top-right */}
        <Image
          src={gen("ornament-confetti")}
          alt=""
          width={1200}
          height={1200}
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-16 hidden w-[28rem] opacity-35 md:block"
        />


        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pt-20 pb-12 md:grid-cols-12 md:gap-6 md:px-8 md:pt-28 md:pb-16">
          <div className="md:col-span-7">
            <span className="cartoon-border inline-block rounded-full bg-cream px-4 py-1 text-xs font-bold uppercase tracking-wider">
              Quinielas as a service
            </span>
            <h1 className="font-display mt-6 text-5xl leading-[0.95] sm:text-6xl md:text-7xl lg:text-8xl">
              La quiniela que tu marca necesita.{" "}
              <span className="marker-yellow">Lista en días.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed md:text-xl">
              Activa una quiniela de fútbol completa para tu próximo Mundial,
              final o clásico. Sin plataformas, sin formularios, sin diseñar
              nada. Te entregamos el kit listo para publicar.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <BookDemoButton className="btn-cartoon inline-flex h-14 items-center rounded-full bg-red px-7 text-base font-bold text-cream">
                Agendar demo →
              </BookDemoButton>
              <a
                href="#como-funciona"
                className="text-base font-bold underline decoration-2 underline-offset-4 hover:text-red"
              >
                Ver cómo funciona
              </a>
            </div>
            <p className="mt-6 text-sm font-medium opacity-70">
              Activación lista en 7-10 días · Sin contratos largos · Pago por campaña
            </p>
          </div>

          <div className="relative min-h-[440px] md:col-span-5 md:min-h-[500px]">
            {/* Top-right: gato with World Cup — slightly bigger as focal anchor */}
            <CharacterFloat
              src={character("gato")}
              alt=""
              width={320}
              height={320}
              priority
              className="absolute right-0 top-0 w-[52%] max-w-[290px]"
              delay={0.05}
              amplitude={14}
              duration={4.5}
              rotate={3}
            />
            {/* Top-left: mexicano — bumped up to visually match gato's body height */}
            <CharacterFloat
              src={character("mexicano")}
              alt=""
              width={300}
              height={320}
              className="absolute left-0 top-8 w-[52%] max-w-[280px] sm:top-12"
              delay={0.25}
              amplitude={18}
              duration={5.2}
              rotate={-3}
            />
            {/* Bottom-center: nuevo (Champions) — pulled up + sized to match the top duo */}
            <CharacterFloat
              src={character("nuevo")}
              alt=""
              width={280}
              height={320}
              className="absolute right-[18%] bottom-0 w-[50%] max-w-[260px]"
              delay={0.45}
              amplitude={12}
              duration={4.8}
              rotate={-2}
            />
          </div>
        </div>
      </div>

      <div
        className="relative h-44 overflow-hidden border-t-[3px] border-ink md:h-60 lg:h-72"
        style={{ background: "#152844" }}
      >
        <Image
          src={gen("stadium-silhouette")}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
          aria-hidden
        />
      </div>
    </section>
  );
}

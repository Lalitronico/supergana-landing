import Image from "next/image";
import { gen } from "@/lib/config";
import { PREMIOS, tierLabel, type PremioData } from "@/lib/premios";

const TIER_ORDER: PremioData["tier"][] = ["estrella", "top", "participacion"];

function PremioCard({ premio }: { premio: PremioData }) {
  const isStar = premio.tier === "estrella";
  return (
    <article
      className={`cartoon-border ${isStar ? "cartoon-shadow-lg" : "cartoon-shadow"} group relative flex flex-col overflow-hidden rounded-2xl ${premio.bg} ${premio.text} p-5 transition-transform hover:-translate-y-1`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full cartoon-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            isStar ? "bg-yellow text-ink" : "bg-cream text-ink"
          }`}
        >
          {tierLabel(premio.tier)}
        </span>
        {premio.audience === "corporativo" ? (
          <span className="rounded-full cartoon-border bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cream">
            Corporativo
          </span>
        ) : null}
      </div>

      <div className="relative mt-4 flex h-40 items-center justify-center md:h-48">
        <Image
          src={premio.image}
          alt={premio.name}
          width={320}
          height={320}
          className="h-full w-auto select-none object-contain transition-transform duration-500 group-hover:scale-105 group-hover:rotate-2"
        />
      </div>

      <h3 className="font-display mt-5 text-2xl leading-tight">{premio.name}</h3>
      <p className="mt-2 text-sm leading-relaxed opacity-90">{premio.body}</p>
    </article>
  );
}

export function Premios() {
  const ordered = [...PREMIOS].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
  );

  return (
    <section
      id="premios"
      className="relative overflow-hidden border-b-[3px] border-ink bg-cream py-24 md:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #0A0A0A 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />
      <Image
        src={gen("ornament-confetti")}
        alt=""
        width={1200}
        height={1200}
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-24 hidden w-[28rem] opacity-25 md:block"
      />

      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-red">
              Premios
            </span>
            <h2 className="font-display mt-3 text-4xl leading-tight md:text-6xl">
              El premio es lo que <span className="marker-yellow">recuerdan</span>.
              Nosotros lo presentamos.
            </h2>
          </div>
          <p className="max-w-md text-lg opacity-80">
            Tú eliges el premio según presupuesto y audiencia. Nosotros lo
            integramos al kit visual con las mascotas de Supergana.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 md:mt-16 md:gap-6 lg:grid-cols-3">
          {ordered.map((premio) => (
            <PremioCard key={premio.id} premio={premio} />
          ))}
        </div>

        <p className="mt-10 max-w-2xl text-sm opacity-70">
          * Los premios son ejemplos. Tú defines presupuesto, talla, marca y
          mecánica de selección — nosotros producimos la pieza visual y el
          anuncio de ganadores.
        </p>
      </div>
    </section>
  );
}

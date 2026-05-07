import Image from "next/image";
import { CASES } from "@/lib/useCases";
import { MundialHero } from "./cases/MundialHero";

export function UseCases() {
  const others = CASES.filter((c) => c.id !== "mundial");

  return (
    <section
      id="casos"
      className="relative overflow-hidden border-b-[3px] border-ink bg-cream py-24 md:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #0A0A0A 0 2px, transparent 2px 80px)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-red">
              Casos de uso
            </span>
            <h2 className="font-display mt-3 text-4xl leading-tight md:text-6xl">
              Para cuando importa estar ahí.
            </h2>
          </div>
          <p className="max-w-md text-lg opacity-80">
            Si tu marca quiere conectar con un momento deportivo y no quiere
            armar todo desde cero — esto es para ti.
          </p>
        </div>

        {/* Mundial = caso estrella */}
        <div className="mt-12 md:mt-16">
          <MundialHero />
        </div>

        {/* Otros casos */}
        <div className="mt-12 md:mt-14">
          <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
            También funciona para
          </span>
          <div className="mt-4 grid gap-5 md:grid-cols-3 md:gap-6">
            {others.map((c) => (
              <article
                key={c.id}
                className={`cartoon-border cartoon-shadow group relative overflow-hidden rounded-2xl ${c.bg} ${c.text} p-5 transition-transform hover:-translate-y-1`}
              >
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                  {c.eyebrow}
                </span>
                <h3 className="font-display mt-1.5 text-xl leading-tight md:text-2xl">
                  {c.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed opacity-90">
                  {c.body}
                </p>
                <div className="mt-4 flex items-end justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full cartoon-border bg-cream px-2 py-0.5 text-[10px] font-bold text-ink">
                    {c.icon} {c.shortLabel}
                  </span>
                  <Image
                    src={c.character}
                    alt=""
                    width={100}
                    height={120}
                    className="h-20 w-auto shrink-0 select-none transition-transform duration-500 group-hover:rotate-6 md:h-24"
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

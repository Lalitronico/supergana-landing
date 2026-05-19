import Image from "next/image";
import { BookDemoButton } from "./BookDemoButton";
import { character, premioAsset } from "@/lib/config";

const PILLARS = [
  {
    title: "Engagement sin reuniones extra",
    body: "Una quiniela vive en WhatsApp o tu intranet. Cero juntas, cero curso obligatorio. Tu gente entra porque quiere.",
    accent: "text-yellow",
  },
  {
    title: "Premios que sí emocionan",
    body: "Viaje a la playa, jerseys, kits parrilleros, días libres. Tú eliges, nosotros producimos el kit visual.",
    accent: "text-pink",
  },
  {
    title: "Listo para tu planta o tu oficina",
    body: "Da igual si son 200 operadores o 50 corporativos. Reglas, mecánica y comunicación se adaptan a tu equipo.",
    accent: "text-green",
  },
];

export function Corporate() {
  return (
    <section
      id="empresas"
      className="relative overflow-hidden border-b-[3px] border-ink bg-blue py-24 text-cream md:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, #FAF7F0 0 2px, transparent 2px 80px)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-12 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-7">
            <span className="text-xs font-bold uppercase tracking-wider text-yellow">
              Empresas · HR · Comunicación interna
            </span>
            <h2 className="font-display mt-3 text-4xl leading-tight md:text-6xl">
              La quiniela que une a tus colaboradores —{" "}
              <span className="marker-yellow text-ink">sin armar nada.</span>
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed opacity-90">
              Para fábricas, oficinas y equipos remotos. Tus empleados juegan,
              conviven y ganan. Tú entregas un programa de engagement en una
              semana, no en un trimestre.
            </p>

            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {PILLARS.map((p) => (
                <div
                  key={p.title}
                  className="cartoon-border cartoon-shadow rounded-2xl bg-cream p-4 text-ink"
                >
                  <p
                    className={`font-display text-xs uppercase tracking-wider ${p.accent}`}
                  >
                    {p.title.split(" ")[0]}
                  </p>
                  <h3 className="font-display mt-2 text-lg leading-tight">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed opacity-80">
                    {p.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <BookDemoButton
                ariaLabel="Agendar demo para mi empresa"
                className="btn-cartoon inline-flex h-14 items-center rounded-full bg-yellow px-7 text-base font-bold text-ink"
              >
                Agendar demo para mi empresa →
              </BookDemoButton>
              <a
                href="#premios"
                className="text-base font-bold underline decoration-2 underline-offset-4 hover:text-yellow"
              >
                Ver premios
              </a>
            </div>
            <p className="mt-5 text-sm opacity-80">
              Activación lista en 7-10 días · Sin app que descargar · Compatible
              con planta operativa
            </p>
          </div>

          <div className="relative min-h-[360px] md:col-span-5 md:min-h-[460px]">
            <Image
              src={premioAsset("corporate-hero")}
              alt=""
              width={720}
              height={720}
              priority={false}
              className="pointer-events-none absolute inset-0 m-auto w-[88%] max-w-[420px] select-none"
              aria-hidden
            />
            {/* Mascot fallback / floating accents using v2 chars so the
                section is never visually empty while Codex produces the
                corporate hero illustration. */}
            <Image
              src={character("mexicano")}
              alt=""
              width={220}
              height={260}
              aria-hidden
              className="pointer-events-none absolute -bottom-2 -left-2 w-[36%] max-w-[160px] -rotate-6 select-none opacity-90"
            />
            <Image
              src={character("oso")}
              alt=""
              width={220}
              height={260}
              aria-hidden
              className="pointer-events-none absolute -right-2 top-4 w-[36%] max-w-[160px] rotate-6 select-none opacity-90"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

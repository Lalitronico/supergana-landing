import Image from "next/image";
import { gen } from "@/lib/config";

const STATS = [
  {
    metric: "+38%",
    label: "Engagement promedio",
    body: "Las quinielas multiplican comentarios, compartidos y guardados frente a posts deportivos genéricos.",
  },
  {
    metric: "1 link",
    label: "Cero fricción",
    body: "El usuario abre, juega y comparte. Nada de descargar app, registrarse o aprender plataforma nueva.",
  },
  {
    metric: "7-10 días",
    label: "De idea a publicación",
    body: "Activamos antes de que tu agencia presente el primer brief. Diseñado para velocidad de marketing real.",
  },
  {
    metric: "100%",
    label: "Tu identidad",
    body: "Tu paleta, tu copy, tu URL — o el logo y los colores corporativos de tu empresa. La quiniela se siente tuya, no de otra plataforma genérica.",
  },
];

export function Benefits() {
  return (
    <section className="relative overflow-hidden border-b-[3px] border-ink bg-ink py-24 text-cream md:py-32">
      <Image
        src={gen("ornament-confetti")}
        alt=""
        width={1200}
        height={1200}
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 w-[32rem] opacity-50"
      />
      <Image
        src={gen("ornament-confetti")}
        alt=""
        width={1200}
        height={1200}
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 w-[26rem] -scale-x-100 opacity-40"
      />
      <Image
        src={gen("ornament-stars")}
        alt=""
        width={400}
        height={400}
        aria-hidden
        className="pointer-events-none absolute right-12 top-32 hidden w-32 rotate-12 md:block"
      />

      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-yellow">
            Por qué funciona
          </span>
          <h2 className="font-display mt-3 text-4xl leading-tight md:text-6xl">
            Métricas que tu director quiere ver.
          </h2>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="cartoon-border rounded-2xl bg-cream p-6 text-ink"
            >
              <p className="font-display text-5xl tracking-tight text-red">
                {s.metric}
              </p>
              <p className="font-display mt-2 text-lg">{s.label}</p>
              <p className="mt-2 text-sm leading-relaxed opacity-80">
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-10 max-w-2xl text-sm opacity-70">
          * Métricas de referencia basadas en activaciones tipo quiniela en
          marcas medianas. El resultado real depende de audiencia y momento.
        </p>
      </div>
    </section>
  );
}

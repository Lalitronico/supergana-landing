import { TriviaDemo } from "./how/TriviaDemo";

const BULLETS = [
  {
    n: "01",
    title: "Eliges el momento",
    body:
      "Mundial, Champions, clásico o el partido que vaya con tu marca. Tú pones la fecha.",
  },
  {
    n: "02",
    title: "Cuéntanos el objetivo",
    body:
      "Engagement, leads, retención o ventas. En 30 minutos confirmamos formato y entregables.",
  },
  {
    n: "03",
    title: "Recibes tu kit listo",
    body:
      "Link público, copys, visuales descargables y reporte de métricas. Solo publicas.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="relative border-b-[3px] border-ink bg-cream py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-red">
            Cómo funciona
          </span>
          <h2 className="font-display mt-3 text-4xl leading-tight md:text-6xl">
            Tres pasos. Ningún formulario.
          </h2>
          <p className="mt-4 text-lg opacity-80">
            Pensado para equipos de marketing que no tienen 6 semanas para
            preparar una activación. Pasamos de la idea al lanzamiento sin
            fricción — así se ve para tu audiencia.
          </p>
        </div>

        <div className="mt-12 md:mt-16">
          <TriviaDemo />
        </div>

        <ol className="mt-14 grid gap-6 md:mt-20 md:grid-cols-3 md:gap-8">
          {BULLETS.map((b) => (
            <li key={b.n} className="flex gap-4">
              <span className="font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full cartoon-border bg-yellow text-base">
                {b.n}
              </span>
              <div>
                <h3 className="font-display text-xl">{b.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed opacity-80">
                  {b.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

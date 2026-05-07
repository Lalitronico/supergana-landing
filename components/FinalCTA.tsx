import { SITE } from "@/lib/config";
import { StadiumTicket } from "./cta/StadiumTicket";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-b-[3px] border-ink bg-blue text-cream">
      {/* Subtle dot pattern background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #FAF7F0 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />
      {/* Soft diagonal stripes overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #0A0A0A 0 2px, transparent 2px 80px)",
        }}
      />

      <div className="relative py-20 md:py-28">
        <div className="relative mx-auto max-w-5xl px-5 text-center md:px-8">
          <h2 className="font-display mx-auto max-w-3xl text-5xl leading-[1.05] md:text-7xl">
            ¿Tu próximo Mundial empieza{" "}
            <span className="marker-yellow text-ink">contigo arriba</span> o
            mirando?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg opacity-90">
            Agenda una demo de 25 minutos. Te mostramos un caso real, te
            cotizamos en la llamada y, si encaja, arrancamos esta semana.
          </p>

          <div className="mt-12 md:mt-14">
            <StadiumTicket />
          </div>

          <p className="mt-8 text-sm opacity-80">
            ¿Prefieres el camino largo?{" "}
            <a
              href={`mailto:${SITE.contactEmail}`}
              className="font-bold underline decoration-2 underline-offset-4"
            >
              Escríbenos un email
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

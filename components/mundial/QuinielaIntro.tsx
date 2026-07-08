"use client";

import Image from "next/image";
import Link from "next/link";
import { gen } from "@/lib/config";
import {
  CAMPAIGN,
  computePrizePool,
  formatUsd,
  STRIPE_PAYMENT_LINK,
} from "@/lib/mundial/config";

// Pre-payment intro for the Mundial x Rotary quiniela. This is the page the
// promo popup links to (Champions-style: the quiniela IS the page). It echoes
// the printed Rotary flyer — navy stadium + gold — so someone arriving from
// the flyer or the popup recognizes it instantly, and it never looks like the
// B2B landing. "Participar ahora" goes straight to Stripe; after paying, the
// user comes back to this same route with a ticket and sees the form.

const example = computePrizePool(CAMPAIGN.goalMinTickets);

const PREMIOS = [
  {
    n: "1",
    tag: "Premio Cuartos",
    body: "Acierta los 4 equipos que avanzan a semifinales.",
    foot: "Desempate: el marcador del 4º partido de cuartos. Si nadie acierta los 4, el premio se junta para la final.",
    prize: example.prizeByStage.cuartos,
    icon: "icon-trophy",
  },
  {
    n: "2",
    tag: "Premio Semifinales",
    body: "Acierta los 2 equipos finalistas.",
    foot: "Desempate: el marcador de la semifinal. Si nadie acierta los 2, el premio se suma a la final.",
    prize: example.prizeByStage.semis,
    icon: "icon-ball",
  },
  {
    n: "3",
    tag: "Premio Final",
    body: "Acierta al campeón del Mundial.",
    foot: "Desempate: el marcador de la final. Gana quien quede más cerca; si empatan también ahí, se divide.",
    prize: example.prizeByStage.final,
    icon: "icon-trophy",
  },
] as const;

function ParticiparButton({ className = "" }: { className?: string }) {
  return (
    <a
      href={STRIPE_PAYMENT_LINK}
      className={`btn-cartoon inline-flex h-14 items-center justify-center rounded-full bg-red px-8 text-lg font-black uppercase text-cream ${className}`}
    >
      Participar ahora · $100 USD →
    </a>
  );
}

export function QuinielaIntro() {
  return (
    <div className="bg-cream">
      {/* HERO — flyer-styled navy stadium */}
      <section
        className="relative overflow-hidden border-b-[3px] border-ink text-cream"
        style={{ background: "#0B2545" }}
      >
        <Image
          src={gen("stadium-silhouette")}
          alt=""
          width={1600}
          height={500}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-full w-full object-cover opacity-25"
        />
        <Image
          src={gen("ornament-confetti")}
          alt=""
          width={1200}
          height={1200}
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-16 hidden w-[26rem] opacity-30 md:block"
        />
        <div className="relative mx-auto max-w-4xl px-5 py-16 md:px-8 md:py-24">
          <div>
            <span className="cartoon-border inline-block rounded-full bg-yellow px-4 py-1 text-xs font-black uppercase tracking-wider text-ink">
              A beneficio de Rotary Club Ciudad Juárez
            </span>
            <h1 className="font-display mt-5 text-6xl uppercase leading-[0.85] sm:text-7xl md:text-8xl">
              Quiniela
              <span className="block text-yellow">Mundialista</span>
            </h1>
            <p className="mt-4 text-lg font-black uppercase tracking-[0.12em] text-cream/90">
              Cuartos · Semifinales · Final
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="cartoon-border rounded-2xl bg-yellow px-5 py-3 text-ink">
                <p className="text-xs font-black uppercase">Donativo</p>
                <p className="font-display text-4xl leading-none">
                  $100 <span className="text-xl">USD</span>
                </p>
                <p className="text-xs font-black uppercase">por boleto</p>
              </div>
              <p className="font-display text-4xl text-yellow sm:text-5xl">
                ¡Gana en cada etapa!
              </p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ParticiparButton />
              <a
                href="#como-funciona"
                className="text-base font-bold text-cream underline decoration-2 underline-offset-4 hover:text-yellow"
              >
                ¿Cómo funciona?
              </a>
            </div>
            <p className="mt-5 text-sm font-medium text-cream/70">
              75% donativo · 25% premios · Llena tu quiniela antes del arranque
              de cuartos (9 jul)
            </p>
          </div>
        </div>
      </section>

      {/* 3 OPORTUNIDADES DE GANAR */}
      <section id="como-funciona" className="border-b-[3px] border-ink bg-cream">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
          <h2 className="font-display text-4xl md:text-5xl">
            3 oportunidades de <span className="marker-yellow">ganar</span>
          </h2>
          <p className="mt-3 max-w-2xl text-lg">
            Hay tres bolsas de premio y una misma persona puede ganar en más de
            una etapa. En cada fase gana quien atina y queda más cerca en el
            marcador del partido clave.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {PREMIOS.map((p) => (
              <div
                key={p.n}
                className="cartoon-border cartoon-shadow flex flex-col rounded-2xl bg-cream p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="cartoon-border grid h-14 w-14 place-items-center rounded-full bg-yellow">
                    <Image src={gen(p.icon)} alt="" width={64} height={64} className="h-8 w-8" />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase opacity-60">
                      Etapa {p.n}
                    </p>
                    <p className="font-display text-2xl leading-none">{p.tag}</p>
                  </div>
                </div>
                <p className="mt-4 font-bold leading-snug">{p.body}</p>
                <p className="mt-2 text-sm italic opacity-70">{p.foot}</p>
                <p className="mt-auto pt-4 text-sm font-black uppercase">
                  Con {CAMPAIGN.goalMinTickets} boletos: {formatUsd(p.prize)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA — pasos */}
      <section className="border-b-[3px] border-ink" style={{ background: "#0B2545" }}>
        <div className="mx-auto max-w-6xl px-5 py-16 text-cream md:px-8 md:py-20">
          <h2 className="font-display text-4xl md:text-5xl">
            ¿Cómo <span className="marker-yellow text-ink">funciona?</span>
          </h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-2">
            {[
              {
                n: "1",
                t: "Dona y llena tu quiniela",
                b: "Tu boleto de $100 USD se paga con tarjeta de forma segura. Al confirmarse el pago llenas tu quiniela: cuartos, semifinales, campeón y un marcador de desempate por fase.",
              },
              {
                n: "2",
                t: "Compite en cuartos",
                b: "Acierta los 4 equipos que avanzan. Si empatas con alguien, gana quien quede más cerca en el marcador del 4º partido. Si nadie acierta los 4, el premio se junta para la final.",
              },
              {
                n: "3",
                t: "Compite en semifinales",
                b: "Acierta los 2 finalistas. El desempate es el marcador de la semifinal. Si nadie acierta los 2, el premio se suma a la final.",
              },
              {
                n: "4",
                t: "Compite por el título",
                b: "Acierta al campeón del Mundial. Si varios lo aciertan, gana quien quede más cerca en el marcador de la final.",
              },
            ].map((s) => (
              <li
                key={s.n}
                className="cartoon-border flex gap-4 rounded-2xl bg-cream p-5 text-ink"
              >
                <span className="cartoon-border grid h-11 w-11 shrink-0 place-items-center rounded-full bg-yellow font-display text-xl">
                  {s.n}
                </span>
                <div>
                  <p className="font-display text-xl">{s.t}</p>
                  <p className="mt-1 leading-snug">{s.b}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="cartoon-border mt-8 rounded-2xl bg-yellow p-5 text-ink">
            <p className="font-display text-lg uppercase">
              ★ En cada fase gana quien atina y queda más cerca en el marcador
            </p>
            <ul className="mt-2 grid gap-1 text-sm font-bold">
              <li>· Cada boleto equivale a un donativo de $100 USD y una participación.</li>
              <li>· Puedes comprar más de un boleto para llenar más de una quiniela.</li>
              <li>· Cada participante puede ganar en una o más etapas.</li>
              <li>· Si varios quedan exactamente igual, el premio de esa fase se divide entre ellos.</li>
              <li>· Después de enviar tu quiniela ya no se pueden editar respuestas.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CIERRE CTA */}
      <section className="bg-cream">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center md:px-8 md:py-20">
          <h2 className="font-display text-4xl md:text-5xl">
            Dona, participa y vive la emoción del Mundial{" "}
            <span className="marker-yellow">apoyando una buena causa.</span>
          </h2>
          <div className="mt-8 flex flex-col items-center gap-4">
            <ParticiparButton />
            <p className="text-sm font-medium opacity-70">
              ¿Ya pagaste? Busca en tu correo el enlace único de tu boleto para
              llenar tu quiniela.
            </p>
            <Link
              href="/"
              className="text-sm font-bold underline decoration-2 underline-offset-4 hover:text-red"
            >
              ← Volver a supergana.fun
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

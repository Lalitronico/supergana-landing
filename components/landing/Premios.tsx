import { ZigzagEdge } from "@/components/ui/ZigzagEdge";

const CARDS = [
  { kind: "GIFT CARD", label: "[ LOGO MARCA ]", tone: "bg-yellow text-ink", rotate: -2 },
  { kind: "CASH", label: "TRANSFERENCIA", tone: "bg-green text-ink", rotate: 1.5 },
  { kind: "GIFT CARD", label: "[ LOGO MARCA ]", tone: "bg-pink text-ink", rotate: -1 },
  { kind: "EXPERIENCIA", label: "[ LOGO MARCA ]", tone: "bg-blue text-cream", rotate: 2 },
  { kind: "PREPAGADA", label: "[ LOGO MARCA ]", tone: "bg-cream text-ink", rotate: -1.5 },
  { kind: "DONACIÓN", label: "[ CAUSA ]", tone: "bg-red text-cream", rotate: 1 },
  { kind: "GIFT CARD", label: "[ LOGO MARCA ]", tone: "bg-yellow text-ink", rotate: -2 },
];

const PAYOUT_OPTIONS = [
  { icon: "🎁", name: "Gift card", meta: "+2,000 MARCAS", chosen: false },
  { icon: "💵", name: "Cash directo", meta: "✓ ELEGIDO", chosen: true },
  { icon: "💳", name: "Prepagada", meta: "VIRTUAL O FÍSICA", chosen: false },
  { icon: "❤️", name: "Donación", meta: "ELIGE CAUSA", chosen: false },
];

/** One column of the endlessly falling reward cards behind the phone. */
function CascadeColumn() {
  return (
    <div className="flex flex-col gap-4">
      {CARDS.map((card, i) => (
        <div
          key={i}
          className={`box-border h-[88px] shrink-0 rounded-xl border-[3px] border-ink p-2.5 ${card.tone}`}
          style={{ transform: `rotate(${card.rotate}deg)` }}
        >
          <p className="m-0 text-[8px] font-extrabold tracking-[0.12em] opacity-60">
            {card.kind}
          </p>
          <p className="m-0 mt-[5px] font-mono text-[10px] font-bold">{card.label}</p>
        </div>
      ))}
    </div>
  );
}

/** The phone mock that sits on top of the cascade. */
function PayoutPhone() {
  return (
    <div className="w-[290px] rotate-2 rounded-[44px] border-[3px] border-cream bg-ink p-2.5 shadow-[12px_12px_0_0_var(--color-yellow-deep)]">
      <div className="overflow-hidden rounded-[34px] bg-cream">
        <div className="bg-ink px-4 pb-3 pt-2">
          <div className="mb-2.5 flex justify-center">
            <div className="h-[7px] w-[84px] rounded-full bg-cream opacity-25" />
          </div>
          <div className="flex items-center justify-between text-[11px] font-extrabold tracking-[0.06em] text-cream">
            <span>TU MARCA · PREMIOS</span>
            <span className="rounded-full bg-yellow px-2.5 py-[3px] text-ink">
              1,250 pts
            </span>
          </div>
        </div>

        <div className="border-b-[3px] border-ink bg-yellow px-4 py-3">
          <p className="font-display m-0 text-base">🎉 ¡Tienes un payout!</p>
          <p className="m-0 mt-0.5 text-[11px] font-semibold opacity-70">
            Por participar. Elige cómo cobrarlo:
          </p>
        </div>

        <div className="grid gap-2 p-3.5">
          {PAYOUT_OPTIONS.map((opt) => (
            <div
              key={opt.name}
              className={`flex items-center justify-between rounded-xl border-[3px] border-ink px-3 py-[9px] text-[13px] ${
                opt.chosen
                  ? "bg-yellow font-extrabold shadow-[3px_3px_0_0_var(--color-ink)]"
                  : "bg-cream font-bold"
              }`}
            >
              <span>
                {opt.icon} {opt.name}
              </span>
              <span
                className={`text-[10px] font-extrabold ${
                  opt.chosen ? "" : "opacity-55"
                }`}
              >
                {opt.meta}
              </span>
            </div>
          ))}

          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex h-[34px] items-center justify-center rounded-lg border-2 border-dashed border-ink font-mono text-[9px] font-bold opacity-60"
              >
                [LOGO]
              </div>
            ))}
          </div>

          <p className="m-0 mt-0.5 text-center text-[10px] font-bold opacity-55">
            …y muchas opciones más en su país
          </p>
        </div>

        <div className="mx-3.5 mb-4 rounded-xl border-[3px] border-ink bg-green p-[11px] text-center text-sm font-extrabold shadow-[3px_3px_0_0_var(--color-ink)]">
          Cobrar ahora
        </div>
      </div>
    </div>
  );
}

export function Premios() {
  return (
    <>
      <ZigzagEdge color="#0A0A0A" direction="down" />

      <section className="overflow-hidden bg-ink py-[90px]">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-12 px-6">
          <div className="min-w-[300px] flex-[1_1_460px]">
            <h2 className="font-display m-0 mb-6 text-[clamp(34px,5.5vw,58px)] leading-[1.08] text-cream">
              Aquí se gana <span className="marker-block">en serio</span>
            </h2>

            <p className="mb-7 max-w-[540px] text-[clamp(16px,1.8vw,19px)] leading-[1.6] text-cream opacity-90">
              Gift cards de miles de marcas, tarjetas prepagadas, transferencias
              en efectivo y donaciones — entregables en más de 200 países,
              directo al ganador. Cada participante canjea en su país, en su
              moneda, sin que tú muevas un dedo.
            </p>

            <div className="mb-7 flex flex-wrap gap-2.5">
              {[
                "🎯 Payout por participar",
                "🌎 En su país y su moneda",
                "⚡ Entrega automática",
              ].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border-2 border-cream px-[15px] py-[7px] text-[13px] font-bold text-cream"
                >
                  {chip}
                </span>
              ))}
            </div>

            <div className="font-display inline-block -rotate-[1.5deg] rounded-[14px] border-[3px] border-cream bg-yellow px-[22px] py-3 text-[22px] text-ink shadow-[6px_6px_0_0_var(--color-yellow-deep)]">
              +200 países · su moneda
            </div>
          </div>

          <div className="relative h-[640px] min-w-[300px] flex-[1_1_420px] overflow-hidden">
            {/* The falling reward cards are decoration and there is no room for
                them beside the phone on a narrow screen — but the phone itself
                carries the section's whole argument, so only the cascade goes.
                Duplicated column translated -50% for a seamless loop. */}
            <div
              aria-hidden
              className="absolute bottom-0 left-[2%] top-0 hidden w-[150px] flex-col gap-4 md:flex"
              style={{ animation: "cascade 13s linear infinite" }}
            >
              <CascadeColumn />
              <CascadeColumn />
            </div>

            {/* Fades that hide the cascade's entry and exit. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-2 hidden h-[60px] bg-gradient-to-b from-ink to-transparent md:block"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 z-2 hidden h-[60px] bg-gradient-to-t from-ink to-transparent md:block"
            />

            <div className="relative z-3 flex justify-center pt-[26px] md:pl-[70px]">
              <PayoutPhone />
            </div>
          </div>
        </div>
      </section>

      <ZigzagEdge color="#0A0A0A" direction="up" />
    </>
  );
}

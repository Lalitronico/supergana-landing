"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SITE } from "@/lib/config";

const ease = [0.16, 1, 0.3, 1] as const;

const INFO_ROWS: { label: string; value: string }[] = [
  { label: "Evento", value: "Demo Supergana" },
  { label: "Duración", value: "25 minutos" },
  { label: "Fecha", value: "Esta semana" },
  { label: "Asiento", value: "Tu Marca · Fila 1" },
];

function FakeQr() {
  const cells: { x: number; y: number }[] = [];
  const seed = [
    1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1,
  ];
  for (let i = 0; i < 25; i++) {
    if (seed[i]) {
      cells.push({ x: i % 5, y: Math.floor(i / 5) });
    }
  }

  const cellSize = 10;
  const padding = 8;
  const size = 5 * cellSize + padding * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="cartoon-border rounded-lg bg-cream"
      aria-hidden
    >
      {cells.map((c, i) => (
        <rect
          key={i}
          x={padding + c.x * cellSize}
          y={padding + c.y * cellSize}
          width={cellSize - 1}
          height={cellSize - 1}
          fill="#0A0A0A"
        />
      ))}
      {[
        { x: padding, y: padding },
        { x: size - padding - cellSize * 2, y: padding },
        { x: padding, y: size - padding - cellSize * 2 },
      ].map((a, i) => (
        <g key={i}>
          <rect
            x={a.x}
            y={a.y}
            width={cellSize * 2}
            height={cellSize * 2}
            fill="#0A0A0A"
          />
          <rect
            x={a.x + 2.5}
            y={a.y + 2.5}
            width={cellSize * 2 - 5}
            height={cellSize * 2 - 5}
            fill="#FAF7F0"
          />
          <rect
            x={a.x + 5}
            y={a.y + 5}
            width={cellSize * 2 - 10}
            height={cellSize * 2 - 10}
            fill="#0A0A0A"
          />
        </g>
      ))}
    </svg>
  );
}

function Barcode() {
  // 48 bars with varied widths for a richer look
  const widths = [
    3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 1, 4, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 4,
    1, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 4, 1, 2, 1, 3, 1, 2, 4, 1, 3, 1, 2,
  ];
  return (
    <div className="flex h-12 items-stretch gap-[2px]">
      {widths.map((w, i) => (
        <div key={i} className="bg-ink" style={{ width: `${w}px` }} />
      ))}
    </div>
  );
}

export function StadiumTicket() {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className="relative mx-auto w-full max-w-2xl"
      initial={prefersReduced ? false : { opacity: 0, y: 30, rotate: -1 }}
      whileInView={prefersReduced ? undefined : { opacity: 1, y: 0, rotate: -1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, ease }}
    >
      <div className="cartoon-border cartoon-shadow-xl relative overflow-hidden rounded-3xl bg-cream text-ink">
        {/* Ribbon top */}
        <div className="flex items-center justify-between gap-2 bg-ink px-4 py-2.5 text-cream">
          <motion.span
            aria-hidden
            className="text-yellow"
            animate={
              prefersReduced
                ? undefined
                : { scale: [1, 1.25, 1], rotate: [0, 18, 0] }
            }
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            ★
          </motion.span>
          <span className="font-display flex-1 text-center text-[11px] uppercase tracking-[0.18em] text-yellow md:text-xs">
            Acceso VIP · Demo Supergana · Mundial 2026
          </span>
          <motion.span
            aria-hidden
            className="text-yellow"
            animate={
              prefersReduced
                ? undefined
                : { scale: [1, 1.25, 1], rotate: [0, -18, 0] }
            }
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5,
            }}
          >
            ★
          </motion.span>
        </div>

        {/* Main + Stub */}
        <div className="relative grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_1px_220px]">
          {/* MAIN */}
          <div className="flex flex-col gap-5 p-6 md:p-8">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full cartoon-border bg-yellow px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
                🎟️ Boleto digital
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink/40">
                #001
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
              {INFO_ROWS.map((row) => (
                <div key={row.label} className="flex flex-col">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/50">
                    {row.label}
                  </dt>
                  <dd className="font-display mt-1 text-base leading-tight md:text-lg">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-col gap-2">
              <a
                href={SITE.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-cartoon inline-flex h-14 w-full items-center justify-center rounded-full bg-yellow px-6 text-base font-bold text-ink"
              >
                Reservar mi lugar →
              </a>
              <span className="text-center text-[10px] uppercase tracking-wider text-ink/50">
                Sin compromiso · Sin demo grabada
              </span>
            </div>
          </div>

          {/* PERFORATION (vertical desktop) */}
          <div className="relative hidden md:block">
            <div
              aria-hidden
              className="absolute inset-y-3 left-1/2 -translate-x-1/2"
              style={{
                width: "2px",
                backgroundImage:
                  "repeating-linear-gradient(to bottom, #0A0A0A 0 5px, transparent 5px 11px)",
              }}
            />
            <div className="absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full border-[3px] border-ink bg-blue" />
            <div className="absolute -bottom-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full border-[3px] border-ink bg-blue" />
          </div>

          {/* PERFORATION (horizontal mobile) */}
          <div className="relative h-3 md:hidden">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-[3px] border-dashed border-ink/40" />
            <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-[3px] border-ink bg-blue" />
            <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-[3px] border-ink bg-blue" />
          </div>

          {/* STUB */}
          <div className="flex flex-col items-center justify-center gap-3 bg-ink/[0.04] p-5 md:p-6">
            <span className="font-display text-[10px] uppercase tracking-[0.18em] text-ink/50">
              Tu pase
            </span>
            <FakeQr />
            <span className="font-display rounded-md cartoon-border bg-ink px-3 py-1 text-xs uppercase tracking-wider text-yellow shadow-[2px_2px_0_0_#0A0A0A]">
              ★ VIP
            </span>
            <span className="text-center text-[10px] uppercase tracking-wider text-ink/60">
              Acceso preferente
            </span>
          </div>
        </div>

        {/* Barcode footer */}
        <div className="flex items-center gap-4 border-t-[3px] border-ink bg-cream px-6 py-4 md:px-8">
          <div className="flex-1 overflow-hidden">
            <Barcode />
          </div>
          <span className="font-display whitespace-nowrap text-[11px] uppercase tracking-[0.18em] text-ink/70 md:text-sm">
            SG-2026-MX-001
          </span>
        </div>
      </div>
    </motion.div>
  );
}

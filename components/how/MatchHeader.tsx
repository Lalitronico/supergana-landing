"use client";

import { motion } from "framer-motion";

function FlagMex({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      className="shrink-0 cartoon-border rounded-full bg-cream"
      aria-hidden
    >
      <clipPath id="mex-clip">
        <circle cx="18" cy="18" r="16" />
      </clipPath>
      <g clipPath="url(#mex-clip)">
        <rect x="2" y="2" width="11" height="32" fill="#1F7A3A" />
        <rect x="13" y="2" width="10" height="32" fill="#FAF7F0" />
        <rect x="23" y="2" width="11" height="32" fill="#C8102E" />
        <circle cx="18" cy="18" r="3.4" fill="#7B3F00" />
        <circle cx="18" cy="18" r="2.1" fill="#0A0A0A" />
      </g>
    </svg>
  );
}

function FlagUsa({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      className="shrink-0 cartoon-border rounded-full bg-cream"
      aria-hidden
    >
      <clipPath id="usa-clip">
        <circle cx="18" cy="18" r="16" />
      </clipPath>
      <g clipPath="url(#usa-clip)">
        <rect x="2" y="2" width="32" height="32" fill="#FAF7F0" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect
            key={i}
            x="2"
            y={2 + i * 4.6}
            width="32"
            height="2.3"
            fill="#C8102E"
          />
        ))}
        <rect x="2" y="2" width="14" height="14" fill="#1A3A8A" />
        {[0, 1, 2].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <circle
              key={`${row}-${col}`}
              cx={4 + col * 3}
              cy={4 + row * 4}
              r="0.7"
              fill="#FAF7F0"
            />
          ))
        )}
      </g>
    </svg>
  );
}

type Props = {
  compact?: boolean;
};

export function MatchHeader({ compact = false }: Props) {
  const flagSize = compact ? 24 : 34;

  return (
    <div className="relative overflow-hidden rounded-t-2xl">
      {/* Tournament strip */}
      <div
        className={`relative flex items-center justify-between gap-2 border-b-2 border-ink/20 bg-yellow ${compact ? "px-3 py-1" : "px-4 py-1.5"}`}
      >
        <span
          className={`font-display ${compact ? "text-[9px]" : "text-[10px]"} uppercase tracking-[0.18em] text-ink`}
        >
          ★ Mundial 2026
        </span>
        <span
          className={`${compact ? "text-[9px]" : "text-[10px]"} font-bold uppercase tracking-wider text-ink/80`}
        >
          Grupo A · J3
        </span>
      </div>

      {/* Main scoreboard */}
      <div
        className={`relative flex items-stretch text-cream ${compact ? "h-[58px]" : "h-[72px]"}`}
      >
        {/* Diagonal team color split background */}
        <div className="absolute inset-0">
          <div className="absolute inset-y-0 left-0 w-1/2 bg-[#0F4D2A]" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[#1A3A8A]" />
          <div
            className="absolute inset-y-0 left-1/2 -translate-x-1/2 bg-ink"
            style={{
              width: compact ? "70px" : "90px",
              clipPath: "polygon(20% 0, 100% 0, 80% 100%, 0 100%)",
            }}
          />
          {/* Subtle dot pattern */}
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, #FAF7F0 1px, transparent 0)",
              backgroundSize: compact ? "10px 10px" : "12px 12px",
            }}
          />
        </div>

        {/* MEX side */}
        <div
          className={`relative z-10 flex flex-1 items-center gap-2 ${compact ? "pl-3" : "pl-4"}`}
        >
          <FlagMex size={flagSize} />
          <div className="flex flex-col">
            <span
              className={`font-display ${compact ? "text-base" : "text-xl"} leading-none`}
            >
              MEX
            </span>
            <span
              className={`mt-0.5 ${compact ? "text-[8px]" : "text-[9px]"} uppercase tracking-wider text-cream/70`}
            >
              Local
            </span>
          </div>
        </div>

        {/* Center score */}
        <div className="relative z-10 flex flex-col items-center justify-center px-2">
          <motion.span
            className={`font-display ${compact ? "text-xl" : "text-2xl"} leading-none`}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            1<span className="mx-1 opacity-60">-</span>1
          </motion.span>
          <span
            className={`mt-1 inline-flex items-center gap-1 rounded-full bg-red px-1.5 py-0.5 ${compact ? "text-[8px]" : "text-[9px]"} font-bold uppercase tracking-wider text-cream`}
          >
            <motion.span
              className="inline-block h-1.5 w-1.5 rounded-full bg-cream"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            67' VIVO
          </span>
        </div>

        {/* USA side */}
        <div
          className={`relative z-10 flex flex-1 items-center justify-end gap-2 ${compact ? "pr-3" : "pr-4"}`}
        >
          <div className="flex flex-col items-end">
            <span
              className={`font-display ${compact ? "text-base" : "text-xl"} leading-none`}
            >
              USA
            </span>
            <span
              className={`mt-0.5 ${compact ? "text-[8px]" : "text-[9px]"} uppercase tracking-wider text-cream/70`}
            >
              Visita
            </span>
          </div>
          <FlagUsa size={flagSize} />
        </div>
      </div>
    </div>
  );
}

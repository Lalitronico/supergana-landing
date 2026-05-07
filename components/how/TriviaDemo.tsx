"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { DesktopFrame } from "./DesktopFrame";
import { PhoneFrame } from "./PhoneFrame";
import { MatchHeader } from "./MatchHeader";
import { TriviaQuestion } from "./TriviaQuestion";
import {
  TRIVIA_STEPS,
  LEADERBOARD,
  TIMING,
} from "@/lib/triviaScript";

type Mode =
  | { kind: "question"; index: number; phase: "asking" | "picked" | "feedback" }
  | { kind: "leaderboard" };

const ease = [0.16, 1, 0.3, 1] as const;

export function TriviaDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { amount: 0.35, once: false });
  const prefersReduced = useReducedMotion();

  const [mode, setMode] = useState<Mode>({
    kind: "question",
    index: 0,
    phase: "asking",
  });

  useEffect(() => {
    if (prefersReduced) {
      setMode({ kind: "question", index: 0, phase: "asking" });
      return;
    }
    if (!inView) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const runQuestion = (index: number) => {
      if (cancelled) return;
      setMode({ kind: "question", index, phase: "asking" });

      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setMode({ kind: "question", index, phase: "picked" });
        }, TIMING.pick)
      );

      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setMode({ kind: "question", index, phase: "feedback" });
        }, TIMING.feedback)
      );

      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          if (index < TRIVIA_STEPS.length - 1) {
            runQuestion(index + 1);
          } else {
            setMode({ kind: "leaderboard" });
            timers.push(
              setTimeout(() => {
                if (cancelled) return;
                runQuestion(0);
              }, TIMING.leaderboardMs)
            );
          }
        }, TIMING.exit)
      );
    };

    runQuestion(0);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [inView, prefersReduced]);

  const currentStep =
    mode.kind === "question" ? TRIVIA_STEPS[mode.index] : null;
  const phase = mode.kind === "question" ? mode.phase : "asking";
  const questionIndex = mode.kind === "question" ? mode.index : 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative grid grid-cols-1 items-center gap-8 md:grid-cols-[1.55fr_1fr] md:gap-10">
        {/* DESKTOP FRAME */}
        <div className="hidden md:block">
          <DesktopFrame>
            <MatchHeader />
            <div className="grid grid-cols-[1fr_180px]">
              <div className="min-h-[300px] border-r-[3px] border-ink">
                <AnimatePresence mode="wait">
                  {mode.kind === "question" && currentStep && (
                    <motion.div
                      key={`q-${mode.index}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <TriviaQuestion
                        step={currentStep}
                        phase={phase}
                        layout="grid"
                        showCursor
                      />
                    </motion.div>
                  )}
                  {mode.kind === "leaderboard" && (
                    <motion.div
                      key="lb"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease }}
                      className="px-5 py-5"
                    >
                      <Leaderboard />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <StatsSidebar
                questionIndex={questionIndex}
                isLeaderboard={mode.kind === "leaderboard"}
              />
            </div>
            <ProgressBar
              phase={phase}
              kind={mode.kind}
              questionIndex={questionIndex}
            />
          </DesktopFrame>
        </div>

        {/* PHONE FRAME */}
        <div className="mx-auto w-full max-w-[280px]">
          <PhoneFrame>
            <div className="pt-7">
              <MatchHeader compact />
              <div className="min-h-[330px]">
                <AnimatePresence mode="wait">
                  {mode.kind === "question" && currentStep && (
                    <motion.div
                      key={`pq-${mode.index}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <TriviaQuestion
                        step={currentStep}
                        phase={phase}
                        layout="stack"
                      />
                    </motion.div>
                  )}
                  {mode.kind === "leaderboard" && (
                    <motion.div
                      key="plb"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease }}
                      className="px-3 py-3"
                    >
                      <Leaderboard />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <ProgressBar
                phase={phase}
                kind={mode.kind}
                questionIndex={questionIndex}
                compact
              />
              <PoweredBy />
            </div>
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
}

function StatsSidebar({
  questionIndex,
  isLeaderboard,
}: {
  questionIndex: number;
  isLeaderboard: boolean;
}) {
  const players = 2847 + questionIndex * 12;
  const userPoints = 22 + questionIndex * 15;
  const userRank = 3;

  return (
    <div className="bg-cream p-3">
      <span className="block text-[9px] font-bold uppercase tracking-wider text-ink/60">
        En vivo
      </span>
      <div className="mt-2 space-y-2">
        <StatCard
          icon="👥"
          label="Jugadores"
          value={players.toLocaleString("es-MX")}
          color="bg-yellow"
        />
        <StatCard
          icon="🏆"
          label="Tu puntaje"
          value={`${userPoints} pts`}
          color="bg-pink"
          highlight={!isLeaderboard}
        />
        <StatCard
          icon="📈"
          label="Posición"
          value={`#${userRank}`}
          color="bg-blue"
        />
      </div>
      <div className="mt-3 cartoon-border rounded-xl bg-ink p-2 text-cream">
        <span className="block text-[9px] font-bold uppercase tracking-wider text-yellow">
          Premio
        </span>
        <span className="font-display block text-sm leading-tight">
          AirPods Pro
        </span>
        <span className="block text-[9px] text-cream/60">Top 10 ranking</span>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <motion.div
      className={`cartoon-border rounded-lg ${color} px-2 py-1.5`}
      animate={highlight ? { scale: [1, 1.03, 1] } : { scale: 1 }}
      transition={{ duration: 1.4, repeat: highlight ? Infinity : 0 }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-sm" aria-hidden>
          {icon}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-ink/70">
          {label}
        </span>
      </div>
      <motion.span
        key={value}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display mt-0.5 block text-base leading-none text-ink"
      >
        {value}
      </motion.span>
    </motion.div>
  );
}

function ProgressBar({
  phase,
  kind,
  questionIndex,
  compact = false,
}: {
  phase: "asking" | "picked" | "feedback";
  kind: "question" | "leaderboard";
  questionIndex: number;
  compact?: boolean;
}) {
  const total = TRIVIA_STEPS.length;
  const label =
    kind === "leaderboard"
      ? "🏆 Ranking en vivo"
      : phase === "feedback"
        ? "→ Siguiente pregunta…"
        : `Pregunta ${questionIndex + 1} de ${total}`;

  return (
    <div
      className={`flex items-center gap-2 border-t-[3px] border-ink ${compact ? "px-3 py-2" : "px-4 py-2.5"} bg-cream`}
    >
      <div className="flex flex-1 gap-1">
        {Array.from({ length: total }).map((_, i) => {
          const filled = kind === "leaderboard" || i < questionIndex;
          const active = kind === "question" && i === questionIndex;
          return (
            <div
              key={i}
              className="relative h-1.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-cream"
            >
              {filled && <div className="absolute inset-0 bg-green" />}
              {active && (
                <motion.div
                  key={`${kind}-${phase}-${i}`}
                  className="absolute inset-y-0 left-0 bg-yellow"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4.2, ease: "linear" }}
                />
              )}
            </div>
          );
        })}
      </div>
      <span
        className={`${compact ? "text-[8px]" : "text-[10px]"} font-bold uppercase tracking-wider text-ink/70 whitespace-nowrap`}
      >
        {label}
      </span>
    </div>
  );
}

function PoweredBy() {
  return (
    <div className="flex items-center justify-center gap-1 border-t-2 border-ink/10 bg-ink py-1.5 text-cream">
      <span className="text-[8px] uppercase tracking-[0.2em]">
        powered by
      </span>
      <span className="font-display text-[10px] tracking-tight">
        supergana<span className="text-red">.</span>
      </span>
    </div>
  );
}

function Leaderboard() {
  const colorMap: Record<string, string> = {
    yellow: "bg-yellow",
    pink: "bg-pink",
    blue: "bg-blue",
  };
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <motion.span
          aria-hidden
          className="text-2xl"
          animate={{ rotate: [-8, 8, -8] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          🏆
        </motion.span>
        <div>
          <h4 className="font-display text-base leading-tight md:text-lg">
            ¡Listo! Ranking final
          </h4>
          <p className="mt-0.5 text-[10px] text-ink/60">
            Actualizado en tiempo real
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {LEADERBOARD.map((row, i) => (
          <motion.li
            key={row.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1, ease }}
            className={`flex items-center gap-2 cartoon-border rounded-xl px-2 py-1.5 ${i === 0 ? "bg-yellow cartoon-shadow" : "bg-cream"}`}
          >
            <span className="text-base" aria-hidden>
              {medals[i] ?? `#${i + 1}`}
            </span>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full cartoon-border ${colorMap[row.avatarColor]}`}
            >
              <span className="font-display text-xs">{row.name[0]}</span>
            </span>
            <span className="flex-1 truncate text-xs font-bold">
              {row.name}
            </span>
            <span className="font-display text-sm">{row.points}</span>
            <span className="text-[8px] uppercase text-ink/60">pts</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}


"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { TriviaStep } from "@/lib/triviaScript";

type Phase = "asking" | "picked" | "feedback";

type Props = {
  step: TriviaStep;
  phase: Phase;
  layout: "grid" | "stack";
  showCursor?: boolean;
};

const ease = [0.16, 1, 0.3, 1] as const;

const DEFAULT_BG = ["bg-yellow", "bg-pink", "bg-blue", "bg-cream"] as const;

function optionBg(
  phase: Phase,
  index: number,
  isPicked: boolean,
  isCorrect: boolean
): string {
  const base = DEFAULT_BG[index % DEFAULT_BG.length];

  if (phase === "asking") return base;
  if (phase === "picked") return isPicked ? "bg-yellow" : `${base} opacity-70`;
  if (phase === "feedback") {
    if (isPicked) return isCorrect ? "bg-green" : "bg-red";
    if (isCorrect) return "bg-green/40";
    return `${base} opacity-50`;
  }
  return base;
}

export function TriviaQuestion({ step, phase, layout, showCursor }: Props) {
  const gridClass =
    layout === "grid"
      ? "grid grid-cols-2 gap-2.5"
      : "flex flex-col gap-2";

  return (
    <div className={`${layout === "stack" ? "px-3 py-3" : "px-4 py-4"}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id + "-eb"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full cartoon-border bg-cream px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink">
            {step.eyebrow}
          </span>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.h4
          key={step.id + "-q"}
          className="font-display mt-2 text-base leading-tight text-ink md:text-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease }}
        >
          {step.question}
        </motion.h4>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id + "-opts"}
          className={`mt-3 ${gridClass}`}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } },
          }}
        >
          {step.options.map((opt, i) => {
            const isPicked = i === step.pickIndex;
            const isCorrect = i === step.correctIndex;
            const bg = optionBg(phase, i, isPicked, isCorrect);
            const isHighlighted = phase !== "asking" && isPicked;

            return (
              <motion.div
                key={opt.label}
                className="relative"
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  show: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.35, ease }}
              >
                <motion.div
                  className={`relative cartoon-border rounded-xl px-2.5 py-2 ${bg} ${isHighlighted ? "cartoon-shadow" : ""} transition-colors duration-300`}
                  animate={
                    isHighlighted && phase === "picked"
                      ? { scale: [1, 1.05, 1] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.35, ease }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg cartoon-border bg-cream text-base"
                      aria-hidden
                    >
                      {opt.icon}
                    </span>
                    <span className="flex-1 truncate text-sm font-bold text-ink">
                      {opt.label}
                    </span>
                    {phase === "feedback" && isPicked && isCorrect && (
                      <motion.span
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ duration: 0.3, ease }}
                        className="font-display text-cream text-base"
                        aria-hidden
                      >
                        ✓
                      </motion.span>
                    )}
                    {phase === "feedback" && isPicked && !isCorrect && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3, ease }}
                        className="font-display text-cream text-base"
                        aria-hidden
                      >
                        ✕
                      </motion.span>
                    )}
                    {phase !== "feedback" && (
                      <span className="rounded-md cartoon-border bg-ink px-1.5 py-0.5 text-[9px] font-bold text-cream">
                        +{opt.points}
                      </span>
                    )}
                  </div>

                  {/* Confetti when correct */}
                  {phase === "feedback" && isPicked && isCorrect && (
                    <>
                      {[...Array(6)].map((_, k) => (
                        <motion.span
                          key={k}
                          aria-hidden
                          className="pointer-events-none absolute text-base"
                          style={{
                            left: `${20 + k * 12}%`,
                            top: "50%",
                          }}
                          initial={{ opacity: 0, y: 0, scale: 0.6 }}
                          animate={{
                            opacity: [0, 1, 0],
                            y: [-4, -28 - k * 3],
                            x: [0, (k - 2.5) * 6],
                            scale: [0.6, 1.1, 0.8],
                            rotate: [0, k * 50],
                          }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        >
                          {["✨", "⭐", "🎉", "✨", "⚡", "🎊"][k]}
                        </motion.span>
                      ))}
                    </>
                  )}

                  {showCursor && phase === "picked" && isPicked && (
                    <motion.span
                      className="pointer-events-none absolute -bottom-3 -right-2 text-2xl"
                      initial={{ opacity: 0, scale: 0.6, rotate: -10 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{ duration: 0.25, ease }}
                      aria-hidden
                    >
                      👆
                    </motion.span>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

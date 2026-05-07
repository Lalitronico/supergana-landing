"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  COUNTER_INITIAL,
  advanceCounters,
  type CounterState,
} from "@/lib/kitPosts";
import {
  IgPost,
  IgStory,
  XPost,
  FbPost,
  WaShare,
  MetricsDashboard,
} from "./SocialPosts";

const ease = [0.16, 1, 0.3, 1] as const;

type SlotConfig = {
  id: string;
  rotate: number;
  Component: React.ComponentType<{ counters: CounterState }>;
};

// Three columns: each balances around ~500-560px tall when rendered
const COLUMNS: SlotConfig[][] = [
  // Col 1: IG Post (square ~480px) + WaShare (~220px)
  [
    { id: "ig-post", rotate: -2.5, Component: IgPost },
    { id: "wa-share", rotate: 2, Component: WaShare },
  ],
  // Col 2: X Post (~210px) + FB Post (~410px)
  [
    { id: "x-post", rotate: 1.5, Component: XPost },
    { id: "fb-post", rotate: -1, Component: FbPost },
  ],
  // Col 3: IG Story (tall, alone ~600px)
  [{ id: "ig-story", rotate: -1.5, Component: IgStory }],
];

export function SocialMosaic() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.1, once: false });
  const prefersReduced = useReducedMotion();

  const [counters, setCounters] = useState<CounterState>(COUNTER_INITIAL);

  useEffect(() => {
    if (prefersReduced || !inView) return;
    const id = setInterval(() => {
      setCounters((prev) => advanceCounters(prev));
    }, 1500);
    return () => clearInterval(id);
  }, [inView, prefersReduced]);

  let slotIndex = 0;

  return (
    <div ref={ref} className="space-y-8 md:space-y-10">
      {/* Top: 3-column mosaic */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:items-stretch md:gap-8">
        {COLUMNS.map((column, colIdx) => {
          const isStoryCol = column.length === 1;
          return (
            <div
              key={colIdx}
              className={`flex flex-col gap-8 ${isStoryCol ? "md:gap-0" : ""}`}
            >
              {column.map((slot) => {
                const Comp = slot.Component;
                const rotate = prefersReduced ? 0 : slot.rotate;
                const i = slotIndex++;
                return (
                  <motion.div
                    key={slot.id}
                    className={`relative ${isStoryCol ? "md:flex-1" : ""}`}
                    initial={{ opacity: 0, y: 28, rotate: rotate - 3 }}
                    whileInView={{ opacity: 1, y: 0, rotate }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.6, delay: i * 0.08, ease }}
                    whileHover={
                      prefersReduced
                        ? undefined
                        : {
                            rotate: 0,
                            y: -6,
                            transition: { duration: 0.3, ease },
                          }
                    }
                  >
                    <div className={isStoryCol ? "h-full" : ""}>
                      <Comp counters={counters} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Bottom: full-width Metrics Dashboard */}
      <motion.div
        className="relative"
        initial={{ opacity: 0, y: 28, rotate: prefersReduced ? 0 : -0.5 }}
        whileInView={{
          opacity: 1,
          y: 0,
          rotate: prefersReduced ? 0 : 0.5,
        }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, delay: 0.5, ease }}
        whileHover={
          prefersReduced
            ? undefined
            : {
                rotate: 0,
                y: -6,
                transition: { duration: 0.3, ease },
              }
        }
      >
        <MetricsDashboard counters={counters} />
      </motion.div>
    </div>
  );
}

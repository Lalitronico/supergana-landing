"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { CASES } from "@/lib/useCases";
import { asset } from "@/lib/config";

const ease = [0.16, 1, 0.3, 1] as const;

export function MundialHero() {
  const data = CASES.find((c) => c.id === "mundial")!;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease }}
      className={`relative cartoon-border cartoon-shadow-lg overflow-hidden rounded-3xl ${data.bg} ${data.text}`}
    >
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* TEXT side */}
        <div className="flex flex-col gap-4 p-7 md:p-10">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full cartoon-border bg-ink px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-yellow shadow-[3px_3px_0_0_#0A0A0A]">
            ★ Mundial 2026 · El caso estrella
          </span>

          <h3 className="font-display text-3xl leading-tight md:text-5xl">
            {data.title}
          </h3>

          <p className="text-[15px] leading-relaxed opacity-90 md:text-base">
            {data.body}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full cartoon-border bg-ink px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cream">
              <span className="block h-1.5 w-1.5 rounded-full bg-yellow" />
              {data.badge}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full cartoon-border bg-cream px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-ink">
              ⚽ 32 partidos
            </span>
          </div>

          {/* Character */}
          <motion.div
            className="mt-2 self-start"
            animate={{ y: [0, -8, 0] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ willChange: "transform" }}
          >
            <Image
              src={data.character}
              alt=""
              width={160}
              height={180}
              className="h-32 w-auto select-none drop-shadow-[6px_8px_0_rgba(10,10,10,0.18)] md:h-40"
              draggable={false}
            />
          </motion.div>
        </div>

        {/* VISUAL side */}
        <div className="relative min-h-[280px] border-t-[3px] border-ink md:min-h-[460px] md:border-l-[3px] md:border-t-0">
          <Image
            src={asset("/cases/v1/mundial-stadium.png")}
            alt="Personajes de Supergana en el estadio celebrando un gol de México"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
            priority={false}
          />
        </div>
      </div>
    </motion.article>
  );
}

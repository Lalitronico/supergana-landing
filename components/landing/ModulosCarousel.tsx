"use client";

import { useRef, useState, type ReactNode } from "react";
import { CartoonButton } from "@/components/ui/CartoonButton";
import { Character } from "@/components/ui/Character";
import type { PoseName } from "@/lib/characters";

export type ModuleSlide = {
  number: string;
  eyebrow: string;
  title: string;
  body: string;
  idealPara: string;
  tone: string;
  numberTone: string;
  frame: string;
  frameRotate: number;
  mock: ReactNode;
  href: string;
  character: {
    pose: PoseName;
    size: number;
    bob: "bob" | "bob2" | "bob3";
    className: string;
  };
};

/** Round ink-bordered nav button, sitting outside the card on wide screens. */
function Arrow({
  direction,
  onClick,
  label,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`btn-cartoon flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full bg-cream text-2xl font-extrabold text-ink xl:absolute xl:top-1/2 xl:-translate-y-1/2 ${
        direction === "prev" ? "xl:-left-20" : "xl:-right-20"
      }`}
    >
      {direction === "prev" ? "←" : "→"}
    </button>
  );
}

export function ModulosCarousel({ slides }: { slides: ModuleSlide[] }) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const go = (delta: number) =>
    setActive((i) => (i + delta + slides.length) % slides.length);

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label="Catálogo de módulos"
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
        if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      }}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchStartX.current = null;
      }}
    >
      {/* Slides share one grid cell. Stacking rather than translating a track
          inside an overflow-hidden viewport keeps the section as tall as its
          tallest slide (no jump when navigating) and — the reason it matters
          here — never clips the characters, which hang outside the card on
          purpose with negative offsets. */}
      <div className="grid">
        {slides.map((mod, i) => {
          const isActive = i === active;
          return (
            <div
              key={mod.number}
              className="col-start-1 row-start-1 flex flex-wrap items-center gap-12 transition-[opacity,transform] duration-300 ease-out"
              style={{
                opacity: isActive ? 1 : 0,
                transform: isActive ? "none" : "translateX(24px)",
                visibility: isActive ? "visible" : "hidden",
              }}
              aria-hidden={!isActive}
              inert={!isActive}
            >
              {/* Visual first on every slide: alternating sides made sense when
                  the modules were stacked, but in a carousel it would flip the
                  layout on every click. */}
              <div className="relative order-1 min-w-[300px] flex-[1_1_420px]">
                <div
                  className={`modulo-frame rounded-[26px] border-[3px] border-ink p-[clamp(16px,min(4vw,3.2vh),40px)] shadow-cartoon-xl ${mod.frame}`}
                  style={{ transform: `rotate(${mod.frameRotate}deg)` }}
                >
                  {mod.mock}
                </div>

                <Character
                  pose={mod.character.pose}
                  size={mod.character.size}
                  bob={mod.character.bob}
                  duration={5.5}
                  className={mod.character.className}
                />
              </div>

              <div className="order-2 min-w-[300px] flex-[1_1_400px]">
                <div className="mb-[18px] flex items-center gap-3.5">
                  <span
                    className={`font-display rounded-[10px] border-[3px] border-ink px-3 py-1 text-[15px] shadow-[3px_3px_0_0_var(--color-ink)] ${mod.numberTone}`}
                  >
                    {mod.number}
                  </span>
                  <span className="text-xs font-extrabold uppercase tracking-[0.12em] opacity-60">
                    {mod.eyebrow}
                  </span>
                </div>

                <h3 className="font-display m-0 mb-3.5 text-[clamp(30px,4vw,42px)] tracking-[-0.015em]">
                  {mod.title}
                </h3>

                <p className="m-0 mb-5 text-[17px] leading-[1.6]">{mod.body}</p>

                <p className="m-0 mb-6 text-sm font-bold">
                  <span
                    className={`mr-2 rounded-full border-2 border-ink px-2.5 py-[3px] text-[11px] uppercase tracking-[0.06em] ${mod.tone}`}
                  >
                    Ideal para
                  </span>
                  {mod.idealPara}
                </p>

                <CartoonButton href={mod.href} variant="cream" size="sm">
                  Ver módulo →
                </CartoonButton>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls. Arrows flank the card from xl up; below that they drop into
          the same row as the dots so they never overlap the artwork. */}
      <div className="mt-[clamp(20px,3vh,40px)] flex items-center justify-center gap-5">
        <Arrow direction="prev" onClick={() => go(-1)} label="Módulo anterior" />

        <div className="flex items-center gap-2.5">
          {slides.map((mod, i) => (
            <button
              key={mod.number}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver ${mod.title}`}
              aria-current={i === active}
              className={`h-4 rounded-full border-[3px] border-ink transition-all ${
                i === active ? "w-10 bg-yellow" : "w-4 bg-cream hover:bg-yellow-hover"
              }`}
            />
          ))}
        </div>

        <Arrow direction="next" onClick={() => go(1)} label="Módulo siguiente" />
      </div>
    </div>
  );
}

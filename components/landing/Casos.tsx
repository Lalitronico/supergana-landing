import Image from "next/image";
import { CartoonButton } from "@/components/ui/CartoonButton";
import { Character } from "@/components/ui/Character";
import { DashedSlot } from "@/components/ui/DashedSlot";
import { landingAsset } from "@/lib/config";
import type { LandingCopy } from "@/lib/i18n";

/**
 * Figures verified directly against the campaign's Supabase tables on
 * 2026-07-24 — 116 paid tickets totalling $11,600 USD, with the campaign's
 * 75/25 donation split sending ~$8,700 to the cause.
 *
 * The design mocked a "[N] países" chip; there is no country column on
 * mundial_tickets or mundial_entries, so that claim has no data behind it and
 * was replaced rather than estimated. Brand rule: no invented case figures —
 * which applies to the translation too: the English chips restate the same
 * three verified numbers and add nothing.
 */
const STAT_TONES = [
  "bg-ink text-cream",
  "bg-ink text-cream",
  "bg-yellow text-ink",
];

export function Casos({ copy }: { copy: LandingCopy["casos"] }) {
  return (
    <section id="casos" className="section-stripes px-6 pb-[110px] pt-[100px]">
      <div className="mx-auto max-w-[1100px]">
        <h2 className="font-display m-0 mb-[54px] text-[clamp(34px,5.5vw,58px)] leading-[1.06]">
          {copy.titleLead} <span className="marker-yellow">{copy.titleMark}</span>
        </h2>

        <div className="mb-11 flex flex-wrap overflow-hidden rounded-[26px] border-[3px] border-ink bg-red shadow-cartoon-xl">
          <div className="min-w-[300px] flex-[1_1_440px] p-[clamp(30px,5vw,54px)] text-cream">
            <div className="mb-[22px] inline-block rounded-full bg-ink px-4 py-1.5 text-xs font-extrabold tracking-[0.1em] text-yellow">
              {copy.badge}
            </div>

            <h3 className="font-display m-0 mb-3.5 text-[clamp(28px,4vw,40px)] tracking-[-0.015em] text-cream">
              {copy.title}
            </h3>

            <p className="m-0 mb-[26px] text-[17px] leading-[1.6] opacity-90">
              {copy.body}
            </p>

            <div className="flex flex-wrap gap-3">
              {copy.stats.map((stat, i) => (
                <span
                  key={stat}
                  className={`rounded-full px-4 py-[7px] text-[13px] font-extrabold ${STAT_TONES[i]}`}
                >
                  {stat}
                </span>
              ))}
            </div>
          </div>

          <div className="relative flex min-w-[280px] flex-[1_1_340px] items-center justify-center border-l-[3px] border-ink bg-blue p-10">
            <DashedSlot
              label={copy.illustrationSlot}
              rotate={-2}
              className="aspect-square w-[min(240px,80%)] overflow-hidden rounded-3xl border-[3px] border-ink bg-cream text-[12px] tracking-[0.08em] shadow-[7px_7px_0_0_var(--color-ink)]"
            >
              {/* Sizing and frame come from the DashedSlot wrapper — repeating
                  them here nests a second bordered box inside the first. */}
              <Image
                src={landingAsset("estadio")}
                alt={copy.illustrationAlt}
                width={480}
                height={480}
                className="h-full w-full rounded-3xl object-cover"
              />
            </DashedSlot>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-[34px] rounded-[26px] border-[3px] border-dashed border-ink p-[clamp(30px,5vw,50px)]">
          <div className="flex min-w-[280px] flex-[1_1_380px] items-center gap-[26px]">
            <Character
              pose="invitando"
              size={110}
              bob="bob"
              duration={5.5}
              className="shrink-0"
            />
            <div>
              <h3 className="font-display m-0 mb-2 text-[clamp(24px,3vw,32px)] tracking-[-0.01em]">
                {copy.yourBrandTitle}
              </h3>
              <p className="m-0 max-w-[420px] text-base leading-[1.55]">
                {copy.yourBrandBody}
              </p>
            </div>
          </div>

          <CartoonButton href="#demo" size="md">
            {copy.cta}
          </CartoonButton>
        </div>
      </div>
    </section>
  );
}

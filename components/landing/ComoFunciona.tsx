import { Character } from "@/components/ui/Character";
import { Pill } from "@/components/ui/Pill";
import type { LandingCopy } from "@/lib/i18n";

// Only the presentation of each step lives here — the copy comes from the
// dictionary and is zipped in by index. Splitting them this way keeps the
// hand-made rotations and the colour rhythm out of the translator's way.
const STEP_STYLES = [
  { tone: "bg-yellow text-ink", rotate: -1.5, badgeRotate: 2 },
  { tone: "bg-blue text-cream", rotate: 1, badgeRotate: -2 },
  { tone: "bg-pink text-ink", rotate: -0.8, badgeRotate: 2 },
];

export function ComoFunciona({ copy }: { copy: LandingCopy["comoFunciona"] }) {
  const steps = copy.steps.map((step, i) => ({
    ...step,
    ...STEP_STYLES[i],
    n: i + 1,
  }));

  return (
    <section
      id="como-funciona"
      // Closing ink rule: without it the striped section dissolves into the
      // plain cream of Módulos with no edge at all.
      className="section-stripes border-b-[3px] border-ink px-6 pb-[110px] pt-[100px]"
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-16 flex flex-wrap items-end justify-between gap-6">
          <div className="-mb-[30px] w-full">
            <Pill tone="ink" bordered={false} rotate={-1}>
              {copy.pill}
            </Pill>
          </div>

          <h2 className="font-display m-0 max-w-[640px] text-[clamp(34px,5.5vw,58px)] leading-[1.06]">
            {copy.titleLead}{" "}
            <span className="marker-yellow">{copy.titleMark}</span>
          </h2>

          <Character
            pose="senalando"
            size={120}
            bob="bob"
            duration={5}
            className="hidden lg:block"
          />
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-[34px]">
          {steps.map((step) => (
            <div
              key={step.n}
              className="relative rounded-[20px] border-[3px] border-ink bg-cream p-[30px] shadow-cartoon-lg"
              style={{ transform: `rotate(${step.rotate}deg)` }}
            >
              <div
                className={`absolute -top-5 right-[22px] rounded-[10px] border-[3px] border-ink px-3 py-1 text-xs font-extrabold tracking-[0.08em] shadow-[3px_3px_0_0_var(--color-ink)] ${step.tone}`}
                style={{ transform: `rotate(${step.badgeRotate}deg)` }}
              >
                {step.badge}
              </div>

              <div
                className={`font-display mb-[18px] flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-ink text-2xl shadow-[3px_3px_0_0_var(--color-ink)] ${step.tone}`}
              >
                {step.n}
              </div>

              <h3 className="font-display m-0 mb-2.5 text-2xl tracking-[-0.01em]">
                {step.title}
              </h3>
              <p className="m-0 text-base leading-[1.55]">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

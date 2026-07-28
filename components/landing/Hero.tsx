import { CartoonButton } from "@/components/ui/CartoonButton";
import { Character } from "@/components/ui/Character";
import { Pill } from "@/components/ui/Pill";
import type { LandingCopy } from "@/lib/i18n";
import Link from "next/link";

type HeroCopy = LandingCopy["hero"];

/** Decorative speed bars bleeding off the left and right edges. */
function SpeedBars({ side }: { side: "left" | "right" }) {
  const widths = side === "left" ? [220, 150, 90] : [200, 120];
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute hidden flex-col gap-3.5 opacity-[0.18] lg:flex ${
        side === "left"
          ? "left-[-40px] top-[190px]"
          : "bottom-[120px] right-[-50px] items-end"
      }`}
    >
      {widths.map((w, i) => (
        <div
          key={w}
          className="h-3.5 rounded-full bg-ink"
          style={{
            width: w,
            marginLeft: side === "left" && i === 1 ? 40 : undefined,
            marginRight: side === "right" && i === 1 ? 50 : undefined,
          }}
        />
      ))}
    </div>
  );
}

/** The tilted in-product screenshot that anchors the right half of the hero. */
function CampaignMock({ copy }: { copy: HeroCopy["mock"] }) {
  return (
    <div className="hero-mock relative ml-[60px] mr-10 mt-[clamp(32px,6vh,76px)] rotate-2 overflow-hidden rounded-[22px] border-[3px] border-ink bg-cream shadow-cartoon-xl">
      <div className="flex items-center justify-between bg-ink px-[18px] py-3 text-cream">
        <span className="font-display text-sm tracking-[0.04em]">
          {copy.header}
        </span>
        <span className="rounded-full border-2 border-cream bg-red px-2.5 py-[3px] text-[11px] font-extrabold">
          {copy.live}
        </span>
      </div>

      <div className="p-[22px]">
        <div className="mb-3 inline-block rounded-full border-[3px] border-ink px-3 py-1 text-[11px] font-extrabold tracking-[0.08em]">
          {copy.badge}
        </div>
        <p className="font-display mb-4 text-[22px] tracking-[-0.01em]">
          {copy.question}
        </p>

        <div className="mb-[18px] grid gap-2.5">
          <div className="flex items-center justify-between rounded-[14px] border-[3px] border-ink bg-yellow px-3.5 py-2.5 text-[15px] font-bold">
            <span>{copy.optionHome}</span>
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-extrabold text-yellow">
              +10
            </span>
          </div>
          <div className="flex items-center justify-between rounded-[14px] border-[3px] border-ink bg-cream px-3.5 py-2.5 text-[15px] font-bold">
            <span>{copy.optionAway}</span>
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-extrabold text-cream">
              +8
            </span>
          </div>
        </div>

        <div className="mb-[18px] flex items-center gap-3">
          <div className="h-[18px] flex-1 overflow-hidden rounded-full border-[3px] border-ink bg-cream">
            <div className="h-full w-[68%] bg-green" />
          </div>
          <span className="rounded-full border-[3px] border-ink bg-blue px-3 py-1 text-xs font-extrabold text-cream shadow-[3px_3px_0_0_var(--color-ink)]">
            120 pts
          </span>
        </div>

        <div className="rounded-[14px] border-[3px] border-ink bg-yellow p-3 text-center text-base font-extrabold shadow-cartoon">
          {copy.cta}
        </div>
      </div>
    </div>
  );
}

export function Hero({ copy }: { copy: HeroCopy }) {
  return (
    // min-h-svh + centring makes the hero own exactly one screen, so the whole
    // proposition is legible on arrival instead of asking for a small scroll.
    <header
      id="top"
      className="relative flex min-h-svh items-center overflow-hidden"
    >
      <SpeedBars side="left" />
      <SpeedBars side="right" />

      <div className="relative mx-auto flex w-full max-w-[1100px] flex-wrap items-center gap-x-14 gap-y-8 px-6 pb-[clamp(40px,7vh,90px)] pt-[clamp(104px,15vh,150px)]">
        <div className="min-w-[300px] flex-[1_1_480px]">
          <Pill shadow rotate={-1} className="mb-[clamp(14px,2.5vh,28px)]">
            {copy.pill}
          </Pill>

          {/* Sized against viewport HEIGHT as well as width: on a short laptop
              screen a width-only clamp keeps the 96px maximum and spills the
              headline onto three lines, which alone is 294px of hero. */}
          <h1 className="font-display m-0 mb-[clamp(14px,2.5vh,26px)] text-[clamp(44px,min(8.5vw,10.5vh),96px)] leading-[1.02]">
            {copy.titleLead}{" "}
            <span className="marker-yellow">{copy.titleMark}</span>
          </h1>

          <p className="hero-copy mb-[clamp(20px,3.5vh,34px)] max-w-[560px] text-[clamp(16px,2vw,20px)] leading-[1.55]">
            {copy.body}
          </p>

          <div className="mb-[clamp(10px,1.6vh,16px)] flex flex-wrap items-center gap-[18px]">
            <CartoonButton href="#demo" size="lg">
              {copy.cta}
            </CartoonButton>
            <Link
              href="#modulos"
              className="border-b-[3px] border-ink pb-0.5 text-[17px] font-bold text-ink transition-colors hover:border-red-deep hover:text-red-deep"
            >
              {copy.secondary}
            </Link>
          </div>

          <p className="hero-micro m-0 text-sm font-semibold opacity-65">
            {copy.micro}
          </p>
        </div>

        <div className="relative min-h-[clamp(360px,54vh,540px)] min-w-[300px] flex-[1_1_380px]">
          {/* Celebrating character + speech bubble, top-left of the mock */}
          <div className="absolute -top-6 left-[-78px] z-2 hidden sm:block">
            <div className="relative">
              <Character pose="celebrando" size={150} bob="bob2" duration={5} />
              <div className="font-display absolute -top-1.5 right-[-108px] whitespace-nowrap rounded-[14px] border-[3px] border-ink bg-cream px-3.5 py-[7px] text-sm shadow-[3px_3px_0_0_var(--color-ink)] rotate-[4deg]">
                {copy.bubble}
              </div>
            </div>
          </div>

          {/* Trophy character, hanging off the mock's bottom-right corner.
              Offset clear of the mock's own CTA — with the shortened hero the
              two collide if the character sits flush at bottom-0. */}
          <div className="absolute -bottom-8 right-[-46px] z-2 hidden lg:block">
            <Character pose="conTrofeo" size={124} bob="bob3" duration={6} delay={0.8} />
          </div>

          <CampaignMock copy={copy.mock} />
        </div>
      </div>
    </header>
  );
}

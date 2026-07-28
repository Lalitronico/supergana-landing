import { BookDemoButton } from "@/components/BookDemoButton";
import { Character } from "@/components/ui/Character";
import { ZigzagEdge } from "@/components/ui/ZigzagEdge";
import type { LandingCopy } from "@/lib/i18n";

/**
 * The only non-cream section besides the ink band. Entered and exited on
 * zigzag teeth; the exit teeth sit on ink so they blend into the footer.
 *
 * The design showed a `[ EMBED DE CALENDARIO ]` placeholder here. It is
 * deliberately NOT an inline embed: a permanently open calendar drops a large
 * white Cal.com panel into the middle of the yellow band and buries the
 * closing headline. The booking flow opens as a modal from the CTA instead.
 */
export function CtaFinal({ copy }: { copy: LandingCopy["ctaFinal"] }) {
  return (
    <>
      <ZigzagEdge color="#FFD93D" direction="down" />

      <section
        id="demo"
        className="relative overflow-hidden bg-yellow px-6 pb-[100px] pt-[90px]"
      >
        <Character
          pose="saludando"
          size={110}
          bob="bob2"
          duration={5}
          className="absolute left-[4%] top-10 hidden lg:block"
        />
        <Character
          pose="festejando"
          size={120}
          bob="bob3"
          duration={6}
          delay={0.6}
          className="absolute bottom-[50px] right-[4%] hidden lg:block"
        />

        <div className="relative mx-auto flex max-w-[760px] flex-col items-center gap-[26px] text-center">
          <h2 className="font-display m-0 text-[clamp(56px,10vw,110px)] leading-none">
            {copy.title}
          </h2>

          <p className="m-0 max-w-[540px] text-[clamp(17px,2vw,20px)] leading-[1.55]">
            {copy.body}
          </p>

          <BookDemoButton className="btn-cartoon btn-cartoon-oncream cursor-pointer rounded-[18px] bg-ink px-[42px] py-5 text-xl font-extrabold text-yellow">
            {copy.cta}
          </BookDemoButton>

          <p className="m-0 text-sm font-semibold opacity-70">
            {copy.micro}
          </p>
        </div>
      </section>

      <ZigzagEdge color="#FFD93D" direction="up" background="#0A0A0A" />
    </>
  );
}

"use client";

import { useRef, useState } from "react";
import { Character } from "@/components/ui/Character";
import { Pill } from "@/components/ui/Pill";
import { ZigzagEdge } from "@/components/ui/ZigzagEdge";
import { promoAsset } from "@/lib/config";

/**
 * blue-deep rather than the brighter `blue`: cream body copy on #1E90FF lands
 * at a 3.0 contrast ratio, under the 4.5 minimum. #1769BF reaches 5.1 and
 * reads more like a darkened room, which is what a video wants behind it.
 */
const BAND = "#1769BF";

const TRACKS = {
  es: { file: "promo-es.mp4", label: "Español", lang: "es-MX" },
  en: { file: "promo-en.mp4", label: "English", lang: "en-US" },
} as const;

type Lang = keyof typeof TRACKS;

const LANGS = Object.keys(TRACKS) as Lang[];

/**
 * The promo video section — the "show, don't tell" beat, placed after "mundo
 * propio" so it plays as the payoff to the cast the reader has just met rather
 * than as an opening hook.
 *
 * Both cuts are the same animation with a different voice track, so the whole
 * thing is one <video> whose src swaps rather than two players: switching
 * language mid-watch keeps the timestamp and keeps playing.
 *
 * `preload="none"` is load-bearing, not a micro-optimisation — the two files
 * are ~8.4 MB each, and an eager preload would start streaming both on page
 * load, competing with the sections above for a video most visitors will never
 * press play on. The poster frame carries the section until they do.
 */
export function Promo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  /** Set on a language switch, consumed by the next loadedmetadata. */
  const resumeRef = useRef<{ at: number; playing: boolean } | null>(null);
  const [lang, setLang] = useState<Lang>("es");
  const [started, setStarted] = useState(false);

  const play = () => {
    setStarted(true);
    videoRef.current?.play().catch(() => {
      // Autoplay policies never block a play() this close to a real click, but
      // a rejected promise here would otherwise surface as an unhandled error.
    });
  };

  const switchTo = (next: Lang) => {
    if (next === lang) return;

    const video = videoRef.current;
    if (video && started) {
      resumeRef.current = { at: video.currentTime, playing: !video.paused };
    }

    // React writes the new src on re-render, which restarts the media element's
    // load algorithm on its own — calling load() here would race that.
    setLang(next);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    const resume = resumeRef.current;
    resumeRef.current = null;
    if (!video || !resume) return;

    video.currentTime = resume.at;
    if (resume.playing) {
      video.play().catch(() => {});
    }
  };

  return (
    // The colour band is what closes the gap. Left as a cream section this sat
    // between two other cream-floored sections, so its own top padding stacked
    // on "mundo propio"'s bottom padding into ~190px of blank floor with no
    // edge anywhere in it. A band turns that dead run into the transition: the
    // teeth land where the emptiness used to start.
    //
    // Entered on teeth, left on none: the yellow OPERAMOS marquee follows
    // immediately, and it is rotated and overscaled enough to cross the band's
    // bottom edge on the diagonal by itself. Exit teeth under it put a blue
    // sawtooth and an ink-bordered yellow band within ~14px of each other —
    // the brand rule wants a colour band never left on a flat cut, and the
    // marquee already is that cut.
    <>
      <ZigzagEdge color={BAND} direction="down" />

      <section
        id="video"
        className="relative overflow-hidden bg-blue-deep px-6 pb-[84px] pt-[72px] text-cream"
      >
        <div className="mx-auto max-w-[1100px] text-center">
          <Pill tone="yellow" shadow rotate={-1.5} className="mb-[22px]">
            En video
          </Pill>

          <h2 className="font-display mx-auto mb-5 max-w-[760px] text-[clamp(34px,5.5vw,58px)] leading-[1.06]">
            {/* marker-block, not marker-yellow: the highlighter gradient is
                built to sit on cream and has nothing to contrast against on a
                colour band — globals.css keeps the solid-block variant for
                exactly this case. nowrap because the phrase otherwise splits
                after "52" and the block paints two ragged stubs. */}
            Supergana en{" "}
            <span className="marker-block whitespace-nowrap">52 segundos</span>
          </h2>

          <p className="mx-auto mb-12 max-w-[560px] text-[17px] leading-[1.6] opacity-90">
            Qué hacemos, cómo se ve con tu marca encima y por qué tu gente
            vuelve a jugar. Sin slides.
          </p>

          {/* Not centred by `mx-auto` alone: the character hangs off the frame's
              bottom-left corner, so the two need a shared positioned parent. */}
          <div className="relative mx-auto w-full max-w-[880px]">
            <Character
              pose="festejando"
              size={128}
              bob="bob2"
              duration={5.4}
              // z-10, not the z-2 used elsewhere: the frame is a later sibling,
              // and anything below its stacking order gets painted over — the
              // character has to read as leaning on the corner, not behind it.
              className="absolute -bottom-9 left-[-88px] z-10 hidden lg:block"
            />

            {/* The cartoon TV: same title-bar-over-body construction as the hero's
                campaign mock, which is the brand's established way of framing a
                screen. The tilt is a fraction of the hero mock's — a video is a
                live raster, and past ~1deg the rotation starts to read as
                softness rather than as character. */}
            <div className="relative -rotate-[0.7deg] overflow-hidden rounded-[22px] border-[3px] border-ink bg-ink shadow-cartoon-xl">
              <div className="flex items-center justify-between gap-3 bg-ink px-[14px] py-3 text-cream sm:gap-4 sm:px-[18px]">
                {/* The full label plus the toggle needs ~350px; the frame's inner
                    width at a 360px viewport is ~306, and both are shrink-0, so
                    the long form has to go rather than be squeezed. */}
                <span className="font-display shrink-0 text-sm tracking-[0.04em]">
                  PROMO<span className="hidden sm:inline"> · SUPERGANA</span>
                </span>

                {/* Cream-on-ink segmented control, matching the navbar pill. A
                    cartoon shadow is deliberately absent: it would be ink on ink
                    and read as a smudge. */}
                <div
                  role="group"
                  aria-label="Idioma del video / Video language"
                  className="flex shrink-0 items-center gap-1 rounded-full border-2 border-cream/25 p-1"
                >
                  {LANGS.map((code) => {
                    const active = code === lang;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => switchTo(code)}
                        aria-pressed={active}
                        lang={TRACKS[code].lang}
                        className={`rounded-full px-2.5 py-1 text-[13px] font-extrabold transition-colors sm:px-3.5 ${
                          active
                            ? "bg-yellow text-ink"
                            : "text-cream/70 hover:bg-cream/15 hover:text-cream"
                        }`}
                      >
                        {TRACKS[code].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative aspect-video">
                <video
                  ref={videoRef}
                  // Keying by language would remount the element and drop the
                  // ref's playback state — the whole point of switching in place.
                  src={promoAsset(TRACKS[lang].file)}
                  poster={promoAsset("promo-poster.jpg")}
                  preload="none"
                  playsInline
                  controls={started}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setStarted(false)}
                  // The source is 848x480 (1.767) against the 16:9 box (1.778):
                  // cover crops ~3px of width rather than letterboxing it.
                  className="block h-full w-full object-cover"
                />

                {!started && (
                  <button
                    type="button"
                    onClick={play}
                    aria-label={`Reproducir el video promocional en ${TRACKS[lang].label}`}
                    className="group absolute inset-0 flex cursor-pointer items-center justify-center bg-ink/15 transition-colors hover:bg-ink/5"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-ink bg-yellow shadow-[6px_6px_0_0_var(--color-ink)] transition-all duration-150 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-yellow-hover group-hover:shadow-[8px_8px_0_0_var(--color-ink)] group-active:translate-x-0.5 group-active:translate-y-0.5 group-active:shadow-[2px_2px_0_0_var(--color-ink)] sm:h-[92px] sm:w-[92px]">
                      {/* Nudged right by 3px: a triangle centred on its bounding
                          box looks left-heavy inside a circle. */}
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden
                        className="ml-[3px] h-7 w-7 fill-ink sm:h-9 sm:w-9"
                      >
                        <path d="M6 3.5 20.5 12 6 20.5z" />
                      </svg>
                    </span>

                    <span className="font-display absolute bottom-3 right-3 rounded-full border-[3px] border-ink bg-cream px-2.5 py-0.5 text-xs tracking-[0.04em] text-ink sm:bottom-4 sm:right-4 sm:px-3 sm:py-1 sm:text-[13px]">
                      0:52
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

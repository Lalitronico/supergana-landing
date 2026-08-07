import Link from "next/link";
import {
  LOCALES,
  LOCALE_HOME,
  LOCALE_LABEL,
  LOCALE_NAME,
  type LandingCopy,
  type Locale,
} from "@/lib/i18n";

/**
 * Floating pill navbar. Stays a plain anchor list — the sections it points at
 * are all on this page, and smooth scrolling is handled by `scroll-behavior`
 * in globals.css.
 *
 * Section ids stay Spanish (`#modulos`, `#como-funciona`) in both locales.
 * They are internal anchors no visitor reads, and translating them would mean
 * carrying two sets of ids through every section component for nothing.
 */
export function Navbar({
  copy,
  locale,
}: {
  copy: LandingCopy["nav"];
  locale: Locale;
}) {
  return (
    // Ink fill, cream border. The border is not decoration: this pill is fixed
    // over cream, striped, ink and yellow sections in turn, and an ink-on-ink
    // navbar vanishes entirely against the prizes band, leaving the logo and
    // links floating loose. Cream outlines it there and merges harmlessly into
    // the cream sections. Cream borders on ink are already brand vocabulary —
    // the chips inside the prizes band use the same treatment.
    //
    // pl-6 dropped to pl-5 and the sm gap from 22px to 18px: the locale switch
    // is a fifth element in a bar that already ran to the 1060px cap on a
    // laptop, and the alternative was hiding it exactly where it is most
    // useful.
    //
    // Below 480px every metric here shrinks. The bar is `fixed`, so it is
    // shrink-to-fit: `max-w` clips it but nothing inside it wraps or shrinks,
    // and the desktop sizes add up to 401px of content — wider than the pill
    // can ever be on a phone, so the button was being cut off at the screen
    // edge on every handset, a 430px viewport included. Type, padding and the
    // outer margin all come down, and the button drops to `ctaShort`; the
    // compact set fits from 320px up. 480px is the switch point because the
    // full-size bar clears its own content at ~437px, and the extra headroom
    // absorbs the font metrics of devices we cannot measure here.
    <nav className="fixed left-1/2 top-4 z-100 flex max-w-[min(1060px,calc(100vw-24px))] -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border-[3px] border-cream bg-ink py-2.5 pl-4 pr-2 shadow-[0_12px_34px_rgba(10,10,10,0.26)] min-[480px]:max-w-[min(1060px,calc(100vw-32px))] min-[480px]:pl-5 min-[480px]:pr-3 sm:gap-[18px]">
      <Link
        href="#top"
        className="font-display text-[19px] text-cream min-[480px]:text-[22px]"
      >
        Supergana<span className="text-red">.</span>
      </Link>

      {/* 880px, not `md`. The four section links are 385px wide and the rest
          of the bar is 440px; turning them on at 768px put 825px of content in
          a pill that can only be 736px wide there, so an iPad in portrait got
          the same clipped button as a phone. 857px is where the full bar first
          clears its own content — 880 rounds it off. Between 480 and 880 the
          links stay hidden and the sections are reached by scrolling, as they
          already were on every phone. */}
      <div className="hidden items-center gap-1 min-[880px]:flex">
        {copy.links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full px-3.5 py-2 text-[15px] font-semibold text-cream/75 transition-colors hover:bg-yellow hover:text-ink"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <LocaleSwitch current={locale} label={copy.languageLabel} />

      {/* Deliberately not `btn-cartoon`: its hard shadow is ink, which is
          invisible against the ink pill, so the hover lift would read as the
          button jumping for no reason. A colour shift is the honest signal
          inside a bar this small. */}
      <Link
        href="#demo"
        className="rounded-full bg-yellow px-4 py-2.5 text-[14px] font-extrabold text-ink transition-colors hover:bg-yellow-hover min-[480px]:px-5 min-[480px]:text-[15px]"
      >
        {/* Two spans rather than one string swapped in JS: the bar renders on
            the server, so a JS swap would ship the wrong label until hydration
            and flash on every phone. The hidden one is `display:none`, which
            assistive tech skips, so only the visible label is announced. */}
        <span className="min-[480px]:hidden">{copy.ctaShort}</span>
        <span className="hidden min-[480px]:inline">{copy.cta}</span>
      </Link>
    </nav>
  );
}

/**
 * ES/EN segmented control.
 *
 * Links, not state: each language is its own URL, so the English landing can
 * be pasted into an email to a US client and open in English. A client-side
 * toggle would have given the same two-button UI and nothing shareable.
 *
 * Same construction as the video track switch inside `Promo` — cream hairline
 * border, yellow fill on the active segment, and no cartoon shadow, which
 * would be ink on ink and read as a smudge.
 */
function LocaleSwitch({ current, label }: { current: Locale; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 items-center gap-0.5 rounded-full border-2 border-cream/25 p-0.5"
    >
      {LOCALES.map((code) => {
        const active = code === current;
        return (
          <Link
            key={code}
            href={LOCALE_HOME[code]}
            hrefLang={code}
            lang={code}
            title={LOCALE_NAME[code]}
            // The active segment stays a link rather than becoming a <span>:
            // it keeps both halves identically sized, and `aria-current`
            // carries the state for assistive tech.
            aria-current={active ? "true" : undefined}
            className={`rounded-full px-2 py-1 text-[12px] font-extrabold transition-colors min-[480px]:px-2.5 min-[480px]:text-[13px] ${
              active
                ? "bg-yellow text-ink"
                : "text-cream/70 hover:bg-cream/15 hover:text-cream"
            }`}
          >
            {LOCALE_LABEL[code]}
          </Link>
        );
      })}
    </div>
  );
}

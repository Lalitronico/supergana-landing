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
    <nav className="fixed left-1/2 top-4 z-100 flex max-w-[min(1060px,calc(100vw-32px))] -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border-[3px] border-cream bg-ink py-2.5 pl-5 pr-3 shadow-[0_12px_34px_rgba(10,10,10,0.26)] sm:gap-[18px]">
      <Link href="#top" className="font-display text-[22px] text-cream">
        Supergana<span className="text-red">.</span>
      </Link>

      <div className="hidden items-center gap-1 md:flex">
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
        className="rounded-full bg-yellow px-5 py-2.5 text-[15px] font-extrabold text-ink transition-colors hover:bg-yellow-hover"
      >
        {copy.cta}
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
            className={`rounded-full px-2.5 py-1 text-[13px] font-extrabold transition-colors ${
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

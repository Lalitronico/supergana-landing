import Link from "next/link";

const LINKS = [
  { href: "#modulos", label: "Módulos" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#casos", label: "Casos" },
];

/**
 * Floating pill navbar. Stays a plain anchor list — the sections it points at
 * are all on this page, and smooth scrolling is handled by `scroll-behavior`
 * in globals.css.
 */
export function Navbar() {
  return (
    // Ink fill, cream border. The border is not decoration: this pill is fixed
    // over cream, striped, ink and yellow sections in turn, and an ink-on-ink
    // navbar vanishes entirely against the prizes band, leaving the logo and
    // links floating loose. Cream outlines it there and merges harmlessly into
    // the cream sections. Cream borders on ink are already brand vocabulary —
    // the chips inside the prizes band use the same treatment.
    <nav className="fixed left-1/2 top-4 z-100 flex max-w-[min(1060px,calc(100vw-32px))] -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border-[3px] border-cream bg-ink py-2.5 pl-6 pr-3 shadow-[0_12px_34px_rgba(10,10,10,0.26)] sm:gap-[22px]">
      <Link href="#top" className="font-display text-[22px] text-cream">
        Supergana<span className="text-red">.</span>
      </Link>

      <div className="hidden items-center gap-1 md:flex">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full px-3.5 py-2 text-[15px] font-semibold text-cream/75 transition-colors hover:bg-yellow hover:text-ink"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Deliberately not `btn-cartoon`: its hard shadow is ink, which is
          invisible against the ink pill, so the hover lift would read as the
          button jumping for no reason. A colour shift is the honest signal
          inside a bar this small. */}
      <Link
        href="#demo"
        className="rounded-full bg-yellow px-5 py-2.5 text-[15px] font-extrabold text-ink transition-colors hover:bg-yellow-hover"
      >
        Agenda tu demo
      </Link>
    </nav>
  );
}

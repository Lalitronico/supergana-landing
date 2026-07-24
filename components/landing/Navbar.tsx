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
    <nav className="fixed left-1/2 top-4 z-100 flex max-w-[min(1060px,calc(100vw-32px))] -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border-[3px] border-ink bg-cream py-2.5 pl-6 pr-3 shadow-cartoon sm:gap-[22px]">
      <Link href="#top" className="font-display text-[22px] text-ink">
        Supergana<span className="text-red">.</span>
      </Link>

      <div className="hidden items-center gap-1 md:flex">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full border-[3px] border-transparent px-3.5 py-2 text-[15px] font-semibold text-ink transition-colors hover:border-ink hover:bg-yellow"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <Link
        href="#demo"
        className="btn-cartoon rounded-full bg-yellow px-5 py-2.5 text-[15px] font-extrabold text-ink"
      >
        Agenda tu demo
      </Link>
    </nav>
  );
}

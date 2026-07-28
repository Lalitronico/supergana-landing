import Link from "next/link";
import { SITE } from "@/lib/config";
import type { LandingCopy } from "@/lib/i18n";

export function Footer({ copy }: { copy: LandingCopy["footer"] }) {
  // The mailto link is appended rather than living in the dictionary: the
  // address is a config value, not copy, and duplicating it per locale is how
  // one of them ends up stale.
  const links = [
    ...copy.links,
    { href: `mailto:${SITE.contactEmail}`, label: copy.contact },
  ];

  return (
    <footer className="bg-ink px-6 py-14 text-cream">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-7">
        <span className="font-display text-2xl">
          Supergana<span className="text-red">.</span>
        </span>

        <div className="flex flex-wrap gap-[26px]">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[15px] font-semibold text-cream transition-colors hover:text-yellow"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col items-end gap-1">
          <a
            href={`mailto:${SITE.contactEmail}`}
            className="text-[15px] font-bold text-yellow transition-colors hover:text-yellow-deep"
          >
            {SITE.contactEmail}
          </a>
          <span className="text-[13px] opacity-60">{copy.rights}</span>
        </div>
      </div>
    </footer>
  );
}

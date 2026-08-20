"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The module's navigation, once and at the bottom.
 *
 * WHY THIS EXISTS.
 *
 * Every screen used to write its own `sg-dock`: twelve of them, each guessing
 * which two or three destinations the player might want next. That cost up to
 * ~165px of a 844px phone per screen, said something different on each one, and
 * still left "where am I" unanswered. Eduardo's mockup 01 answers it the way
 * every phone app does — four fixed destinations, the current one lit — and the
 * marketing for the shell is that the destinations never move.
 *
 * WHERE IT IS MOUNTED. In `layout.tsx`, AFTER `{children}`. The phone frame is a
 * flex column, so the order on screen is head → the child's scrolling screen →
 * whatever contextual sticky the child adds (the picks board's `pk-dockmini`)
 * → these tabs. A child cannot forget to render them and cannot render them
 * twice.
 *
 * WHY IT TAKES `openWeek` AS A PROP. The programme is already loaded by the
 * layout that mounts this, so "Jugar" can point at the open jornada without a
 * fetch of its own. A tab that has to wait for data is a tab that flickers.
 *
 * WHY IT DISAPPEARS UNDER /panel. The same layout serves the staff console, and
 * four player destinations at the bottom of a settlement screen are four ways
 * to lose the work in progress.
 */

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Everything under these prefixes lights this tab. */
  match: string[];
  /** The guided tour's handle on this tab. A class would not do: `.pk-tab` is
      four identical siblings, so pointing at one would mean `:nth-child(3)`,
      which silently points at the wrong tab the day a fifth destination is
      added or the order changes. */
  tour: string;
};

const ICON = {
  width: 21,
  height: 21,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.1,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/* The ball, laces and all. Rotated 45° so it reads as a football and not as an
   egg at 21px. */
const BallIcon = () => (
  <svg {...ICON}>
    <ellipse cx="12" cy="12" rx="9.2" ry="5.6" transform="rotate(-45 12 12)" />
    <path d="M9.2 14.8 14.8 9.2" />
    <path d="M10.4 11.6 11.6 12.8M12 10 13.2 11.2" />
  </svg>
);

const ChartIcon = () => (
  <svg {...ICON}>
    <path d="M4 20V10.5M12 20V4.5M20 20v-7" />
    <path d="M2.5 20h19" />
  </svg>
);

const GiftIcon = () => (
  <svg {...ICON}>
    <path d="M3.6 10.5h16.8v9.9H3.6z" />
    <path d="M2.5 6.6h19v3.9h-19zM12 6.6v13.8" />
    <path d="M12 6.6C12 4.6 10.6 3.3 9.2 3.3S6.7 4.6 7.4 6.6M12 6.6c0-2 1.4-3.3 2.8-3.3s2.5 1.3 1.8 3.3" />
  </svg>
);

const PersonIcon = () => (
  <svg {...ICON}>
    <circle cx="12" cy="8" r="3.9" />
    <path d="M4.6 20.4c0-4 3.3-6.4 7.4-6.4s7.4 2.4 7.4 6.4" />
  </svg>
);

export function PickemTabs({
  slug,
  openWeek,
}: {
  slug: string;
  /** The jornada "Jugar" opens. The layout already knows it; see the header. */
  openWeek: number;
}) {
  const pathname = usePathname() ?? "";
  const base = `/p/${slug}`;

  // The staff console shares this layout. Player navigation has no business at
  // the bottom of a settlement screen.
  if (pathname.startsWith(`${base}/panel`)) return null;

  const tabs: Tab[] = [
    {
      href: `${base}/jornada/${openWeek}/`,
      label: "Jugar",
      icon: <BallIcon />,
      // Any week, not just the open one: somebody reading jornada 3's results is
      // still in the part of the app where you play.
      match: [`${base}/jornada/`],
      tour: "tab-jugar",
    },
    {
      href: `${base}/ranking/`,
      label: "Ranking",
      icon: <ChartIcon />,
      match: [`${base}/ranking/`],
      tour: "tab-ranking",
    },
    {
      href: `${base}/premios/`,
      label: "Premios",
      icon: <GiftIcon />,
      match: [`${base}/premios/`],
      tour: "tab-premios",
    },
    {
      // Registration and the code screen light "Perfil" because that is what
      // they are: the way into an identity. Without it the tabs go dark exactly
      // where a new player is least sure of where they are.
      href: `${base}/perfil/`,
      label: "Perfil",
      icon: <PersonIcon />,
      match: [`${base}/perfil/`, `${base}/registro/`, `${base}/verificar/`],
      tour: "tab-perfil",
    },
  ];

  return (
    <nav className="pk-tabs" aria-label="Secciones">
      {tabs.map((tab) => {
        const active = tab.match.some(
          (m) => pathname === m.slice(0, -1) || pathname.startsWith(m),
        );
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={`pk-tab${active ? " is-active" : ""}`}
            data-tour={tab.tour}
            aria-current={active ? "page" : undefined}
          >
            {tab.icon}
            <span className="pk-tab-l">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

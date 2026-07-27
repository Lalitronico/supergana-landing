"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { translator, type Translate } from "@/lib/tickets/i18n";
import { formatUsdCents, type Locale, type PublicCampaign } from "@/lib/tickets/config";

interface TicketsContextValue {
  campaign: PublicCampaign;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  /** Base path with the trailing slash next.config demands. */
  base: string;
  money: (cents: number) => string;
}

const TicketsContext = createContext<TicketsContextValue | null>(null);

export const useTickets = (): TicketsContextValue => {
  const ctx = useContext(TicketsContext);
  if (!ctx) throw new Error("useTickets must be used inside TicketsShell");
  return ctx;
};

const LOCALE_COOKIE = "tk_locale";

const ICONS = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M12 15V8m0 0-3 3m3-3 3 3" />
    </svg>
  ),
  panel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5" />
    </svg>
  ),
};

export function TicketsShell({
  campaign,
  initialLocale,
  children,
}: {
  campaign: PublicCampaign;
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const pathname = usePathname();
  const base = `/c/${campaign.slug}/`;

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    // A year is fine: the preference is not sensitive and re-picking a language
    // on every visit is the kind of friction that loses a bilingual audience.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    document.documentElement.lang = next;
  }, []);

  const value = useMemo<TicketsContextValue>(
    () => ({
      campaign,
      locale,
      setLocale,
      t: translator(locale),
      base,
      money: (cents: number) => formatUsdCents(cents, locale),
    }),
    [campaign, locale, setLocale, base],
  );

  const t = value.t;

  // `/c/slug/subir/` and everything under the claim flow lights up the middle tab.
  const section = pathname.startsWith(`${base}panel`)
    ? "panel"
    : pathname === base || pathname === base.slice(0, -1)
      ? "home"
      : "upload";

  const tabs = [
    { key: "home", href: base, icon: ICONS.home, label: t("navHome"), cta: false },
    { key: "upload", href: `${base}subir/`, icon: ICONS.upload, label: t("navUpload"), cta: true },
    { key: "panel", href: `${base}panel/`, icon: ICONS.panel, label: t("navPanel"), cta: false },
  ];

  return (
    <TicketsContext.Provider value={value}>
      <div className="tk-app">
        <div className="tk-phone">
          {campaign.status !== "live" && (
            <div className="tk-ribbon">{t("draftRibbon")}</div>
          )}
          <header className="tk-head">
            <div className="tk-logo">
              <span className="dot" />
              {t("appName")}
            </div>
            <div className="tk-lang" role="group" aria-label={t("langLabel")}>
              {(["es", "en"] as Locale[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={locale === code}
                  onClick={() => setLocale(code)}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </header>

          <main className="tk-screen">{children}</main>

          <nav className="tk-nav">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                className={tab.cta ? "cta" : undefined}
                aria-current={section === tab.key ? "page" : undefined}
              >
                <span className="tk-navico">{tab.icon}</span>
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </TicketsContext.Provider>
  );
}

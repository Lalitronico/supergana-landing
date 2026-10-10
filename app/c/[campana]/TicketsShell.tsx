"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { translator, type Translate } from "@/lib/tickets/i18n";
import { formatUsdCents, type Locale, type PublicCampaign } from "@/lib/tickets/config";
import { brandTone, castMember, isCobranded, themeCssVars } from "@/lib/tickets/theme";
import { useMe, type Me, type MeStatus } from "./useMe";
import { useStore, type StoreStatus } from "./useStore";
import { SafeImg } from "./showcase/SafeImg";
import { SuperganaWordmark } from "./fiesta/Wordmark";
import { ApprovalCelebration } from "./ApprovalCelebration";
import { ScrollCue } from "./ScrollCue";
import type { StoreSnapshot } from "@/lib/tickets/store";

/**
 * Session state, fetched once per page and shared.
 *
 * Every gated screen used to call `useMe` itself, which was fine while nothing
 * above them needed the balance. The header chip needs it, and two hooks against
 * `/me/` on one screen means two polls, two refresh timers and two answers that
 * can disagree for a second. So the shell owns the fetch and the screens read it.
 */
export interface Session {
  status: MeStatus;
  me: Me | null;
  reload: () => Promise<void>;
}

/** This week's Drop and the participant's redemptions. See `useStore`. */
export interface Store {
  status: StoreStatus;
  snapshot: StoreSnapshot | null;
  reload: () => Promise<void>;
}

interface TicketsContextValue {
  campaign: PublicCampaign;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  /** Base path with the trailing slash next.config demands. */
  base: string;
  money: (cents: number) => string;
  /**
   * The privacy promise, already resolved.
   *
   * Five screens make it, and it is not the same promise on every campaign: one
   * whose OCR is on sends the photo to a third party, and one whose OCR is off
   * does not. Resolved here so there is a single place that decides, rather
   * than five ternaries that will drift the first time somebody adds a sixth
   * screen.
   */
  privacyNote: string;
  session: Session;
  store: Store;
}

const TicketsContext = createContext<TicketsContextValue | null>(null);

export const useTickets = (): TicketsContextValue => {
  const ctx = useContext(TicketsContext);
  if (!ctx) throw new Error("useTickets must be used inside TicketsShell");
  return ctx;
};

/** The session alone, for the many screens that need nothing else from the shell. */
export const useSession = (): Session => useTickets().session;

/** The shelf alone. Off on threshold campaigns and before sign-in. */
export const useStoreState = (): Store => useTickets().store;

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
  prizes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="13" rx="2" />
      <path d="M3 12.5h18M12 8v13" />
      <path d="M12 8S10.5 4 8 4a2.2 2.2 0 0 0 0 4zm0 0s1.5-4 4-4a2.2 2.2 0 0 1 0 4z" />
    </svg>
  ),
  panel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5" />
    </svg>
  ),
};

/** The system's star: the mark that means "points" everywhere in the module. */
const STAR = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="m12 2.6 2.9 6.05 6.6.86-4.85 4.55 1.24 6.54L12 17.4l-5.89 3.2 1.24-6.54L2.5 9.51l6.6-.86z"
      fill="var(--tk-yellow)"
      stroke="var(--tk-ink)"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

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
  const { status, me, reload } = useMe(campaign.slug);
  const screenRef = useRef<HTMLElement>(null);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    // A year is fine: the preference is not sensitive and re-picking a language
    // on every visit is the kind of friction that loses a bilingual audience.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    document.documentElement.lang = next;
  }, []);

  const session = useMemo<Session>(() => ({ status, me, reload }), [status, me, reload]);

  // Only campaigns that have a shelf, and only once somebody is standing at it.
  // The balance goes in so the shelf follows it: the snapshot carries its own
  // copy of the points, and that copy is what decides whether a prize shows a
  // Canjear button. Read once per page load, it stayed at whatever the balance
  // was when the app opened.
  const storeState = useStore(
    campaign.slug,
    campaign.mechanic === "accumulation" && status === "ready",
    me?.points ?? null,
  );
  const store = useMemo<Store>(
    () => ({
      status: storeState.status,
      snapshot: storeState.snapshot,
      reload: storeState.reload,
    }),
    [storeState.status, storeState.snapshot, storeState.reload],
  );

  const value = useMemo<TicketsContextValue>(() => {
    // One translator per render of the context, built with the campaign's own
    // wording so every screen inherits it without knowing it exists.
    const translate = translator(locale, campaign.copy);
    return {
      campaign,
      locale,
      setLocale,
      t: translate,
      base,
      money: (cents: number) => formatUsdCents(cents, locale),
      privacyNote: translate(campaign.ocrEnabled ? "privacyNoteOcr" : "privacyNote"),
      session,
      store,
    };
  }, [campaign, locale, setLocale, base, session, store]);

  const t = value.t;
  const theme = campaign.theme;
  // A logo that fails to load drops the whole co-brand lockup back to the
  // Supergana wordmark: a header with a broken-image icon (or an empty slot next
  // to "powered by") is worse in front of a client than no logo at all.
  const [logoFailed, setLogoFailed] = useState(false);
  const cobrand = isCobranded(theme) && !logoFailed;

  // The prize store is its own destination in accumulation campaigns, where
  // points are the whole point. Threshold campaigns have no store to visit —
  // their reward is the receipt's — so they keep the three tabs they shipped with.
  const hasPrizeTab = campaign.mechanic === "accumulation";

  const tabs = [
    { key: "home", href: base, icon: ICONS.home, label: t("navHome"), cta: false },
    { key: "upload", href: `${base}subir/`, icon: ICONS.upload, label: t("navUpload"), cta: true },
    ...(hasPrizeTab
      ? [
          {
            key: "prizes",
            href: `${base}premios/`,
            icon: ICONS.prizes,
            label: t("navPrizes"),
            cta: false,
          },
        ]
      : []),
    { key: "panel", href: `${base}panel/`, icon: ICONS.panel, label: t("navPanel"), cta: false },
  ];

  // `/c/slug/subir/` and everything under the claim flow lights up the middle tab.
  const section = pathname.startsWith(`${base}premios`)
    ? "prizes"
    : pathname.startsWith(`${base}panel`)
      ? "panel"
      : pathname === base || pathname === base.slice(0, -1)
        ? "home"
        : "upload";

  // The balance is only a fact once there is a participant in this campaign.
  // An account with no profile here has no points, and printing "0 pts" at
  // somebody who has not joined yet reads as a loss rather than a blank slate.
  const points = status === "ready" && me ? me.points : null;
  // The character they play as (resolved by the server), when the campaign has a
  // cast: it takes the star's place in the balance chip, so the header says who
  // you are as well as what you have, in the same space.
  const avatarMember = castMember(
    theme,
    (me?.participant as { avatar?: string | null } | null | undefined)?.avatar,
  );

  return (
    <TicketsContext.Provider value={value}>
      <div className="tk-app" style={themeCssVars(theme)} data-tone={brandTone(theme) ?? undefined}>
        <div className="tk-phone">
          {campaign.status !== "live" && (
            <div className="tk-ribbon">{t("draftRibbon")}</div>
          )}
          <header className="tk-head" data-cobrand={cobrand ? "true" : undefined}>
            {/* The lockup is the same on every screen, signed or not: the client's
                logo with the platform's signature tucked underneath. It used to
                share a slot with the points chip, which made "powered by" vanish
                the moment somebody signed in. Stacking it under the logo gives
                the balance its own place on the right. */}
            <div className="tk-brandstack">
              {cobrand ? (
                <SafeImg
                  className="tk-cobrand"
                  src={theme.logoUrl ?? ""}
                  alt={theme.logoAlt ?? campaign.orgName}
                  onFail={() => setLogoFailed(true)}
                  fallback={<SuperganaWordmark size={20} />}
                />
              ) : (
                <SuperganaWordmark size={21} />
              )}
              {cobrand && theme.poweredBy && (
                <span className="tk-powered">
                  <span className="by">{t("headPoweredBy")}</span>
                  <SuperganaWordmark size={14} />
                </span>
              )}
            </div>

            <div className="tk-headright">
              {/* Only the languages this campaign actually ships. A one-locale
                  campaign offering an EN button promises a translation nobody
                  wrote — Carrera Alaska is `['es']` and gets no toggle at all. */}
              {campaign.locales.length > 1 && (
                <div className="tk-lang" role="group" aria-label={t("langLabel")}>
                  {campaign.locales.map((code) => (
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
              )}

              {points !== null && (
                <Link href={`${base}panel/`} className="tk-points" aria-label={t("pointsAria")}>
                  {avatarMember ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tenant art from data
                    <img
                      className="tk-points-avatar"
                      src={avatarMember.avatar ?? avatarMember.image}
                      alt=""
                      decoding="async"
                      draggable={false}
                    />
                  ) : (
                    <span className="tk-star">{STAR}</span>
                  )}
                  <b>{points.toLocaleString(locale === "en" ? "en-US" : "es-MX")}</b>
                  <span className="unit">{t("pointsUnit")}</span>
                </Link>
              )}
            </div>
          </header>

          <main className="tk-screen" ref={screenRef}>
            {children}
            <ScrollCue screenRef={screenRef} label={t("scrollCue")} pathname={pathname} />
          </main>

          <nav className="tk-nav" data-tabs={tabs.length}>
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                className={tab.cta ? "cta" : undefined}
                aria-current={section === tab.key ? "page" : undefined}
              >
                <span className="tk-navico">{tab.icon}</span>
                <span className="tk-navlabel">{tab.label}</span>
              </Link>
            ))}
          </nav>

          {/* A verdict reaches the participant on whatever screen they are on. */}
          {status === "ready" && <ApprovalCelebration />}
        </div>
      </div>
    </TicketsContext.Provider>
  );
}

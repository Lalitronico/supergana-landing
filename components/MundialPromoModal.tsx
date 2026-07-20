"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { character, gen, quinielaAsset } from "@/lib/config";
import {
  remainingStages,
  STAGE_DEADLINE_LABELS,
  stageLockDate,
  type Stage,
} from "@/lib/mundial/config";

// Promo popup for the Mundial x Rotary donation campaign. Same behavior as
// the PSG-Arsenal promo: opens once per visitor (localStorage), collapses to
// a floating pill, and disappears for good when the campaign ends (final
// kickoff — entries can compete in at least one stage until then).

const STORAGE_KEY = "supergana:promo-modal:mundial-rotary:v1";
const OPEN_DELAY_MS = 1200;

const STAGE_NAMES: Record<Stage, string> = {
  cuartos: "cuartos",
  semis: "semifinales",
  final: "final",
};

const joinEs = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;

// The prize pitch shrinks with the tournament: stages already played are
// dropped so the popup never promises a prize a new buyer can't win.
const featuresFor = (remaining: Stage[]) =>
  [
    {
      icon: "heart",
      title: "75% ES DONATIVO",
      body: "Tu boleto de $100 USD, a través del Rotary Club, apoya a las familias del terremoto en Venezuela.",
    },
    {
      icon: "trophy",
      title:
        remaining.length <= 1
          ? "PREMIO EN LA FINAL"
          : `PREMIOS EN ${remaining.length} ETAPAS`,
      body:
        // `<= 1` (not `=== 1`) so an empty `remaining` — every stage already
        // locked, e.g. after the campaign ends — takes this safe branch
        // instead of the IIFE, whose `lista[0]` would be undefined and crash.
        remaining.length <= 1
          ? "Acierta al campeón del Mundial y gana el premio de la final."
          : (() => {
              const lista = joinEs(remaining.map((s) => STAGE_NAMES[s]));
              const cuenta = remaining.length === 2 ? "dos" : "tres";
              return `${lista.charAt(0).toUpperCase()}${lista.slice(1)}: ${cuenta} oportunidades de ganar.`;
            })(),
    },
    {
      icon: "phone",
      title: "LLENA Y LISTO",
      body: "Quiniela digital de 3 minutos, desde tu celular.",
    },
  ] as const;

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function MundialPromoModal() {
  const titleId = useId();
  const descriptionId = useId();
  const reducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [hasDismissed, setHasDismissed] = useState(false);
  const [campaignActive, setCampaignActive] = useState(false);
  // Only read once the modal is client-rendered (campaignActive gates SSR),
  // so the copy always reflects the stages still in play.
  const remaining = remainingStages();
  const features = featuresFor(remaining);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const markDismissed = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {
      // Private browsing or disabled storage should not break the modal.
    }
  }, []);

  const dismiss = useCallback(() => {
    markDismissed();
    setHasDismissed(true);
    setIsOpen(false);
  }, [markDismissed]);

  const reopenPromo = useCallback(() => {
    setIsOpen(true);
  }, []);

  const goToCampaign = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      markDismissed();
      setHasDismissed(true);
      window.location.assign("/mundial/quiniela/");
    },
    [markDismissed],
  );

  useEffect(() => {
    // Client-only check so prerendered HTML stays date-independent.
    if (Date.now() >= stageLockDate("final").getTime()) return;
    setCampaignActive(true);

    let openTimeout: number | undefined;
    const storageTimeout = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem(STORAGE_KEY) === "dismissed") {
          setHasDismissed(true);
          return;
        }
      } catch {
        // If storage is unavailable, behave like a normal first visit.
      }

      openTimeout = window.setTimeout(() => {
        setIsOpen(true);
      }, OPEN_DELAY_MS);
    }, 0);

    return () => {
      window.clearTimeout(storageTimeout);
      if (openTimeout) window.clearTimeout(openTimeout);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimeout = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      });

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimeout);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [dismiss, isOpen]);

  if (!campaignActive) return null;

  return (
    <AnimatePresence>
      {hasDismissed && !isOpen ? (
        <motion.button
          type="button"
          data-testid="mundial-promo-reopen"
          aria-label="Abrir promoción de la quiniela Mundial x Rotary"
          className="btn-cartoon fixed bottom-4 right-4 z-[80] inline-flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full bg-yellow px-4 py-3 text-left text-ink shadow-[5px_5px_0_#0A0A0A] sm:bottom-6 sm:right-6 sm:px-5"
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
          onClick={reopenPromo}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-yellow">
            <FeatureIcon name="heart" />
          </span>
          <span className="grid leading-none">
            <span className="text-[0.65rem] font-black uppercase tracking-[0.14em]">
              Campaña con causa
            </span>
            <span className="mt-1 text-base font-black uppercase">
              Quiniela Mundial
            </span>
          </span>
        </motion.button>
      ) : null}

      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/72 p-3 backdrop-blur-[3px] sm:p-5"
          aria-hidden={false}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) dismiss();
          }}
        >
          <motion.section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            data-testid="mundial-promo-dialog"
            tabIndex={-1}
            className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-[1.7rem] border-[3px] border-ink bg-cream shadow-[8px_8px_0_#0A0A0A] outline-none sm:rounded-[2rem] sm:shadow-[12px_12px_0_#0A0A0A] lg:max-h-[calc(100dvh-0.5rem)]"
            initial={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 26, scale: 0.96, rotate: -0.4 }
            }
            animate={
              reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, rotate: 0 }
            }
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 190, damping: 22 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Cerrar promoción"
              data-testid="mundial-promo-close"
              onClick={dismiss}
              className="btn-cartoon absolute right-4 top-4 z-20 grid h-11 w-11 place-items-center rounded-full bg-cream text-ink sm:right-6 sm:top-6 sm:h-14 sm:w-14"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 sm:h-8 sm:w-8"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="3"
                aria-hidden="true"
              >
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </svg>
            </button>

            <div className="relative overflow-hidden bg-cream px-4 pb-5 pt-9 text-center sm:px-8 sm:pb-6 sm:pt-9 lg:px-12">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.05]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, #0A0A0A 1px, transparent 0)",
                  backgroundSize: "20px 20px",
                }}
              />
              <Image
                src={gen("ornament-confetti")}
                alt=""
                width={1200}
                height={400}
                loading="eager"
                className="pointer-events-none absolute left-1/2 top-0 w-[62rem] max-w-none -translate-x-1/2 opacity-35"
                aria-hidden="true"
              />

              <div className="relative mx-auto grid max-w-[38rem] justify-items-center">
                <span className="cartoon-border rounded-full bg-yellow px-5 py-2 text-sm font-black uppercase tracking-[0.16em] shadow-[4px_4px_0_#0A0A0A]">
                  CAMPAÑA CON CAUSA · ROTARY
                </span>

                <h2
                  id={titleId}
                  className="font-display mt-4 text-[3.1rem] uppercase leading-[0.86] text-[#07182A] sm:text-7xl"
                >
                  QUINIELA
                  <span className="block">MUNDIAL 2026</span>
                </h2>

                <div className="relative mt-3 bg-yellow px-5 py-1.5 text-xl font-black uppercase leading-none text-ink shadow-[5px_5px_0_rgba(10,10,10,0.16)] before:absolute before:left-[-1.05rem] before:top-0 before:h-full before:w-5 before:bg-yellow before:[clip-path:polygon(100%_0,100%_100%,0_50%)] after:absolute after:right-[-1.05rem] after:top-0 after:h-full after:w-5 after:bg-yellow after:[clip-path:polygon(0_0,100%_50%,0_100%)] sm:text-2xl">
                  75% DONATIVO · 25% PREMIOS
                </div>

                <p
                  id={descriptionId}
                  className="mt-4 max-w-[32rem] text-balance text-base font-bold leading-snug text-ink sm:text-lg"
                >
                  Dona $100 USD, llena tu quiniela de la fase final del Mundial
                  y participa por premios en{" "}
                  {joinEs(remaining.map((s) => STAGE_NAMES[s]))}. El verdadero
                  premio es ayudar: lo recaudado apoya a las familias afectadas
                  por el terremoto en Venezuela.
                </p>

                <div
                  className="pointer-events-none mt-4 flex items-end justify-center gap-1"
                  aria-hidden="true"
                >
                  <Image
                    src={character("mexicano")}
                    alt=""
                    width={300}
                    height={320}
                    loading="eager"
                    className="h-auto w-32 rotate-[-4deg] drop-shadow-[5px_7px_0_rgba(10,10,10,0.18)] sm:w-40"
                  />
                  <Image
                    src={quinielaAsset("trophy-orejona-cartoon")}
                    alt=""
                    width={500}
                    height={500}
                    loading="eager"
                    className="h-auto w-24 drop-shadow-[5px_7px_0_rgba(10,10,10,0.18)] sm:w-28"
                  />
                  <Image
                    src={character("gato")}
                    alt=""
                    width={320}
                    height={320}
                    loading="eager"
                    className="h-auto w-32 rotate-[4deg] drop-shadow-[5px_7px_0_rgba(10,10,10,0.18)] sm:w-40"
                  />
                </div>
              </div>
            </div>

            <div
              className="relative overflow-hidden bg-[#063454] px-4 pb-4 pt-10 text-cream sm:px-8 sm:pt-11 lg:px-12 lg:pt-10"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(250,247,240,0.12) 1px, transparent 0), linear-gradient(135deg, rgba(30,144,255,0.18), transparent 36%)",
                backgroundSize: "18px 18px, cover",
              }}
            >
              <div className="absolute left-0 right-0 top-0 h-5 rounded-b-[50%] bg-cream" />

              <div className="relative grid gap-5">
                <div className="grid gap-4 md:grid-cols-3">
                  {features.map((feature) => (
                    <div
                      key={feature.title}
                      className="grid grid-cols-[3rem_1fr] gap-3 text-left md:grid-cols-1 md:justify-items-start"
                    >
                      <span
                        className="cartoon-border grid h-12 w-12 place-items-center rounded-full bg-yellow text-ink shadow-[3px_3px_0_#0A0A0A]"
                        aria-hidden="true"
                      >
                        <FeatureIcon name={feature.icon} />
                      </span>
                      <span>
                        <strong className="block text-sm font-black uppercase leading-tight sm:text-base">
                          {feature.title}
                        </strong>
                        <span className="mt-2 block text-sm font-semibold leading-snug text-cream/88">
                          {feature.body}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid justify-items-center gap-3">
                  <a
                    href="/mundial/quiniela/"
                    data-testid="mundial-promo-cta"
                    onClick={goToCampaign}
                    className="btn-cartoon inline-flex min-h-12 w-full max-w-[28rem] items-center justify-center rounded-full bg-yellow px-6 text-center text-xl font-black uppercase text-ink sm:text-2xl"
                  >
                    PARTICIPAR AHORA →
                  </a>
                  <p className="text-center text-sm font-bold text-cream/90 sm:text-base">
                    Entra antes {STAGE_DEADLINE_LABELS[remaining[0] ?? "final"]}{" "}
                    para competir por{" "}
                    {remaining.length === 1
                      ? "el premio de la final"
                      : `los premios de las ${remaining.length} etapas que quedan`}
                    .
                  </p>
                </div>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FeatureIcon({ name }: { name: "heart" | "trophy" | "phone" }) {
  if (name === "heart") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
        aria-hidden="true"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    );
  }

  if (name === "trophy") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
        aria-hidden="true"
      >
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 7H4a3 3 0 0 0 3 3" />
        <path d="M17 7h3a3 3 0 0 1-3 3" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
      aria-hidden="true"
    >
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
      <path d="M10 6h4" />
    </svg>
  );
}

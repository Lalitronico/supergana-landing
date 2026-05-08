"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SITE } from "@/lib/config";

const NAV = [
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "kit", label: "Qué incluye" },
  { id: "casos", label: "Casos" },
  { id: "faq", label: "FAQ" },
];

export function Navbar() {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      {
        rootMargin: "-45% 0px -50% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    NAV.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      className="sticky top-4 z-50 mt-4 px-4 md:px-6"
    >
      <nav className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 rounded-full bg-ink py-2 pl-7 pr-2 text-cream shadow-[0_14px_40px_rgba(10,10,10,0.22)] md:pl-8">
        {/* Logo */}
        <Link href="/" className="font-display text-2xl tracking-tight md:text-3xl">
          {SITE.name}
          <motion.span
            className="inline-block text-red"
            animate={{ scale: [1, 1.35, 1] }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              repeatDelay: 2.4,
              ease: "easeInOut",
            }}
          >
            .
          </motion.span>
        </Link>

        {/* Center nav with sliding active pill */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const isActive = activeId === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="relative rounded-full px-5 py-3 text-base font-medium"
              >
                {isActive && (
                  <motion.span
                    layoutId="navbar-active-pill"
                    className="absolute inset-0 rounded-full bg-yellow"
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 32,
                    }}
                    aria-hidden
                  />
                )}
                <span
                  className={`relative z-10 transition-colors ${
                    isActive
                      ? "text-ink"
                      : "text-cream/75 hover:text-cream"
                  }`}
                >
                  {item.label}
                </span>
              </a>
            );
          })}
        </div>

        {/* Right: secondary email + divider + primary CTA */}
        <div className="flex items-center gap-2">
          <a
            href={`mailto:${SITE.contactEmail}`}
            aria-label="Contacto por email"
            className="hidden h-12 w-12 place-items-center rounded-full text-cream/75 transition-colors hover:bg-cream/10 hover:text-cream md:grid"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </a>
          <span
            aria-hidden
            className="hidden h-6 w-px bg-cream/20 md:inline-block"
          />
          <motion.button
            type="button"
            data-cal-namespace={SITE.bookingNamespace}
            data-cal-link={SITE.bookingCalLink}
            data-cal-config='{"layout":"month_view"}'
            whileHover={{ y: -2 }}
            whileTap={{ y: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="inline-flex h-12 items-center rounded-full bg-yellow px-6 text-base font-bold text-ink transition-colors hover:bg-cream"
          >
            Agendar demo
          </motion.button>
        </div>
      </nav>
    </motion.header>
  );
}

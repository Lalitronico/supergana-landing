"use client";

import { useEffect, useState, type RefObject } from "react";

/** Pixels of scroll that count as "they found out the screen goes on". */
const SCROLLED_PX = 24;
/** Less than this left below the fold is not worth a cue. */
const MIN_HIDDEN_PX = 96;
/** A screen that grows or shrinks this much is a new screen, as far as the cue goes. */
const NEW_LAYOUT_PX = 200;
/** Let the screen load before deciding it is long: no cue flashing over a spinner. */
const SETTLE_MS = 900;

/**
 * "There is more below", for people who do not think to scroll.
 *
 * Seen in a real test: after taking the receipt photo, the person never
 * scrolled, and the instructions under the fold went unread. Phones give no
 * hint that a page continues — no scrollbar until you move, and a section that
 * happens to end at the fold looks like the end of the page.
 *
 * A pill above the tab bar, only when the screen really continues and the
 * person has not scrolled yet. It goes away on the first scroll and stays away
 * on that screen; it comes back on the next screen, or when the same screen
 * turns into a different one (the capture screen becoming the reading screen,
 * which keeps the URL). Tapping it scrolls most of a screen down.
 *
 * Watches the shell's scroller (`.tk-screen`), not the window: on a phone the
 * document is locked and that element is the only thing that moves.
 */
export function ScrollCue({
  screenRef,
  label,
  pathname,
}: {
  screenRef: RefObject<HTMLElement | null>;
  label: string;
  /** Re-arms the cue on every navigation. */
  pathname: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;

    let armed = true;
    let settled = false;
    let lastHeight = el.scrollHeight;

    const update = () => {
      const below = el.scrollHeight - el.clientHeight - el.scrollTop;
      if (el.scrollTop > SCROLLED_PX) armed = false;
      setShow(settled && armed && below > MIN_HIDDEN_PX);
    };

    const onResize = () => {
      const height = el.scrollHeight;
      if (Math.abs(height - lastHeight) > NEW_LAYOUT_PX && el.scrollTop <= SCROLLED_PX) {
        armed = true;
      }
      lastHeight = height;
      update();
    };

    const timer = window.setTimeout(() => {
      settled = true;
      update();
    }, SETTLE_MS);

    el.addEventListener("scroll", update, { passive: true });
    // The content's height, not the scroller's: data arriving after the first
    // paint is what makes a screen long. A screen that swaps its root element
    // (loading → loaded) gets the new one observed too.
    const observer = new ResizeObserver(onResize);
    const observeAll = () => {
      observer.disconnect();
      observer.observe(el);
      for (const child of Array.from(el.children)) observer.observe(child);
    };
    observeAll();
    const children = new MutationObserver(() => {
      observeAll();
      onResize();
    });
    children.observe(el, { childList: true });

    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("scroll", update);
      observer.disconnect();
      children.disconnect();
      setShow(false);
    };
  }, [screenRef, pathname]);

  const nudge = () => {
    const el = screenRef.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ top: el.clientHeight * 0.7, behavior: smooth ? "smooth" : "auto" });
  };

  // A zero-height sticky anchor at the end of the scroller's content: it rides
  // the bottom edge of the visible area for as long as the content continues,
  // with no layout of its own. Inside the scroller rather than beside it, so the
  // shell needs no positioned wrapper — one would capture every page's
  // `position: absolute` modal and stop it covering the header and the tabs.
  return (
    <div className="tk-scrollcue-anchor">
      <button
        type="button"
        className="tk-scrollcue"
        data-show={show ? "true" : undefined}
        aria-hidden={show ? undefined : true}
        tabIndex={show ? 0 : -1}
        onClick={nudge}
      >
        {label}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

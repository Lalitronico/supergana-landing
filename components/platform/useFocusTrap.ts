"use client";

import { useEffect, type RefObject } from "react";

/**
 * Keyboard containment for a modal surface, generalised.
 *
 * WHY THIS EXISTS RATHER THAN REUSING WHAT IS THERE. The module already has a
 * trap, in app/p/[programa]/jornada/[semana]/SavedCelebration.tsx, and its own
 * comment says it does not generalise: it swaps focus between exactly TWO known
 * refs, which is all a celebration with one link and one button ever needs. A
 * tour has Back, Next and Skip, and its controls change per step. The landing's
 * QuinielaPromoModal has the general version — query the subtree, filter what
 * is actually visible, wrap first to last — and this is that code lifted into
 * one place so a third copy never gets written.
 *
 * NEITHER OF THOSE TWO IS REFACTORED TO USE THIS. QuinielaPromoModal is on a
 * live campaign and SavedCelebration is on a screen the client has signed off;
 * rewriting working focus management to save duplication is how a tour ships a
 * regression in something else.
 */

/**
 * `getComputedStyle` rather than `offsetParent`: a control inside a collapsed
 * details element or a `visibility: hidden` branch is in the DOM, matches the
 * selector, and cannot take focus. Tabbing to it drops the user out of the
 * dialog with no visible cursor, which is the failure mode a trap exists to
 * prevent.
 */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export const focusableIn = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
): void {
  useEffect(() => {
    if (!active) return;

    // Captured now, restored on teardown. Read before anything inside the
    // dialog takes focus or this is the dialog itself.
    const previous = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== "Tab" || !ref.current) return;

      const items = focusableIn(ref.current);
      if (items.length === 0) {
        // Nothing to land on, so park on the container rather than letting Tab
        // walk out into an app the tour has just made inert.
        event.preventDefault();
        ref.current.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const here = document.activeElement;

      // `!ref.current.contains(here)` is the case the two-node version cannot
      // express: focus is somewhere outside entirely — after a route change, or
      // after the browser reset it — and the next Tab has to come back inside
      // rather than continue from wherever it was.
      if (event.shiftKey && (here === first || !ref.current.contains(here))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (here === last || !ref.current.contains(here))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // The guard SavedCelebration has and QuinielaPromoModal does not: a tour
      // navigates between routes, so the element that had focus when it opened
      // is very often gone by the time it closes. Calling focus() on a detached
      // node is a silent no-op in most browsers and a throw in some.
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [ref, active, onEscape]);
}

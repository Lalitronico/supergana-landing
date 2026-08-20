"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  TOUR_DEFAULTS,
  fillLabel,
  nextUsable,
  stepIsUsable,
  tourRunKey,
  tourStorageKey,
  type TourDefinition,
  type TourStep,
} from "@/lib/platform/tour";
import { useFocusTrap } from "./useFocusTrap";

/**
 * The guided-tour engine. Module-agnostic on purpose: it is handed a
 * TourDefinition and two selectors, and it never learns what it is touring.
 *
 * HOW THE SPOTLIGHT IS DRAWN, AND WHY NOT THE OBVIOUS WAY.
 *
 * The obvious way is to raise the highlighted element above a scrim with
 * z-index. It does not survive this shell. The one scrolling region has
 * `overflow-y: auto`, so a raised element is still clipped by it and the ring
 * gets sliced the moment the anchor sits near the top or bottom — which, after
 * scrollIntoView, is most of the time. Raising also means writing position and
 * z-index onto elements this component does not own, and inheriting whatever
 * they already carry: a switched-off rules row would light up at `opacity:.62`.
 *
 * So nothing inside the app is ever raised. Instead a single element is
 * positioned over the hole and paints the scrim OUTWARDS from it, as a 9999px
 * box-shadow spread. The frame's own `overflow: hidden` clips that spread — see
 * the comment on `.sg-phone` in styles/module-shell.css, which is load-bearing
 * for this file. The consequence is that the stacking question simply stops
 * existing, and the same engine drops into any module whose shell is a clipped
 * frame.
 *
 * box-shadow paints and does not take pointer events, so a separate transparent
 * veil sits underneath to swallow taps. That is also what stops a player
 * tapping the spotlighted control and navigating out from under the tour.
 */

/**
 * How many times to look for a step's anchor before giving up on it.
 *
 * ATTEMPTS, NOT A DEADLINE, and driven by setTimeout rather than
 * requestAnimationFrame. Both halves of that were a bug.
 *
 * A backgrounded or unfocused tab throttles rAF to almost nothing while a
 * wall-clock deadline keeps running at full speed, so the poll would burn its
 * whole 1500ms having looked perhaps twice, decide the anchor did not exist,
 * and drop the spotlight. Every step that changed route lost its hole. It looks
 * like a race in the router and is not: it is a timer measuring one clock while
 * the work runs on another.
 *
 * Counting attempts makes the poll indifferent to how fast the browser feels
 * like running it. Throttled timers clamp to about a second, so a hidden tab
 * simply takes longer to arrive at the same answer — and nobody is looking at a
 * hidden tab. ~30 × 60ms is under two seconds when the tab is in front.
 */
const ANCHOR_ATTEMPTS = 30;
const ANCHOR_POLL_MS = 60;
/** After scrollIntoView, how long before the rect is worth reading. */
const SETTLE_MS = 320;
/** Ceiling on the wait for fonts before an auto-started tour opens. */
const FONTS_TIMEOUT_MS = 900;
/** Below this card height, the art is dropped so the copy survives. */
const ART_MIN_CARD = 260;
/** How many times to re-scroll when the router undoes it. */
const SCROLL_TRIES = 3;
/** An anchor taller than this share of the scroller is pinned to the top
    rather than centred, so the card gets one big gap instead of two small. */
const TALL_ANCHOR_RATIO = 0.45;

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * No store to subscribe to: the value only changes as a result of this
 * component writing it, and this component already re-renders when it does.
 * Same shape the staff panel's venue memory uses.
 */
const NO_SUBSCRIPTION = () => () => {};

const anchorEl = (anchor: string | null): HTMLElement | null =>
  anchor ? document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`) : null;

/** Is the anchor actually inside the scroller's visible band right now? */
const inView = (el: HTMLElement, scroller: HTMLElement): boolean => {
  const a = el.getBoundingClientRect();
  const s = scroller.getBoundingClientRect();
  return a.bottom > s.top && a.top < s.bottom;
};

interface Hole {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
}

/**
 * WHY THERE IS NO REACT CONTEXT IN THIS FILE.
 *
 * There was one, and a replay control read it. That is the obvious design and it
 * does not work across the boundary these controls live on.
 *
 * The pages that host a replay button are server components. Their output is
 * slotted into TourHost as `children`, which normally means context flows. It
 * did not: on the client the button rendered no React fiber at all, because
 * `useTour()` returned null there and the component returned null, leaving the
 * server-rendered <button> orphaned in the DOM as unclickable HTML. The context
 * module ends up instantiated once per client entry point — the layout's and
 * the page's — so `createContext` runs twice and the page's copy is a different
 * object that no provider ever filled. It renders on the server, where there is
 * one module registry, and dies on the client, where there are two.
 *
 * `window` is the one registry both copies certainly share. The host publishes
 * itself under `{module}:{scope}` while it is mounted; a control looks itself up
 * after mount and renders nothing until it finds a host. That also means the
 * button never appears in server HTML, so there is no orphan to click and no
 * hydration difference to reconcile.
 */
const REGISTRY = "__sgTourHosts";
const HOSTS_CHANGED = "sg:tour:hosts";

interface HostEntry {
  start: (fromStepId?: string) => void;
  replayLabel: string;
}

const hostRegistry = (): Record<string, HostEntry> => {
  const w = window as unknown as Record<string, unknown>;
  if (!w[REGISTRY]) w[REGISTRY] = {};
  return w[REGISTRY] as Record<string, HostEntry>;
};

export function TourHost({
  definition,
  children,
  /** The element the overlay is positioned inside. Must be `position: relative`
      AND `overflow: hidden` — the second is what clips the scrim. */
  frameSelector = ".sg-phone",
  /** The one scrolling region. Anchors inside it get scrolled into view and the
      hole gets clamped to its edges. */
  scrollSelector = ".sg-screen",
  /** The module resolves its own art. The platform never imports a cast. */
  renderArt,
  /** The module resolves its own interactive demos, by the same trick. */
  renderSlot,
  /** Paths under which the tour never runs — a staff console, typically. */
  mutedPrefixes = [],
  autoStart = true,
}: {
  definition: TourDefinition;
  children: ReactNode;
  frameSelector?: string;
  scrollSelector?: string;
  renderArt?: (key: string, size: number) => ReactNode;
  renderSlot?: (key: string) => ReactNode;
  mutedPrefixes?: string[];
  autoStart?: boolean;
}) {
  const steps = definition.steps;
  const total = steps.length;
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [, startTransition] = useTransition();

  const [index, setIndex] = useState<number | null>(null);
  const [hole, setHole] = useState<Hole | null>(null);
  const [ready, setReady] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  /** Which way the player was travelling, so a skipped step does not bounce
      them back the way they came. */
  const dirRef = useRef<1 | -1>(1);

  const storageKey = tourStorageKey(definition);
  const runKey = tourRunKey(definition);
  const muted = mutedPrefixes.some((p) => pathname.startsWith(p));

  /**
   * The server's answer is "already seen", and that is the whole point: it
   * guarantees nothing renders in the server HTML, so a returning player never
   * gets a flash of dimmed screen while hydrating. A browser with storage
   * disabled gets the same answer, which is the right failure — no tour beats a
   * tour on every single load.
   */
  const seen = useSyncExternalStore(
    NO_SUBSCRIPTION,
    () => {
      try {
        return window.localStorage.getItem(storageKey) === "done";
      } catch {
        return true;
      }
    },
    () => true,
  );

  const running = index !== null && !muted;
  const step: TourStep | null = index === null ? null : (steps[index] ?? null);

  /** Whether a step can be shown from where we stand right now. A step that
      lives on another route is always "usable": we cannot know until we get
      there, and the anchor poll is what decides it once we do. */
  const canUse = useCallback(
    (s: TourStep) => {
      if (s.anchor === null) return true;
      if (s.href && s.href !== pathname) return true;
      return stepIsUsable(s, anchorEl(s.anchor) !== null);
    },
    [pathname],
  );

  const finish = useCallback(() => {
    setIndex(null);
    setHole(null);
    setReady(false);
    try {
      window.localStorage.setItem(storageKey, "done");
      window.sessionStorage.removeItem(runKey);
    } catch {
      // Private mode. The tour ran; it will run again next time, which is a
      // smaller problem than throwing on the way out.
    }
  }, [storageKey, runKey]);

  /**
   * Move, or end.
   *
   * `nextUsable` returning null means the tour is over in that direction, and
   * that decision is taken HERE rather than by letting the index run off the
   * end and cleaning up in an effect. An effect that calls setState during
   * commit is a cascading render, and React 19's lint rule is right to refuse
   * it — the honest shape is one function that either advances or finishes.
   */
  const go = useCallback(
    (dir: 1 | -1) => {
      if (index === null) return;
      dirRef.current = dir;
      const next = nextUsable(steps, index, dir, canUse);
      if (next === null) {
        finish();
        return;
      }
      setReady(false);
      setIndex(next);
    },
    [index, steps, canUse, finish],
  );

  const start = useCallback(
    (fromStepId?: string) => {
      if (total === 0) return;
      const at = fromStepId ? steps.findIndex((s) => s.id === fromStepId) : -1;
      dirRef.current = 1;
      setReady(false);
      setIndex(at >= 0 ? at : 0);
    },
    [steps, total],
  );

  // ---- auto-start ---------------------------------------------------------
  //
  // Waits for the display font, not for a flat delay: the font is the thing
  // that would move the rect out from under a freshly measured hole, and a QR
  // landing should not stall a second and a bit for a timer that was guessing.
  useEffect(() => {
    if (!autoStart || seen || muted || total === 0 || index !== null) return;
    let cancelled = false;
    let timer = 0;

    const open = () => {
      if (cancelled) return;
      // A tick, not a frame: same reason as the anchor poll. A tab that is not
      // in front does not paint, and a tour that waits for a frame that never
      // comes never opens.
      timer = window.setTimeout(() => {
        if (cancelled) return;
        let resume: string | null = null;
        try {
          resume = window.sessionStorage.getItem(runKey);
        } catch {
          resume = null;
        }
        start(resume ?? undefined);
      });
    };

    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      const ceiling = window.setTimeout(open, FONTS_TIMEOUT_MS);
      fonts.ready.then(() => {
        window.clearTimeout(ceiling);
        open();
      });
    } else {
      open();
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // `start` is stable per definition; `index` is read to avoid re-opening a
    // tour the player is already in.
  }, [autoStart, seen, muted, total, index, runKey, start]);

  // ---- remember where we are, for a mid-tour reload ------------------------
  useEffect(() => {
    if (!running || !step) return;
    try {
      window.sessionStorage.setItem(runKey, step.id);
    } catch {
      // Nothing to resume from. The tour still works forwards.
    }
  }, [running, step, runKey]);

  // ---- measurement --------------------------------------------------------
  const measure = useCallback(() => {
    const current = index === null ? null : steps[index];
    if (!current?.anchor) {
      setHole(null);
      return;
    }
    const frame = document.querySelector<HTMLElement>(frameSelector);
    const el = anchorEl(current.anchor);
    if (!frame || !el) {
      setHole(null);
      return;
    }

    const box = frame.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const pad = current.pad ?? TOUR_DEFAULTS.pad;

    // Against the frame's PADDING box: clientLeft/clientTop are the border
    // widths, which are 3px on desktop and 0 below 860px where the frame loses
    // its border. Reading them costs one property and removes the branch.
    const left = r.left - box.left - frame.clientLeft - pad;
    const width = r.width + pad * 2;
    let top = r.top - box.top - frame.clientTop - pad;
    let height = r.height + pad * 2;

    // An anchor half-scrolled out of the screen would otherwise open a hole
    // over the header, which reads as a rendering bug rather than as a tour.
    const scroller = document.querySelector<HTMLElement>(scrollSelector);
    if (scroller && scroller.contains(el)) {
      const s = scroller.getBoundingClientRect();
      const sTop = s.top - box.top - frame.clientTop;
      const sBottom = sTop + s.height;
      const bottom = Math.min(top + height, sBottom);
      top = Math.max(top, sTop);
      height = Math.max(0, bottom - top);
    }

    setHole({
      left,
      top,
      width,
      height,
      radius: current.radius ?? TOUR_DEFAULTS.radius,
    });
  }, [index, steps, frameSelector, scrollSelector]);

  // ---- navigate to the step's route, then wait for its anchor -------------
  useEffect(() => {
    if (!running || !step) return;

    if (step.href && pathname !== step.href) {
      startTransition(() => router.push(step.href as string));
      return;
    }

    // The URL — and therefore usePathname() — updates while loading.tsx is
    // still on screen, so being "on the right route" does not mean the anchor
    // exists yet. Polling rather than assuming is what stops every cross-route
    // step from silently skipping itself.
    let cancelled = false;
    let poll = 0;
    let settle = 0;
    let attempts = 0;
    const reduced = prefersReducedMotion();

    const tick = () => {
      if (cancelled) return;
      attempts += 1;

      if (!step.anchor) {
        setHole(null);
        setReady(true);
        return;
      }

      const el = anchorEl(step.anchor);
      if (el) {
        const scroller = document.querySelector<HTMLElement>(scrollSelector);

        /**
         * Bring it into view, measure, and CHECK THAT IT STUCK.
         *
         * The check is the part that matters. On a step that changes route, the
         * router restores the scroll position when the navigation completes,
         * which is often after this scroll and after the first measurement — so
         * the anchor gets scrolled into view and then quietly scrolled back
         * out. The symptom is a hole clamped to zero height at the edge of the
         * screen: the tour pointing confidently at a strip of nothing, several
         * hundred pixels from the button it is describing.
         *
         * Re-measuring cannot fix that, and an earlier version tried: measuring
         * twice just reads the same wrong rect twice. What has to be repeated is
         * the SCROLL.
         */
        const bring = (tries: number) => {
          if (cancelled) return;
          if (scroller?.contains(el)) {
            // Centring is right for a small anchor and wrong for a big one. The
            // prizes list is 292px of a 547px screen: centred, it leaves about
            // 220px above and 110px below, and a card needs more than either —
            // so the copy ends up behind a scrollbar no matter which side it
            // picks. Pinning a tall anchor to the top instead hands the whole
            // lower half to the card, which is the only place it fits.
            const tall =
              el.getBoundingClientRect().height > scroller.clientHeight * TALL_ANCHOR_RATIO;
            el.scrollIntoView({
              block: tall ? "start" : "center",
              // The retries are deliberately instant. A smooth scroll that is
              // about to be undone and redone reads as the page fighting itself.
              behavior: reduced || tries < SCROLL_TRIES ? "auto" : "smooth",
            });
          }
          settle = window.setTimeout(
            () => {
              if (cancelled) return;
              measure();
              setReady(true);
              if (tries > 0 && scroller?.contains(el) && !inView(el, scroller)) {
                bring(tries - 1);
              }
            },
            reduced ? 0 : SETTLE_MS,
          );
        };

        bring(SCROLL_TRIES);
        return;
      }

      if (attempts >= ANCHOR_ATTEMPTS) {
        if (step.optional === false) {
          // Declared as guaranteed and it is not there. Show the step centred
          // so the copy is not lost, and make the breakage visible in dev.
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[tour] anchor "${step.anchor}" not found for step "${step.id}"`);
          }
          setHole(null);
          setReady(true);
        } else {
          go(dirRef.current);
        }
        return;
      }

      poll = window.setTimeout(tick, ANCHOR_POLL_MS);
    };

    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(poll);
      window.clearTimeout(settle);
    };
  }, [running, step, pathname, router, scrollSelector, measure, go]);

  // ---- measure on every step, then keep the hole on the anchor ------------
  //
  // TWO BUGS LIVED HERE. The first: this was gated on `hole` already existing,
  // so the observers never attached for the first anchor of a run — the hole
  // could not follow anything until something else had already measured it.
  //
  // The second is why it is measured HERE and not only in the anchor poll. The
  // poll schedules its measurement behind a settle timer, which exists to let
  // a smooth scroll finish. A step whose anchor needs no scrolling — the rules
  // pill lives in the header, which never moves — has nothing to wait for, and
  // in practice its timer did not survive to fire: the hole stayed on the
  // PREVIOUS step's anchor, pointing confidently at the wrong thing. Measuring
  // once per step here makes the poll's timer an improvement on a correct
  // result rather than the only thing standing between the tour and a lie.
  useEffect(() => {
    if (!running) return;

    const onChange = () => measure();
    onChange();
    const frame = document.querySelector<HTMLElement>(frameSelector);
    const scroller = document.querySelector<HTMLElement>(scrollSelector);

    // Images in this module are unoptimised and served from /public, so one of
    // them landing above the anchor reflows the page after the first measure.
    // Measuring once is the bug; observing is the fix.
    const ro = new ResizeObserver(onChange);
    if (frame) ro.observe(frame);
    if (scroller?.firstElementChild) ro.observe(scroller.firstElementChild);

    scroller?.addEventListener("scroll", onChange, { passive: true });
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      ro.disconnect();
      scroller?.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
    // `pathname` IS a dependency, and leaving it out was a bug with a visible
    // symptom: on a step that changes route, this effect re-ran when `measure`
    // changed — which happens when the step index changes, BEFORE the
    // navigation lands — so the scroll listener attached to the OLD route's
    // `.sg-screen`. The new route renders a different element, nothing was
    // listening to it, and when the router settled the scroll afterwards the
    // hole stayed where it had been measured. On the last step that put the
    // ring on an empty strip below the button it was supposed to be pointing at.
    //
    // `hole` is still deliberately NOT a dependency: depending on the thing
    // this effect produces is the loop that made it a gate in the first place.
  }, [running, measure, pathname, frameSelector, scrollSelector]);

  // ---- what makes the app underneath unavailable --------------------------
  //
  // THREE THINGS, AND NONE OF THEM TOUCHES THE DOM.
  //
  //   1. `.sg-tour-veil` swallows pointer events, so nothing under the scrim
  //      can be tapped — including the spotlighted control itself.
  //   2. `useFocusTrap` keeps Tab inside the card.
  //   3. `role="dialog"` + `aria-modal="true"` on the card is what tells a
  //      screen reader the rest of the frame is not part of the conversation.
  //
  // An earlier version also set `inert` on the frame's other children, which
  // is the modern one-attribute version of all three. It had to go: those nodes
  // belong to React — `.sg-screen` is rendered by the page — and writing an
  // attribute onto them made React report a hydration mismatch on the next
  // navigation ("some attributes of the server rendered HTML didn't match").
  // Mutating DOM another renderer owns is a bug even when it works, and here it
  // did not. `aria-modal` is the mechanism that exists for exactly this, it is
  // what SavedCelebration and QuinielaPromoModal both already use, and it costs
  // nothing to be consistent with them.

  useFocusTrap(cardRef, running, finish);

  // The dialog never unmounts between steps, so nothing is re-announced on its
  // own. Moving focus back to the card, plus the live region below, is what
  // makes a step change an event a screen reader reports.
  useEffect(() => {
    if (!running || !ready) return;
    cardRef.current?.focus();
  }, [running, ready, index]);

  // Published for replay controls that live outside this client subtree.
  useEffect(() => {
    const reg = hostRegistry();
    const key = `${definition.id}:${definition.scope}`;
    reg[key] = { start, replayLabel: definition.labels.replay };
    window.dispatchEvent(new Event(HOSTS_CHANGED));
    return () => {
      delete reg[key];
      window.dispatchEvent(new Event(HOSTS_CHANGED));
    };
  }, [definition, start]);

  /**
   * Where the card parks, and how tall it is allowed to be there.
   *
   * The obvious rule — "put it on the half the hole is not on" — is wrong, and
   * wrong in a way that only shows up on a tall anchor. The portada's countdown
   * is 181px in a 677px frame, which leaves ~215px of clear space on EITHER
   * side; a card of 260px then overlaps the very thing it is pointing at, no
   * matter which half it picks. Comparing halves answers the wrong question.
   *
   * So measure the two gaps, take the roomier one, and cap the card to it. The
   * body scrolls when the copy does not fit, which is what it was given
   * `overflow-y: auto` for — a step whose card covers its own spotlight is a
   * broken step, and a step whose text scrolls is merely a long one.
   */
  const layout = useMemo(() => {
    if (!hole || hole.height <= 0) {
      return { cls: "centred", maxHeight: undefined as number | undefined };
    }
    const frame = document.querySelector<HTMLElement>(frameSelector);
    const frameH = frame?.clientHeight ?? 0;
    const GAP = 14; // the card's own inset from the frame, plus air off the hole

    const above = hole.top - GAP * 2;
    const below = frameH - (hole.top + hole.height) - GAP * 2;

    const explicit = step?.placement ?? TOUR_DEFAULTS.placement;
    const atTop =
      explicit === "top" ? true : explicit === "bottom" ? false : above >= below;

    return {
      cls: atTop ? "at-top" : "at-bottom",
      // A floor, so a hole that nearly fills the frame still leaves something
      // readable rather than collapsing the card to its border.
      maxHeight: Math.max(150, atTop ? above : below),
    };
  }, [hole, step, frameSelector]);

  // Computed once, and only while the tour is open — `canUse` reads the DOM,
  // which does not exist on the server. The overlay's ternary already guards
  // that, but naming these here keeps three identical walks out of the JSX.
  const hasPrev = running && index !== null && nextUsable(steps, index, -1, canUse) !== null;
  const hasNext = running && index !== null && nextUsable(steps, index, 1, canUse) !== null;

  const overlay =
    running && step ? (
      <div className="sg-tour">
        <div className="sg-tour-veil" aria-hidden="true" />
        {hole && hole.height > 0 ? (
          <div
            className="sg-tour-spot"
            aria-hidden="true"
            style={{
              left: hole.left,
              top: hole.top,
              width: hole.width,
              height: hole.height,
              borderRadius: hole.radius,
            }}
          />
        ) : (
          <div className="sg-tour-spot is-full" aria-hidden="true" />
        )}

        <div
          className={`sg-tour-card ${layout.cls}`}
          style={layout.maxHeight ? { maxHeight: layout.maxHeight } : undefined}
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-label={definition.labels.title}
          aria-describedby="sg-tour-body"
          tabIndex={-1}
        >
          <div className="sg-tour-live" aria-live="polite" aria-atomic="true">
            {ready
              ? `${step.title}. ${fillLabel(definition.labels.progress, {
                  n: (index ?? 0) + 1,
                  total,
                })}.`
              : ""}
          </div>

          <div className="sg-tour-row">
            <div>
              <span className="sg-eyebrow" aria-hidden="true">
                {fillLabel(definition.labels.progress, { n: (index ?? 0) + 1, total })}
              </span>
              <h2 className="sg-h sg-tour-title">{step.title}</h2>
            </div>
            {/* The art is the first thing to go when the card is tight.
                A step beside a tall anchor — the prizes list is 292px of a
                677px frame — gets a card barely deeper than its own buttons,
                and a character there costs the body every line it has. Deciding
                by the measured cap rather than per step means no definition has
                to know how tall its anchor happens to render today. */}
            {step.art && renderArt && (layout.maxHeight ?? Infinity) >= ART_MIN_CARD ? (
              <span className="sg-tour-art">
                {renderArt(step.art, step.artSize ?? TOUR_DEFAULTS.artSize)}
              </span>
            ) : null}
          </div>

          <div className="sg-tour-body" id="sg-tour-body" key={step.id}>
            {step.body.map((p) => (
              <p className="sg-body" key={p}>
                {p}
              </p>
            ))}
            {step.slot && renderSlot ? renderSlot(step.slot) : null}
          </div>

          <div className="sg-tour-cta">
            <button
              type="button"
              className="sg-btn ghost sm"
              onClick={() => go(-1)}
              disabled={!hasPrev}
            >
              {definition.labels.back}
            </button>
            {/* `go(1)` finishes by itself when there is nothing left, so the
                last step's button needs a different LABEL, not a different
                handler. */}
            <button type="button" className="sg-btn" onClick={() => go(1)}>
              {hasNext ? definition.labels.next : definition.labels.done}
            </button>
            {/* In the same row as the buttons, not under them. A row of its own
                costs ~35px of card height, and the card's height is capped to
                the gap beside the spotlight — those 35px come straight out of
                the copy, which is the one thing on here that has to be read. */}
            <button type="button" className="sg-tour-skip" onClick={finish}>
              {definition.labels.skip}
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      {children}
      {overlay}
    </>
  );
}

/**
 * The replay control, for screens that are not inside the host's client subtree
 * — which is every page, since pages are server components. See REGISTRY above
 * for why this cannot be a context read.
 *
 * Renders nothing until it finds its host, so a screen can drop it in without
 * knowing whether its module has a tour at all, and nothing appears on a
 * deployment where the tour was removed.
 */
export function TourReplay({
  /** The module's tour id — "pickem". Must match the definition's. */
  tourId,
  /** The tenant instance: the campaign slug. */
  scope,
  className = "sg-btn ghost sm",
  label,
}: {
  tourId: string;
  scope: string;
  className?: string;
  label?: string;
}) {
  const [host, setHost] = useState<HostEntry | null>(null);

  useEffect(() => {
    const key = `${tourId}:${scope}`;
    const read = () => setHost(hostRegistry()[key] ?? null);
    read();
    window.addEventListener(HOSTS_CHANGED, read);
    return () => window.removeEventListener(HOSTS_CHANGED, read);
  }, [tourId, scope]);

  if (!host) return null;
  return (
    <button type="button" className={className} onClick={() => host.start()}>
      {label ?? host.replayLabel}
    </button>
  );
}

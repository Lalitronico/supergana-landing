/**
 * A guided tour, described as data.
 *
 * PLATFORM, not pick'em. Like phone.ts beside it, this is the part that outlives
 * the module that needed it first: a tour is "point at a thing, say a sentence,
 * move on", and nothing about that is specific to a football pool. The pick'em
 * builds its own definition in app/p/[programa]/tour.ts; the tickets module can
 * build its own the day it wants one, and neither has to fork the engine.
 *
 * NO REACT AND NO DOM IN THIS FILE, on purpose and for two reasons. It keeps
 * the rules of "which step comes next" testable with `node --test` and no
 * framework — the same trade phone.ts makes and phone.test.ts collects. And it
 * keeps the type declarations importable from a server component, which is
 * where the definition is built.
 *
 * WHY THE STEPS ARE DATA AND NOT JSX.
 *
 * The rules screen (app/p/[programa]/reglas/page.tsx) states the doctrine this
 * file exists to obey: every number on a player-facing screen is read from the
 * programme, because writing "10 puntos por acierto" as prose is a second copy
 * of the rules, and the first time a tenant reconfigures their programme the
 * published copy starts lying about how it scores.
 *
 * A tour written as JSX would be exactly that second copy. So the definition is
 * built on the SERVER from the programme row and handed to a client component
 * as a prop — which means every field here has to be JSON-serialisable. No
 * ReactNode, no functions, no Date. That constraint is the feature: React
 * enforces at runtime what would otherwise be a convention nobody remembers.
 * Art and interactive demos cross the boundary as string KEYS, resolved by the
 * module's own binder on the client (see `art` and `slot` below).
 */

/**
 * Where the card sits IN THE FRAME — not relative to the anchor.
 *
 * There is no floating-tooltip positioning here and there should not be: the
 * phone frame is 400px wide with `overflow: hidden`, so anything that tries to
 * float beside a target gets clipped. The card spans the frame's width and
 * parks on the half the spotlight is not on, which is all the placement a
 * 400px column can meaningfully express.
 */
export type TourPlacement = "top" | "bottom" | "auto";

export interface TourStep {
  /**
   * Stable forever. The resume key, the progress dots and any future analytics
   * hang off this — renumbering it silently resumes somebody in the wrong
   * place, which is worse than resetting them.
   */
  id: string;
  /**
   * The `[data-tour="…"]` value to spotlight. Null renders a centred card with
   * no hole, which is the right shape for an opening and a closing step.
   */
  anchor: string | null;
  /**
   * Where this step is shown. Full path, WITH the trailing slash — next.config
   * sets `trailingSlash: true`, so a path without it costs a 308 on every push.
   * Null means "wherever the player already is", for anchors the shell renders
   * on every screen.
   */
  href: string | null;
  title: string;
  /** Paragraphs. Strings, because the definition crosses the RSC boundary. */
  body: string[];
  /**
   * Art key, resolved by the module's binder. The platform layer never learns
   * what a "dino-picks" is, which is what keeps it a platform layer.
   */
  art?: string | null;
  artSize?: number;
  /**
   * Interactive demo key, resolved the same way. Exists because the pick'em's
   * play screen sits behind a verification gate: a stranger cannot be walked to
   * it, so the gesture has to be shown inside the card instead.
   */
  slot?: string | null;
  placement?: TourPlacement;
  /**
   * A missing anchor skips the step instead of stalling the tour. Default true.
   * Set false only for anchors the shell guarantees, where absence is a bug
   * worth seeing rather than a screen that happens to be empty today.
   */
  optional?: boolean;
  /** px of breathing room around the hole. */
  pad?: number;
  /** px, to match the anchor's own corner. Default is --sg-radius. */
  radius?: number;
}

export interface TourLabels {
  /** Names the dialog for a screen reader. */
  title: string;
  next: string;
  back: string;
  skip: string;
  done: string;
  /** "Paso {n} de {total}" — the `{key}` placeholder convention lib/tickets/i18n.ts uses. */
  progress: string;
  replay: string;
}

export interface TourDefinition {
  /** The module: "pickem", later "tickets". */
  id: string;
  /** The tenant's instance of it: the campaign slug. */
  scope: string;
  /**
   * Bump to show the tour again to everyone who already finished it. The
   * storage key carries it, so an old key is simply never read again — no
   * migration, no cleanup, and a player who is mid-tour when it changes starts
   * the new one from the beginning rather than resuming into a renumbered step.
   */
  version: number;
  steps: TourStep[];
  labels: TourLabels;
}

/** Defaults live here rather than in the component, so the pure `nextUsable`
    and the renderer cannot disagree about what an unset field means. */
export const TOUR_DEFAULTS = {
  placement: "auto" as TourPlacement,
  optional: true,
  pad: 6,
  radius: 14,
  artSize: 96,
} as const;

/**
 * `sg:tour:pickem:chapa-pickem-2026:v1`.
 *
 * The `sg:` prefix follows `sg:pickem:panel:venue:{slug}` (panel/DeskView.tsx);
 * the versioned suffix follows `supergana:promo-modal:{slug}:v1` (the landing's
 * QuinielaPromoModal). Two conventions already existed and this picks the
 * shorter prefix with the longer discipline.
 */
export const tourStorageKey = (
  d: Pick<TourDefinition, "id" | "scope" | "version">,
): string => `sg:tour:${d.id}:${d.scope}:v${d.version}`;

/**
 * Where a tour IN PROGRESS remembers itself. sessionStorage, not local: a tour
 * halfway through is a property of this tab, not of this person. It survives
 * the reload a bad restaurant wifi produces and dies with the tab, which is
 * exactly the lifetime wanted.
 */
export const tourRunKey = (d: Pick<TourDefinition, "id" | "scope">): string =>
  `sg:tour-run:${d.id}:${d.scope}`;

/** "Paso {n} de {total}" + `{n: 3, total: 7}` → "Paso 3 de 7". */
export const fillLabel = (
  template: string,
  values: Record<string, string | number>,
): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );

/**
 * The next step index in `dir` whose anchor `canUse` accepts, or null when the
 * tour is over in that direction.
 *
 * THIS IS THE WHOLE REASON THIS FILE HAS NO REACT IN IT. Skipping absent
 * anchors is the part of a tour that goes quietly wrong: skip forward without
 * remembering the direction and Back bounces the player forward again, past
 * the step they were trying to reach, forever. It is four lines and it is worth
 * testing, so it lives where a test can reach it.
 *
 * `canUse` is injected rather than assumed, because "is this anchor present"
 * is a DOM question and this module does not have a DOM.
 */
export const nextUsable = (
  steps: TourStep[],
  from: number,
  dir: 1 | -1,
  canUse: (step: TourStep, index: number) => boolean,
): number | null => {
  for (let i = from + dir; i >= 0 && i < steps.length; i += dir) {
    if (canUse(steps[i], i)) return i;
  }
  return null;
};

/**
 * Whether a step can render at all given what the DOM currently holds.
 *
 * A step with no anchor always can — it is a centred card and needs nothing.
 * A step whose anchor is present always can. A step whose anchor is missing can
 * only if it is NOT optional, in which case it renders as a centred card and
 * the absence shows up as a warning rather than as a silently shorter tour.
 */
export const stepIsUsable = (step: TourStep, anchorPresent: boolean): boolean =>
  step.anchor === null || anchorPresent || step.optional === false;

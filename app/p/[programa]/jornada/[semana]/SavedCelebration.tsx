"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ChapaCharacter } from "../../ChapaCharacter";

/**
 * What happens after "Enviar mis picks".
 *
 * Before this, the only signal was the button's own label changing to "Picks
 * guardados ✓" — at the bottom of the screen, in a dock the player had usually
 * scrolled past. Eduardo submitted sixteen picks on his iPhone and did not know
 * whether anything had happened, then did not know what to do next. Both are
 * the same omission: the moment the product is *for* had no moment.
 *
 * So it gets one. Three things, in this order, because that is the order the
 * questions arrive in:
 *   1. It worked — the count, and the character reacting to it.
 *   2. What it earned — the early bonus, when it was earned.
 *   3. What happens now — when results land, and that picks stay editable.
 *
 * WHY `early` IS A PROP AND NOT RECOMPUTED HERE.
 *
 * `qualifiesEarly` compares the clock to the lock time, and the board calls
 * `router.refresh()` right after saving. Recomputing on render means a sheet
 * sent four seconds before the early window closed could announce the bonus,
 * re-render, and take it back. The value is captured at the instant the POST
 * succeeded and never looked at again — the same instant the server stamps
 * `submitted_at`, which is what actually decides the bonus.
 *
 * WHY THE OVERLAY IS ABSOLUTE AND NOT FIXED.
 *
 * On desktop this module is a 400px phone drawn in the middle of a page. A
 * fixed overlay would dim the entire browser window to announce something that
 * happened inside a card. `.sg-phone` is already `position: relative`
 * (module-shell.css), so `inset: 0` lands on the frame.
 */
export function SavedCelebration({
  slug,
  week,
  /** How many playable matches were sent. Both halves of "16/16". */
  count,
  total,
  /** Captured at the moment the save succeeded. See above. */
  early,
  earlyPoints,
  charDir,
  onClose,
}: {
  slug: string;
  week: number;
  count: number;
  total: number;
  early: boolean;
  earlyPoints: number;
  charDir: string | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const rankRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Whatever had focus was the save button, which is about to disappear with
    // the bar. Remembering it anyway: if the bar survives (a later edit), focus
    // goes back where the player left it instead of at the top of the document.
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    // Two controls, so the trap is a swap rather than a list walk. Anything
    // more general here would be a focus-trap library's job, and this dialog is
    // never going to grow a form.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = [rankRef.current, closeRef.current].filter(
        (el): el is HTMLAnchorElement | HTMLButtonElement => el !== null,
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      // Anything outside the pair — the page behind the scrim, say — is treated
      // as "at the edge", so a stray Tab pulls focus back into the dialog
      // rather than out of it.
      const inside = focusables.some((el) => el === active);
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [onClose]);

  return (
    <div
      className="pk-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pk-celebration-title"
    >
      {/* The scrim is not a button. A tap on it closes, which is what everybody
          expects, but it carries no role of its own: the dialog already has two
          labelled ways out and an invisible third one in the a11y tree would be
          a control nobody can name. */}
      <div className="pk-modal-scrim" onClick={onClose} aria-hidden="true" />

      <div className="pk-modal-card">
        <div className="pk-modal-art">
          <ChapaCharacter dir={charDir} name="dino-picks" size={128} />
        </div>

        <span className="pk-tag">Jornada {week}</span>

        <h2 id="pk-celebration-title" className="sg-display" style={{ marginTop: 9 }}>
          ¡Quedaron
          <br />
          guardados!
        </h2>

        <p className="sg-body" style={{ margin: "8px 0 0" }}>
          {count} de {total} picks enviados. Ya estás en la jornada {week}.
        </p>

        {early ? (
          <div className="pk-ticket pk-mech is-on" style={{ marginTop: 12 }}>
            <span className="pk-mech-disc" aria-hidden="true">
              ⏱
            </span>
            <div className="pk-mech-text">
              <div className="pk-mech-name">Madrugador</div>
              <div className="pk-mech-sub">Enviaste con tiempo de sobra</div>
            </div>
            <div className="pk-perf" />
            <div className="pk-mech-val">+{earlyPoints}</div>
          </div>
        ) : null}

        <ul className="pk-next">
          <li>Los resultados llegan el martes, cuando cierra la jornada.</li>
          <li>Puedes cambiar tus picks hasta el primer kickoff.</li>
        </ul>

        <div className="pk-modal-cta">
          <Link
            ref={rankRef}
            className="sg-btn"
            href={`/p/${slug}/ranking/`}
            onClick={onClose}
          >
            Ver el ranking
          </Link>
          <button ref={closeRef} type="button" className="sg-btn ghost sm" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

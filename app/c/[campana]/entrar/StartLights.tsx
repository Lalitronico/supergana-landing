"use client";

import { useId, type CSSProperties, type RefObject } from "react";

/**
 * "Prende las 4 luces": a starting-light gantry that draws the code as it is typed.
 * Styles live in ./start-lights.css (prefix `wa-lights-`).
 *
 * ONE real input, never four. Four inputs break the things that matter most on
 * a phone: iOS/Android one-time-code autofill, pasting "1234" from WhatsApp's
 * copy button, and screen readers. The lights are a drawing of this input.
 */
export type LightsStatus = "idle" | "error" | "go";

export interface StartLightsProps {
  /** Digits only, 0–4 of them. */
  value: string;
  /** Called with digits only (the caller already strips non-digits too). */
  onChange: (digits: string) => void;
  /** Field label ("Código"), kept for screen readers even if drawn small. */
  label: string;
  /** idle: typing · error: last attempt was wrong · go: accepted, leaving. */
  status: LightsStatus;
  /** Shown when status is "go" ("¡Arranca!"). */
  goLabel: string;
  disabled?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}

const LIGHT_COUNT = 4;

export function StartLights({ value, onChange, label, status, goLabel, disabled, inputRef }: StartLightsProps) {
  const inputId = useId();
  // Drawn state depends only on `value`: the input is append-only, so caret quirks never matter.
  const nextIndex = Math.min(value.length, LIGHT_COUNT - 1);

  return (
    <div className="wa-lights" data-status={status}>
      <label className="wa-lights-label" htmlFor={inputId}>
        {label}
      </label>

      <div className="wa-lights-gantry">
        <span className="wa-lights-post wa-lights-post-l" aria-hidden="true" />
        <span className="wa-lights-post wa-lights-post-r" aria-hidden="true" />
        <div className="wa-lights-housing">
          <span className="wa-lights-strip sg-checker" aria-hidden="true" />
          <div className="wa-lights-row" aria-hidden="true">
            {Array.from({ length: LIGHT_COUNT }, (_, index) => {
              const digit = value[index];
              const lit = status === "go" || digit !== undefined;
              return (
                <span
                  key={index}
                  className="wa-lights-bay"
                  data-lit={lit || undefined}
                  data-next={(index === nextIndex && status !== "go") || undefined}
                  style={{ "--wa-i": index } as CSSProperties}
                >
                  <span className="wa-lights-lens">
                    <span className="wa-lights-digit">{digit ?? ""}</span>
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        {/* The one real input sits on top of the drawing so any tap focuses it. */}
        <input
          id={inputId}
          ref={inputRef}
          className="wa-lights-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          // Not 4: the browser cuts BEFORE onChange strips separators, so a
          // pasted "2 1 9 5" or "21-95" would lose digits. The slice below is
          // what actually holds the code to four.
          maxLength={12}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, LIGHT_COUNT))}
          aria-invalid={status === "error" || undefined}
          disabled={disabled}
          required
        />
      </div>

      <div className="wa-lights-go" role="status" aria-live="polite">
        {status === "go" && (
          <span className="wa-lights-flag">
            <span className="wa-lights-flag-check sg-checker" aria-hidden="true" />
            {goLabel}
          </span>
        )}
      </div>
    </div>
  );
}

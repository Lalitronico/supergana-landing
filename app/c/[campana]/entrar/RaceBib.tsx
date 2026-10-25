"use client";

import { useId } from "react";

/**
 * The phone field, drawn as a racing bib (dorsal).
 *
 * Why a bib: in this app the phone number IS the account, the way the bib is
 * the runner. The real <input> stays a real, visible, focusable input with the
 * attributes that make the phone's keyboard, autofill and "send" key work; the
 * bib is only dressing around it. Styles live in ./race-bib.css (`wa-bib-`).
 */
export interface RaceBibProps {
  value: string;
  onChange: (value: string) => void;
  /** formatMxPhone(normalized) once the number is valid, else null. */
  formatted: string | null;
  /** Field label ("Tu celular"). */
  label: string;
  placeholder: string;
  /** Printed across the top of the bib: the campaign's name. */
  raceName: string;
  /** Small tag on the bib ("Corredor"). */
  tag: string;
  invalid?: boolean;
  disabled?: boolean;
}

/** Safety pins are decoration only; one SVG reused at the four corners. */
function Pin({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  return (
    <svg className={`wa-bib-pin wa-bib-pin-${corner}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="#e9e6df" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      <path d="M3 21 L10 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function RaceBib({
  value,
  onChange,
  formatted,
  label,
  placeholder,
  raceName,
  tag,
  invalid,
  disabled,
}: RaceBibProps) {
  const inputId = useId();
  return (
    <div className={`wa-bib${invalid ? " is-invalid" : ""}${disabled ? " is-disabled" : ""}`}>
      <Pin corner="tl" />
      <Pin corner="tr" />
      <Pin corner="bl" />
      <Pin corner="br" />

      <div className="wa-bib-band">
        <span className="wa-bib-race">{raceName}</span>
      </div>

      <div className="wa-bib-body">
        <div className="wa-bib-meta">
          <label className="wa-bib-label" htmlFor={inputId}>
            {label}
          </label>
          <span className="wa-bib-tag">{tag}</span>
        </div>
        <input
          id={inputId}
          className="wa-bib-input"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="send"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          required
        />
      </div>

      <div className="wa-bib-foot">
        {/* Echo of the clean number: a fat-fingered digit shows here before a
            message goes to a stranger. Live region so it is announced too. */}
        <span className="wa-bib-confirm" aria-live="polite">
          {formatted ? `${formatted} ✓` : ""}
        </span>
        <span className="wa-bib-barcode" aria-hidden="true" />
      </div>
    </div>
  );
}

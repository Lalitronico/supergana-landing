"use client";

import { useState } from "react";
import { useTickets } from "../TicketsShell";

/**
 * A password input with a Show/Hide toggle.
 *
 * On a phone, typing a password twice blind is the slowest step of sign-up and
 * the likeliest place to quit. One field that can be made visible on demand is
 * both faster and safer than a hidden field plus a "confirm" field.
 */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "new-password" | "current-password";
  hint?: string;
  minLength?: number;
}) {
  const { t } = useTickets();
  const [shown, setShown] = useState(false);

  return (
    <div className="tk-field">
      <label htmlFor="sh-password">{label}</label>
      <span className="sh-pw">
        <input
          id="sh-password"
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={minLength}
        />
        <button
          type="button"
          className="sh-pw-toggle"
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? t("shHidePw") : t("shShowPw")}
        </button>
      </span>
      {hint && (
        <span className="tk-foot" style={{ fontWeight: 500 }}>
          {hint}
        </span>
      )}
    </div>
  );
}

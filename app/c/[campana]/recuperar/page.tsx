"use client";

import { useState } from "react";
import Link from "next/link";
import { authThrottleKind, supabaseBrowser } from "@/lib/supabase/browser";
import { useTickets } from "../TicketsShell";

/**
 * Password recovery. This is the one password flow that sends email by
 * definition, so it inherits the project's mail budget (2/hour on the built-in
 * sender until SMTP lands — see OPERACION_LIMITES_Y_CAPACIDAD.md). The success
 * copy never confirms whether the account exists.
 */
export default function RecoverPage() {
  const { t, base } = useTickets();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("errEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: authError } = await supabaseBrowser().auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        // The link lands on /auth/callback, which turns it into a session and
        // forwards to the new-password screen.
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`${base}restablecer/`)}`,
      },
    );
    setBusy(false);
    if (authError) {
      const throttle = authThrottleKind(authError);
      if (throttle === "project") {
        console.error("[tickets auth] project email budget exhausted", authError.message);
      }
      setError(
        t(
          throttle === "cooldown"
            ? "errTooManyCodes"
            : throttle === "project"
              ? "errMailBudget"
              : "errGeneric",
        ),
      );
      return;
    }
    setSent(true);
  };

  return (
    <div className="tk-pad">
      <div>
        <h1 className="tk-h" style={{ fontSize: 28 }}>
          {t("recTitle")}
        </h1>
        <p className="tk-body" style={{ fontSize: 13.5, marginTop: 6 }}>
          {t("recSub")}
        </p>
      </div>

      {error && <p className="tk-error">{error}</p>}

      {sent ? (
        <div className="tk-card">
          <p className="tk-body">{t("recSent")}</p>
        </div>
      ) : (
        <form
          className="tk-card"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
          onSubmit={submit}
        >
          <label className="tk-field">
            {t("authEmail")}
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@email.com"
              required
            />
          </label>
          <button className="tk-btn" type="submit" disabled={busy}>
            {busy ? t("authSending") : t("recBtn")} →
          </button>
        </form>
      )}

      <Link className="tk-linkbtn" href={`${base}entrar/`} style={{ textAlign: "center" }}>
        {t("back")}
      </Link>
    </div>
  );
}

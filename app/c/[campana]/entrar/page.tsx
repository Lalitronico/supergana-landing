"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authThrottleKind, supabaseBrowser } from "@/lib/supabase/browser";
import { useTickets } from "../TicketsShell";

/**
 * Email OTP sign-in. No passwords: the account IS the verified email, which is
 * also the address the reward is delivered to — one fewer thing that can be
 * mistyped between signing up and getting paid.
 */
export default function SignInPage() {
  const { t, base } = useTickets();
  const router = useRouter();

  // Resolved at navigation time rather than held in state: reading it here
  // avoids useSearchParams() (which would force a Suspense boundary around the
  // form) without mirroring the URL into React state just to read it once.
  const destination = () => {
    const target =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("next");
    return target === "panel" ? `${base}panel/` : `${base}subir/`;
  };

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("errEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: authError } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        // Belt and braces: the code field below is the primary flow, but if the
        // email template sends a link instead, /auth/callback catches it.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination())}`,
      },
    });
    setBusy(false);
    if (authError) {
      // Supabase's messages are English-only and unlocalisable, and this is a
      // bilingual campaign — passing one through would show English to someone
      // who chose Spanish.
      const throttle = authThrottleKind(authError);
      if (throttle === "project") {
        // The project's hourly email budget is gone: every other participant
        // arriving right now is locked out too. That is an operational
        // incident, not a user mistake, so it goes to the log as one.
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
    setStep("code");
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    // Supabase's OTP length is a project setting (6–10 digits), not a constant.
    // This project issues 8; hardcoding 6 would reject every real code.
    if (token.length < 6 || token.length > 10) {
      setError(t("errCode"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: authError } = await supabaseBrowser().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });
    setBusy(false);
    if (authError) {
      setError(t("errCode"));
      return;
    }
    // The session now lives in cookies, so the server routes can see it too.
    // refresh() re-runs the server components with the new session.
    router.replace(destination());
    router.refresh();
  };

  return (
    <div className="tk-pad">
      <div>
        <div className="tk-eyebrow">{t("regStep", { n: 1 })}</div>
        <h1 className="tk-h" style={{ fontSize: 28, marginTop: 6 }}>
          {step === "email" ? t("authTitle") : t("authCodeTitle")}
        </h1>
        <p className="tk-body" style={{ fontSize: 13.5, marginTop: 6 }}>
          {step === "email" ? t("authSub") : t("authCodeSub", { email })}
        </p>
      </div>

      {error && <p className="tk-error">{error}</p>}

      {step === "email" ? (
        <form
          className="tk-card"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
          onSubmit={sendCode}
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
            {busy ? t("authSending") : t("authSend")} →
          </button>
        </form>
      ) : (
        <form
          className="tk-card"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
          onSubmit={verify}
        >
          <label className="tk-field">
            {t("authCode")}
            <input
              className="tk-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="——————"
              required
            />
          </label>
          <button className="tk-btn" type="submit" disabled={busy}>
            {busy ? t("authVerifying") : t("authVerify")} →
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <button type="button" className="tk-linkbtn" onClick={() => setStep("email")}>
              {t("authWrongEmail")}
            </button>
            <button
              type="button"
              className="tk-linkbtn"
              onClick={(e) => sendCode(e as unknown as React.FormEvent)}
              disabled={busy}
            >
              {t("authResend")}
            </button>
          </div>
        </form>
      )}

      <p className="tk-foot">{t("privacyNote")}</p>
    </div>
  );
}

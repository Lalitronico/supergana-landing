"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authThrottleKind, supabaseBrowser } from "@/lib/supabase/browser";
import { useTickets } from "../TicketsShell";

/**
 * Sign-in. Password is the primary path: entering sends no email at all, so
 * the project's mail budget stays out of the critical path. The email-OTP flow
 * survives as the fallback — it's how accounts created before passwords
 * existed get in (and then set themselves a password from the panel).
 */
type Mode = "password" | "otp-email" | "otp-code";

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

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = () => {
    // The session now lives in cookies, so the server routes can see it too.
    // refresh() re-runs the server components with the new session.
    router.replace(destination());
    router.refresh();
  };

  const validEmail = () => /^\S+@\S+\.\S+$/.test(email.trim());

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validEmail()) {
      setError(t("errEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: authError } = await supabaseBrowser().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    if (authError) {
      // Supabase's messages are English-only; this campaign is bilingual.
      // Wrong password and unknown account collapse into one message on
      // purpose — telling them apart confirms which emails have accounts.
      setError(t("errBadLogin"));
      return;
    }
    enter();
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validEmail()) {
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
    setMode("otp-code");
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
    enter();
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setCode("");
  };

  const heading =
    mode === "password"
      ? ([t("authPwTitle"), t("authPwSub")] as const)
      : mode === "otp-email"
        ? ([t("authTitle"), t("authSub")] as const)
        : ([t("authCodeTitle"), t("authCodeSub", { email })] as const);

  return (
    <div className="tk-pad">
      <div>
        <div className="tk-eyebrow">{t("regStep", { n: 1 })}</div>
        <h1 className="tk-h" style={{ fontSize: 28, marginTop: 6 }}>
          {heading[0]}
        </h1>
        <p className="tk-body" style={{ fontSize: 13.5, marginTop: 6 }}>
          {heading[1]}
        </p>
      </div>

      {error && <p className="tk-error">{error}</p>}

      {mode === "password" && (
        <form
          className="tk-card"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
          onSubmit={signInWithPassword}
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
          <label className="tk-field">
            {t("fPassword")}
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="tk-btn" type="submit" disabled={busy}>
            {busy ? t("authSigningIn") : t("authSignIn")} →
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <Link className="tk-linkbtn" href={`${base}recuperar/`}>
              {t("authForgot")}
            </Link>
            <button
              type="button"
              className="tk-linkbtn"
              onClick={() => switchMode("otp-email")}
            >
              {t("authOtpAlt")}
            </button>
          </div>
        </form>
      )}

      {mode === "otp-email" && (
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
          <button
            type="button"
            className="tk-linkbtn"
            onClick={() => switchMode("password")}
          >
            {t("authPwAlt")}
          </button>
        </form>
      )}

      {mode === "otp-code" && (
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
            <button type="button" className="tk-linkbtn" onClick={() => switchMode("otp-email")}>
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

      {mode === "password" && (
        <Link
          className="tk-btn sm"
          href={`${base}crear-cuenta/`}
          style={{ textAlign: "center" }}
        >
          {t("authNoAccount")} →
        </Link>
      )}

      <p className="tk-foot">{t("privacyNote")}</p>
    </div>
  );
}

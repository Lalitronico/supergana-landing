"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTickets } from "../TicketsShell";

/**
 * Account creation: email + password, no email sent, no wall. The server
 * creates the account (see /api/tickets/[campana]/account/) and the browser
 * signs in with the same credentials right after, so one submit leaves the
 * person signed in and heading to the profile step.
 */
export default function CreateAccountPage() {
  const { campaign, t, base } = useTickets();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExists(false);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("errEmail"));
      return;
    }
    if (password.length < 8) {
      setError(t("errPwShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("errPwMatch"));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${campaign.slug}/account/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      if (res.status === 409) {
        // The address already has an account. Saying so is a small oracle, but
        // the alternative — a generic error on a legitimate "I forgot I signed
        // up" — strands exactly the people the campaign wants back.
        setExists(true);
        setError(t("errAccountExists"));
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(t(data?.error === "weak_password" ? "errPwShort" : "errGeneric"));
        return;
      }

      const { error: authError } = await supabaseBrowser().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) {
        // Account created but sign-in failed — send them to the sign-in screen
        // rather than a dead end; their credentials already work.
        router.replace(`${base}entrar/`);
        router.refresh();
        return;
      }

      router.replace(`${base}registro/`);
      router.refresh();
    } catch {
      setError(t("errNetwork"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tk-pad">
      <div>
        <div className="tk-eyebrow">{t("regStep", { n: 1 })}</div>
        <h1 className="tk-h" style={{ fontSize: 28, marginTop: 6 }}>
          {t("acTitle")}
        </h1>
        <p className="tk-body" style={{ fontSize: 13.5, marginTop: 6 }}>
          {t("acSub")}
        </p>
      </div>

      {error && <p className="tk-error">{error}</p>}

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
        <label className="tk-field">
          {t("fPassword")}
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <label className="tk-field">
          {t("fPassword2")}
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <button className="tk-btn" type="submit" disabled={busy}>
          {busy ? t("acCreating") : t("acBtn")} →
        </button>
        {exists && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <Link className="tk-linkbtn" href={`${base}entrar/`}>
              {t("authHaveAccount")}
            </Link>
            <Link className="tk-linkbtn" href={`${base}recuperar/`}>
              {t("authForgot")}
            </Link>
          </div>
        )}
      </form>

      {!exists && (
        <Link className="tk-linkbtn" href={`${base}entrar/`} style={{ textAlign: "center" }}>
          {t("authHaveAccount")}
        </Link>
      )}

      <p className="tk-foot">{t("privacyNote")}</p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTickets } from "../TicketsShell";
import { EntryHead } from "../showcase/EntryHead";
import { PasswordField } from "../showcase/PasswordField";

/**
 * Account creation: email + password, no email sent, no wall. The server
 * creates the account (see /api/tickets/[campana]/account/) and the browser
 * signs in with the same credentials right after, so one submit leaves the
 * person signed in and heading to the profile step.
 */
export default function CreateAccountPage() {
  const { campaign, t, base, locale } = useTickets();
  const router = useRouter();

/**
 * A campaign identified by phone (0030) has no password and no address, so this
 * screen has nothing to do there. Redirected rather than hidden: the URL is
 * guessable and reachable from an old bookmark, and the API route behind it
 * already answers 404 — this is the screen agreeing rather than showing a form
 * whose submit can only fail.
 */
  useEffect(() => {
    if (campaign.authChannel === "phone") router.replace(`${base}entrar/`);
  }, [campaign.authChannel, router, base]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  // Rendered nothing rather than briefly: the redirect above is an effect, so
  // without this the form paints for one frame before vanishing — which reads
  // as a glitch and, worse, as a form somebody might start typing into.
  if (campaign.authChannel === "phone") {
    return <div className="tk-pad"><p className="tk-body">{t("loading")}</p></div>;
  }
  return (
    <div className="tk-pad">
      {/* The "confirm password" box is gone on purpose: on a phone it doubles
          the slowest step of sign-up, and the Show toggle on the field below
          catches a typo better than a second blind entry does. */}
      <EntryHead
        step={1}
        title={t("acTitle")}
        // An accumulation campaign never emails a reward, so promising one
        // here would be the first lie the participant reads.
        sub={t(campaign.mechanic === "accumulation" ? "accAcSub" : "acSub")}
      />

      {error && <p className="tk-error">{error}</p>}

      <form
        className="tk-card sh-form"
        onSubmit={submit}
      >
        <label className="tk-field">
          {t("authEmail")}
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={locale === "es" ? "maria@correo.com" : "maria@email.com"}
            required
          />
        </label>
        <PasswordField
          label={t("fPassword")}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
          hint={t("shPwHint")}
        />
        <button className="tk-btn" type="submit" disabled={busy}>
          {busy ? t("acCreating") : t("acBtn")}&nbsp;→
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

    </div>
  );
}

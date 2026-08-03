"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTickets } from "../TicketsShell";
import { useMe } from "../useMe";

/**
 * Set a new password. Serves two doors with one screen: the recovery link
 * (which arrives here already signed in via /auth/callback) and the panel's
 * "change my password" — which is also the migration path for accounts that
 * predate passwords and only ever signed in by code.
 */
export default function ResetPasswordPage() {
  const { campaign, t, base } = useTickets();
  const router = useRouter();
  const { status } = useMe(campaign.slug);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anon") router.replace(`${base}entrar/?next=panel`);
  }, [status, router, base]);

  if (status === "loading" || status === "anon") {
    return <div className="tk-pad"><p className="tk-body">{t("loading")}</p></div>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    const { error: authError } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (authError) {
      setError(t("errGeneric"));
      return;
    }
    setDone(true);
  };

  return (
    <div className="tk-pad">
      <div>
        <h1 className="tk-h" style={{ fontSize: 28 }}>
          {t("rsTitle")}
        </h1>
        <p className="tk-body" style={{ fontSize: 13.5, marginTop: 6 }}>
          {t("rsSub")}
        </p>
      </div>

      {error && <p className="tk-error">{error}</p>}

      {done ? (
        <div className="tk-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p className="tk-body">{t("rsDone")}</p>
          <button
            className="tk-btn"
            type="button"
            onClick={() => {
              router.replace(`${base}panel/`);
              router.refresh();
            }}
          >
            {t("homeGoPanel")} →
          </button>
        </div>
      ) : (
        <form
          className="tk-card"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
          onSubmit={submit}
        >
          <label className="tk-field">
            {t("fPassword")}
            <input
              type="password"
              autoComplete="new-password"
              autoFocus
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
            {busy ? t("rsSaving") : t("rsBtn")} →
          </button>
        </form>
      )}
    </div>
  );
}

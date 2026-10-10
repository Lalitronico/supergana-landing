"use client";

import { useEffect, useRef, useState } from "react";
import { formatMxPhone, normalizeMxPhone } from "@/lib/platform/phone";
import { useTickets } from "../TicketsShell";
import { EntryHead } from "../showcase/EntryHead";

/**
 * Sign-in for campaigns whose identity channel is the phone (0030).
 *
 * Two steps and no password: a number, then four digits that arrive by
 * WhatsApp. There is no "create an account" anywhere near this screen, and that
 * is the point — the same door serves somebody arriving for the first time and
 * somebody coming back in week six, because the number IS the account. Which of
 * the two they are is a question this screen may not answer until the code
 * comes back: `start` replies identically either way, so the form cannot be
 * used to find out who plays.
 *
 * WHY IT ANNOUNCES THE MESSAGE BEFORE SENDING IT. Meta's authentication
 * templates carry fixed, unbranded text — "Tu código de verificación es 1234" —
 * and this number's display name is declined, so it arrives from a raw phone
 * number saying nothing about Alaska or Supergana. Without the warning first,
 * the message is indistinguishable from spam, and the people most careful about
 * their phone are exactly the ones who would ignore it.
 *
 * THE SESSION IS SET BY THE SERVER, so confirming navigates with a full page
 * load rather than `router.replace`. `supabase-js` never saw a sign-in happen,
 * so no `onAuthStateChange` fires and a client-side transition would land on a
 * panel whose components still believe nobody is signed in. Same reason
 * `HashSession` reloads rather than routing.
 */

/** In-app screens a `?next=` may name. Every one is a route under `base`. */
const POST_LOGIN = new Set(["panel", "premios", "subir"]);

/** Long enough that the WhatsApp has plausibly arrived, short enough not to
 *  strand somebody whose message genuinely never came. Each resend is a
 *  conversation billed to the tenant, and the server caps them at three an hour
 *  regardless — this is only so the button does not invite the second one. */
const RESEND_COOLDOWN_S = 45;

type Step = "phone" | "code";

export function PhoneSignIn() {
  const { t, base, campaign } = useTickets();

  const destination = () => {
    const target =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("next");
    // An allowlist, not a path: `next` comes from the URL, and anything that
    // let it name its own destination would be an open redirect wearing a
    // login form. Unknown values land on the upload screen.
    return target && POST_LOGIN.has(target) ? `${base}${target}/` : `${base}subir/`;
  };

  const [step, setStep] = useState<Step>("phone");
  const [typed, setTyped] = useState("");
  /** E.164, set only once `normalizeMxPhone` accepted it — what the server is
   *  told, so step two cannot drift from the number the code went to. */
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Only ever set outside production — see `codeSender` in lib/platform/otp. */
  const [rehearsalCode, setRehearsalCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Focus follows the step, so somebody who just typed their number does not
  // have to hunt for the next box with a keyboard covering half the screen.
  useEffect(() => {
    if (step === "code") codeInput.current?.focus();
  }, [step]);

  const normalized = normalizeMxPhone(typed);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/tickets/${campaign.slug}/phone-auth/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { res, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  };

  const errorFor = (reason: unknown): string => {
    switch (reason) {
      case "bad_phone":
        return t("errWaPhone");
      case "bad_code":
        return t("errWaCode");
      case "code_expired":
        return t("errWaExpired");
      case "too_many_attempts":
        return t("errWaAttempts");
      case "too_many_sends":
        return t("errWaTooMany");
      case "not_configured":
      case "send_failed":
        return t("errWaUnavailable");
      default:
        return t("errGeneric");
    }
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    // Validated here as well as on the server, and only so the error names the
    // real problem: a Ciudad Juárez campaign gets El Paso numbers typed into
    // it, and "we only take Mexican mobiles" is a different sentence from
    // "invalid" to somebody who typed their number correctly.
    if (!normalized) {
      setError(t("errWaPhone"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await post({ action: "start", phone: normalized });
      if (!res.ok) {
        setError(errorFor(data.error));
        return;
      }
      setPhone(normalized);
      setRehearsalCode(typeof data.rehearsalCode === "string" ? data.rehearsalCode : null);
      setCode("");
      setStep("code");
      setCooldown(RESEND_COOLDOWN_S);
    } catch {
      setError(t("errNetwork"));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || code.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await post({ action: "confirm", phone, code });
      if (!res.ok) {
        setError(errorFor(data.error));
        // An expired code has no second attempt worth offering here: the only
        // way forward is a new one, so send them back to ask for it.
        if (data.error === "code_expired") {
          setStep("phone");
          setCooldown(0);
        }
        setBusy(false);
        return;
      }
      // Full navigation, not router.replace — see the header. `busy` is left on
      // deliberately: the page is leaving, and re-enabling the button would
      // only offer a second submit during the handover.
      window.location.assign(destination());
    } catch {
      setError(t("errNetwork"));
      setBusy(false);
    }
  };

  return (
    <div className="tk-pad">
      <EntryHead
        step={1}
        title={step === "phone" ? t("waTitle") : t("waCodeTitle")}
        sub={
          step === "phone"
            ? t("waSub")
            : t("waCodeSub", { phone: phone ? formatMxPhone(phone) : "" })
        }
      />

      {error && <p className="tk-error">{error}</p>}

      {step === "phone" ? (
        <form
          className="tk-card sh-form"
          onSubmit={sendCode}
        >
          <label className="tk-field">
            {t("waLabel")}
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="send"
              autoFocus
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("waPlaceholder")}
              required
            />
          </label>

          {/* Confirms what we will actually dial, the moment it stops being
              ambiguous. Somebody who fat-fingered a digit sees it here rather
              than after waiting for a message that went to a stranger. */}
          {normalized && (
            <p className="tk-body" style={{ fontSize: 13, marginTop: -6, opacity: 0.75 }}>
              {formatMxPhone(normalized)}
            </p>
          )}

          <p className="tk-body" style={{ fontSize: 12.5, opacity: 0.8 }}>
            {t("waNote")}
          </p>

          <button className="tk-btn" type="submit" disabled={busy}>
            {busy ? t("authSending") : t("waSend")}&nbsp;→
          </button>
        </form>
      ) : (
        <form
          className="tk-card sh-form"
          onSubmit={confirm}
        >
          {/* The one place a code may appear on screen, and it is the SERVER
              that decides: `codeSender` cannot build a revealing sender on a
              production deployment, and Vercel's own VERCEL_ENV is what makes
              that true rather than a flag we control. */}
          {rehearsalCode && (
            <p className="tk-rehearsal">{t("waRehearsal", { code: rehearsalCode })}</p>
          )}

          <label className="tk-field">
            {t("waCodeLabel")}
            <input
              ref={codeInput}
              className="tk-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={code}
              onChange={(e) => {
                // Digits only. WhatsApp's copy button pastes the code, and a
                // stray character would fail a check the person cannot see.
                setCode(e.target.value.replace(/\D/g, "").slice(0, 4));
                if (error) setError(null);
              }}
              placeholder="————"
              required
            />
          </label>

          <button className="tk-btn" type="submit" disabled={busy || code.length !== 4}>
            {busy ? t("authVerifying") : t("waConfirm")}&nbsp;→
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <button
              type="button"
              className="tk-linkbtn"
              disabled={busy}
              onClick={() => {
                setStep("phone");
                setCode("");
                setRehearsalCode(null);
                setError(null);
              }}
            >
              {t("waChangeNumber")}
            </button>
            <button
              type="button"
              className="tk-linkbtn"
              disabled={busy || cooldown > 0}
              onClick={() => sendCode()}
            >
              {cooldown > 0 ? t("waResendIn", { seconds: cooldown }) : t("waResend")}
            </button>
          </div>
        </form>
      )}

    </div>
  );
}

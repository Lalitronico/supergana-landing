"use client";

import { useEffect, useRef, useState } from "react";
import { formatMxPhone, normalizeMxPhone } from "@/lib/platform/phone";
import { useTickets } from "../TicketsShell";
import { StartLineHead } from "./StartLineHead";
import { RaceBib } from "./RaceBib";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { StartLights, type LightsStatus } from "./StartLights";

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
 * THE STARTING LINE (2026-10-25). Every phone campaign is a race (Carrera
 * Alaska, La Carrera del Sabor), so the door is drawn as the start of one: the
 * number goes on a racing bib — the bib IS the runner, as the number IS the
 * account — and the four digits are the four starting lights. All of it is
 * drawing; this file keeps every rule it had, and the pieces in this folder
 * only render what it tells them.
 *
 * WHY IT ANNOUNCES THE MESSAGE BEFORE SENDING IT. Meta's authentication
 * templates carry fixed, unbranded text — "Tu código de verificación es 1234" —
 * and this number's display name is declined, so it arrives from a raw phone
 * number saying nothing about the campaign or Supergana. Without the warning
 * first, the message is indistinguishable from spam, and the people most
 * careful about their phone are exactly the ones who would ignore it. That is
 * `WhatsAppPreview`'s whole job.
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

/** How long the green lights stay on screen before the page leaves. Long
 *  enough to register as "you're in", short enough not to feel like a wait. */
const GO_HOLD_MS = 700;

/** The code in the "this is what you'll get" bubble. An example, and it must
 *  stay one: a fixed literal, never anything derived from a real send. */
const EXAMPLE_CODE = "4821";

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
  /** Busy with the CODE, as opposed to a resend: only this one may say
   *  "Verificando…" on the button. */
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Only ever set outside production — see `codeSender` in lib/platform/otp. */
  const [rehearsalCode, setRehearsalCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  /** What the starting lights show: typing, a wrong code, or accepted. */
  const [lights, setLights] = useState<LightsStatus>("idle");
  const codeInput = useRef<HTMLInputElement>(null);
  /** Guards the auto-submit: the fourth digit and the Enter key can both fire
   *  before React re-renders, and `busy` (state) is not visible to the second. */
  const confirming = useRef(false);

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
      setLights("idle");
      setStep("code");
      setCooldown(RESEND_COOLDOWN_S);
    } catch {
      setError(t("errNetwork"));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (digits: string) => {
    if (!phone || digits.length !== 4 || confirming.current) return;
    confirming.current = true;
    setBusy(true);
    setVerifying(true);
    setError(null);
    try {
      const { res, data } = await post({ action: "confirm", phone, code: digits });
      if (!res.ok) {
        setError(errorFor(data.error));
        setLights("error");
        // The lights go dark again so the next try starts from an empty grid,
        // which is what "that code was wrong" should look like.
        setCode("");
        // An expired code has no second attempt worth offering here: the only
        // way forward is a new one, so send them back to ask for it.
        if (data.error === "code_expired") {
          setStep("phone");
          setCooldown(0);
        } else {
          codeInput.current?.focus();
        }
        setBusy(false);
        setVerifying(false);
        confirming.current = false;
        return;
      }
      // Full navigation, not router.replace — see the header. `busy` and the
      // guard stay on deliberately: the page is leaving, and re-enabling the
      // button would only offer a second submit during the handover. The hold
      // is only so the green lights are seen; reduced motion skips it.
      setLights("go");
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(() => window.location.assign(destination()), reduced ? 0 : GO_HOLD_MS);
    } catch {
      // Same shape as a wrong code — empty lights, focus back in the box — so
      // the next move is obvious: type it again (the code is still valid).
      setError(t("errNetwork"));
      setLights("error");
      setCode("");
      codeInput.current?.focus();
      setBusy(false);
      setVerifying(false);
      confirming.current = false;
    }
  };

  const onCodeChange = (digits: string) => {
    setCode(digits);
    if (error) setError(null);
    if (lights === "error") setLights("idle");
    // The fourth light submits. WhatsApp's copy button and the keyboard's
    // one-time-code suggestion both deliver all four at once, and making
    // somebody then find a button is a step that buys nothing.
    if (digits.length === 4) void confirm(digits);
  };

  return (
    <div className="tk-pad">
      <StartLineHead
        step={1}
        phase={step === "phone" ? "bib" : lights === "go" ? "go" : "lights"}
        title={step === "phone" ? t("waBibTitle") : t("waLightsTitle")}
        mark={step === "phone" ? t("waBibMark") : t("waLightsMark")}
        sub={
          step === "phone"
            ? t("waBibSub")
            : t("waLightsSub", { phone: phone ? formatMxPhone(phone) : "" })
        }
      />

      {error && <p className="tk-error" role="alert">{error}</p>}

      {step === "phone" ? (
        <form className="tk-card sh-form wa-form" onSubmit={sendCode}>
          {/* Confirms what we will actually dial, the moment it stops being
              ambiguous. Somebody who fat-fingered a digit sees it on the bib
              rather than after waiting for a message that went to a stranger. */}
          <RaceBib
            value={typed}
            onChange={(value) => {
              setTyped(value);
              if (error) setError(null);
            }}
            formatted={normalized ? formatMxPhone(normalized) : null}
            label={t("waLabel")}
            placeholder={t("waPlaceholder")}
            raceName={campaign.name}
            tag={t("waBibTag")}
            invalid={Boolean(error)}
            disabled={busy}
          />

          <button className="tk-btn" type="submit" disabled={busy}>
            {busy ? t("authSending") : t("waSend")}&nbsp;→
          </button>

          <WhatsAppPreview
            label={t("waPreviewLabel")}
            from={t("waPreviewFrom")}
            body={t("waPreviewBody", { code: EXAMPLE_CODE })}
            copy={t("waPreviewCopy")}
            note={t("waPreviewNote")}
          />
        </form>
      ) : (
        <form
          className="tk-card sh-form wa-form"
          onSubmit={(e) => {
            e.preventDefault();
            void confirm(code);
          }}
        >
          {/* The one place a code may appear on screen, and it is the SERVER
              that decides: `codeSender` cannot build a revealing sender on a
              production deployment, and Vercel's own VERCEL_ENV is what makes
              that true rather than a flag we control. */}
          {rehearsalCode && (
            <p className="tk-rehearsal">{t("waRehearsal", { code: rehearsalCode })}</p>
          )}

          <StartLights
            value={code}
            onChange={onCodeChange}
            label={t("waCodeLabel")}
            status={lights}
            goLabel={t("waLightsGo")}
            disabled={busy && lights === "go"}
            inputRef={codeInput}
          />

          <button className="tk-btn" type="submit" disabled={busy || code.length !== 4}>
            {verifying ? t("authVerifying") : t("waConfirm")}&nbsp;→
          </button>

          <div className="wa-form-links">
            <button
              type="button"
              className="tk-linkbtn"
              disabled={busy}
              onClick={() => {
                setStep("phone");
                setCode("");
                setLights("idle");
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

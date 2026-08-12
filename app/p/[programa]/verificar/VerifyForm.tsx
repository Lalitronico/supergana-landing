"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatMxPhone, normalizeMxPhone } from "@/lib/platform/phone";
import { useDeviceSession } from "../useDeviceSession";

/**
 * The code, and then whichever of the two things happens next.
 *
 * THE FORK LIVES HERE AND NOWHERE EARLIER.
 *
 * Registration cannot know whether a number already plays — answering that
 * before the code would turn the form into a directory of players — so both
 * kinds of player go through one door and find out on the other side of it. A
 * code that came back proves the number belongs to whoever is holding the
 * phone, and from that instant greeting them by name is what any account does.
 *
 * New: the nickname, asked for once, inline. Not a route of its own — a fourth
 * screen between "verified" and "playing" is a place to abandon, and the sheet
 * is what the player came for. Whoever does not want to answer gets a plain way
 * past it, and so does whoever the POST fails for.
 *
 * Returning: a one-beat hello and then the jornada. The greeting exists because
 * "did it work" needs an answer, and because being recognised by name after
 * seven weeks away is the whole promise of the number being the account.
 */

const ERRORS: Record<string, string> = {
  bad_code: "Ese código no es. Revísalo y vuelve a intentar.",
  code_expired: "El código ya venció. Pide uno nuevo.",
  too_many_attempts: "Demasiados intentos con este código. Pide uno nuevo.",
  too_many_sends:
    "Ya enviamos varios códigos a ese número. Espera una hora e inténtalo de nuevo.",
  bad_phone: "Necesitamos 10 dígitos con LADA. Ej. 656 111 2233.",
  no_session: "No pudimos abrir tu sesión. Recarga la página.",
  not_verified: "Necesitas confirmar tu número antes de ponerte un apodo.",
  not_a_participant: "No encontramos tu registro en este dispositivo.",
  db_error: "Algo falló de nuestro lado. Inténtalo otra vez.",
};

/** What the server calls a player who has not named themselves yet. */
const PLACEHOLDER_ALIAS = "Jugador";

type Step = "code" | "alias" | "welcome";

export function VerifyForm({ slug, openWeek }: { slug: string; openWeek: number }) {
  const router = useRouter();
  const search = useSearchParams();
  const { ensure } = useDeviceSession();

  const phone = normalizeMxPhone(search.get("t") ?? "");
  // Present only on a rehearsal deployment, where no WhatsApp account exists to
  // deliver anything. The server decides that and cannot decide it in
  // production; see lib/pickem/otp.ts.
  const [rehearsalCode, setRehearsalCode] = useState<string | null>(search.get("ensayo"));
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [step, setStep] = useState<Step>("code");
  const [alias, setAlias] = useState("");
  /** How the server already knows them. Only shown to somebody who returns. */
  const [knownAlias, setKnownAlias] = useState<string | null>(null);

  const board = `/p/${slug}/jornada/${openWeek}/`;

  // The hello is a beat, not a screen. Long enough to read four words, short
  // enough that nobody reaches for the button that is not there.
  useEffect(() => {
    if (step !== "welcome") return;
    const t = window.setTimeout(() => router.replace(board), 1400);
    return () => window.clearTimeout(t);
  }, [step, router, board]);

  const post = async (body: Record<string, unknown>) => {
    const uid = await ensure();
    if (!uid) throw new Error("no_session");
    const res = await fetch(`/api/pickem/${slug}/verify/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (typeof json?.rehearsalCode === "string") setRehearsalCode(json.rehearsalCode);
    return { ok: res.ok, json } as {
      ok: boolean;
      json: { error?: string; rehearsalCode?: string; alias?: string | null; isNew?: boolean };
    };
  };

  // Somebody who lands here without a number in the URL cleared it, or opened
  // the link on a different device. Sending them back beats an empty box that
  // can never succeed.
  if (!phone) {
    return (
      <div className="sg-card">
        <p className="sg-body" style={{ marginTop: 0 }}>
          No sabemos a qué número mandamos el código.
        </p>
        <button className="sg-btn sm" onClick={() => router.push(`/p/${slug}/registro/`)}>
          Volver a empezar
        </button>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 4 || busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const { ok, json } = await post({ action: "confirm", phone, code });
      if (!ok) {
        setError(ERRORS[json?.error ?? ""] ?? "No pudimos verificar el código.");
        setBusy(false);
        return;
      }
      // Verified. `isNew` is the server's answer read BEFORE the link stamped
      // the row — see the route. A brand new player names themselves here; a
      // returning one gets a hello and the board.
      if (json.isNew) {
        setKnownAlias(null);
        setStep("alias");
        setBusy(false);
        return;
      }
      const known = typeof json.alias === "string" ? json.alias.trim() : "";
      setKnownAlias(known && known !== PLACEHOLDER_ALIAS ? known : null);
      setStep("welcome");
      setBusy(false);
    } catch {
      setError("No hay conexión. Inténtalo otra vez.");
      setBusy(false);
    }
  };

  /**
   * The nickname, and the board either way.
   *
   * A failure here is not worth stranding anybody over: the number is already
   * proven, the account already exists, and a player who cannot be renamed can
   * still play as Jugador and fix it later. So the error is shown and the exit
   * stays open — it is beside the button at all times, not conjured by the
   * failure.
   */
  const saveAlias = async (event: React.FormEvent) => {
    event.preventDefault();
    if (alias.trim().length < 2 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { ok, json } = await post({ action: "alias", alias: alias.trim() });
      if (!ok) {
        setError(ERRORS[json?.error ?? ""] ?? "No pudimos guardar tu apodo.");
        setBusy(false);
        return;
      }
      router.replace(board);
    } catch {
      setError("No hay conexión. Puedes entrar y ponerte el apodo después.");
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      // No alias, and the schema no longer wants one: the row exists either way
      // and a name typed on another screen is not what is being re-sent.
      const { ok, json } = await post({ action: "start", phone });
      setNote(ok ? "Te mandamos otro código." : null);
      if (!ok) setError(ERRORS[json?.error ?? ""] ?? "No pudimos reenviar el código.");
    } catch {
      setError("No hay conexión. Inténtalo otra vez.");
    }
    setBusy(false);
  };

  // ---- the hello, for somebody who already plays --------------------------
  if (step === "welcome") {
    return (
      <div className="sg-card" style={{ background: "var(--sg-yellow)" }}>
        <div className="sg-eyebrow">Listo</div>
        <div className="sg-h" style={{ fontSize: 26, marginTop: 4 }}>
          {knownAlias ? `¡Hola de nuevo, ${knownAlias}!` : "¡Hola de nuevo!"}
        </div>
        <p className="sg-body" style={{ margin: "6px 0 0" }}>
          Tus puntos siguen donde los dejaste. Te llevamos a la jornada {openWeek}…
        </p>
      </div>
    );
  }

  // ---- the nickname, for somebody brand new -------------------------------
  if (step === "alias") {
    return (
      <form onSubmit={saveAlias} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="pk-ticket accent raised pk-banner">
          <span className="pk-mech-disc" aria-hidden="true">
            ✓
          </span>
          <span>Número confirmado</span>
        </div>

        <div className="sg-field">
          <label htmlFor="alias">Cómo quieres aparecer</label>
          <input
            id="alias"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Tu apodo"
            maxLength={24}
            autoComplete="nickname"
            autoFocus
          />
          <span className="sg-foot">
            Es el nombre que ve todo el mundo en el ranking. Lo puedes cambiar después.
          </span>
        </div>

        {error ? <div className="sg-error">{error}</div> : null}

        <button className="sg-btn" type="submit" disabled={alias.trim().length < 2 || busy}>
          {busy ? "Guardando…" : "¡Listo, a jugar!"}
        </button>

        {/* Always here, not summoned by a failure. Somebody who does not want
            to be named is not stuck, and neither is somebody the update failed
            for: the account exists and the board is one tap away either way. */}
        <button
          type="button"
          className="sg-btn ghost sm"
          onClick={() => router.replace(board)}
          disabled={busy}
        >
          Continuar como {PLACEHOLDER_ALIAS}
        </button>
      </form>
    );
  }

  // ---- the code -----------------------------------------------------------
  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Labelled as loudly as it can be. Somebody demoing this has to be able
          to say "esto no pasa en producción" without it sounding like an
          excuse, and somebody who stumbles onto it has to understand at a
          glance that no WhatsApp is coming. */}
      {rehearsalCode ? (
        <div className="sg-card" style={{ background: "var(--sg-yellow)" }}>
          <div className="sg-eyebrow">Modo ensayo · no se envió WhatsApp</div>
          <div
            style={{
              fontFamily: "var(--sg-mono)",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "0.3em",
              marginTop: 4,
            }}
          >
            {rehearsalCode}
          </div>
          <p className="sg-foot" style={{ marginTop: 6, marginBottom: 0 }}>
            Este programa todavía no tiene cuenta de WhatsApp, así que el código se
            muestra aquí. En producción llega al teléfono y nunca aparece en pantalla.
          </p>
        </div>
      ) : null}

      <div className="sg-field">
        <label htmlFor="code">Código de 4 dígitos</label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          // One-time-code lets iOS and Android offer the code from the
          // notification, which removes the app-switch that loses people.
          autoComplete="one-time-code"
          placeholder="0000"
          style={{
            fontFamily: "var(--sg-display)",
            fontSize: 30,
            letterSpacing: "0.4em",
            textAlign: "center",
          }}
        />
        <span className="sg-foot">Enviado a {formatMxPhone(phone)}</span>
      </div>

      {error ? <div className="sg-error">{error}</div> : null}
      {note ? <div className="sg-foot">{note}</div> : null}

      <button className="sg-btn" type="submit" disabled={code.length !== 4 || busy}>
        {busy ? "Comprobando…" : "Entrar"}
      </button>

      <button type="button" className="sg-btn ghost sm" onClick={resend} disabled={busy}>
        Reenviar el código
      </button>

      <button
        type="button"
        className="sg-btn ghost sm"
        onClick={() => router.push(`/p/${slug}/registro/`)}
        disabled={busy}
      >
        Cambiar el número
      </button>
    </form>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatMxPhone, normalizeMxPhone } from "@/lib/platform/phone";
import { useDeviceSession } from "../useDeviceSession";

const ERRORS: Record<string, string> = {
  bad_code: "Ese código no es. Revísalo y vuelve a intentar.",
  code_expired: "El código ya venció. Pide uno nuevo.",
  too_many_attempts: "Demasiados intentos con este código. Pide uno nuevo.",
  too_many_sends:
    "Ya enviamos varios códigos a ese número. Espera una hora e inténtalo de nuevo.",
  bad_phone: "Necesitamos 10 dígitos con LADA. Ej. 656 111 2233.",
  no_session: "No pudimos abrir tu sesión. Recarga la página.",
  db_error: "Algo falló de nuestro lado. Inténtalo otra vez.",
};

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
      json: { error?: string; rehearsalCode?: string };
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
      // Verified. Straight into the open week — the next screen is the product,
      // and a "listo, ya quedaste" page in between is a tap that buys nothing.
      router.replace(`/p/${slug}/jornada/${openWeek}/`);
    } catch {
      setError("No hay conexión. Inténtalo otra vez.");
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      // No alias: the row already exists, so the server ignores it anyway. The
      // schema still wants the field, and repeating a name the player cannot
      // see on this screen would be a lie about what is being sent.
      const { ok, json } = await post({ action: "start", phone, alias: "jugador" });
      setNote(ok ? "Te mandamos otro código." : null);
      if (!ok) setError(ERRORS[json?.error ?? ""] ?? "No pudimos reenviar el código.");
    } catch {
      setError("No hay conexión. Inténtalo otra vez.");
    }
    setBusy(false);
  };

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

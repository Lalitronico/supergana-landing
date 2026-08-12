"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMxPhone, normalizeMxPhone } from "@/lib/platform/phone";
import { useDeviceSession } from "../useDeviceSession";

/**
 * ONE field, and that is the whole entrance.
 *
 * The deck sold it as "solo nombre y WhatsApp; sin descargar app y sin
 * contraseñas complicadas". This is less than that, and it is the same promise
 * kept better. No email, because the prize is collected at the counter and an
 * inbox buys the player nothing. No branch either: the branch matters when
 * somebody scans the table QR to check in, which is where it is captured.
 *
 * WHY THE NICKNAME LEFT THIS SCREEN.
 *
 * There is no "iniciar sesión" and no "registrarse" in this module — Eduardo
 * could not tell them apart because they do not exist. There is a number, and
 * the number either has an account behind it or it does not. Asking for a
 * nickname up front made the one door look like the new-player door, so a
 * player returning in jornada 7 was made to invent a name again before being
 * let back in.
 *
 * And the form CANNOT resolve that by saying "you already have one": `start`
 * answers identically for a number that plays and one that does not, on
 * purpose, or the form becomes a way to find out who plays. The only place the
 * question can be answered is after the code, where it is answered — see
 * `VerifyForm`. So the copy here promises nothing about which kind of player
 * you are, because at this moment nobody knows.
 */

/** What the server can answer, in words a person can act on. */
const ERRORS: Record<string, string> = {
  bad_phone: "Necesitamos 10 dígitos con LADA. Ej. 656 111 2233.",
  too_many_sends:
    "Ya enviamos varios códigos a ese número. Espera una hora e inténtalo de nuevo.",
  not_configured: "Todavía no podemos enviar el código. Avísale al personal de Chapa.",
  send_failed: "No pudimos enviar el WhatsApp. Revisa el número e inténtalo otra vez.",
  already_verified_other:
    "Este dispositivo ya tiene su jugador. Escribe un número que ya juegue aquí para entrar con él, o usa otro dispositivo para estrenar uno.",
  no_session: "No pudimos abrir tu sesión. Recarga la página.",
  db_error: "Algo falló de nuestro lado. Inténtalo otra vez.",
};

export function RegisterForm({ slug }: { slug: string }) {
  const router = useRouter();
  const { status, ensure } = useDeviceSession();

  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Normalised as they type, so the number they see confirmed is the number we
  // will dial. Silently reformatting somebody's phone is how a message goes
  // nowhere; showing it back is how they catch a typo before we send.
  const e164 = normalizeMxPhone(phone);
  const ready = e164 !== null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || sending) return;
    setSending(true);
    setError(null);

    // The session may not have settled yet on a cold load; awaiting it here
    // means a fast tapper does not get a 401 for being quick.
    const uid = await ensure();
    if (!uid) {
      setError("No pudimos abrir tu sesión en este dispositivo.");
      setSending(false);
      return;
    }

    try {
      const res = await fetch(`/api/pickem/${slug}/verify/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No alias. The server inserts a placeholder for a number nobody holds
        // and touches nothing for a number somebody does — which is what makes
        // this one door for both.
        body: JSON.stringify({ action: "start", phone: e164 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(ERRORS[body?.error] ?? "No pudimos enviar el código.");
        setSending(false);
        return;
      }
      // The number travels in the URL so a reload of the code screen does not
      // lose it. It is the player's own number on their own device, and the
      // alternative is asking them to type it again.
      //
      // `rehearsalCode` only exists on a deployment with no WhatsApp account
      // and no way to deliver anything; the server decides that, and it cannot
      // decide it in production. Carrying it forward lets the next screen say
      // so out loud instead of asking for a code that will never arrive.
      const rehearsal = typeof body?.rehearsalCode === "string" ? body.rehearsalCode : null;
      router.push(
        `/p/${slug}/verificar/?t=${encodeURIComponent(e164!)}` +
          (rehearsal ? `&ensayo=${encodeURIComponent(rehearsal)}` : ""),
      );
    } catch {
      setError("No hay conexión. Inténtalo otra vez.");
      setSending(false);
    }
  };

  if (status === "unavailable") {
    return (
      <div className="sg-card">
        <div className="sg-eyebrow" style={{ marginBottom: 6 }}>El registro no está abierto</div>
        <p className="sg-body" style={{ margin: 0 }}>
          Todavía no podemos crear jugadores en este dispositivo. Avísale al personal de
          Chapa.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="sg-field">
        <label htmlFor="phone">Tu WhatsApp</label>
        <input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="656 111 2233"
          inputMode="tel"
          autoComplete="tel"
          maxLength={24}
        />
        {phone.trim() && !e164 ? (
          <span className="sg-error">{ERRORS.bad_phone}</span>
        ) : e164 ? (
          <span className="sg-foot">Te mandamos el código a {formatMxPhone(e164)}</span>
        ) : (
          <span className="sg-foot">
            Tus puntos viven en este número, no en este teléfono. Si cambias de celular,
            los recuperas con él.
          </span>
        )}
      </div>

      {error ? <div className="sg-error">{error}</div> : null}

      <button className="sg-btn" type="submit" disabled={!ready || sending}>
        {sending ? "Enviando…" : "Mandarme el código"}
      </button>

      <p className="sg-foot" style={{ margin: 0 }}>
        Si ya jugaste antes con este número, entras a tu misma cuenta con tus puntos.
        Si es tu primera vez, la creamos al confirmar el código.
      </p>

      {/* Meta does not let an authentication template carry a word of our own —
          the text is fixed and Chapa cannot appear in it. So the warning goes
          here instead: without it the message arrives from an unknown number
          with no context, which is what spam looks like. */}
      <p className="sg-foot" style={{ margin: 0 }}>
        Te llega un WhatsApp con un código de 4 dígitos. Viene de un número que no
        conoces y no dice Chapa — así son los mensajes de verificación de WhatsApp.
      </p>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMxPhone, normalizeMxPhone } from "@/lib/platform/phone";
import { useDeviceSession } from "../useDeviceSession";

/**
 * Two fields, and that is the whole registration.
 *
 * The deck sold it that way — "solo nombre y WhatsApp; sin descargar app y sin
 * contraseñas complicadas" — and the promise is worth keeping literally. No
 * email, because the prize is collected at the counter and an inbox buys the
 * player nothing. No branch either: the branch matters when somebody scans the
 * table QR to check in, which is where it is captured and where it feeds the
 * per-venue numbers. Asking twice for something we only use once is friction
 * charged to every player.
 */

/** What the server can answer, in words a person can act on. */
const ERRORS: Record<string, string> = {
  bad_phone: "Necesitamos 10 dígitos con LADA. Ej. 656 111 2233.",
  too_many_sends:
    "Ya enviamos varios códigos a ese número. Espera una hora e inténtalo de nuevo.",
  not_configured: "Todavía no podemos enviar el código. Avísale al personal de Chapa.",
  send_failed: "No pudimos enviar el WhatsApp. Revisa el número e inténtalo otra vez.",
  already_verified_other:
    "Este dispositivo ya está registrado con otro número. Cámbialo desde tu perfil.",
  no_session: "No pudimos abrir tu sesión. Recarga la página.",
  db_error: "Algo falló de nuestro lado. Inténtalo otra vez.",
};

export function RegisterForm({ slug }: { slug: string }) {
  const router = useRouter();
  const { status, ensure } = useDeviceSession();

  const [alias, setAlias] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Normalised as they type, so the number they see confirmed is the number we
  // will dial. Silently reformatting somebody's phone is how a message goes
  // nowhere; showing it back is how they catch a typo before we send.
  const e164 = normalizeMxPhone(phone);
  const ready = alias.trim().length >= 2 && e164 !== null;

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
        body: JSON.stringify({ action: "start", alias: alias.trim(), phone: e164 }),
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
        <label htmlFor="alias">Cómo quieres aparecer</label>
        <input
          id="alias"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="Tu apodo"
          maxLength={24}
          autoComplete="nickname"
        />
        <span className="sg-foot">
          Es el nombre que ve todo el mundo en el ranking. Lo puedes cambiar después.
        </span>
      </div>

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

// Transactional email for the Carrera de Tickets module, via Resend's REST API.
//
// Same contract as lib/mundial/email.ts: every sender is env-gated, so a
// missing RESEND_API_KEY logs and returns false instead of failing the upload
// or the approval that triggered it. A participant never loses a reward
// because an email bounced.
//
// Transactional only. Marketing goes on a separate consent and a separate
// sender — mixing them is a CAN-SPAM problem, not a style preference.

import { formatUsdCents, type Locale } from "./config";

const FROM = process.env.EMAIL_FROM ?? "Supergana <onboarding@resend.dev>";

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://supergana.fun";

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[tickets email] RESEND_API_KEY missing — skipped "${subject}" to ${to}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!res.ok) {
      console.error(`[tickets email] send failed (${res.status}): ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[tickets email] send threw", e);
    return false;
  }
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );

interface Shell {
  campaignName: string;
  campaignSlug: string;
  locale: Locale;
  title: string;
  body: string;
  cta?: { label: string; path: string };
}

const wrap = ({ campaignName, campaignSlug, locale, title, body, cta }: Shell) => {
  const link = `${siteUrl()}/c/${campaignSlug}/`;
  const foot =
    locale === "es"
      ? `Recibes este correo porque participas en ${escapeHtml(campaignName)}. Es un mensaje de servicio sobre tu ticket, no publicidad.`
      : `You're getting this because you entered ${escapeHtml(campaignName)}. This is a service message about your receipt, not marketing.`;
  return `
  <div style="font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #0A0A0A;">
    <div style="background:#FAF7F0; border:3px solid #0A0A0A; border-radius:16px; padding:28px;">
      <div style="font-size:12px; letter-spacing:0.14em; text-transform:uppercase; font-weight:700; opacity:0.6;">
        ${escapeHtml(campaignName)}
      </div>
      <h1 style="font-size:24px; margin:10px 0 14px; line-height:1.15;">${title}</h1>
      ${body}
      ${
        cta
          ? `<p style="margin:24px 0 0;">
               <a href="${link}${cta.path}" style="background:#FFD93D; color:#0A0A0A; padding:14px 24px;
                 border:3px solid #0A0A0A; border-radius:12px; text-decoration:none;
                 font-weight:800; display:inline-block;">${cta.label}</a>
             </p>`
          : ""
      }
      <p style="margin-top:28px; font-size:12px; line-height:1.5; opacity:0.65;">${foot}</p>
    </div>
  </div>`;
};

interface Recipient {
  to: string;
  firstName: string;
  locale: Locale;
  campaignName: string;
  campaignSlug: string;
}

/** Sent the moment a receipt lands, so the 48h clock is visible to the person waiting. */
export async function sendReceiptReceived(r: Recipient, slaHours: number) {
  const es = r.locale === "es";
  return sendEmail(
    r.to,
    es ? "Recibimos tu ticket 🧾" : "We got your receipt 🧾",
    wrap({
      ...r,
      title: es
        ? `Recibimos tu ticket, ${escapeHtml(r.firstName)}`
        : `We got your receipt, ${escapeHtml(r.firstName)}`,
      body: es
        ? `<p style="line-height:1.55;">Tu ticket está en revisión. Te escribimos con el resultado en menos de <b>${slaHours} horas</b>.</p>
           <p style="line-height:1.55; font-size:14px;">No necesitas hacer nada más. Si la foto no se lee bien, te pediremos una nueva.</p>`
        : `<p style="line-height:1.55;">Your receipt is in review. We'll email you the result in under <b>${slaHours} hours</b>.</p>
           <p style="line-height:1.55; font-size:14px;">Nothing else to do. If the photo isn't readable we'll ask for a new one.</p>`,
      cta: { label: es ? "Ver mi panel" : "See my panel", path: "panel/" },
    }),
  );
}

export async function sendReceiptApproved(r: Recipient, rewardCents: number) {
  const es = r.locale === "es";
  const amount = formatUsdCents(rewardCents, r.locale);
  return sendEmail(
    r.to,
    es ? `¡Ticket aprobado! Tu recompensa de ${amount} va en camino` : `Receipt approved! Your ${amount} reward is on the way`,
    wrap({
      ...r,
      title: es ? "¡Tu ticket fue aprobado!" : "Your receipt was approved!",
      body: es
        ? `<p style="line-height:1.55;">Validamos tu compra. Tu recompensa digital de <b>${amount}</b> va en camino a este mismo correo.</p>
           <p style="line-height:1.55; font-size:14px;">Si no la ves en unos minutos, revisa spam o promociones antes de escribirnos.</p>`
        : `<p style="line-height:1.55;">Your purchase checks out. Your <b>${amount}</b> digital reward is on its way to this address.</p>
           <p style="line-height:1.55; font-size:14px;">If it doesn't show up in a few minutes, check spam or promotions before writing to us.</p>`,
      cta: { label: es ? "Ver mi panel" : "See my panel", path: "panel/" },
    }),
  );
}

export async function sendReceiptNeedsNewImage(r: Recipient, reason: string | null) {
  const es = r.locale === "es";
  return sendEmail(
    r.to,
    es ? "Necesitamos una foto nueva de tu ticket" : "We need a new photo of your receipt",
    wrap({
      ...r,
      title: es ? "Necesitamos una foto nueva" : "We need a new photo",
      body: es
        ? `<p style="line-height:1.55;">No pudimos validar tu ticket con la imagen que subiste.</p>
           ${reason ? `<p style="line-height:1.55;"><b>Qué falta:</b> ${escapeHtml(reason)}</p>` : ""}
           <p style="line-height:1.55; font-size:14px;">Sube el ticket completo, sobre una superficie plana y sin sombras. Tu lugar no se pierde.</p>`
        : `<p style="line-height:1.55;">We couldn't validate your receipt from the image you uploaded.</p>
           ${reason ? `<p style="line-height:1.55;"><b>What's missing:</b> ${escapeHtml(reason)}</p>` : ""}
           <p style="line-height:1.55; font-size:14px;">Upload the full receipt on a flat surface, no shadows. You don't lose your spot.</p>`,
      cta: { label: es ? "Subir foto nueva" : "Upload a new photo", path: "subir/" },
    }),
  );
}

export async function sendReceiptRejected(r: Recipient, reason: string | null) {
  const es = r.locale === "es";
  return sendEmail(
    r.to,
    es ? "Sobre tu ticket" : "About your receipt",
    wrap({
      ...r,
      title: es ? "No pudimos aprobar este ticket" : "We couldn't approve this receipt",
      body: es
        ? `${reason ? `<p style="line-height:1.55;"><b>Motivo:</b> ${escapeHtml(reason)}</p>` : ""}
           <p style="line-height:1.55; font-size:14px;">Si crees que hubo un error, responde a este correo con la foto del ticket y lo revisamos otra vez.</p>`
        : `${reason ? `<p style="line-height:1.55;"><b>Reason:</b> ${escapeHtml(reason)}</p>` : ""}
           <p style="line-height:1.55; font-size:14px;">If you think this is a mistake, reply to this email with the receipt photo and we'll take another look.</p>`,
    }),
  );
}

/**
 * The verification code that unlocks the payout. The subject says why it's
 * worth opening: this is the one email standing between the person and $20.
 */
export async function sendEmailVerification(r: Recipient, code: string) {
  const es = r.locale === "es";
  return sendEmail(
    r.to,
    es ? `Tu código para recibir tu recompensa: ${code}` : `Your code to receive your reward: ${code}`,
    wrap({
      ...r,
      title: es ? "Confirma tu correo" : "Confirm your email",
      body: es
        ? `<p style="line-height:1.55;">Tu recompensa se envía a este correo. Escribe este código en tu panel para confirmar que es tuyo:</p>
           <p style="font-size:34px; font-weight:800; letter-spacing:0.18em; margin:18px 0;">${escapeHtml(code)}</p>
           <p style="line-height:1.55; font-size:14px;">El código vence en 30 minutos. Si no pediste esto, ignora este correo.</p>`
        : `<p style="line-height:1.55;">Your reward is delivered to this address. Enter this code in your panel to confirm it's yours:</p>
           <p style="font-size:34px; font-weight:800; letter-spacing:0.18em; margin:18px 0;">${escapeHtml(code)}</p>
           <p style="line-height:1.55; font-size:14px;">The code expires in 30 minutes. If you didn't request this, ignore this email.</p>`,
      cta: { label: es ? "Ir a mi panel" : "Go to my panel", path: "panel/" },
    }),
  );
}

/** Sent when an operator marks the reward as actually delivered. */
export async function sendRewardSent(r: Recipient, rewardCents: number, ref: string | null) {
  const es = r.locale === "es";
  const amount = formatUsdCents(rewardCents, r.locale);
  return sendEmail(
    r.to,
    es ? `Tu recompensa de ${amount} fue enviada` : `Your ${amount} reward has been sent`,
    wrap({
      ...r,
      title: es ? "Tu recompensa fue enviada" : "Your reward has been sent",
      body: es
        ? `<p style="line-height:1.55;">Enviamos tu recompensa digital de <b>${amount}</b> a este correo.</p>
           ${ref ? `<p style="line-height:1.55; font-size:13px; opacity:0.75;">Referencia: ${escapeHtml(ref)}</p>` : ""}`
        : `<p style="line-height:1.55;">We sent your <b>${amount}</b> digital reward to this address.</p>
           ${ref ? `<p style="line-height:1.55; font-size:13px; opacity:0.75;">Reference: ${escapeHtml(ref)}</p>` : ""}`,
    }),
  );
}

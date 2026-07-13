// Transactional email via Resend's REST API (no SDK needed). Every sender is
// env-gated: without RESEND_API_KEY the campaign still works, we just skip
// the email and log it, so a missing key can never break payment or submit.

import { CAMPAIGN, formatUsd, STAGE_LABELS, type Stage } from "./config";
import { teamById } from "./teams";
import { finalEndingLabel, finalStarLabel, topScorerLabel } from "./players";
import type { MundialAnswers } from "./schema";

const FROM = process.env.EMAIL_FROM ?? "Supergana <onboarding@resend.dev>";

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[mundial email] RESEND_API_KEY missing — skipped "${subject}" to ${to}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    console.error(`[mundial email] send failed (${res.status}): ${await res.text()}`);
    return false;
  }
  return true;
}

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://supergana.fun";

const wrap = (inner: string) => `
  <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0A0A0A;">
    <div style="background:#FAF7F0; border:3px solid #0A0A0A; border-radius:16px; padding:28px;">
      ${inner}
      <p style="margin-top:28px; font-size:13px; opacity:0.7;">
        ${CAMPAIGN.name} · El ${Math.round(CAMPAIGN.donationShare * 100)}% de lo recaudado
        se destina a la causa de Rotary. Gracias por participar. 💛
      </p>
    </div>
  </div>`;

/** Sent when a payment is confirmed: contains the secret link to fill the quiniela. */
export async function sendTicketEmail(to: string, ticketId: string): Promise<boolean> {
  const link = `${siteUrl()}/mundial/quiniela/?ticket=${ticketId}`;
  return sendEmail(
    to,
    "Tu boleto está listo — llena tu quiniela del Mundial 🏆",
    wrap(`
      <h1 style="font-size:24px; margin:0 0 12px;">¡Gracias por tu donativo!</h1>
      <p>Tu boleto de ${formatUsd(CAMPAIGN.ticketPriceUsd)} quedó confirmado.
      Este es tu enlace único para llenar la quiniela — guárdalo, es personal:</p>
      <p style="margin:20px 0;">
        <a href="${link}" style="background:#FF4757; color:#FAF7F0; padding:14px 24px;
          border-radius:999px; text-decoration:none; font-weight:bold; display:inline-block;">
          Llenar mi quiniela →
        </a>
      </p>
      <p style="font-size:14px;">Mientras más pronto la llenes, en más etapas compites:
      las quinielas enviadas antes de cada etapa (cuartos, semis, final) participan por el premio de esa etapa.</p>
    `),
  );
}

/** Sent after the quiniela is submitted: full answer summary + rules recap. */
export async function sendEntryConfirmationEmail(
  to: string,
  fullName: string,
  answers: MundialAnswers,
  eligible: Stage[],
): Promise<boolean> {
  const t = (id: string) => {
    const team = teamById(id);
    return team ? `${team.flag} ${team.name}` : id;
  };
  const tb = answers.tiebreakers;
  // Stages the entry didn't compete in were never asked — skip their rows.
  const rows: [string, string][] = [
    ...(answers.qf1 && answers.qf2 && answers.qf3 && answers.qf4 && tb.cuartos
      ? ([
          ["Cuartos 1", t(answers.qf1)],
          ["Cuartos 2", t(answers.qf2)],
          ["Cuartos 3", t(answers.qf3)],
          ["Cuartos 4", t(answers.qf4)],
          ["Marcador Argentina-Suiza", `${tb.cuartos.home} - ${tb.cuartos.away}`],
        ] as [string, string][])
      : []),
    ...(answers.sf1 && answers.sf2 && tb.semis
      ? ([
          ["Finalista lado A", t(answers.sf1)],
          ["Finalista lado B", t(answers.sf2)],
          ["Marcador Semifinal 2", `${tb.semis.home} - ${tb.semis.away}`],
        ] as [string, string][])
      : []),
    ["Campeón", t(answers.champion)],
    ["Marcador de la final", `${tb.final.home} - ${tb.final.away}`],
    ["¿Cómo termina la final?", finalEndingLabel(answers.finalEnding)],
    ["Goleador del torneo", topScorerLabel(answers.topScorer)],
    ["Estrella de la final", finalStarLabel(answers.finalStar)],
  ];
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0; opacity:0.7;">${label}</td>
         <td style="padding:6px 0; font-weight:bold;">${value}</td></tr>`,
    )
    .join("");

  const stages = eligible.map((s) => STAGE_LABELS[s]).join(", ") || "ninguna (llegó tarde)";

  return sendEmail(
    to,
    "¡Tu quiniela quedó registrada! 🎉",
    wrap(`
      <h1 style="font-size:24px; margin:0 0 12px;">¡Tu quiniela quedó registrada, ${fullName}!</h1>
      <p>Gracias por apoyar esta causa. Publicaremos los resultados por etapa
      conforme avance el Mundial. Este es el resumen de tus respuestas:</p>
      <table style="margin:16px 0; font-size:15px;">${rowsHtml}</table>
      <p><strong>Etapas en las que compites:</strong> ${stages}.</p>
      <p style="font-size:14px;">Recuerda: después del envío ya no se pueden editar respuestas.
      El premio de cada etapa se divide entre todos los que atinen; las reglas
      completas están en ${siteUrl()}/mundial/quiniela/.</p>
    `),
  );
}

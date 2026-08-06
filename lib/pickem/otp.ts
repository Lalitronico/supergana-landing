// The code we send to a phone, and how it gets there.
//
// Server only — it hashes secrets and reads env. The delivery channel is behind
// an interface on purpose: the WhatsApp Business account this programme will
// send from does not exist yet (Meta business verification takes days and had
// not been started when this was written), and none of the rest of the flow
// should have to wait for it. In development the code goes to the log; when the
// account is ready, `MetaSender` is the only thing that changes.

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/** Rules from the handoff, all of them cost-shaped rather than security-shaped. */
export const OTP = {
  /** Four digits: what the demo tested with the client. Six adds friction
      without adding real security at this risk level — the search space that
      matters is the one the attempt limit defines, not the one the alphabet
      does. */
  digits: 4,
  /** Long enough for WhatsApp to be slow, short enough not to be reusable. */
  ttlMinutes: 10,
  /** Per code. Burning them kills the code, never the account: locking somebody
      out of an eighteen-week season over four typos is worse than what it
      prevents. */
  maxAttempts: 5,
  /** Per number per hour. Every resend is a Meta conversation billed to the
      client, so this is their money, not our patience. */
  maxResendsPerHour: 3,
} as const;

export const newCode = (): string =>
  String(randomInt(0, 10 ** OTP.digits)).padStart(OTP.digits, "0");

/**
 * Hashed with the participant's id as salt.
 *
 * A bare sha256 of four digits is ten thousand hashes — a rainbow table
 * somebody could build during the OTP's ten-minute life. Salting per
 * participant means the table has to be rebuilt for every player, which for a
 * secret this short is the difference that matters. The real defence is still
 * the five-attempt limit; this is so that a leaked table of hashes is not a
 * leaked table of codes.
 */
export const hashCode = (code: string, participantId: string): string =>
  createHash("sha256").update(`${participantId}:${code}`).digest("hex");

/** Constant-time compare, so a wrong code cannot be found one digit at a time. */
export const codeMatches = (code: string, participantId: string, hash: string): boolean => {
  const a = Buffer.from(hashCode(code, participantId), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export interface SendResult {
  ok: boolean;
  /** Machine code for the route to translate. Never includes the code itself. */
  error?: "not_configured" | "send_failed";
}

export interface CodeSender {
  readonly name: string;
  send(phoneE164: string, code: string): Promise<SendResult>;
}

/**
 * Development sender: writes the code to the server log.
 *
 * It logs rather than returning the code, and that distinction is the whole
 * point. The demo showed the code on screen because it had no integration, and
 * a screen that can show you the code is a screen that can show it to anybody
 * who guesses a phone number. This one is visible to whoever can read the
 * server's output, which in production is nobody with a browser — and the
 * production sender is chosen by `codeSender()` below, not by a flag somebody
 * could flip.
 */
class LogSender implements CodeSender {
  readonly name = "log";
  async send(phoneE164: string, code: string): Promise<SendResult> {
    console.warn(
      `[pickem] OTP para ${phoneE164}: ${code} — emisor de desarrollo, no envía WhatsApp`,
    );
    return { ok: true };
  }
}

/**
 * WhatsApp Cloud API, once the programme has an account to send from.
 *
 * Meta's authentication templates carry FIXED text: "<CODE> is your
 * verification code", plus an optional security notice and an expiry warning.
 * Nothing about Chapa can appear in the message, which is why the screen that
 * triggers this has to tell the player a code is coming and roughly what it
 * will look like — otherwise it arrives from an unknown number as a message
 * with no context, which is indistinguishable from spam.
 */
class MetaSender implements CodeSender {
  readonly name = "meta";

  constructor(
    private readonly token: string,
    private readonly phoneNumberId: string,
    private readonly template: string,
    private readonly language: string,
  ) {}

  async send(phoneE164: string, code: string): Promise<SendResult> {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phoneE164.replace(/^\+/, ""),
            type: "template",
            template: {
              name: this.template,
              language: { code: this.language },
              components: [
                { type: "body", parameters: [{ type: "text", text: code }] },
                // The copy-code button repeats the code as its parameter. Meta
                // requires it on authentication templates that have one, and
                // rejects the send outright if it is missing.
                {
                  type: "button",
                  sub_type: "url",
                  index: "0",
                  parameters: [{ type: "text", text: code }],
                },
              ],
            },
          }),
        },
      );

      if (!res.ok) {
        // The body can echo the template parameters, which are the code. Log
        // the status and nothing else.
        console.error(`[pickem] WhatsApp send failed: ${res.status}`);
        return { ok: false, error: "send_failed" };
      }
      return { ok: true };
    } catch (err) {
      console.error("[pickem] WhatsApp send threw", err);
      return { ok: false, error: "send_failed" };
    }
  }
}

/**
 * Which sender is in play.
 *
 * Chosen by whether the credentials exist, not by NODE_ENV: a production deploy
 * that is missing them must not silently fall back to writing codes into a log
 * nobody reads while telling players their message is on its way. It refuses
 * instead, and the route turns that into "no pudimos enviar el código".
 *
 * The log sender is only reachable in development.
 */
export const codeSender = (): CodeSender | null => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_OTP_TEMPLATE;
  const language = process.env.WHATSAPP_OTP_LANGUAGE ?? "es_MX";

  if (token && phoneNumberId && template) {
    return new MetaSender(token, phoneNumberId, template, language);
  }
  if (process.env.NODE_ENV !== "production") return new LogSender();
  return null;
};

// The code we send to a phone, and how it gets there.
//
// Server only — it hashes secrets and reads env. Shared by every module that
// proves a phone number: pick'em signs its players in with one of these, and
// the tickets modules use it wherever a campaign is identified by phone. There
// is one WhatsApp account for the whole platform, billed per conversation, so
// there is one place that talks to it.
//
// The delivery channel is behind an interface because it once had to be: the
// account did not exist while this was written and none of the rest of the flow
// could wait for Meta's business verification. The account exists now, but the
// seam earned its keep — it is what lets a local dev server put the code on
// screen without a single credential, and what makes `codeSender` the one
// decision about when that is allowed.
//
// MERGE CONTRACT. This file is the port of `lib/pickem/otp.ts`, which still
// exists on the unmerged `modulo-pickem` branch. When that branch lands, the
// merge DELETES `lib/pickem/otp.ts` and `lib/pickem/otp.test.ts` and repoints
// their two importers — `app/api/pickem/[programa]/verify/route.ts` and the
// test — at `@/lib/platform/otp`. The signatures here are deliberately
// call-compatible with that file so the repoint is an import line and nothing
// else. Nothing else of pick'em belongs in `lib/platform/`.

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
 * Hashed with a caller-chosen salt.
 *
 * A bare sha256 of four digits is ten thousand hashes — a rainbow table
 * somebody could build during the OTP's ten-minute life. Salting means the
 * table has to be rebuilt for every recipient, which for a secret this short is
 * the difference that matters. The real defence is still the five-attempt
 * limit; this is so that a leaked table of hashes is not a leaked table of
 * codes.
 *
 * WHAT THE SALT HAS TO BE: unique per recipient, and known at both `start` and
 * `confirm` without trusting anything the caller typed. Pick'em uses the
 * participant's id, because the player row exists before the code is sent.
 * Tickets uses `${campaignId}:${phoneE164}`, because there it is a NUMBER being
 * proven and no participant exists yet — creating one per number somebody typed
 * would fill the review queue with ghosts.
 */
export const hashCode = (code: string, salt: string): string =>
  createHash("sha256").update(`${salt}:${code}`).digest("hex");

/** Constant-time compare, so a wrong code cannot be found one digit at a time. */
export const codeMatches = (code: string, salt: string, hash: string): boolean => {
  const a = Buffer.from(hashCode(code, salt), "hex");
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
  /**
   * True when this sender cannot actually deliver anything, so the screen has
   * to show the code instead. Only ever true outside production — see
   * `codeSender`. The route reads this rather than sniffing the environment
   * itself, so there is one place that decides.
   */
  readonly revealsCode: boolean;
  send(phoneE164: string, code: string): Promise<SendResult>;
}

/**
 * Rehearsal sender: delivers nothing and says so.
 *
 * Written when there was no WhatsApp account to send from, and kept now that
 * there is one, because what it really serves is the laptop: a dev server with
 * no credentials can walk the whole sign-in flow without spending a single
 * conversation of the client's money. Rather than fail registration, this hands
 * the code back for the screen to display under an explicit label.
 *
 * That IS the thing every comment in this file says must not happen, so read
 * why it is allowed here and nowhere else: `codeSender` will not build one of
 * these in production, and it takes TWO independent conditions to reach it —
 * an env var somebody sets deliberately, AND a deployment environment that is
 * not production. A flag alone cannot do it. And wherever the Meta credentials
 * are present — every Vercel environment, since 2026-08-19 — this class is
 * unreachable regardless, because credentials win before the flag is read.
 */
class RehearsalSender implements CodeSender {
  readonly name = "rehearsal";
  readonly revealsCode = true;
  // Takes no code, deliberately. It goes to the screen, and writing it to a log
  // as well would be a second copy in a place nobody is watching.
  async send(phoneE164: string): Promise<SendResult> {
    console.warn(`[otp] modo ensayo — código para ${phoneE164} mostrado en pantalla`);
    return { ok: true };
  }
}

/**
 * WhatsApp Cloud API. Live since 2026-08-19.
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
  readonly revealsCode = false;

  // Plain fields rather than constructor parameter properties: those need a
  // real TypeScript transform, and `node --test --experimental-strip-types`
  // only strips. Keeping this module loadable by the test runner is worth four
  // lines, because what it tests is when a verification code may reach a screen.
  private readonly token: string;
  private readonly phoneNumberId: string;
  private readonly template: string;
  private readonly language: string;

  constructor(token: string, phoneNumberId: string, template: string, language: string) {
    this.token = token;
    this.phoneNumberId = phoneNumberId;
    this.template = template;
    this.language = language;
  }

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
        console.error(`[otp] WhatsApp send failed: ${res.status}`);
        return { ok: false, error: "send_failed" };
      }
      return { ok: true };
    } catch (err) {
      console.error("[otp] WhatsApp send threw", err);
      return { ok: false, error: "send_failed" };
    }
  }
}

/**
 * Which sender is in play.
 *
 * Credentials win, always. A production deploy that is missing them must not
 * silently fall back to something that cannot deliver while telling players
 * their message is on its way — it refuses, and the route turns that into "no
 * pudimos enviar el código".
 *
 * The rehearsal sender needs all three of these to be true:
 *
 *   1. No WhatsApp credentials, so nothing real is being displaced.
 *   2. `OTP_REHEARSAL=1` (or the older `PICKEM_REHEARSAL_OTP=1`, still read so
 *      that the pick'em branch's own .env keeps working after the merge), which
 *      somebody has to set on purpose.
 *   3. The deployment is not production — either a local dev server, or a
 *      Vercel environment that reports itself as preview or development.
 *
 * Condition 3 is the one that matters, because it is not ours to fake: Vercel
 * sets VERCEL_ENV, and on the production deployment it says "production" no
 * matter what else is configured. So the flag being left on by accident cannot
 * put codes on screen where real players are.
 */
export const codeSender = (): CodeSender | null => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_OTP_TEMPLATE;
  const language = process.env.WHATSAPP_OTP_LANGUAGE ?? "es_MX";

  if (token && phoneNumberId && template) {
    return new MetaSender(token, phoneNumberId, template, language);
  }

  const isProductionDeploy =
    process.env.VERCEL_ENV === "production" ||
    (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production");

  if (isProductionDeploy) return null;
  const rehearsalFlag =
    process.env.OTP_REHEARSAL === "1" || process.env.PICKEM_REHEARSAL_OTP === "1";
  if (process.env.NODE_ENV !== "production" || rehearsalFlag) {
    return new RehearsalSender();
  }
  return null;
};

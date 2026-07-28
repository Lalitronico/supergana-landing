import { createHash, randomInt } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveParticipant } from "@/lib/tickets/access";
import { getCampaign, isVisible } from "@/lib/tickets/campaigns";
import { emailConfigured, sendEmailVerification } from "@/lib/tickets/email";

export const runtime = "nodejs";

/**
 * Verify the participant's email — the reward's delivery channel.
 *
 * Sign-up sends nothing (the wall was moved off the door on purpose), so this
 * is where an address is finally proven real: a 6-digit code mailed on demand,
 * typed back in the panel. The payout route refuses to mark a reward sent
 * until `participants.email_verified_at` is set, which only happens here.
 *
 * Without a body `code`, sends (or re-sends, after a cooldown) the code.
 * With one, checks it. The hash lives in `email_verifications`, a table no
 * participant can read — their own row would hand them a 1e6-guess crack.
 */

const bodySchema = z.object({
  code: z.string().regex(/^\d{6}$/).optional(),
});

const COOLDOWN_MS = 60 * 1000;
const EXPIRY_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Participant id in the hash input acts as a salt: two people with the same
// code the same minute don't share a hash.
const hashCode = (code: string, participantId: string) =>
  createHash("sha256").update(`${participantId}:${code}`).digest("hex");

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campana: string }> },
) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign || !isVisible(campaign)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ctx = await resolveParticipant(campaign.id);
  if (!ctx) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  if (!ctx.participant) {
    return NextResponse.json({ error: "profile_required" }, { status: 409 });
  }
  const participant = ctx.participant;

  if (participant.email_verified_at) {
    return NextResponse.json({ ok: true, verified: true });
  }

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    // An empty body is a legitimate "send me a code".
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: pending } = await db
    .from("email_verifications")
    .select("code_hash, sent_at, expires_at, attempts")
    .eq("participant_id", participant.id)
    .maybeSingle<{
      code_hash: string;
      sent_at: string;
      expires_at: string;
      attempts: number;
    }>();

  // ---- send / resend ------------------------------------------------------
  if (!parsed.data.code) {
    if (pending && Date.now() - new Date(pending.sent_at).getTime() < COOLDOWN_MS) {
      return NextResponse.json({ error: "cooldown" }, { status: 429 });
    }

    // randomInt, not Math.random: the code IS the credential here.
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const { error: storeError } = await db.from("email_verifications").upsert({
      participant_id: participant.id,
      code_hash: hashCode(code, participant.id),
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + EXPIRY_MS).toISOString(),
      attempts: 0,
    });
    if (storeError) {
      console.error("[tickets verify-email] store failed", storeError);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    if (!emailConfigured()) {
      // Local reality: without RESEND_API_KEY nothing can be delivered, and a
      // code nobody can read is a dead end. The server log is the dev inbox.
      console.warn(
        `[tickets verify-email] RESEND_API_KEY missing — code for ${ctx.email}: ${code}`,
      );
    } else {
      await sendEmailVerification(
        {
          to: ctx.email,
          firstName: participant.first_name,
          locale: participant.locale,
          campaignName: campaign.name,
          campaignSlug: campaign.slug,
        },
        code,
      );
    }

    return NextResponse.json({ ok: true, sent: true });
  }

  // ---- confirm ------------------------------------------------------------
  if (!pending || Date.now() > new Date(pending.expires_at).getTime()) {
    return NextResponse.json({ error: "code_expired" }, { status: 410 });
  }
  if (pending.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  if (hashCode(parsed.data.code, participant.id) !== pending.code_hash) {
    // Counted before answering, so a wrong guess always costs one of the 5.
    await db
      .from("email_verifications")
      .update({ attempts: pending.attempts + 1 })
      .eq("participant_id", participant.id);
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }

  const { error: verifyError } = await db
    .from("participants")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", participant.id);
  if (verifyError) {
    console.error("[tickets verify-email] verify write failed", verifyError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  await db.from("email_verifications").delete().eq("participant_id", participant.id);

  return NextResponse.json({ ok: true, verified: true });
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/supabase/route";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getProgram, isVisible } from "@/lib/pickem/program";
import { normalizeMxPhone } from "@/lib/platform/phone";
import { codeMatches, codeSender, hashCode, newCode, OTP } from "@/lib/pickem/otp";

export const runtime = "nodejs";

/**
 * Proving a phone number, which in this module is proving who you are.
 *
 * `start` creates or finds the player and sends a code. `confirm` checks it,
 * stamps the number verified and links the calling device to the player.
 *
 * WHY VERIFICATION IS NOT OPTIONAL. Without it, one person opens five accounts
 * on five numbers they do not own and multiplies their chances at eighteen
 * weeks of real prizes; and anybody can register somebody else's number and
 * take their points. The second is worse than the first, because the damage is
 * not the prize — it is that the leaderboard stops being believable, and the
 * leaderboard is the product.
 *
 * THE CODE NEVER LEAVES THE SERVER. Not in a response, not in a log line that
 * production can reach. The demo showed it on screen because it had no
 * integration; that is labelled there and does not survive into this.
 */

const startSchema = z.object({
  action: z.literal("start"),
  alias: z.string().trim().min(2).max(24),
  phone: z.string().trim().min(6).max(24),
});

const confirmSchema = z.object({
  action: z.literal("confirm"),
  phone: z.string().trim().min(6).max(24),
  code: z.string().trim().regex(/^\d{4}$/),
});

const bodySchema = z.discriminatedUnion("action", [startSchema, confirmSchema]);

interface PendingRow {
  participant_id: string;
  code_hash: string;
  sent_at: string;
  expires_at: string;
  attempts: number;
  resends: number;
  resend_window_started_at: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ programa: string }> },
) {
  const { programa } = await params;
  const program = await getProgram(programa);
  if (!program || !isVisible(program)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // The anonymous session is the device. It is what a later `confirm` binds the
  // player to, so without one there is nothing to bind and no point sending a
  // code somebody could not then use.
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  // Normalised before anything touches the database, so the five ways a Mexican
  // number gets typed collapse to one row rather than five players.
  const phone = normalizeMxPhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "bad_phone" }, { status: 400 });

  const db = supabaseAdmin();

  return parsed.data.action === "start"
    ? start(db, program.campaignId, user.id, phone, parsed.data.alias)
    : confirm(db, program.campaignId, user.id, phone, parsed.data.code);
}

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

type Db = ReturnType<typeof supabaseAdmin>;

const start = async (
  db: Db,
  campaignId: string,
  authUserId: string,
  phone: string,
  alias: string,
) => {
  const { data: existing } = await db
    .from("participants")
    .select("id, alias, phone_verified_at")
    .eq("campaign_id", campaignId)
    .eq("phone", phone)
    .maybeSingle<{ id: string; alias: string | null; phone_verified_at: string | null }>();

  let participantId: string;

  if (existing) {
    // Somebody already holds this number. That somebody may be this person on a
    // new phone, or it may not be — and there is no way to tell from here, so
    // nothing about the row changes. The alias they just typed is ignored: it
    // is not theirs to rename until the code proves the number is.
    participantId = existing.id;
  } else {
    // This session may already have an unverified row from a mistyped number.
    // Reuse it rather than insert: `unique (campaign_id, auth_user_id)` would
    // refuse the second one, and a player who goes back to fix a digit should
    // not hit a wall for it.
    const { data: mine } = await db
      .from("participants")
      .select("id, phone_verified_at")
      .eq("campaign_id", campaignId)
      .eq("auth_user_id", authUserId)
      .maybeSingle<{ id: string; phone_verified_at: string | null }>();

    if (mine && !mine.phone_verified_at) {
      const { error } = await db
        .from("participants")
        .update({ phone, alias })
        .eq("id", mine.id);
      if (error) {
        console.error("[pickem verify] retarget failed", error);
        return NextResponse.json({ error: "db_error" }, { status: 500 });
      }
      participantId = mine.id;
    } else if (mine) {
      // A verified row on this session, and the number typed is a different
      // one. Changing the number of a verified player is a profile operation
      // with its own confirmation, not something a registration form does.
      return NextResponse.json({ error: "already_verified_other" }, { status: 409 });
    } else {
      const { data: created, error } = await db
        .from("participants")
        .insert({ campaign_id: campaignId, auth_user_id: authUserId, alias, phone })
        .select("id")
        .single<{ id: string }>();
      if (error || !created) {
        console.error("[pickem verify] create failed", error);
        return NextResponse.json({ error: "db_error" }, { status: 500 });
      }
      participantId = created.id;
    }
  }

  const { data: pending } = await db
    .from("phone_verifications")
    .select("*")
    .eq("participant_id", participantId)
    .maybeSingle<PendingRow>();

  // Resends are counted in a rolling hour, not forever: somebody who loses
  // their phone in week 9 has a real reason to ask again. Within the hour the
  // cap holds, because every send is a WhatsApp conversation billed to the
  // client.
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const windowOpen =
    pending && new Date(pending.resend_window_started_at).getTime() > hourAgo;
  if (windowOpen && pending.resends >= OTP.maxResendsPerHour) {
    return NextResponse.json({ error: "too_many_sends" }, { status: 429 });
  }

  const sender = codeSender();
  if (!sender) {
    // No credentials in production. Refusing beats storing a code nobody can
    // receive and telling the player it is on its way.
    console.error("[pickem verify] no code sender configured");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const code = newCode();
  const { error: storeError } = await db.from("phone_verifications").upsert({
    participant_id: participantId,
    code_hash: hashCode(code, participantId),
    sent_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + OTP.ttlMinutes * 60 * 1000).toISOString(),
    // Attempts reset with the code: the limit protects one code from being
    // guessed, and this is a different code.
    attempts: 0,
    resends: windowOpen ? pending.resends + 1 : 0,
    resend_window_started_at: windowOpen
      ? pending.resend_window_started_at
      : new Date().toISOString(),
  });
  if (storeError) {
    console.error("[pickem verify] store failed", storeError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const sent = await sender.send(phone, code);
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error ?? "send_failed" }, { status: 502 });
  }

  // Deliberately says nothing about whether the number was already registered.
  // "This number is taken" turns the form into a way to find out who plays.
  //
  // `rehearsalCode` is the one exception to "the code never leaves the server",
  // and it is the sender that decides — not this route, and not the browser.
  // See `codeSender`: it cannot build a revealing sender on a production
  // deployment, and Vercel's own VERCEL_ENV is what makes that true rather than
  // a flag we control.
  return NextResponse.json({
    ok: true,
    sent: true,
    ...(sender.revealsCode ? { rehearsalCode: code } : {}),
  });
};

// ---------------------------------------------------------------------------
// confirm
// ---------------------------------------------------------------------------

const confirm = async (
  db: Db,
  campaignId: string,
  authUserId: string,
  phone: string,
  code: string,
) => {
  const { data: participant } = await db
    .from("participants")
    .select("id, alias")
    .eq("campaign_id", campaignId)
    .eq("phone", phone)
    .maybeSingle<{ id: string; alias: string | null }>();

  // No row for this number means no code was ever issued for it. Same answer as
  // a wrong code, so the endpoint cannot be used to test which numbers play.
  if (!participant) {
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }

  const { data: pending } = await db
    .from("phone_verifications")
    .select("*")
    .eq("participant_id", participant.id)
    .maybeSingle<PendingRow>();

  if (!pending || Date.now() > new Date(pending.expires_at).getTime()) {
    return NextResponse.json({ error: "code_expired" }, { status: 410 });
  }
  if (pending.attempts >= OTP.maxAttempts) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  if (!codeMatches(code, participant.id, pending.code_hash)) {
    // Counted before answering, so a wrong guess always costs one of the five.
    await db
      .from("phone_verifications")
      .update({ attempts: pending.attempts + 1 })
      .eq("participant_id", participant.id);
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }

  // The number is proven. Three writes, and the order matters: stamp first so
  // that a failure after this leaves a verified player who can retry the link,
  // rather than a linked device on an unverified number that cannot play.
  const { error: stampError } = await db
    .from("participants")
    .update({ phone_verified_at: new Date().toISOString(), auth_user_id: authUserId })
    .eq("id", participant.id);
  if (stampError) {
    console.error("[pickem verify] stamp failed", stampError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // This device now holds the identity — and so do the others that proved it
  // before. A person with a phone and a tablet is a person, not an attack, so
  // linking here never unlinks anything.
  const { error: linkError } = await db.from("participant_devices").upsert(
    {
      campaign_id: campaignId,
      auth_user_id: authUserId,
      participant_id: participant.id,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "campaign_id,auth_user_id" },
  );
  if (linkError) {
    console.error("[pickem verify] device link failed", linkError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // The code is spent. Leaving it would leave a second valid guess window open
  // for no reason.
  await db.from("phone_verifications").delete().eq("participant_id", participant.id);

  return NextResponse.json({ ok: true, verified: true, alias: participant.alias });
};

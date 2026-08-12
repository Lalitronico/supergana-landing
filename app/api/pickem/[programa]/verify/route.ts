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
 * WHO A DEVICE IS. `participant_devices` — never `participants.auth_user_id`.
 * 0021 built that table because a pick'em player signs in anonymously, so a
 * second device is a second `auth.users` row for the same person, and it wrote
 * down that the column names only the device that CREATED the row. Every reader
 * honours that: `resolvePlayer`, `pickem_participant`, and through it every RPC
 * a player can call. This route used to be the one writer that did not, and 0029
 * has the whole story of what that cost. The rule now: the column is set once,
 * at insert, and never moved.
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

/**
 * `alias` is OPTIONAL, and that is the whole phone-first flow.
 *
 * Registration used to ask for a nickname and a number on the same screen, so a
 * player who had been playing since jornada 1 was made to invent a name again
 * before they could get back in — and the form could not say "you already have
 * one", because saying so would turn it into a way to find out which numbers
 * play. One door for both, and the door is the number.
 *
 * The nickname is asked for AFTER the code, where knowing whether this is a new
 * player is legitimate: the number has been proven to belong to whoever is
 * holding the phone.
 */
const startSchema = z.object({
  action: z.literal("start"),
  alias: z.string().trim().min(2).max(24).optional(),
  phone: z.string().trim().min(6).max(24),
});

const confirmSchema = z.object({
  action: z.literal("confirm"),
  phone: z.string().trim().min(6).max(24),
  code: z.string().trim().regex(/^\d{4}$/),
});

/** Naming yourself, once the number is yours. Carries no phone: the device's
 *  own link says who is asking, and accepting a number here would be accepting
 *  a claim instead of a proof. */
const aliasSchema = z.object({
  action: z.literal("alias"),
  alias: z.string().trim().min(2).max(24),
});

const bodySchema = z.discriminatedUnion("action", [
  startSchema,
  confirmSchema,
  aliasSchema,
]);

/**
 * What a pick'em participant is called before they have said.
 *
 * 0021's trigger refuses to insert one without an alias — the leaderboard has
 * to be able to name every row — so the phone-first flow needs something to put
 * there between "sent the code" and "chose a nickname". It matches the fallback
 * `resolvePlayer` already uses for a null alias, so a player who never picks a
 * name is called the same thing everywhere.
 *
 * It is NOT the signal of a new player: `phone_verified_at === null` is. A
 * returning player could perfectly well have left themselves named Jugador.
 */
const PLACEHOLDER_ALIAS = "Jugador";

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

  const db = supabaseAdmin();

  // Naming yourself carries no number: the device's link is the identity, and
  // it exists only because a code already came back. Handled before the phone
  // is normalised because there is none to normalise.
  if (parsed.data.action === "alias") {
    return rename(db, program.campaignId, user.id, parsed.data.alias);
  }

  // Normalised before anything touches the database, so the five ways a Mexican
  // number gets typed collapse to one row rather than five players.
  const phone = normalizeMxPhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "bad_phone" }, { status: 400 });

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
  /** Absent in the phone-first flow, which is every flow the UI drives now. */
  alias: string | undefined,
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
    //
    // Note what is NOT checked here: whether this device already belongs to
    // another player. It does not need to be. Proving a number does not rename
    // or re-number anybody — it moves THIS device's link (see `confirm`), and
    // the player it leaves keeps their row, their points and their other
    // devices, because the points live on the number.
    participantId = existing.id;
  } else {
    // A number nobody holds, so this device needs a row of its own to hang the
    // code on. It may already have one from a mistyped digit — reuse it rather
    // than insert, because `unique (campaign_id, auth_user_id)` allows a device
    // exactly one row per campaign and a player who goes back to fix a digit
    // should not hit a wall for it.
    //
    // Read by `auth_user_id` deliberately, and it is the ONLY question that
    // column answers: "which row did this device create". Not "who is this
    // device" — that is `participant_devices`, and confusing the two is what
    // 0029 fixes.
    const { data: mine } = await db
      .from("participants")
      .select("id, phone_verified_at")
      .eq("campaign_id", campaignId)
      .eq("auth_user_id", authUserId)
      .maybeSingle<{ id: string; phone_verified_at: string | null }>();

    if (mine && !mine.phone_verified_at) {
      // Only the number is being corrected. The alias is written only if one
      // came with the request — overwriting a name with `undefined` would
      // violate 0021's trigger, and overwriting it with the placeholder would
      // silently un-name somebody who had already chosen.
      const { error } = await db
        .from("participants")
        .update(alias ? { phone, alias } : { phone })
        .eq("id", mine.id);
      if (error) {
        console.error("[pickem verify] retarget failed", error);
        return NextResponse.json({ error: "db_error" }, { status: 500 });
      }
      participantId = mine.id;
    } else if (mine) {
      // This device already created a verified player, and the number typed is
      // a brand new one that nobody holds. `unique (campaign_id, auth_user_id)`
      // physically forbids a second row for this device, so there is nowhere to
      // put the new player — the refusal is the schema's, not a policy.
      //
      // It is narrower than it looks: a number that ALREADY exists is handled
      // above and re-points the device, so recovering an account on a shared
      // phone still works. What cannot happen on this device is INVENTING a
      // second account. Changing the number of a verified player is a profile
      // operation with its own confirmation, not something a registration form
      // does.
      return NextResponse.json({ error: "already_verified_other" }, { status: 409 });
    } else {
      const { data: created, error } = await db
        .from("participants")
        .insert({
          campaign_id: campaignId,
          auth_user_id: authUserId,
          // 0021's trigger refuses a pick'em participant with no alias, and in
          // the phone-first flow there is no alias yet. The placeholder holds
          // the row until the code comes back and the player names themselves.
          alias: alias ?? PLACEHOLDER_ALIAS,
          phone,
        })
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
    .select("id, alias, phone_verified_at")
    .eq("campaign_id", campaignId)
    .eq("phone", phone)
    .maybeSingle<{ id: string; alias: string | null; phone_verified_at: string | null }>();

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

  /**
   * Whether this is somebody's first time in, read BEFORE the link runs.
   *
   * `pickem_link_device` is what stamps `phone_verified_at`, so asking after it
   * would always answer "returning". The row's alias is not the signal either:
   * the phone-first flow inserts `Jugador` as a placeholder, and a returning
   * player may have left themselves called exactly that.
   *
   * Answering this at all is only legitimate here. `start` may not hint that a
   * number exists — that would turn the form into a way to find out who plays —
   * but a code that came back proves the number belongs to whoever is holding
   * the phone, and greeting them by name is what any account does.
   */
  const isNew = participant.phone_verified_at === null;

  // The number is proven. Stamping it verified and pointing this device at the
  // player are ONE fact, so they are one transaction — `pickem_link_device`
  // (0029). This used to be two writes here, and the second one was reachable
  // only if the first succeeded:
  //
  //     update participants set phone_verified_at = now(),
  //                             auth_user_id = <this device>
  //
  // That second column is what broke it. `unique (campaign_id, auth_user_id)`
  // allows a device one participant row per campaign, so as soon as this device
  // had created a player of its own, moving the column onto a DIFFERENT player
  // raised 23505 — and the route returned 500 without ever reaching the link.
  // The device went on pointing at the previous player, which is what put
  // somebody else's picks on the board of a person who had just proved their
  // own number. The column is not ours to move: 0021 says it names the device
  // that created the row, and `participant_devices` is who is asking.
  //
  // The link re-points THIS device and touches no other, so a person with a
  // phone and a tablet keeps both — 0021's invariant, and the reason this is an
  // upsert on (campaign_id, auth_user_id) rather than a delete and an insert.
  const { error: linkError } = await db.rpc("pickem_link_device", {
    p_campaign: campaignId,
    p_auth_user: authUserId,
    p_participant: participant.id,
  });
  if (linkError) {
    console.error("[pickem verify] device link failed", linkError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // The code is spent. Leaving it would leave a second valid guess window open
  // for no reason.
  await db.from("phone_verifications").delete().eq("participant_id", participant.id);

  return NextResponse.json({
    ok: true,
    verified: true,
    alias: participant.alias,
    isNew,
  });
};

// ---------------------------------------------------------------------------
// alias
// ---------------------------------------------------------------------------

/**
 * Naming yourself, after the number proved it is yours.
 *
 * WHO IS ASKING. `participant_devices`, never `participants.auth_user_id` —
 * 0021's invariant, honoured by every reader in the module. The column on
 * `participants` names only the device that CREATED the row, which after a
 * phone change is not the device asking; 0029 has what confusing the two cost.
 *
 * WHY THERE IS NO MIGRATION. There is no RPC for this and there does not need
 * to be one: `confirm` already updates rows through `supabaseAdmin()`, and the
 * authorisation this needs is exactly what the device link already answers.
 * Adding a function to the database to do one UPDATE would be ceremony.
 *
 * The unverified are refused. Nothing in the module may be written by a device
 * that has not answered a code, and the leaderboard's names are no exception.
 */
const rename = async (
  db: Db,
  campaignId: string,
  authUserId: string,
  alias: string,
) => {
  const { data: link } = await db
    .from("participant_devices")
    .select("participant_id, participants(phone_verified_at)")
    .eq("campaign_id", campaignId)
    .eq("auth_user_id", authUserId)
    .maybeSingle<{
      participant_id: string;
      participants: { phone_verified_at: string | null } | null;
    }>();

  if (!link?.participants) {
    return NextResponse.json({ error: "not_a_participant" }, { status: 403 });
  }
  if (!link.participants.phone_verified_at) {
    return NextResponse.json({ error: "not_verified" }, { status: 403 });
  }

  const { error } = await db
    .from("participants")
    .update({ alias })
    .eq("id", link.participant_id);
  if (error) {
    console.error("[pickem verify] alias update failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alias });
};

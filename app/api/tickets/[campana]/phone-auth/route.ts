import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseRoute } from "@/lib/supabase/route";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCampaign, isVisible } from "@/lib/tickets/campaigns";
import { normalizeMxPhone } from "@/lib/platform/phone";
import { phoneAuthEmail } from "@/lib/platform/identity";
import { codeMatches, codeSender, hashCode, newCode, OTP } from "@/lib/platform/otp";
import type { Campaign } from "@/lib/tickets/config";

export const runtime = "nodejs";

/**
 * Signing in with a WhatsApp number, for campaigns whose identity channel is
 * the phone (0030).
 *
 * `start` sends a code to a number. `confirm` checks it and mints a real
 * Supabase session for the account that number owns. Two actions, one route,
 * because they are two halves of one fact and splitting them would put the
 * rate-limit bookkeeping in two places.
 *
 * WHY A PHONE AT ALL. Carrera Alaska pays no reward to an email address — its
 * prizes are collected over a counter against a redemption code — so the
 * address it used to demand bought nothing and cost everything: this project
 * has no SMTP of its own, Supabase Free caps the built-in sender at two
 * messages an hour, and a password nobody can reset is not a door.
 *
 * WHAT THIS ROUTE MAY NOT DO, in order of how much it would cost:
 *
 *  1. **Reveal whether a number is registered.** `start` answers identically
 *     either way. Saying "that number already has an account" turns a public
 *     form into a way to find out who plays, and this is a promotion where the
 *     leaderboard is published.
 *  2. **Let the code reach the browser.** Not in a body, not in a log a
 *     production deployment can reach. The single exception is `rehearsalCode`,
 *     and it is `codeSender()` that decides — see the three conditions there,
 *     one of which is Vercel's own VERCEL_ENV and therefore not ours to fake.
 *  3. **Create a participant.** `start` is reachable by anyone with a phone
 *     keypad; a row per number typed would fill the review console with people
 *     who never signed up. The participant is created by the profile step
 *     (`/me` POST), which stays this module's only writer of `participants`.
 *
 * WHO A DEVICE IS. `participants.auth_user_id`, exactly as before — unlike
 * pick'em, which needed `participant_devices` because it signs players in
 * ANONYMOUSLY and a second device there is a second `auth.users` row for one
 * person. Here the account is derived from the number itself
 * (`phoneAuthEmail`), so a second device lands on the same `auth.users` row and
 * `unique (campaign_id, auth_user_id)` keeps meaning what it always meant.
 */

const startSchema = z.object({
  action: z.literal("start"),
  phone: z.string().trim().min(6).max(24),
});

const confirmSchema = z.object({
  action: z.literal("confirm"),
  phone: z.string().trim().min(6).max(24),
  // Four digits, matching `OTP.digits` and the template the client tested with.
  // NOT six: the six-to-ten-digit code elsewhere in this module is Supabase's
  // email OTP, whose length is a project setting. Hardcoding either length in
  // the wrong screen has cost a bug here before.
  code: z.string().trim().regex(/^\d{4}$/),
});

const bodySchema = z.discriminatedUnion("action", [startSchema, confirmSchema]);

/**
 * Salted per campaign AND per number.
 *
 * A hash keyed on the number alone would verify across tenants: the same person
 * asking Alaska and a future campaign for a code in the same minute would end
 * up with one of them opening the other. The campaign id costs nothing and
 * closes it.
 */
const saltFor = (campaignId: string, phone: string) => `${campaignId}:${phone}`;

interface PendingRow {
  code_hash: string;
  expires_at: string;
  attempts: number;
  resends: number;
  resend_window_started_at: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campana: string }> },
) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign || !isVisible(campaign)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // A campaign that identifies by email has no phone door, and a 404 says so
  // without announcing that the route exists elsewhere. Checked before the body
  // is read: there is nothing here to validate for Ticket al Tanque.
  if (campaign.config.auth.channel !== "phone") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  // Normalised before anything touches the database, so the five ways a Mexican
  // number gets typed collapse to one row rather than five accounts. It refuses
  // non-Mexican country codes on purpose — in a Ciudad Juárez campaign somebody
  // will type an El Paso number, and the screen has to say why rather than
  // silently turning a +1 into a Mexican number belonging to a stranger.
  const phone = normalizeMxPhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "bad_phone" }, { status: 400 });

  return parsed.data.action === "start"
    ? start(campaign, phone)
    : confirm(campaign, phone, parsed.data.code);
}

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

const start = async (campaign: Campaign, phone: string) => {
  const db = supabaseAdmin();

  /**
   * The spend breaker.
   *
   * This endpoint takes no session — it cannot, since proving the number is how
   * you get one — and every send is a WhatsApp conversation billed to the
   * tenant. The per-number limit below stops one person resending; this stops a
   * script walking the dialling plan, which is the failure that arrives as a
   * bill nobody was watching for.
   *
   * A lower bound, deliberately: there is one row per number, so a number that
   * resent three times counts once. It is a circuit breaker, not an accountant.
   * If it ever trips, that is an incident and the log line says so.
   */
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recent } = await db
    .from("phone_login_codes")
    .select("phone", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .gt("sent_at", hourAgo);

  if ((recent ?? 0) >= campaign.config.auth.maxSendsPerHour) {
    console.error(
      `[tickets phone-auth] send breaker tripped for ${campaign.slug}: ` +
        `${recent} numbers in the last hour, limit ${campaign.config.auth.maxSendsPerHour}`,
    );
    return NextResponse.json({ error: "too_many_sends" }, { status: 429 });
  }

  const { data: pending } = await db
    .from("phone_login_codes")
    .select("code_hash, expires_at, attempts, resends, resend_window_started_at")
    .eq("campaign_id", campaign.id)
    .eq("phone", phone)
    .maybeSingle<PendingRow>();

  // Resends counted in a rolling hour rather than forever: somebody who changes
  // phones in week six has a real reason to ask again. Within the hour the cap
  // holds, because within the hour it is almost always the same person pressing
  // the button twice.
  const windowOpen =
    pending && new Date(pending.resend_window_started_at).getTime() > Date.now() - 60 * 60 * 1000;
  if (windowOpen && pending.resends >= OTP.maxResendsPerHour) {
    return NextResponse.json({ error: "too_many_sends" }, { status: 429 });
  }

  const sender = codeSender();
  if (!sender) {
    // Credentials missing on a production deployment. Refusing beats storing a
    // code nobody can receive while telling somebody it is on its way.
    console.error("[tickets phone-auth] no code sender configured");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const code = newCode();
  const { error: storeError } = await db.from("phone_login_codes").upsert(
    {
      campaign_id: campaign.id,
      phone,
      code_hash: hashCode(code, saltFor(campaign.id, phone)),
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + OTP.ttlMinutes * 60 * 1000).toISOString(),
      // Attempts reset with the code: the limit protects one code from being
      // guessed, and this is a different code.
      attempts: 0,
      resends: windowOpen ? pending.resends + 1 : 0,
      resend_window_started_at: windowOpen
        ? pending.resend_window_started_at
        : new Date().toISOString(),
    },
    { onConflict: "campaign_id,phone" },
  );
  if (storeError) {
    console.error("[tickets phone-auth] store failed", storeError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const sent = await sender.send(phone, code);
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error ?? "send_failed" }, { status: 502 });
  }

  // Says nothing about whether this number already has an account. See the
  // header: that answer is what turns the form into a directory.
  return NextResponse.json({
    ok: true,
    sent: true,
    ...(sender.revealsCode ? { rehearsalCode: code } : {}),
  });
};

// ---------------------------------------------------------------------------
// confirm
// ---------------------------------------------------------------------------

const confirm = async (campaign: Campaign, phone: string, code: string) => {
  const db = supabaseAdmin();

  const { data: pending } = await db
    .from("phone_login_codes")
    .select("code_hash, expires_at, attempts, resends, resend_window_started_at")
    .eq("campaign_id", campaign.id)
    .eq("phone", phone)
    .maybeSingle<PendingRow>();

  // No row and an expired row get the same answer, so this cannot be used to
  // find out which numbers were recently sent a code.
  if (!pending || Date.now() > new Date(pending.expires_at).getTime()) {
    return NextResponse.json({ error: "code_expired" }, { status: 410 });
  }
  if (pending.attempts >= OTP.maxAttempts) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  if (!codeMatches(code, saltFor(campaign.id, phone), pending.code_hash)) {
    // Counted before answering, so a wrong guess always costs one of the five
    // even if the caller hangs up on the response.
    await db
      .from("phone_login_codes")
      .update({ attempts: pending.attempts + 1 })
      .eq("campaign_id", campaign.id)
      .eq("phone", phone);
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }

  const session = await mintSession(phone);
  if (!session) {
    return NextResponse.json({ error: "session_failed" }, { status: 500 });
  }

  // The code is spent. Leaving it would leave a second valid guess window open
  // for no reason, and leave the number sitting in a table it no longer needs
  // to be in.
  await db
    .from("phone_login_codes")
    .delete()
    .eq("campaign_id", campaign.id)
    .eq("phone", phone);

  /**
   * Whether this is somebody's first time in.
   *
   * Read AFTER the session exists, by the account it belongs to rather than by
   * the number — the number is what was proven, the account is what holds the
   * points. A returning participant has a row here; a new one does not, and the
   * screen sends them to the profile form.
   *
   * Answering this at all is legitimate only here. `start` may not hint that a
   * number exists; a code that came back proves the number belongs to whoever
   * is holding the phone, and greeting them by name is what any account does.
   */
  const { data: participant } = await db
    .from("participants")
    .select("id, alias, first_name")
    .eq("campaign_id", campaign.id)
    .eq("auth_user_id", session.userId)
    .maybeSingle<{ id: string; alias: string | null; first_name: string | null }>();

  return NextResponse.json({
    ok: true,
    verified: true,
    isNew: !participant,
    name: participant?.alias ?? participant?.first_name ?? null,
  });
};

// ---------------------------------------------------------------------------
// The session
// ---------------------------------------------------------------------------

/**
 * Turning a proven number into a signed-in browser.
 *
 * `participants.auth_user_id` is NOT NULL and every RLS policy in this module
 * is written against `auth.uid()`, so a phone identity still needs a row in
 * `auth.users` and a real Supabase session. That is the point: nothing about
 * the database's idea of who you are changes because the front door did.
 *
 * Three calls, all server-side:
 *
 *   createUser   — idempotent by design. The address is derived from the number
 *                  (`phoneAuthEmail`), so "create or find" is one call plus a
 *                  swallowed duplicate error, and never `admin.listUsers`,
 *                  which is O(n) paginated and gets slower with every account.
 *   generateLink — mints a token WITHOUT sending anything, and returns the user
 *                  it belongs to, which is where the uid comes from. Verified
 *                  against this project on 2026-08-20: six in a row, ~500ms
 *                  each, no `over_email_send_rate_limit`. That mattered, because
 *                  the project's mail budget is two an hour.
 *   verifyOtp    — on the COOKIE client, so the session is written to cookies
 *                  by the server. No token, no access token and no refresh
 *                  token ever reaches the browser in a response body.
 */
const mintSession = async (phone: string): Promise<{ userId: string } | null> => {
  const email = phoneAuthEmail(phone);
  const admin = supabaseAdmin();

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    // Nothing is ever sent to this address — it is derived plumbing, not a way
    // to reach anyone — so confirming it here is stating a fact, not skipping a
    // check. What was actually proven is the number, one call ago.
    email_confirm: true,
  });
  if (createError && !/already been registered|already exists/i.test(createError.message)) {
    console.error("[tickets phone-auth] createUser failed", createError.message);
    return null;
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link?.properties?.hashed_token || !link.user?.id) {
    console.error("[tickets phone-auth] generateLink failed", linkError?.message);
    return null;
  }

  const cookieClient = await supabaseRoute();
  const { data: verified, error: verifyError } = await cookieClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError || !verified?.session) {
    // Never log the error object whole: it can echo the token back.
    console.error("[tickets phone-auth] verifyOtp failed", verifyError?.message);
    return null;
  }

  return { userId: link.user.id };
};

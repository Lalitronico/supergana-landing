import { productLabel } from "@/lib/tickets/productLabel";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveParticipant } from "@/lib/tickets/access";
import { getCampaign, isVisible, mayRehearse } from "@/lib/tickets/campaigns";
import { profileSchemaFor } from "@/lib/tickets/schema";
import { parseAvatarChoice } from "@/lib/tickets/avatar";
import { POINTS_SPEND_KINDS } from "@/lib/tickets/config";
import type { ReceiptRow, RewardRow } from "@/lib/tickets/schema";

export const runtime = "nodejs";

/** Everything the participant's own panel shows. Requires a verified session. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ campana: string }> },
) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign || !isVisible(campaign)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ctx = await resolveParticipant(campaign.id);
  if (!ctx) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  // Who may submit against an unpublished campaign. Same predicate the receipts
  // route enforces, so this screen cannot offer an upload the write would refuse.
  const canRehearse = await mayRehearse(campaign);

  if (!ctx.participant) {
    return NextResponse.json({
      email: ctx.email,
      // The identity of the ACCOUNT, which on a phone campaign is the only
      // thing there is to show. Distinct from `participant.phone`, a profile
      // field that on those campaigns is written from this and never asked for.
      phone: ctx.phone,
      participant: null,
      receipts: [],
      rewards: [],
      points: 0,
      pointsEarned: 0,
      canRehearse,
    });
  }

  const db = supabaseAdmin();
  const [receipts, rewards, points] = await Promise.all([
    db
      .from("receipts")
      .select("id, status, submitted_at, store_name, purchase_date, total_cents, eligible_cents, reject_reason, reviewed_at")
      .eq("participant_id", ctx.participant.id)
      .order("submitted_at", { ascending: false }),
    db
      .from("rewards")
      .select("id, amount_cents, status, created_at, sent_at, receipt_id")
      .eq("participant_id", ctx.participant.id)
      .order("created_at", { ascending: false }),
    db
      .from("points_entries")
      .select("points, kind, receipt_id")
      .eq("participant_id", ctx.participant.id),
  ]);

  // What was read on the participant's OWN approved receipts, for the
  // celebration ("we found Jarritos Tamarindo on your ticket"). Only the
  // catalog product names go out — the same names the public campaign endpoint
  // already lists — never the raw line text or amounts, which are the
  // receipt's personal contents. Scoped by receipt ids that were just read for
  // this participant, so there is no way to ask for someone else's.
  const receiptRows = (receipts.data ?? []) as Partial<ReceiptRow>[];
  const productsByReceipt = new Map<string, string[]>();
  // Whether the automatic read has FINISHED for each receipt — one boolean, not
  // what it read or why a ticket went to the queue. The participant's screen
  // uses it to stop pretending to scan the moment the gate has had its say,
  // instead of waiting out a timer.
  const readDone = new Set<string>();
  const allIds = receiptRows.map((r) => r.id).filter((id): id is string => Boolean(id));
  if (allIds.length > 0) {
    const { data: extractions } = await db
      .from("receipt_extractions")
      .select("receipt_id")
      .in("receipt_id", allIds);
    for (const row of (extractions ?? []) as { receipt_id: string }[]) readDone.add(row.receipt_id);
  }
  const approvedIds = receiptRows.filter((r) => r.status === "approved" && r.id).map((r) => r.id!);
  if (approvedIds.length > 0) {
    const { data: items } = await db
      .from("receipt_items")
      .select("receipt_id, products(brand, name, size)")
      .in("receipt_id", approvedIds);
    for (const row of (items ?? []) as unknown as {
      receipt_id: string;
      products: { brand: string; name: string; size: string | null } | null;
    }[]) {
      if (!row.products) continue;
      const label = productLabel(row.products);
      const list = productsByReceipt.get(row.receipt_id) ?? [];
      if (!list.includes(label)) list.push(label);
      productsByReceipt.set(row.receipt_id, list);
    }
  }

  // The balance is a SUM over the ledger, computed here and nowhere else the
  // client can see — a mutable balance column is how history and total drift.
  const ledger = (points.data ?? []) as { points: number; kind: string; receipt_id: string | null }[];
  // Points each receipt credited, so the history can say "+150 pts" beside it.
  const pointsByReceipt = new Map<string, number>();
  for (const e of ledger) {
    if (e.kind === "purchase" && e.receipt_id) {
      pointsByReceipt.set(e.receipt_id, (pointsByReceipt.get(e.receipt_id) ?? 0) + e.points);
    }
  }
  const pointsBalance = ledger.reduce((sum, e) => sum + e.points, 0);
  // The race total the leaderboard ranks on: everything except spending, so
  // redeeming a prize costs balance and never position.
  const pointsEarned = ledger
    .filter((e) => !POINTS_SPEND_KINDS.includes(e.kind as (typeof POINTS_SPEND_KINDS)[number]))
    .reduce((sum, e) => sum + e.points, 0);

  return NextResponse.json({
    email: ctx.email,
    participant: {
      id: ctx.participant.id,
      firstName: ctx.participant.first_name,
      lastName: ctx.participant.last_name,
      alias: ctx.participant.alias,
      zip: ctx.participant.zip,
      state: ctx.participant.state,
      // Coalesced rather than read straight: the select is `*`, so before
      // migration 0015 runs against a project the key is simply absent.
      phone: ctx.participant.phone ?? null,
      locale: ctx.participant.locale,
      // Absent on a project where 0043 has not run; the cast id the participant
      // picked, drawn client-side from the theme.
      avatar: (ctx.participant as { avatar?: string | null }).avatar ?? null,
      emailVerified: ctx.participant.email_verified_at !== null,
    },
    receipts: receiptRows.map((r) => ({
      ...r,
      points: r.id ? (pointsByReceipt.get(r.id) ?? null) : null,
      read_done: r.id ? readDone.has(r.id) : false,
      products: r.id ? (productsByReceipt.get(r.id) ?? []) : [],
    })),
    rewards: (rewards.data ?? []) as Partial<RewardRow>[],
    points: pointsBalance,
    pointsEarned,
    canRehearse,
  });
}

/**
 * Creates or updates the campaign profile and records consent.
 *
 * Consents are inserted, never updated: `consents` is an append-only log, so
 * re-submitting the form leaves a trail of what was accepted and when. That is
 * the only way to answer "which version of the rules did this person agree to"
 * after the rules change mid-campaign.
 */
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  // The same `profile_fields` the form was drawn from. The browser decides
  // which boxes to show; this decides what is acceptable, and it reads the
  // campaign row rather than trusting anything in the request.
  const { profileFields } = campaign.config;

  const parsed = profileSchemaFor(profileFields).safeParse(body);
  if (!parsed.success) {
    const failed = (field: string) => parsed.error.issues.some((i) => i.path[0] === field);
    const consentIssue = failed("acceptedAgeState") || failed("acceptedRules");
    return NextResponse.json(
      {
        error: failed("zip")
          ? "bad_zip"
          : failed("phone")
            ? "bad_phone"
            : consentIssue
              ? "consents_required"
              : "bad_body",
      },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // An empty eligible-states list means "not restricted yet" (the campaign is
  // still waiting on Novamex's answer), not "nobody qualifies". A campaign
  // that stopped asking for a state cannot restrict by one either — the check
  // is skipped rather than failing everyone with a null state.
  const { eligibleStates } = campaign.config;
  if (
    profileFields.state !== "off" &&
    eligibleStates.length > 0 &&
    (input.state === null || !eligibleStates.includes(input.state))
  ) {
    return NextResponse.json({ error: "state_not_eligible" }, { status: 403 });
  }

  // "Elige tu personaje": validated against THIS campaign's cast, never trusted.
  // Not in the profile schema because it is optional decoration, not consent or
  // identity; absent leaves the stored choice untouched.
  const avatarChoice = parseAvatarChoice(
    campaign.theme.cast,
    body && typeof body === "object" ? (body as Record<string, unknown>).avatar : undefined,
  );
  if (avatarChoice.kind === "invalid") {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  // The upsert names only the columns this campaign asks for. Two reasons: a
  // field the campaign switched off stops being written without erasing what
  // was already collected from people who answered it, and a campaign that
  // never asks for a phone keeps saving profiles on a project where migration
  // 0015 has not run yet.
  const profile: Record<string, unknown> = {
    campaign_id: campaign.id,
    auth_user_id: ctx.userId,
    first_name: input.firstName,
    last_name: input.lastName,
    alias: input.alias,
    locale: input.locale,
  };

  /**
   * The credential is written from the SESSION, never from the body.
   *
   * On a phone campaign the number already came back from a code, and that
   * proof is the account. Taking a number out of the request here would let
   * somebody sign in as one number and register as another — the identity
   * quietly coming apart one profile save at a time. `parseCampaignConfig`
   * forces `profileFields.phone` to "off" on these campaigns so the form does
   * not even draw the box; this is the server agreeing with it rather than
   * trusting it.
   *
   * `phone_verified_at` is stamped on first write only. It records when the
   * number answered, and re-saving a profile is not that happening again.
   */
  if (campaign.config.auth.channel === "phone") {
    if (!ctx.phone) {
      // A session on this campaign that carries no phone identity has no
      // business creating a participant: it is a leftover email account from
      // before the channel changed, or a staff session wandering in.
      return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
    }
    profile.phone = ctx.phone;
    if (!ctx.participant?.phone_verified_at) {
      profile.phone_verified_at = new Date().toISOString();
    }
  } else {
    // An email campaign cannot have a null address here: `auth.channel` is
    // 'email', so `resolveParticipant` returned the real one from the session.
    if (!ctx.email) {
      return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
    }
    profile.email = ctx.email.toLowerCase();
    if (profileFields.phone !== "off") profile.phone = input.phone;
  }
  if (avatarChoice.kind === "set") profile.avatar = avatarChoice.id;
  if (avatarChoice.kind === "clear") profile.avatar = null;
  if (profileFields.zip !== "off") profile.zip = input.zip;
  if (profileFields.state !== "off") profile.state = input.state;

  const db = supabaseAdmin();
  const { data: participant, error } = await db
    .from("participants")
    .upsert(profile, { onConflict: "campaign_id,auth_user_id" })
    // `phone` is read back rather than echoed from the input: on a phone
    // campaign the input never carried one, and the profile screen shows the
    // number the session proved. Reading it means the response says what the
    // row says, instead of what the request wished.
    .select("id, first_name, last_name, alias, zip, state, phone, locale")
    .single();

  if (error || !participant) {
    console.error("[tickets me] participant upsert failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const userAgent = req.headers.get("user-agent");

  const { error: consentError } = await db.from("consents").insert([
    {
      participant_id: participant.id,
      kind: "age_state",
      version: campaign.config.rulesVersion,
      accepted: input.acceptedAgeState,
      ip,
      user_agent: userAgent,
    },
    {
      participant_id: participant.id,
      kind: "official_rules",
      version: campaign.config.rulesVersion,
      accepted: input.acceptedRules,
      ip,
      user_agent: userAgent,
    },
    {
      participant_id: participant.id,
      kind: "marketing",
      version: campaign.config.rulesVersion,
      accepted: input.acceptedMarketing,
      ip,
      user_agent: userAgent,
    },
  ]);

  if (consentError) {
    // The profile without its consent record is worse than no profile: it
    // looks like someone agreed to rules we cannot prove they saw.
    console.error("[tickets me] consent insert failed", consentError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({
    participant: {
      id: participant.id,
      firstName: participant.first_name,
      lastName: participant.last_name,
      alias: participant.alias,
      zip: participant.zip,
      state: participant.state,
      // Re-read from the row, not echoed from the input. It used to be echoed,
      // which was fine while the only phone was one somebody typed — but on a
      // campaign identified by phone the input carries none and the number
      // comes from the session, so echoing would answer `null` about a row that
      // holds the participant's actual number.
      phone: (participant as { phone?: string | null }).phone ?? null,
      locale: participant.locale,
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveParticipant } from "@/lib/tickets/access";
import { getCampaign, isVisible, mayRehearse } from "@/lib/tickets/campaigns";
import { profileSchemaFor } from "@/lib/tickets/schema";
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
      .select("points, kind")
      .eq("participant_id", ctx.participant.id),
  ]);

  // The balance is a SUM over the ledger, computed here and nowhere else the
  // client can see — a mutable balance column is how history and total drift.
  const ledger = (points.data ?? []) as { points: number; kind: string }[];
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
      emailVerified: ctx.participant.email_verified_at !== null,
    },
    receipts: (receipts.data ?? []) as Partial<ReceiptRow>[],
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

  // The upsert names only the columns this campaign asks for. Two reasons: a
  // field the campaign switched off stops being written without erasing what
  // was already collected from people who answered it, and a campaign that
  // never asks for a phone keeps saving profiles on a project where migration
  // 0015 has not run yet.
  const profile: Record<string, unknown> = {
    campaign_id: campaign.id,
    auth_user_id: ctx.userId,
    email: ctx.email.toLowerCase(),
    first_name: input.firstName,
    last_name: input.lastName,
    alias: input.alias,
    locale: input.locale,
  };
  if (profileFields.phone !== "off") profile.phone = input.phone;
  if (profileFields.zip !== "off") profile.zip = input.zip;
  if (profileFields.state !== "off") profile.state = input.state;

  const db = supabaseAdmin();
  const { data: participant, error } = await db
    .from("participants")
    .upsert(profile, { onConflict: "campaign_id,auth_user_id" })
    .select("id, first_name, last_name, alias, zip, state, locale")
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
      // Echoed from the validated input rather than re-read: the select above
      // stays literal so it does not name a column that may not exist yet, and
      // what we asked to store is exactly what this request decided.
      phone: input.phone,
      locale: participant.locale,
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveParticipant, resolveStaff } from "@/lib/tickets/access";
import { getCampaign, isVisible } from "@/lib/tickets/campaigns";
import { profileSchema } from "@/lib/tickets/schema";
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

  // Rehearsal mode: a draft campaign accepts receipts from campaign staff, so
  // the client can walk the whole flow before anything is published. Only
  // looked up while drafting — live campaigns never need the extra query.
  const canRehearse =
    campaign.status === "draft" &&
    (await resolveStaff(campaign.id)).kind === "ok";

  if (!ctx.participant) {
    return NextResponse.json({
      email: ctx.email,
      participant: null,
      receipts: [],
      rewards: [],
      points: 0,
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
      .select("points")
      .eq("participant_id", ctx.participant.id),
  ]);

  // The balance is a SUM over the ledger, computed here and nowhere else the
  // client can see — a mutable balance column is how history and total drift.
  const pointsBalance = (points.data ?? []).reduce((sum, e) => sum + e.points, 0);

  return NextResponse.json({
    email: ctx.email,
    participant: {
      id: ctx.participant.id,
      firstName: ctx.participant.first_name,
      lastName: ctx.participant.last_name,
      alias: ctx.participant.alias,
      zip: ctx.participant.zip,
      state: ctx.participant.state,
      locale: ctx.participant.locale,
      emailVerified: ctx.participant.email_verified_at !== null,
    },
    receipts: (receipts.data ?? []) as Partial<ReceiptRow>[],
    rewards: (rewards.data ?? []) as Partial<RewardRow>[],
    points: pointsBalance,
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

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    const zipIssue = parsed.error.issues.some((i) => i.path[0] === "zip");
    const consentIssue = parsed.error.issues.some(
      (i) => i.path[0] === "acceptedAgeState" || i.path[0] === "acceptedRules",
    );
    return NextResponse.json(
      { error: zipIssue ? "bad_zip" : consentIssue ? "consents_required" : "bad_body" },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // An empty eligible-states list means "not restricted yet" (the campaign is
  // still waiting on Novamex's answer), not "nobody qualifies".
  const { eligibleStates } = campaign.config;
  if (eligibleStates.length > 0 && !eligibleStates.includes(input.state)) {
    return NextResponse.json({ error: "state_not_eligible" }, { status: 403 });
  }

  const db = supabaseAdmin();
  const { data: participant, error } = await db
    .from("participants")
    .upsert(
      {
        campaign_id: campaign.id,
        auth_user_id: ctx.userId,
        email: ctx.email.toLowerCase(),
        first_name: input.firstName,
        last_name: input.lastName,
        alias: input.alias,
        zip: input.zip,
        state: input.state,
        locale: input.locale,
      },
      { onConflict: "campaign_id,auth_user_id" },
    )
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
      locale: participant.locale,
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { canPayout, resolveStaff, staffDenialStatus } from "@/lib/tickets/access";
import { getCampaign } from "@/lib/tickets/campaigns";
import { sendRewardSent } from "@/lib/tickets/email";
import { canTransition } from "@/lib/tickets/payouts";
import { payoutSchema, type RewardStatusValue } from "@/lib/tickets/schema";
import type { Locale } from "@/lib/tickets/config";

export const runtime = "nodejs";

interface RewardWithOwner {
  id: string;
  status: RewardStatusValue;
  amount_cents: number;
  external_id: string;
  participants: {
    email: string;
    first_name: string;
    locale: Locale;
    email_verified_at: string | null;
  } | null;
}

/**
 * Moves a reward along its delivery states. v1 delivery is manual, so this is
 * an operator recording what they did — but it is recorded against the same
 * ledger row and the same `external_id` a payout provider would use, which is
 * what makes the switch to an automated provider a configuration change.
 *
 * Cancelling is the only way to give budget back: `tickets_approve_receipt`
 * counts every non-canceled reward against the fund and the weekly quota.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campana: string }> },
) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const access = await resolveStaff(campaign.id);
  if (access.kind !== "ok") {
    return NextResponse.json(
      { error: access.kind },
      { status: staffDenialStatus(access) },
    );
  }
  if (!canPayout(access.staff.role)) {
    return NextResponse.json({ error: "role_cannot_payout" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const parsed = payoutSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad_body" }, { status: 400 });
  const input = parsed.data;

  const db = supabaseAdmin();
  const { data: reward, error: lookupError } = await db
    .from("rewards")
    .select("id, status, amount_cents, external_id, participants(email, first_name, locale, email_verified_at)")
    .eq("id", input.rewardId)
    .eq("campaign_id", campaign.id)
    .maybeSingle<RewardWithOwner>();

  if (lookupError) {
    console.error("[tickets payout] lookup failed", lookupError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!reward) return NextResponse.json({ error: "reward_not_found" }, { status: 404 });

  if (!canTransition(reward.status, input.status)) {
    return NextResponse.json(
      { error: "bad_transition", from: reward.status, to: input.status },
      { status: 409 },
    );
  }

  // The email is the delivery channel and sign-up never proved it (the
  // verification wall sits here, where there's a reward to gain — decision of
  // 2026-07-28). Marking "sent" to an unproven address means a gift card
  // walking into a typo, so the operator gets a refusal, not a warning.
  if (
    (input.status === "sent" || input.status === "delivered") &&
    !reward.participants?.email_verified_at
  ) {
    return NextResponse.json({ error: "email_unverified" }, { status: 409 });
  }

  const { data: moved, error: updateError } = await db
    .from("rewards")
    .update({
      status: input.status,
      provider_ref: input.providerRef ?? undefined,
      note: input.note ?? undefined,
      sent_at:
        input.status === "sent" || input.status === "delivered"
          ? new Date().toISOString()
          : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reward.id)
    // Optimistic guard: if another operator moved this reward between our read
    // and this write, the update matches nothing rather than overwriting them.
    .eq("status", reward.status)
    // …and `.select()` is what makes that guard observable. Without it the
    // no-op is indistinguishable from success: Postgres reports no error for
    // an UPDATE that matched zero rows, so the loser of the race was told
    // `ok: true` and went on to send a second "your reward is on its way".
    // With manual fulfilment that means two operators each believing they own
    // the same gift card.
    .select("id");

  if (updateError) {
    console.error("[tickets payout] update failed", updateError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if ((moved ?? []).length === 0) {
    // Re-read so the console can show what it actually became, rather than
    // making the operator guess who beat them to it.
    const { data: current } = await db
      .from("rewards")
      .select("status")
      .eq("id", reward.id)
      .maybeSingle<{ status: string }>();
    return NextResponse.json(
      { error: "already_moved", from: reward.status, to: input.status, now: current?.status },
      { status: 409 },
    );
  }

  if (input.status === "sent" && reward.participants) {
    sendRewardSent(
      {
        to: reward.participants.email,
        firstName: reward.participants.first_name,
        locale: reward.participants.locale,
        campaignName: campaign.name,
        campaignSlug: campaign.slug,
      },
      reward.amount_cents,
      input.providerRef ?? null,
    ).catch((e) => console.error("[tickets payout] sent email failed", e));
  }

  return NextResponse.json({ ok: true, status: input.status });
}

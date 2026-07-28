import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { canReview, resolveStaff, staffDenialStatus } from "@/lib/tickets/access";
import { getCampaign } from "@/lib/tickets/campaigns";
import {
  sendReceiptApproved,
  sendReceiptNeedsNewImage,
  sendReceiptRejected,
} from "@/lib/tickets/email";
import { approveSchema, reviewSchema } from "@/lib/tickets/schema";
import type { Locale } from "@/lib/tickets/config";

export const runtime = "nodejs";

const bodySchema = z.discriminatedUnion("action", [
  approveSchema.extend({ action: z.literal("approve") }),
  reviewSchema.extend({ action: z.literal("review") }),
]);

// Machine codes raised by tickets_approve_receipt. Anything not in this map is
// an unexpected database failure, not a business rule, and must surface as 500.
const RULE_CODES = new Set([
  "bad_status",
  "below_threshold",
  "eligible_above_total",
  "duplicate_receipt",
  "participant_limit",
  "household_limit",
  "weekly_quota",
  "slots_exhausted",
  "fund_exhausted",
  "receipt_not_found",
  "bad_decision",
]);

interface ReceiptOwner {
  id: string;
  participants: {
    email: string;
    first_name: string;
    locale: Locale;
  } | null;
}

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
  const staff = access.staff;
  if (!canReview(staff.role)) {
    return NextResponse.json({ error: "role_cannot_review" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_body", issues: parsed.error.issues.map((i) => i.path.join(".")) },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const db = supabaseAdmin();

  // The receipt must belong to THIS campaign — a reviewer authorised for one
  // campaign must not be able to decide another's claim by guessing an id.
  const { data: owner, error: ownerError } = await db
    .from("receipts")
    .select("id, participants(email, first_name, locale)")
    .eq("id", body.receiptId)
    .eq("campaign_id", campaign.id)
    .maybeSingle<ReceiptOwner>();

  if (ownerError) {
    console.error("[tickets review] owner lookup failed", ownerError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!owner) return NextResponse.json({ error: "receipt_not_found" }, { status: 404 });

  const recipient = owner.participants
    ? {
        to: owner.participants.email,
        firstName: owner.participants.first_name,
        locale: owner.participants.locale,
        campaignName: campaign.name,
        campaignSlug: campaign.slug,
      }
    : null;

  if (body.action === "approve") {
    const { data, error } = await db.rpc("tickets_approve_receipt", {
      p_receipt_id: body.receiptId,
      p_reviewer: staff.userId,
      p_store_name: body.storeName,
      p_purchase_date: body.purchaseDate,
      p_total_cents: body.totalCents,
      p_eligible_cents: body.eligibleCents,
      p_items: body.items.map((i) => ({
        product_id: i.productId,
        alias_matched: i.aliasMatched,
        line_text: i.lineText,
        amount_cents: i.amountCents,
      })),
      p_note: body.note ?? null,
    });

    if (error) {
      const code = error.message?.trim();
      if (code && RULE_CODES.has(code)) {
        // 409: the request was well formed, the campaign's rules refused it.
        return NextResponse.json({ error: code }, { status: 409 });
      }
      console.error("[tickets review] approve failed", error);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    // Since v2 an approval can carry points and no reward (second receipt,
    // quota gone). The approved email promises "$20 on its way", so it only
    // goes out when that promise is true. A points-only email belongs to the
    // progress-panel step, where there will be a balance worth telling.
    const result = (data ?? {}) as { reward_id?: string | null };
    if (recipient && result.reward_id) {
      sendReceiptApproved(recipient, campaign.config.rewardCents).catch((e) =>
        console.error("[tickets review] approval email failed", e),
      );
    }
    return NextResponse.json({ ok: true, reward: data });
  }

  const { error } = await db.rpc("tickets_review_receipt", {
    p_receipt_id: body.receiptId,
    p_reviewer: staff.userId,
    p_decision: body.decision,
    p_reason: body.reason ?? null,
  });

  if (error) {
    const code = error.message?.trim();
    if (code && RULE_CODES.has(code)) {
      return NextResponse.json({ error: code }, { status: 409 });
    }
    console.error("[tickets review] decision failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Reopening ("in_review") is an internal move — the participant already got
  // the message that matters and does not need a second email about it.
  if (recipient && body.decision === "needs_new_image") {
    sendReceiptNeedsNewImage(recipient, body.reason ?? null).catch((e) =>
      console.error("[tickets review] needs-new-image email failed", e),
    );
  }
  if (recipient && body.decision === "rejected") {
    sendReceiptRejected(recipient, body.reason ?? null).catch((e) =>
      console.error("[tickets review] rejection email failed", e),
    );
  }

  return NextResponse.json({ ok: true, status: body.decision });
}

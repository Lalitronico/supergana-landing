import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveParticipant, resolveStaff } from "@/lib/tickets/access";
import { acceptsReceipts, getCampaign, isVisible } from "@/lib/tickets/campaigns";
import { MAX_RECEIPT_BYTES, RECEIPTS_BUCKET } from "@/lib/tickets/config";
import { sendReceiptReceived } from "@/lib/tickets/email";
import { receiptSubmitSchema } from "@/lib/tickets/schema";

export const runtime = "nodejs";

/**
 * Registers a receipt the browser has already uploaded to Supabase Storage.
 *
 * The image never travels through this function: an 8 MB phone photo would hit
 * Vercel's request body limit. The browser writes straight to the private
 * bucket (constrained by the storage RLS policy to its own folder) and posts
 * the object key here. The server then reads the object back to hash it — a
 * client-computed hash would be worth nothing as a dedupe signal.
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
  if (!acceptsReceipts(campaign)) {
    // Rehearsal mode: staff may submit against a draft campaign so the whole
    // flow can be walked before launch. Draft only — a paused campaign is
    // closed for everyone, staff included: pausing is an operational brake.
    const rehearsal =
      campaign.status === "draft" &&
      (await resolveStaff(campaign.id)).kind === "ok";
    if (!rehearsal) {
      return NextResponse.json({ error: "campaign_closed" }, { status: 409 });
    }
  }

  const ctx = await resolveParticipant(campaign.id);
  if (!ctx) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  if (!ctx.participant) {
    return NextResponse.json({ error: "profile_required" }, { status: 409 });
  }
  const participant = ctx.participant;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const parsed = receiptSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  // The storage policy already scopes writes to the caller's own folder; this
  // re-checks the same thing here so a mismatched key is a clean 403 instead of
  // a confusing "object not found" further down.
  const expectedPrefix = `${campaign.slug}/${ctx.userId}/`;
  const imagePath = parsed.data.imagePath;
  if (!imagePath.startsWith(expectedPrefix) || imagePath.includes("..")) {
    return NextResponse.json({ error: "bad_path" }, { status: 403 });
  }

  const db = supabaseAdmin();

  // One receipt in review at a time keeps the queue honest, but since points
  // (v2) an already-rewarded participant is welcome to keep submitting: every
  // approved receipt earns points, only the welcome reward is once-ever. That
  // skip is decided inside tickets_approve_receipt, not here.
  const { data: openReceipts } = await db
    .from("receipts")
    .select("id")
    .eq("participant_id", participant.id)
    .in("status", ["received", "in_review"])
    .limit(1);

  if ((openReceipts ?? []).length > 0) {
    return NextResponse.json({ error: "receipt_pending" }, { status: 409 });
  }

  const { data: file, error: downloadError } = await db.storage
    .from(RECEIPTS_BUCKET)
    .download(imagePath);

  if (downloadError || !file) {
    console.error("[tickets receipts] object unreadable", imagePath, downloadError);
    return NextResponse.json({ error: "image_missing" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    await db.storage.from(RECEIPTS_BUCKET).remove([imagePath]);
    return NextResponse.json({ error: "image_missing" }, { status: 400 });
  }
  if (bytes.byteLength > MAX_RECEIPT_BYTES) {
    await db.storage.from(RECEIPTS_BUCKET).remove([imagePath]);
    return NextResponse.json({ error: "image_too_large" }, { status: 413 });
  }

  const imageHash = createHash("sha256").update(bytes).digest("hex");

  const { data: receipt, error: insertError } = await db
    .from("receipts")
    .insert({
      campaign_id: campaign.id,
      participant_id: participant.id,
      status: "received",
      image_path: imagePath,
      image_hash: imageHash,
    })
    .select("id, status, submitted_at")
    .single();

  if (insertError) {
    // Unique (campaign_id, image_hash): this exact file was already submitted,
    // by this participant or by someone else. Drop the copy we just stored.
    await db.storage.from(RECEIPTS_BUCKET).remove([imagePath]);
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "duplicate_image" }, { status: 409 });
    }
    console.error("[tickets receipts] insert failed", insertError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Fire-and-forget: a bounced confirmation must not lose the receipt.
  sendReceiptReceived(
    {
      to: participant.email,
      firstName: participant.first_name,
      locale: participant.locale,
      campaignName: campaign.name,
      campaignSlug: campaign.slug,
    },
    campaign.config.reviewSlaHours,
  ).catch((e) => console.error("[tickets receipts] confirmation email failed", e));

  return NextResponse.json({
    receipt: {
      id: receipt.id,
      status: receipt.status,
      submittedAt: receipt.submitted_at,
    },
  });
}

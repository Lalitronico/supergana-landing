import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveStaff, staffDenialStatus } from "@/lib/tickets/access";
import { getCampaign } from "@/lib/tickets/campaigns";
import { RECEIPTS_BUCKET } from "@/lib/tickets/config";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SECONDS = 300;

/**
 * A short-lived signed URL for one receipt image.
 *
 * The bucket is private and the storage policy only lets a participant read
 * their own folder, so staff cannot reach these objects with their own session
 * — the service role mints a URL here instead, per receipt, after checking the
 * receipt belongs to a campaign this reviewer is authorised for. Five minutes
 * is long enough to review a claim and short enough that a URL pasted into a
 * chat stops working.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campana: string }> },
) {
  const { campana } = await params;
  const receiptId = req.nextUrl.searchParams.get("receiptId");
  if (!receiptId) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const campaign = await getCampaign(campana);
  if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const access = await resolveStaff(campaign.id);
  if (access.kind !== "ok") {
    return NextResponse.json(
      { error: access.kind },
      { status: staffDenialStatus(access) },
    );
  }

  const db = supabaseAdmin();
  const { data: receipt, error } = await db
    .from("receipts")
    .select("image_path")
    .eq("id", receiptId)
    .eq("campaign_id", campaign.id)
    .maybeSingle<{ image_path: string }>();

  if (error) {
    console.error("[tickets image] lookup failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!receipt) return NextResponse.json({ error: "receipt_not_found" }, { status: 404 });

  const { data: signed, error: signError } = await db.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(receipt.image_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) {
    console.error("[tickets image] sign failed", signError);
    return NextResponse.json({ error: "sign_failed" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCampaign, getQuotaState, isVisible } from "@/lib/tickets/campaigns";
import { toPublicCampaign } from "@/lib/tickets/config";

export const runtime = "nodejs";

// Public campaign payload for the participant app: everything the home screen
// needs and nothing more. The fund, the eligibility rules and the alias
// dictionary stay server-side — `campaigns` is unreadable by anon/authenticated
// through RLS precisely so this route decides what leaves the building.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ campana: string }> },
) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);

  if (!campaign || !isVisible(campaign)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const db = supabaseAdmin();
  const [{ data: products }, quota] = await Promise.all([
    db
      .from("products")
      .select("brand, name, size")
      .eq("campaign_id", campaign.id)
      .eq("active", true)
      .order("brand"),
    getQuotaState(campaign),
  ]);

  return NextResponse.json({
    campaign: toPublicCampaign(campaign),
    quota: {
      weeklyQuota: quota.weeklyQuota,
      weeklyLeft: quota.weeklyLeft,
      totalLeft: quota.totalLeft,
    },
    products: products ?? [],
  });
}

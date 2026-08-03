import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCampaign, getQuotaState, isVisible } from "@/lib/tickets/campaigns";
import { HomeScreen } from "./HomeScreen";

// The QR landing. Rendered on the server so the shelf-talker scan lands on
// finished copy instead of a spinner — the quota is read here rather than
// fetched from the browser for the same reason.
export default async function CampaignHomePage({
  params,
}: {
  params: Promise<{ campana: string }>;
}) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign || !isVisible(campaign)) notFound();

  const db = supabaseAdmin();
  const [quota, { data: products }] = await Promise.all([
    getQuotaState(campaign),
    db
      .from("products")
      .select("brand, name, size")
      .eq("campaign_id", campaign.id)
      .eq("active", true)
      .order("brand"),
  ]);

  return (
    <HomeScreen
      quota={{
        weeklyQuota: quota.weeklyQuota,
        weeklyLeft: quota.weeklyLeft,
        totalLeft: quota.totalLeft,
      }}
      products={products ?? []}
    />
  );
}

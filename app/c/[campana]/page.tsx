import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCampaign, getQuotaState, isVisible } from "@/lib/tickets/campaigns";
import { mechanicOf } from "@/lib/tickets/config";
import { HomeScreen } from "./HomeScreen";

const NO_QUOTA = { weeklyQuota: 0, weeklyLeft: 0, totalLeft: 0 };

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
  // An accumulation campaign has no reward to ration, so it has no quota to
  // read — and asking for one would only produce the zeros that used to be
  // rendered as "this week's rewards are gone".
  const wantsQuota = mechanicOf(campaign.config) === "threshold";
  const [quota, { data: products }] = await Promise.all([
    wantsQuota ? getQuotaState(campaign) : Promise.resolve(null),
    db
      .from("products")
      .select("brand, name, size")
      .eq("campaign_id", campaign.id)
      .eq("active", true)
      // Name too: the accumulation home lists every size, and an unordered
      // catalogue reshuffles itself between renders.
      .order("brand")
      .order("name"),
  ]);

  return (
    <HomeScreen
      quota={
        quota
          ? {
              weeklyQuota: quota.weeklyQuota,
              weeklyLeft: quota.weeklyLeft,
              totalLeft: quota.totalLeft,
            }
          : NO_QUOTA
      }
      products={products ?? []}
    />
  );
}

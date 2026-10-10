import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCampaign, getQuotaState, isVisible } from "@/lib/tickets/campaigns";
import { mechanicOf } from "@/lib/tickets/config";
import { asAssetUrl } from "@/lib/tickets/theme";
import { HomeScreen } from "./HomeScreen";
import type { TeaserPrize } from "./showcase/PrizeTeaser";

/**
 * The current week's open Drop, as public price-list rows.
 *
 * A Drop is a list of prizes with their prices: nothing personal, and the same
 * rows any participant's store shows. "Current" is the latest open Drop that has
 * already started and is under a week old; older than that and the week has
 * rolled over without a new Drop, so the teaser stays quiet rather than quote
 * last month's shelf. Any failure (tables missing mid-deploy) is an empty list:
 * the home must never break over a teaser.
 */
async function readPrizeTeaser(campaignId: string): Promise<TeaserPrize[]> {
  const db = supabaseAdmin();
  const now = Date.now();
  const { data: drops } = await db
    .from("prize_drops")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "open")
    .lte("week_start", new Date(now).toISOString())
    .gte("week_start", new Date(now - 7 * 86_400_000).toISOString())
    .order("week_start", { ascending: false })
    .limit(1);
  const dropId = drops?.[0]?.id;
  if (!dropId) return [];

  const { data: items } = await db
    .from("prize_drop_items")
    .select("name_es, name_en, points_cost, detail")
    .eq("drop_id", dropId)
    .eq("active", true)
    .gt("inventory", 0)
    .order("points_cost", { ascending: true })
    .limit(6);
  return (items ?? []).map((row) => ({
    nameEs: row.name_es as string,
    nameEn: (row.name_en as string | null) ?? null,
    pointsCost: row.points_cost as number,
    detail: (row.detail as Record<string, unknown> | null) ?? {},
  }));
}

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
  const [quota, { data: products }, prizes] = await Promise.all([
    wantsQuota ? getQuotaState(campaign) : Promise.resolve(null),
    db
      .from("products")
      .select("brand, name, size, image_url")
      .eq("campaign_id", campaign.id)
      .eq("active", true)
      // Name too: the accumulation home lists every size, and an unordered
      // catalogue reshuffles itself between renders.
      .order("brand")
      .order("name"),
    wantsQuota ? Promise.resolve([]) : readPrizeTeaser(campaign.id).catch(() => []),
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
      products={(products ?? []).map((p) => ({
        brand: p.brand,
        name: p.name,
        size: p.size,
        // Validated like every other tenant asset: it ends up in an <img src>.
        imageUrl: asAssetUrl(p.image_url),
      }))}
      prizes={prizes}
    />
  );
}

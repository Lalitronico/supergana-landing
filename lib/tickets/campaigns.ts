// Campaign lookup. Service-role reads: `campaigns` is locked to anon and
// authenticated by RLS, so the config never reaches a browser except through
// the fields an API route chooses to expose.

import { supabaseAdmin } from "@/lib/supabase/server";
import {
  parseCampaignConfig,
  weekStart,
  type Campaign,
  type CampaignStatus,
  type Locale,
} from "./config";
import { parseOrgTheme } from "./theme";

interface CampaignQueryRow {
  id: string;
  slug: string;
  name: string;
  status: CampaignStatus;
  locales: string[];
  config: unknown;
  module: string;
  organizations: { name: string; slug: string; theme: unknown } | null;
}

export const getCampaign = async (slug: string): Promise<Campaign | null> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("campaigns")
    .select(
      "id, slug, name, status, locales, config, module, organizations(name, slug, theme)",
    )
    .eq("slug", slug)
    .eq("module", "tickets")
    .maybeSingle<CampaignQueryRow>();

  if (error) {
    console.error("[tickets] campaign lookup failed", error);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    status: data.status,
    locales: (data.locales ?? ["es"]).filter(
      (l): l is Locale => l === "es" || l === "en",
    ),
    orgName: data.organizations?.name ?? data.name,
    orgSlug: data.organizations?.slug ?? data.slug,
    // A campaign with no organization row is not themeable, which is the same
    // as a campaign whose organization has no theme: the Supergana look.
    theme: parseOrgTheme(data.organizations?.theme),
    config: parseCampaignConfig(data.config),
  };
};

/**
 * A draft campaign still renders — that is how the console and the client
 * preview it before launch — but it must never take a receipt. Only `live`
 * accepts submissions.
 */
export const acceptsReceipts = (campaign: Campaign) => campaign.status === "live";

export const isVisible = (campaign: Campaign) =>
  campaign.status === "live" || campaign.status === "draft" || campaign.status === "paused";

export interface QuotaState {
  weekStart: string;
  weeklyQuota: number;
  weeklyUsed: number;
  weeklyLeft: number;
  totalSlots: number;
  totalUsed: number;
  totalLeft: number;
  fundCents: number;
  fundUsedCents: number;
  fundLeftCents: number;
  /** Reserved but not yet delivered — money already promised to someone. */
  fundReservedCents: number;
}

/**
 * Read-only view of the campaign's budget. The authoritative check is inside
 * `tickets_approve_receipt`, under the campaign row lock; this is for display
 * and for the "no rewards left this week" state on the home screen.
 */
export const getQuotaState = async (campaign: Campaign): Promise<QuotaState> => {
  const db = supabaseAdmin();
  const { config } = campaign;

  // Ask Postgres rather than recompute: the approval path uses the SQL
  // function, and a display that disagreed with it would be worse than useless.
  const { data: weekRow, error: weekError } = await db.rpc("tickets_week_start", {
    p_tz: config.timezone,
  });
  if (weekError) console.error("[tickets] week_start rpc failed", weekError);
  const weekStartIso =
    typeof weekRow === "string" ? weekRow : weekStart(config.timezone).toISOString();

  const { data: rewards, error } = await db
    .from("rewards")
    .select("amount_cents, status, week_start")
    .eq("campaign_id", campaign.id)
    .neq("status", "canceled");

  if (error) {
    console.error("[tickets] quota read failed", error);
  }

  const rows = rewards ?? [];
  const weeklyUsed = rows.filter(
    (r) => new Date(r.week_start).getTime() === new Date(weekStartIso).getTime(),
  ).length;
  const fundUsedCents = rows.reduce((sum, r) => sum + Number(r.amount_cents ?? 0), 0);
  const fundReservedCents = rows
    .filter((r) => r.status === "reserved" || r.status === "queued")
    .reduce((sum, r) => sum + Number(r.amount_cents ?? 0), 0);

  return {
    weekStart: weekStartIso,
    weeklyQuota: config.weeklyQuota,
    weeklyUsed,
    weeklyLeft: Math.max(0, config.weeklyQuota - weeklyUsed),
    totalSlots: config.totalRewardSlots,
    totalUsed: rows.length,
    totalLeft: Math.max(0, config.totalRewardSlots - rows.length),
    fundCents: config.fundCents,
    fundUsedCents,
    fundLeftCents: Math.max(0, config.fundCents - fundUsedCents),
    fundReservedCents,
  };
};

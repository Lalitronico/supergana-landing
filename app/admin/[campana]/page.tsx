import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCampaign } from "@/lib/tickets/campaigns";
import { HashSession } from "@/app/auth/HashSession";
import { TicketsAdminClient } from "./TicketsAdminClient";
import "./admin.css";

export const metadata: Metadata = {
  title: "Consola de operación — Supergana",
  robots: { index: false, follow: false },
};

/**
 * Operations console, one per campaign.
 *
 * Static segments win over dynamic ones in the App Router, so the pre-existing
 * `/admin/mundial` (its own HMAC-cookie auth, see lib/mundial/adminAuth.ts)
 * keeps resolving to its own page and never falls through to here.
 *
 * This page only proves the campaign exists. Authorization happens in the API
 * routes against `campaign_admins` — rendering a shell to a stranger costs
 * nothing, and putting the check here as well would only create two places
 * that must agree.
 */
export default async function TicketsAdminPage({
  params,
}: {
  params: Promise<{ campana: string }>;
}) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign) notFound();

  return (
    <>
      <HashSession />
      <TicketsAdminClient slug={campaign.slug} />
    </>
  );
}

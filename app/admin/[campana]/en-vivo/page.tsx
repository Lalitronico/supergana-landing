import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCampaign } from "@/lib/tickets/campaigns";
import { HashSession } from "@/app/auth/HashSession";
import { LiveScreen } from "./LiveScreen";
import "./live.css";

export const metadata: Metadata = {
  title: "Pantalla en vivo — Supergana",
  robots: { index: false, follow: false },
};

/**
 * The projector screen for a campaign.
 *
 * Like the console page, this only proves the campaign exists. Who may look is
 * decided by `/api/tickets/[campana]/admin/live`, against `campaign_admins`:
 * the shell of a screen that shows nothing without data costs nothing to
 * render for a stranger, and a second check here would be a second place that
 * has to agree with the first.
 */
export default async function LivePage({
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
      <LiveScreen slug={campaign.slug} />
    </>
  );
}

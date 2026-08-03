import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCampaign, isVisible } from "@/lib/tickets/campaigns";
import { isLocale, toPublicCampaign, type Locale } from "@/lib/tickets/config";
import { HashSession } from "@/app/auth/HashSession";
import { TicketsShell } from "./TicketsShell";
import "./tickets.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ campana: string }>;
}): Promise<Metadata> {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign) return { title: "Supergana" };
  return {
    title: `${campaign.name} — ${campaign.orgName}`,
    // A campaign lives behind a QR on a shelf talker; it has no business
    // competing with the marketing site in search results, and a draft one
    // must not be indexable at all.
    robots: { index: false, follow: false },
  };
}

export default async function TicketsCampaignLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ campana: string }>;
}) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign || !isVisible(campaign)) notFound();

  // The cookie is shared across campaigns, so a preference picked on a
  // bilingual one must not force a language a single-locale campaign never
  // translated. Campaign locales win; the cookie only chooses among them.
  const cookieLocale = (await cookies()).get("tk_locale")?.value;
  const initial: Locale =
    isLocale(cookieLocale) && campaign.locales.includes(cookieLocale)
      ? cookieLocale
      : (campaign.locales[0] ?? "es");

  return (
    <>
      <HashSession />
      <TicketsShell campaign={toPublicCampaign(campaign)} initialLocale={initial}>
        {children}
      </TicketsShell>
    </>
  );
}

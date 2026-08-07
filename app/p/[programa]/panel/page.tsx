import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProgram } from "@/lib/pickem/program";
import { HashSession } from "@/app/auth/HashSession";
import { PanelClient } from "./PanelClient";
import "./panel.css";

export const metadata: Metadata = {
  title: "Panel de operación — Supergana",
  robots: { index: false, follow: false },
};

/**
 * The supervisor's panel, one per programme.
 *
 * This page only proves the programme exists. Authorization happens in the API
 * routes against `campaign_admins`, which is the tickets console's pattern and
 * its reasoning (app/admin/[campana]/page.tsx): rendering a shell to a stranger
 * costs nothing, and putting the check here as well would only create two
 * places that have to agree — the kind of pair that drifts and leaves a door
 * open on the side nobody re-read.
 *
 * `HashSession` is mounted for the same reason the console mounts it: an access
 * link minted server-side comes back in the URL fragment, which no route
 * handler can see. Without this the operator watches nothing happen and the
 * link burns.
 *
 * It renders inside the module's own layout — the phone frame, the tenant's
 * header, the tenant's colours. That is not laziness about a back office: the
 * two screens that get used every week are the Tuesday close and the counter,
 * and both happen on a phone or on a tablet held in one hand. There is no
 * laptop in a restaurant.
 */
export default async function PickemPanelPage({
  params,
}: {
  params: Promise<{ programa: string }>;
}) {
  const { programa } = await params;
  const program = await getProgram(programa);
  if (!program) notFound();

  return (
    <>
      <HashSession />
      <PanelClient slug={program.slug} />
    </>
  );
}

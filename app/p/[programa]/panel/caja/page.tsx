import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProgram } from "@/lib/pickem/program";
import { HashSession } from "@/app/auth/HashSession";
import { PanelClient } from "../PanelClient";
import "../panel.css";

export const metadata: Metadata = {
  title: "Caja de canje — Supergana",
  robots: { index: false, follow: false },
};

/**
 * The counter, on its own URL.
 *
 * Same console, opened on the redemption screen. It exists because the branch
 * tablet is not the supervisor's phone: it sits by the till, it is left open
 * all day, and whoever is at the counter picks it up. A bookmark that lands on
 * the jornada view and needs two taps to reach the code box is two taps taken
 * with a customer standing there.
 *
 * The seat is the same allowlist — `campaign_admins`, checked in the routes.
 * The runbook asks that validating a code must NOT require the waiter to have
 * an account of their own, and this is how that is honoured: one signed-in
 * tablet per branch, and every seat on the programme may redeem.
 */
export default async function PickemDeskPage({
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
      <PanelClient slug={program.slug} initialView="caja" />
    </>
  );
}

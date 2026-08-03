"use client";

import type { MascotPose } from "@/lib/tickets/theme";
import { useTickets } from "./TicketsShell";

/**
 * A tenant's mascot, if it has one for this moment.
 *
 * Renders nothing when the pose is missing, which is the normal case: mascots
 * are optional in `organizations.theme`, Novamex has none, and every screen
 * that calls this has to stand up without art. Treating the mascot as decoration
 * the layout does not depend on is what keeps a second tenant from needing an
 * illustrator before it can launch.
 *
 * Decorative by construction: `alt=""` and aria-hidden, because the mascot never
 * carries information the copy next to it does not already say.
 */
export function Mascot({
  pose,
  className,
  /** Idle bob. Off inside modals, where the whole card is already animating in. */
  bob = true,
}: {
  pose: MascotPose;
  className?: string;
  bob?: boolean;
}) {
  const { campaign } = useTickets();
  const src = campaign.theme.mascots[pose];
  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      decoding="async"
      className={["tk-mascot", bob ? "bob" : null, className].filter(Boolean).join(" ")}
    />
  );
}

"use client";

import type { ReceiptStatus } from "@/lib/tickets/config";
import { useTickets } from "./TicketsShell";

// received → in_review → validation → result. `needs_new_image` deliberately
// sits at step 4 with a red dot rather than resetting to step 1: the person did
// finish the flow, we are the ones asking for something else.
const STEPS = [
  { key: "st1", desc: "st1d" },
  { key: "st2", desc: "st2d" },
  { key: "st3", desc: "st3d" },
  { key: "st4", desc: "st4d" },
] as const;

const REACHED: Record<ReceiptStatus, number> = {
  received: 1,
  in_review: 2,
  needs_new_image: 4,
  approved: 4,
  rejected: 4,
};

export function StatusTimeline({ status }: { status: ReceiptStatus }) {
  const { t } = useTickets();
  const current = REACHED[status];
  const settled = status === "approved" || status === "rejected" || status === "needs_new_image";

  return (
    <div className="tk-timeline">
      {STEPS.map((step, i) => {
        const index = i + 1;
        const done = index < current || (settled && index === current);
        const now = index === current && !settled;
        return (
          <div className="tk-tl-item" key={step.key}>
            <div className="tk-tl-rail">
              <div className={`tk-tl-dot ${done ? "done" : now ? "now" : ""}`}>
                {done ? "✓" : index}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`tk-tl-line ${index < current ? "done" : ""}`} />
              )}
            </div>
            <div className="tk-tl-body">
              <h4>{t(step.key)}</h4>
              <p>{t(step.desc)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

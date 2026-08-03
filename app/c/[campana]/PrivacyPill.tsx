"use client";

import { useTickets } from "./TicketsShell";

/**
 * "Your data is safe", next to the camera.
 *
 * Small, but it is the reassurance the mockups put directly under the frame, and
 * it belongs there: the moment somebody is asked to photograph a receipt is the
 * moment they wonder who sees it. The long version of this promise — encrypted
 * at rest, seen only by the validation team — stays in `privacyNote` where
 * there is room to make it.
 */
export function PrivacyPill() {
  const { t } = useTickets();
  return (
    <div className="tk-privacy" title={t("privacyNote")}>
      <span className="tk-privacy-ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.9l7.2 2.7v5.6c0 4.5-3 8.1-7.2 9.9-4.2-1.8-7.2-5.4-7.2-9.9V5.6Z" />
          <path d="m8.9 12.1 2.2 2.2 4-4.3" />
        </svg>
      </span>
      {t("capPrivacy")}
    </div>
  );
}

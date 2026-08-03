"use client";

import { useCallback, useEffect, useState } from "react";
import type { StoreSnapshot } from "@/lib/tickets/store";

/**
 *  · `off`         — nothing to read: threshold campaign, or nobody signed in.
 *  · `loading`     — first read in flight.
 *  · `ready`       — `snapshot` is the store.
 *  · `unavailable` — the endpoint said no store here, or the read failed. The
 *                    screens treat it as "not open yet", never as an error.
 */
export type StoreStatus = "off" | "loading" | "ready" | "unavailable";

/**
 * This week's Drop and the participant's redemptions, fetched once per page.
 *
 * Lives in the shell for the same reason the session does: the balance-versus-
 * next-prize bar shows up on the home, in Mi panel and inside the approval
 * celebration, and three components each fetching `/store/` would mean three
 * answers about how many units are left. There is one shelf; read it once.
 *
 * `enabled` is the campaign's mechanic plus a session. A threshold campaign has
 * no store and its endpoint answers 404; an anonymous visitor gets 401. Neither
 * is worth a request, and asking anyway would fill the console with expected
 * failures on every login screen.
 */
export function useStore(slug: string, enabled: boolean) {
  // Only the fetch result is state; the status is derived from it plus
  // `enabled`. Mirroring `enabled` into state would mean a setState inside the
  // effect body, which is a cascading render for a value already in hand.
  const [result, setResult] = useState<{ snapshot: StoreSnapshot | null } | null>(null);

  const fetchSnapshot = useCallback(async (): Promise<StoreSnapshot | null> => {
    try {
      const res = await fetch(`/api/tickets/${slug}/store/`, { cache: "no-store" });
      if (!res.ok) return null;
      const body = (await res.json()) as StoreSnapshot;
      // `available: false` is the endpoint saying the store tables are not
      // deployed here — a normal state between a deploy and its migration, and
      // indistinguishable from "no store" as far as a screen is concerned.
      return body.available ? body : null;
    } catch {
      return null;
    }
  }, [slug]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetchSnapshot().then((snapshot) => {
      if (alive) setResult({ snapshot });
    });
    return () => {
      alive = false;
    };
  }, [enabled, fetchSnapshot]);

  /**
   * Re-read after a redemption. Never downgrades a working shelf: a flaky tick
   * right after somebody spent 1000 points must not replace their new code with
   * "the store isn't open".
   */
  const reload = useCallback(async () => {
    if (!enabled) return;
    const snapshot = await fetchSnapshot();
    setResult((prev) => (snapshot ? { snapshot } : (prev ?? { snapshot: null })));
  }, [enabled, fetchSnapshot]);

  const status: StoreStatus = !enabled
    ? "off"
    : result === null
      ? "loading"
      : result.snapshot
        ? "ready"
        : "unavailable";

  return { status, snapshot: enabled ? (result?.snapshot ?? null) : null, reload };
}

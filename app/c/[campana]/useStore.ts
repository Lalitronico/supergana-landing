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
 *
 * `balance` is what the session currently says the points are, and it is here
 * because reading the shelf once per page load was not enough. The snapshot
 * carries its own copy of the balance, and every affordability decision on
 * these screens — the next-prize bar, each prize's gap, and whether the Canjear
 * button renders at all — is made against that copy rather than against the
 * chip in the header. So when a receipt was approved while the app sat open,
 * the chip climbed and the shelf did not: the store went on offering "te faltan
 * 100 pts" to somebody holding 4,047, with no button to press. The shell is a
 * layout, so walking between tabs never remounted it either.
 *
 * Tying the read to the balance closes that gap at its source: the moment the
 * session notices points changed, the shelf is re-read.
 */
export function useStore(slug: string, enabled: boolean, balance: number | null) {
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
    // `balance` belongs in here: a changed balance makes the snapshot's own copy
    // of it wrong, and everything this screen decides is decided from that copy.
  }, [enabled, fetchSnapshot, balance]);

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

  /**
   * Re-read on returning to the tab, the way the session already does.
   *
   * The balance is not the only thing that goes stale while a phone sits in a
   * pocket: stock is counted from other people's redemptions, so a shelf read
   * ten minutes ago can offer the last Termo to two participants at once. The
   * RPC still refuses the second one under its row lock — this only keeps the
   * screen from promising what the database will deny.
   */
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, reload]);

  const status: StoreStatus = !enabled
    ? "off"
    : result === null
      ? "loading"
      : result.snapshot
        ? "ready"
        : "unavailable";

  return { status, snapshot: enabled ? (result?.snapshot ?? null) : null, reload };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReceiptStatus, RewardStatus } from "@/lib/tickets/config";

export interface MeReceipt {
  id: string;
  status: ReceiptStatus;
  submitted_at: string;
  store_name: string | null;
  purchase_date: string | null;
  total_cents: number | null;
  eligible_cents: number | null;
  reject_reason: string | null;
  reviewed_at: string | null;
}

export interface MeReward {
  id: string;
  amount_cents: number;
  status: RewardStatus;
  created_at: string;
  sent_at: string | null;
  receipt_id: string;
}

export interface MeProfile {
  id: string;
  firstName: string;
  lastName: string;
  zip: string;
  state: string | null;
  locale: "es" | "en";
  /** False until the address is proven; the reward won't release before then. */
  emailVerified: boolean;
}

export interface Me {
  email: string;
  participant: MeProfile | null;
  receipts: MeReceipt[];
  rewards: MeReward[];
  /** Staff walking a draft campaign: may submit receipts before launch. */
  canRehearse: boolean;
}

/**
 * Session state, read from the API rather than from the Supabase client.
 *
 * The distinction that matters here is between "signed in" and "has a profile
 * in this campaign": an account is global, a participant is per campaign, and
 * every gated screen needs to tell those two apart to know where to send you.
 */
export type MeStatus = "loading" | "anon" | "no-profile" | "ready" | "error";

interface MeState {
  status: MeStatus;
  me: Me | null;
}

export function useMe(slug: string) {
  const [state, setState] = useState<MeState>({ status: "loading", me: null });

  // Fetching is separated from storing so the only setState on mount happens
  // in the promise callback — and so a response that lands after the user has
  // navigated away is dropped instead of writing to an unmounted component.
  const fetchMe = useCallback(async (): Promise<MeState> => {
    try {
      const res = await fetch(`/api/tickets/${slug}/me/`, { cache: "no-store" });
      if (res.status === 401) return { status: "anon", me: null };
      if (!res.ok) return { status: "error", me: null };
      const data = (await res.json()) as Me;
      return { status: data.participant ? "ready" : "no-profile", me: data };
    } catch {
      return { status: "error", me: null };
    }
  }, [slug]);

  useEffect(() => {
    let alive = true;
    // Background refreshes must never downgrade a working screen: a flaky
    // network tick would otherwise flash the error state at someone who did
    // nothing. A 401 does apply — the session genuinely ended.
    const refresh = (background = false) => {
      fetchMe().then((next) => {
        if (!alive) return;
        setState((prev) =>
          background && next.status === "error" && prev.status !== "error"
            ? prev
            : next,
        );
      });
    };
    refresh();

    // The review happens in another tab — or another person's hands. Refetching
    // when the tab comes back into view is what turns "en revisión" into the
    // real status without asking anyone to reload by hand.
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchMe]);

  // While a receipt is awaiting review, poll gently so a screen left open still
  // learns the verdict. Hidden tabs skip the tick; settled claims stop it.
  const hasOpenReceipt =
    state.me?.receipts.some(
      (r) => r.status === "received" || r.status === "in_review",
    ) ?? false;

  useEffect(() => {
    if (!hasOpenReceipt) return;
    let alive = true;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchMe().then((next) => {
        if (!alive) return;
        setState((prev) =>
          next.status === "error" && prev.status !== "error" ? prev : next,
        );
      });
    }, 20_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [hasOpenReceipt, fetchMe]);

  const reload = useCallback(async () => {
    setState(await fetchMe());
  }, [fetchMe]);

  return { status: state.status, me: state.me, reload };
}

/** The claim currently worth showing: newest receipt, plus its reward if any. */
export const currentClaim = (me: Me | null) => {
  if (!me || me.receipts.length === 0) return null;
  const receipt = me.receipts[0];
  const reward = me.rewards.find((r) => r.receipt_id === receipt.id) ?? null;
  return { receipt, reward };
};

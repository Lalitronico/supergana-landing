"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseAuthConfigured, supabaseBrowser } from "@/lib/supabase/browser";
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
  /** Points this receipt credited; null until it is approved. */
  points?: number | null;
  /** Catalog products read on it (approved receipts only). */
  products?: string[];
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
  /** Leaderboard display name; null on profiles that predate the field. */
  alias: string | null;
  /** Null wherever the campaign's `profileFields.zip` is not 'required'. */
  zip: string | null;
  state: string | null;
  /** E.164, or null on campaigns that never ask for it. */
  phone: string | null;
  locale: "es" | "en";
  /** False until the address is proven; the reward won't release before then. */
  emailVerified: boolean;
}

export interface Me {
  /** Null on campaigns identified by phone (0030): there is no address. */
  email: string | null;
  /** E.164 of the ACCOUNT on those campaigns — the number a code came back
   *  from. Distinct from `participant.phone`, which is a profile field. */
  phone: string | null;
  participant: MeProfile | null;
  receipts: MeReceipt[];
  rewards: MeReward[];
  /** Balance: SUM over the points ledger, computed server-side. */
  points: number;
  /**
   * Points earned, ignoring redemptions — the number the leaderboard ranks on.
   * Equal to `points` until the first redemption exists.
   */
  pointsEarned: number;
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

const FAST_POLL_MS = 2_500;
const FAST_POLL_WINDOW_MS = 90_000;
// After the fast window a ticket is probably with a person, who may approve it
// minutes later while the phone is still in the participant's hand: keep
// checking every 5 s for ten minutes, then settle to the gentle 20 s.
const MID_POLL_MS = 5_000;
const MID_POLL_WINDOW_MS = 600_000;
const SLOW_POLL_MS = 20_000;

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

  // While a receipt is awaiting review the screen keeps asking for the verdict.
  // Two speeds: right after an upload the OCR usually answers within seconds, so
  // for the first ~90 s of a receipt's life the poll runs every 2.5 s and the
  // approval lands while the person is still looking at the "reading" screen.
  // Past that the wait is probably a human review, and 20 s is plenty.
  // Hidden tabs skip the tick; settled claims stop it.
  const hasOpenReceipt =
    state.me?.receipts.some(
      (r) => r.status === "received" || r.status === "in_review",
    ) ?? false;

  // When THIS browser first saw each receipt in flight. Measured with the local
  // clock on purpose: comparing against the server's `submitted_at` would make
  // a phone with a skewed clock poll fast forever or never.
  const firstSeen = useRef<Map<string, number>>(new Map());
  // The tick reads the latest receipts through a ref so the interval is not torn
  // down and rebuilt on every response.
  const receiptsRef = useRef<MeReceipt[]>([]);
  useEffect(() => {
    receiptsRef.current = state.me?.receipts ?? [];
  }, [state.me]);

  useEffect(() => {
    if (!hasOpenReceipt) return;
    let alive = true;
    let lastFetch = Date.now();
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const open = receiptsRef.current.filter(
        (r) => r.status === "received" || r.status === "in_review",
      );
      for (const r of open) if (!firstSeen.current.has(r.id)) firstSeen.current.set(r.id, now);
      const age = Math.min(...open.map((r) => now - (firstSeen.current.get(r.id) ?? now)));
      const wait =
        age < FAST_POLL_WINDOW_MS ? 0 : age < MID_POLL_WINDOW_MS ? MID_POLL_MS : SLOW_POLL_MS;
      if (now - lastFetch < wait) return;
      lastFetch = now;
      fetchMe().then((next) => {
        if (!alive) return;
        setState((prev) =>
          next.status === "error" && prev.status !== "error" ? prev : next,
        );
      });
    }, FAST_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [hasOpenReceipt, fetchMe]);

  const reload = useCallback(async () => {
    setState(await fetchMe());
  }, [fetchMe]);

  /**
   * Re-read when the signed-in identity changes.
   *
   * This is what makes it safe for one `useMe` to serve a whole layout. When
   * each screen owned its own copy, signing in and navigating remounted the hook
   * and it read the new cookie by accident of the remount. Hoisted into the
   * shell, the hook outlives every client-side navigation — so a session state
   * fetched while anonymous stayed "anon" after a successful sign-in, and every
   * gated screen bounced back to /entrar/ in a loop that only a hard reload
   * broke. The visibility refetch and the 20s poll do not rescue it: the tab
   * never hid, and a brand-new account has no open receipt to poll for.
   *
   * Now the hook watches for the thing that actually changed instead of relying
   * on a remount to notice it. Works no matter which screen signs in, and picks
   * up a sign-in that happened in another tab.
   */
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!supabaseAuthConfigured()) return;
    const { data } = supabaseBrowser().auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id ?? null;
      // Fires on subscribe. The mount effect above is already fetching, so this
      // one only records who we started as.
      if (event === "INITIAL_SESSION") {
        lastUserId.current = userId;
        return;
      }
      // A new token for the same person changes nothing this hook reports.
      if (event === "TOKEN_REFRESHED") return;
      // Some versions re-announce SIGNED_IN on tab focus; only an identity
      // change is worth a request.
      if (userId === lastUserId.current) return;
      lastUserId.current = userId;
      // "loading" BEFORE the request, not after it. The screen that signed in
      // navigates the moment signIn resolves, and the gated screen it lands on
      // (registro, panel, subir) redirects on "anon" in its first effect. With
      // the old identity's status still in state, a brand-new account bounced
      // from crear-cuenta → registro → entrar: signed in, and told to sign in.
      // Gated screens already wait on "loading", so this is all they need.
      setState({ status: "loading", me: null });
      void reload();
    });
    return () => data.subscription.unsubscribe();
  }, [reload]);

  return { status: state.status, me: state.me, reload };
}

/** The claim currently worth showing: newest receipt, plus its reward if any. */
export const currentClaim = (me: Me | null) => {
  if (!me || me.receipts.length === 0) return null;
  const receipt = me.receipts[0];
  const reward = me.rewards.find((r) => r.receipt_id === receipt.id) ?? null;
  return { receipt, reward };
};

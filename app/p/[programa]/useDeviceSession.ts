"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export type SessionStatus = "loading" | "ready" | "unavailable";

/**
 * The anonymous session that identifies this device.
 *
 * Pick'em has no password and no email — the handoff is explicit that both are
 * friction with nothing behind them, since the prize is collected across a
 * counter rather than delivered to an inbox. What the server still needs is a
 * stable `auth.uid()` to hang row-level security on, and an anonymous session
 * is exactly that: a real Supabase user with no credentials attached.
 *
 * The account it creates means nothing on its own. It becomes a player only
 * when a code sent to a phone is typed back, which is what writes the
 * `participant_devices` row. Until then it can read the public schedule and
 * nothing else.
 */

/**
 * One sign-in per tab, shared by everything that asks.
 *
 * Module scope rather than component state, and the reason is not tidiness:
 * two components mounting together would otherwise race and create two
 * anonymous users, one of which becomes an orphan `auth.users` row that never
 * gets linked to anybody. Holding the in-flight promise means the second caller
 * awaits the first's answer.
 */
let inFlight: Promise<string | null> | null = null;

const warmSession = (): Promise<string | null> => {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return data.session.user.id;

      const { data: signed, error } = await supabase.auth.signInAnonymously();
      if (error || !signed.user) {
        console.error("[pickem] anonymous sign-in failed", error);
        return null;
      }
      return signed.user.id;
    } catch (err) {
      console.error("[pickem] session failed", err);
      return null;
    } finally {
      // Cleared so a later attempt can retry after a network blip. The Supabase
      // client caches the session itself, so a successful retry is a cheap
      // getSession rather than a second sign-in.
      inFlight = null;
    }
  })();
  return inFlight;
};

export const useDeviceSession = () => {
  const [status, setStatus] = useState<SessionStatus>("loading");

  const ensure = useCallback(async () => {
    const uid = await warmSession();
    setStatus(uid ? "ready" : "unavailable");
    return uid;
  }, []);

  useEffect(() => {
    // Warmed, not awaited into state. Signing in early means the first submit
    // does not pay for a round trip; resolving it into React state from inside
    // an effect would be a cascading render for a value nothing renders yet.
    // `ensure` is what the submit handlers call, and that is where the status
    // becomes something the screen can show.
    let live = true;
    void warmSession().then((uid) => {
      if (live && !uid) setStatus("unavailable");
    });
    return () => {
      live = false;
    };
  }, []);

  return { status, ensure };
};

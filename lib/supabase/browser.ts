// Browser client for the participant and staff apps. Sessions live in cookies
// (not localStorage) so route handlers on the server can read the same session
// — that is the whole reason this file exists next to `client.ts`.
//
// Deliberately NOT merged with `lib/supabase/client.ts`: that one runs with
// `persistSession: false` for the anonymous PSG-Arsenal quiniela RPCs, and
// giving it a session would change how those writes are authorised.

import { createBrowserClient } from "@supabase/ssr";
import type { AuthError, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * How Supabase is refusing to send a code — the two cases look identical in
 * the response (`429`, `over_email_send_rate_limit`) but mean opposite things
 * to the person waiting, so telling them apart decides what we can honestly
 * promise:
 *
 * - `"cooldown"` — *"you can only request this after N seconds"*. Per address,
 *   60 s. Waiting genuinely fixes it.
 * - `"project"` — *"email rate limit exceeded"*. The whole project's hourly
 *   budget is gone, which on the built-in sender is **2 emails/hour**. Nothing
 *   the person does helps; the next arrival is locked out too. Promising them
 *   a minute here would be a lie, and it is the failure that a launch spike
 *   produces first.
 *
 * Verified against this project's auth logs on 2026-07-27: both codes fired,
 * and the project cap was reached after exactly two sends.
 */
export type AuthThrottle = "cooldown" | "project" | null;

export const authThrottleKind = (error: AuthError): AuthThrottle => {
  const throttled =
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    /only request this after|rate limit/i.test(error.message);
  if (!throttled) return null;
  // Order matters: the per-address message also contains "request this after",
  // so match it first and treat everything else throttled as the project cap.
  return /only request this after/i.test(error.message) ? "cooldown" : "project";
};

export const supabaseAuthConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

export const supabaseBrowser = (): SupabaseClient => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  // createBrowserClient is already a singleton per (url, key), but caching the
  // reference keeps identity stable across React re-renders.
  if (!cached) cached = createBrowserClient(url, key);
  return cached;
};

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
 * Whether an auth failure is Supabase throttling code requests.
 *
 * Checked by status first; the message match is the fallback because older
 * gotrue builds answer 429 conditions with a 400. Worth singling out: with the
 * built-in email sender this is the failure a real campaign hits first, and
 * "wait a minute" is advice the person can actually act on, unlike a generic
 * apology.
 */
export const isRateLimited = (error: AuthError) =>
  error.status === 429 ||
  error.code === "over_email_send_rate_limit" ||
  /only request this after|rate limit/i.test(error.message);

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

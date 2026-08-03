// Server-side Supabase client bound to the request's cookies. Use this to find
// out WHO is calling; use `supabaseAdmin()` from `./server` to actually read or
// write anything privileged.
//
// A fresh client per request — never share one across requests, the cookie jar
// belongs to a single caller.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export const supabaseRoute = async (): Promise<SupabaseClient> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Harmless here: proxy.ts
          // refreshes the session on every request that matters, so the
          // refreshed token is already written back there.
        }
      },
    },
  });
};

/**
 * The authenticated user, or null. Uses `getUser()` rather than `getSession()`
 * on purpose: getSession trusts whatever the cookie says, getUser revalidates
 * the JWT with the auth server. Anything gating money must use this one.
 */
export const currentUser = async (): Promise<User | null> => {
  const supabase = await supabaseRoute();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
};

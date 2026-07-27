"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Rescues an auth session delivered in the URL fragment.
 *
 * Supabase has two ways of handing back a session. A sign-in started from the
 * browser client uses PKCE and comes back as `?code=…`, which the server route
 * at /auth/callback exchanges. But links minted server-side — `generateLink`
 * from the admin API, which is how an operator gets access without waiting on
 * SMTP — come back in the *implicit* flow: `#access_token=…&refresh_token=…`.
 *
 * A fragment is never sent to the server. No route handler can see it, so
 * /auth/callback fell through to its failure branch while the tokens sat in
 * the address bar unused. This component is the other half: it reads them,
 * hands them to the browser client (which writes the cookies the server reads),
 * and reloads onto a clean URL.
 *
 * Mounted on the surfaces an auth link can land on. Costs nothing when there
 * is no fragment, which is almost always.
 */
export function HashSession() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    let alive = true;
    supabaseBrowser()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (!alive) return;
        if (error) {
          console.error("[auth] could not adopt fragment session", error.message);
          return;
        }
        // Full reload rather than a router refresh: the session now lives in
        // cookies and every server component on the page has to be re-rendered
        // with it. Also drops the tokens out of the address bar and history.
        const url = new URL(window.location.href);
        url.hash = "";
        url.searchParams.delete("authError");
        window.location.replace(url.toString());
      });

    return () => {
      alive = false;
    };
  }, []);

  return null;
}

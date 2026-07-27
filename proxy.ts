// Session refresh for the Supabase-authenticated surfaces.
//
// Next 16 renamed the `middleware` file convention to `proxy` — same slot in
// the request lifecycle, new name. See
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
//
// Without this, an expired access token can only be refreshed inside a route
// handler, and Server Components would silently see a logged-out user. The
// Supabase SSR client is explicit that skipping it causes random logouts.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // The Mundial x Rotary console predates Supabase Auth and carries its own
  // HMAC cookie (lib/mundial/adminAuth.ts). Leave it alone.
  if (request.nextUrl.pathname.startsWith("/admin/mundial")) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        // Rebuild the response so the refreshed cookies reach BOTH the
        // downstream handler (via request) and the browser (via response).
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Includes the no-store family: a cached Set-Cookie would hand one
        // user's session to the next visitor behind the CDN.
        for (const [header, value] of Object.entries(headers)) {
          response.headers.set(header, value);
        }
      },
    },
  });

  // Touching the user is what triggers the refresh. Must happen before the
  // response is committed, or the new token is lost.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/c/:path*", "/admin/:path*", "/api/tickets/:path*"],
};

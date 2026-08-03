import { NextResponse, type NextRequest } from "next/server";
import { supabaseRoute } from "@/lib/supabase/route";

export const runtime = "nodejs";

/**
 * Landing point for Supabase Auth email links.
 *
 * Both sign-in surfaces show a 6-digit code field, which is the more robust
 * flow: the code works even when the email is opened on a different device
 * from the one that asked for it. But Supabase's *default* Magic Link template
 * only carries `{{ .ConfirmationURL }}` — a link, no code — so without this
 * route a fresh project cannot sign anyone in until someone edits the template.
 *
 * So both work. This handles whatever the link carries: a PKCE `code`, or the
 * `token_hash` + `type` pair the newer templates use.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type");

  // Only same-origin paths into the two campaign surfaces. `next` arrives from
  // an email link, which means anyone can put anything in it — an unchecked
  // redirect here would turn our domain into someone else's phishing hop.
  const requested = params.get("next") ?? "/";
  const next =
    requested.startsWith("/c/") || requested.startsWith("/admin/") ? requested : "/";

  const supabase = await supabaseRoute();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, req.nextUrl.origin));
    console.error("[auth callback] code exchange failed", error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "email" | "magiclink" | "signup" | "recovery" | "invite",
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(new URL(next, req.nextUrl.origin));
    console.error("[auth callback] token_hash verify failed", error.message);
  }

  // Send them back where they were headed: the gate on that page bounces an
  // unauthenticated visitor to the sign-in screen anyway.
  const failed = new URL(next, req.nextUrl.origin);
  failed.searchParams.set("authError", "link");
  return NextResponse.redirect(failed);
}

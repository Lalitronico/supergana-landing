import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCampaign, isVisible } from "@/lib/tickets/campaigns";
import { accountSchema } from "@/lib/tickets/schema";

export const runtime = "nodejs";

/**
 * Creates a password account without sending any email.
 *
 * The project has "Confirm email" on, so a plain client-side `signUp` would
 * mail a confirmation link and hold the session hostage until it's clicked —
 * the exact wall this module is trying to remove. Creating the account with
 * the service role, already confirmed, keeps sign-up email-free. The email is
 * NOT verified by this: whether the address is real is settled later, before
 * the reward is released, which is where the participant has a reason to
 * cooperate.
 *
 * If the address is already registered this must NOT touch the password —
 * that would let anyone take over an account by "signing up" as its owner.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campana: string }> },
) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign || !isVisible(campaign)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const parsed = accountSchema.safeParse(body);
  if (!parsed.success) {
    const short = parsed.error.issues.some((i) => i.path[0] === "password");
    return NextResponse.json(
      { error: short ? "weak_password" : "bad_email" },
      { status: 400 },
    );
  }
  const { email, password } = parsed.data;

  const db = supabaseAdmin();
  const { error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (/already been registered|already exists/i.test(error.message)) {
      return NextResponse.json({ error: "account_exists" }, { status: 409 });
    }
    console.error("[tickets account] createUser failed", error.message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // No session in the response on purpose: the client signs in through
  // supabase-js so the session lands in cookies the same way it always does.
  return NextResponse.json({ ok: true });
}

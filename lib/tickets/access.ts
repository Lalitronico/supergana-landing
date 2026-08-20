// Who is calling, and what may they do.
//
// Two independent facts, deliberately kept apart:
//   authentication — Supabase verified this JWT (lib/supabase/route.ts)
//   authorization  — this campaign has a row for that user
// Being signed in grants nothing. A participant exists per campaign; a
// reviewer exists per campaign. Neither is implied by having an account.

import { currentUser } from "@/lib/supabase/route";
import { supabaseAdmin } from "@/lib/supabase/server";
import { phoneFromAuthEmail } from "@/lib/platform/identity";
import type { ParticipantRow } from "./schema.ts";
import type { StaffRole } from "./roles.ts";

// Re-exported so server code has one import for "who is calling and what may
// they do". Client components must import from ./roles directly — this module
// reaches for next/headers and cannot be bundled for the browser.
export type { StaffRole };
export { canReview, canPayout } from "./roles.ts";

export interface ParticipantContext {
  userId: string;
  /**
   * The address, or null when this session has none to speak of.
   *
   * Null is not an error and not an incomplete profile: a campaign whose
   * channel is `phone` mints accounts on a synthetic address that reaches
   * nobody, and this is where that address stops existing. Anything downstream
   * that wants to SHOW who is signed in reads `phone` instead — or falls back
   * to it — and anything that wants to SEND somewhere must treat null as "there
   * is nowhere to send", because there is.
   */
  email: string | null;
  /** E.164 when the session is a phone identity, null otherwise. */
  phone: string | null;
  /** null when the account exists but the campaign profile isn't filled in yet. */
  participant: ParticipantRow | null;
}

export const resolveParticipant = async (
  campaignId: string,
): Promise<ParticipantContext | null> => {
  const user = await currentUser();
  if (!user) return null;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("participants")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("auth_user_id", user.id)
    .maybeSingle<ParticipantRow>();

  if (error) {
    console.error("[tickets] participant lookup failed", error);
    return null;
  }

  // THE ONE TRANSLATION. `user.email` on a phone identity is plumbing —
  // `526567767074@wa.supergana.fun` — and every screen that prints an address
  // would print that instead. It is turned into a phone number here, once, and
  // no other reader of `currentUser()` in this module may skip past it.
  //
  // The participant row's own email is still the fallback for an email session,
  // as it was: an account created before the address was copied onto the row is
  // still the same person.
  const phone = phoneFromAuthEmail(user.email);
  return {
    userId: user.id,
    email: phone ? null : (user.email ?? data?.email ?? null),
    // Preferring the session over the row deliberately: the row's phone is a
    // profile field somebody could have edited, the session's is the number a
    // code came back from.
    phone: phone ?? data?.phone ?? null,
    participant: data ?? null,
  };
};

export interface StaffContext {
  userId: string;
  email: string;
  role: StaffRole;
}

/**
 * Three outcomes, kept distinct on purpose.
 *
 * "No session" and "session without a seat at this campaign" are different
 * facts and deserve different answers: 401 tells the console to show a sign-in
 * form, 403 tells it to say the account is not on the allowlist. Collapsing
 * them means the browser has to ask Supabase who it is just to pick a screen.
 */
export type StaffResult =
  | { kind: "anon" }
  | { kind: "forbidden" }
  | { kind: "ok"; staff: StaffContext };

export const resolveStaff = async (campaignId: string): Promise<StaffResult> => {
  const user = await currentUser();
  if (!user) return { kind: "anon" };

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("campaign_admins")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("auth_user_id", user.id)
    .maybeSingle<{ role: StaffRole }>();

  if (error) {
    console.error("[tickets] staff lookup failed", error);
    return { kind: "forbidden" };
  }
  if (!data) return { kind: "forbidden" };

  return {
    kind: "ok",
    staff: { userId: user.id, email: user.email ?? "", role: data.role },
  };
};

/** Maps a non-ok StaffResult to its HTTP status. */
export const staffDenialStatus = (result: StaffResult) =>
  result.kind === "anon" ? 401 : 403;

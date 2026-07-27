// Who is calling, and what may they do.
//
// Two independent facts, deliberately kept apart:
//   authentication — Supabase verified this JWT (lib/supabase/route.ts)
//   authorization  — this campaign has a row for that user
// Being signed in grants nothing. A participant exists per campaign; a
// reviewer exists per campaign. Neither is implied by having an account.

import { currentUser } from "@/lib/supabase/route";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ParticipantRow } from "./schema";
import type { StaffRole } from "./roles";

// Re-exported so server code has one import for "who is calling and what may
// they do". Client components must import from ./roles directly — this module
// reaches for next/headers and cannot be bundled for the browser.
export type { StaffRole };
export { canReview, canPayout } from "./roles";

export interface ParticipantContext {
  userId: string;
  email: string;
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

  return {
    userId: user.id,
    email: user.email ?? data?.email ?? "",
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

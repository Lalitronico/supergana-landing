// The door every panel route goes through.
//
// One pattern, reused rather than reinvented: `resolveStaff` reads
// `campaign_admins`, which has been the platform's staff allowlist since 0006
// and is what the tickets console checks on every one of its routes. Being
// signed in grants nothing — a seat exists per campaign, and a supervisor at
// Chapa is not a supervisor at Alaska.
//
// The three outcomes stay distinct, exactly as lib/tickets/access.ts argues:
//
//   401 — no session at all. The panel shows a sign-in form.
//   403 — a valid session with no seat on this programme. A different screen,
//         because looping somebody through a sign-in they already completed is
//         how an operator concludes the console is broken.
//   404 — no such programme.
//
// Deciding this in the route rather than in the page is also the tickets
// pattern (app/admin/[campana]/page.tsx says why): the shell costs nothing to
// render to a stranger, and a second check on the page would only create two
// places that have to agree.

import { NextResponse } from "next/server";
import { resolveStaff, staffDenialStatus, type StaffRole } from "@/lib/tickets/access";
import { getProgram } from "@/lib/pickem/program";
import type { Program } from "@/lib/pickem/schema";

export interface PanelStaff {
  userId: string;
  email: string;
  role: StaffRole;
}

export type PanelGate =
  | { ok: true; program: Program; staff: PanelStaff }
  | { ok: false; response: NextResponse };

export const openPanel = async (programa: string): Promise<PanelGate> => {
  const program = await getProgram(programa);
  if (!program) {
    return {
      ok: false,
      response: NextResponse.json({ error: "not_found" }, { status: 404 }),
    };
  }

  const access = await resolveStaff(program.campaignId);
  if (access.kind !== "ok") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: access.kind },
        { status: staffDenialStatus(access) },
      ),
    };
  }

  return { ok: true, program, staff: access.staff };
};

/**
 * A seat the panel has, used for an action it does not.
 *
 * Its own status and its own code so the screen can say which permission is
 * missing instead of repeating the sign-in message — the caller IS on the
 * allowlist, which is a different sentence from not being on it.
 */
export const forbidRole = (action: string) =>
  NextResponse.json({ error: "role_cannot", action }, { status: 403 });

/** Body parsing, with the same refusal every route in the platform gives. */
export const readJson = async (req: Request): Promise<unknown | undefined> => {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
};

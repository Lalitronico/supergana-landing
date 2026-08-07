import { NextResponse, type NextRequest } from "next/server";
import {
  canOperateWeek,
  canRedeemAward,
  getPanelWeek,
  listPendingAwards,
} from "@/lib/pickem/staff";
import { openPanel } from "./gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Everything the supervisor's screen renders, in one read.
 *
 * `?week=` picks the jornada; the default is the open one, which is what the
 * cron would close and therefore what a person opening the panel on a Tuesday
 * is looking for. Earlier weeks are reachable because the two real cases from
 * the runbook — a postponed game and a score captured wrong — both leave an
 * earlier jornada needing a second pass.
 *
 * The seat's permissions travel in the payload rather than being re-derived in
 * the browser. A hidden button is not a permission, and every action route
 * checks the role again; sending the answer just means the console does not
 * have to hold the rule to know which controls to draw.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ programa: string }> },
) {
  const { programa } = await params;
  const gate = await openPanel(programa);
  if (!gate.ok) return gate.response;

  const { program, staff } = gate;

  const asked = Number(req.nextUrl.searchParams.get("week"));
  const week =
    Number.isInteger(asked) && asked >= 1 && asked <= program.totalWeeks
      ? asked
      : program.openWeek;

  const [snapshot, pending] = await Promise.all([
    getPanelWeek(program, week),
    listPendingAwards(program),
  ]);

  return NextResponse.json({
    program: {
      slug: program.slug,
      name: program.name,
      orgName: program.orgName,
      status: program.status,
      openWeek: program.openWeek,
      totalWeeks: program.totalWeeks,
      timezone: program.timezone,
      venues: program.venues,
    },
    staff: {
      email: staff.email,
      role: staff.role,
      canOperate: canOperateWeek(staff.role),
      canRedeem: canRedeemAward(staff.role),
    },
    week: snapshot,
    pendingAwards: pending,
  });
}

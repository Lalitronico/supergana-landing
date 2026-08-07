import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  adjustPoints,
  canOperateWeek,
  getPlayerLedger,
  searchPlayers,
  staffMessage,
  staffStatusFor,
  validateAdjustment,
} from "@/lib/pickem/staff";
import { forbidRole, openPanel, readJson } from "../gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Correcting the ledger, and finding whose ledger to correct.
 *
 * The runbook's third case, and the only one that arrives after everything is
 * already published: "un marcador se capturó mal y hay que corregirlo DESPUÉS
 * de cerrar". The answer is never to edit the entry that was credited — that
 * entry is what the player was told and what the ranking paid. It is a new
 * signed entry with a reason, and the balance moves because a balance is a SUM.
 *
 * GET  ?q=      who this could be. Alias or phone, this programme only.
 * GET  ?player= their ledger, so the supervisor corrects against what is
 *               actually there rather than against what they remember.
 * POST          the correction itself.
 */

const bodySchema = z.object({
  participantId: z.uuid(),
  points: z.number().int(),
  note: z.string(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ programa: string }> },
) {
  const { programa } = await params;
  const gate = await openPanel(programa);
  if (!gate.ok) return gate.response;

  const { program, staff } = gate;
  if (!canOperateWeek(staff.role)) return forbidRole("ver y corregir el ledger");

  const player = req.nextUrl.searchParams.get("player");
  if (player) {
    const ledger = await getPlayerLedger(program, player);
    if (!ledger) {
      return NextResponse.json(
        { error: "participant_not_found", message: staffMessage("participant_not_found") },
        { status: 404 },
      );
    }
    return NextResponse.json({ ledger });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({ players: await searchPlayers(program, q) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ programa: string }> },
) {
  const { programa } = await params;
  const gate = await openPanel(programa);
  if (!gate.ok) return gate.response;

  const { program, staff } = gate;
  if (!canOperateWeek(staff.role)) return forbidRole("corregir el ledger");

  const raw = await readJson(req);
  if (raw === undefined) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  // The same check the form runs, run again where it is authoritative. The
  // screen deciding what to offer and the server deciding what to write are two
  // places, and only one of them is the record.
  const check = validateAdjustment(parsed.data.points, parsed.data.note);
  if (!check.ok) {
    return NextResponse.json(
      { error: check.error, message: staffMessage(check.error) },
      { status: staffStatusFor(check.error) },
    );
  }

  const result = await adjustPoints(
    program,
    parsed.data.participantId,
    check.points,
    check.note,
    // From the verified session, never from the body: a signature that the
    // signer can type is not a signature.
    staff.userId,
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: staffMessage(result.error) },
      { status: staffStatusFor(result.error) },
    );
  }

  const d = result.data;
  return NextResponse.json({
    ok: true,
    ...d,
    message: `${d.points > 0 ? "+" : ""}${d.points} puntos a ${d.alias ?? "el jugador"}. Nuevo total: ${d.total}.`,
  });
}

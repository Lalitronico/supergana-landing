import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  canOperateWeek,
  resolveTie,
  setGameVoided,
  settleWeekByHand,
  staffMessage,
  staffStatusFor,
} from "@/lib/pickem/staff";
import { forbidRole, openPanel, readJson } from "../gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The three things that can happen to a jornada by hand.
 *
 * One route with a discriminated body rather than three, the same shape the
 * tickets review route uses: they share a gate, a role check and an error
 * vocabulary, and splitting them would mean maintaining that three times.
 *
 * None of the rules live here. Closing is `pickem_settle_week` through
 * `settleProgram`; the tie is `pickem_resolve_tie`; annulling is
 * `pickem_set_game_voided`. This route decides who may ask and turns a machine
 * code into a sentence in Spanish.
 */

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("settle"),
    week: z.number().int().min(1).max(30),
  }),
  z.object({
    action: z.literal("resolve-tie"),
    week: z.number().int().min(1).max(30),
    // The supervisor may name one of the tied players or several to split
    // between. Both are legitimate answers; what the RPC refuses is a name that
    // is not on the top line.
    winners: z.array(z.uuid()).min(1).max(20),
  }),
  z.object({
    action: z.literal("void-game"),
    gameId: z.uuid(),
    voided: z.boolean(),
  }),
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ programa: string }> },
) {
  const { programa } = await params;
  const gate = await openPanel(programa);
  if (!gate.ok) return gate.response;

  const { program, staff } = gate;
  if (!canOperateWeek(staff.role)) return forbidRole("operar la jornada");

  const raw = await readJson(req);
  if (raw === undefined) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_body", issues: parsed.error.issues.map((i) => i.path.join(".")) },
      { status: 400 },
    );
  }
  const body = parsed.data;

  if (body.action === "settle") {
    const result = await settleWeekByHand(program, body.week);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, message: staffMessage(result.error) },
        { status: staffStatusFor(result.error) },
      );
    }

    const outcome = result.data;
    return NextResponse.json({
      ok: true,
      week: outcome.week,
      settled: outcome.settled ?? 0,
      awarded: Boolean(outcome.awarded),
      // The RPC settles the week, credits everybody and awards nobody when the
      // tiebreak did not separate the top two. Not a failure and not silence
      // either: somebody has to open the tie card and decide before the winner
      // can be told.
      tiedAtTop: Boolean(outcome.tiedAtTop),
      message: outcome.tiedAtTop
        ? `Jornada ${outcome.week} cerrada con ${outcome.settled ?? 0} entrada(s). Hay empate en la cima: falta decidir el premio.`
        : `Jornada ${outcome.week} cerrada con ${outcome.settled ?? 0} entrada(s).`,
    });
  }

  if (body.action === "resolve-tie") {
    const result = await resolveTie(program, body.week, body.winners, staff.userId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, message: staffMessage(result.error) },
        { status: staffStatusFor(result.error) },
      );
    }
    const data = result.data;
    return NextResponse.json({
      ok: true,
      ...data,
      message:
        data.awarded.length === 1
          ? `Premio otorgado a ${data.awarded[0].alias ?? "el jugador"}.`
          : `Premio repartido entre ${data.awarded.length} jugadores.`,
    });
  }

  const result = await setGameVoided(program, body.gameId, body.voided, staff.userId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: staffMessage(result.error) },
      { status: staffStatusFor(result.error) },
    );
  }
  const g = result.data;
  return NextResponse.json({
    ok: true,
    ...g,
    message: g.voided
      ? `${g.away} vs ${g.home} anulado: no cuenta para nadie y la jornada ya puede cerrar sin él.`
      : `${g.away} vs ${g.home} vuelve a contar.`,
  });
}

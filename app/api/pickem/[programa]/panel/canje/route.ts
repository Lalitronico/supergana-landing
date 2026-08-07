import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  canRedeemAward,
  findAward,
  looksLikeAwardCode,
  redeemAward,
  staffMessage,
  staffStatusFor,
} from "@/lib/pickem/staff";
import { forbidRole, openPanel, readJson } from "../gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The counter. Where the game turns into a visit.
 *
 * 0026 wrote `pickem_redeem_award`, granted it to service_role and left it
 * unreachable — no route called it, so a prize could be won and could not be
 * collected. This is that caller.
 *
 * GET  ?code=  what the code is, before anybody promises anything.
 * POST         the redemption, with the branch and the staff who handed it over.
 *
 * The two use the same matcher: `pickem_find_award` normalises the typed string
 * with the expression `pickem_redeem_award` uses, character for character. A
 * search that forgave a different set of typos would produce a code the panel
 * cannot find and the redeem would have accepted, which from the customer's
 * side is indistinguishable from a prize that does not exist.
 */

const bodySchema = z.object({
  code: z.string().min(1).max(40),
  venue: z.string().trim().min(1).max(80),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ programa: string }> },
) {
  const { programa } = await params;
  const gate = await openPanel(programa);
  if (!gate.ok) return gate.response;

  const { program, staff } = gate;
  if (!canRedeemAward(staff.role)) return forbidRole("validar códigos");

  const code = req.nextUrl.searchParams.get("code") ?? "";
  // Short of a whole code the answer is always "no such code", and showing that
  // to somebody who has typed four characters reads as a refusal rather than as
  // patience.
  if (!looksLikeAwardCode(code)) {
    return NextResponse.json({ award: null, incomplete: true });
  }

  const result = await findAward(program, code);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: staffMessage(result.error) },
      { status: staffStatusFor(result.error) },
    );
  }

  if (!result.data) {
    return NextResponse.json(
      { award: null, incomplete: false, message: staffMessage("award_not_found") },
      { status: 200 },
    );
  }

  return NextResponse.json({ award: result.data, incomplete: false });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ programa: string }> },
) {
  const { programa } = await params;
  const gate = await openPanel(programa);
  if (!gate.ok) return gate.response;

  const { program, staff } = gate;
  if (!canRedeemAward(staff.role)) return forbidRole("canjear premios");

  const raw = await readJson(req);
  if (raw === undefined) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const result = await redeemAward(
    program,
    parsed.data.code,
    parsed.data.venue,
    // Who handed the prize over, taken from the session. The whole reason the
    // status carries a name and a time is to be able to answer "¿ya usó su
    // premio?" months later without anybody having to remember.
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
    message: `Canjeado: ${d.prize} para ${d.alias ?? "el jugador"} en ${d.venue}.`,
  });
}

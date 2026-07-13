import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/mundial/adminAuth";
import { computePrizePool, STAGES, type Stage } from "@/lib/mundial/config";
import { stageOutcome } from "@/lib/mundial/scoring";
import {
  isSoldTicket,
  type MundialEntryRow,
  type MundialResultsRow,
} from "@/lib/mundial/schema";

export const runtime = "nodejs";

const computeSchema = z.object({
  action: z.literal("compute"),
  stage: z.enum(STAGES as [Stage, ...Stage[]]),
});
const publishSchema = z.object({
  action: z.literal("publish"),
  stage: z.enum(STAGES as [Stage, ...Stage[]]),
  published: z.boolean(),
});
const bodySchema = z.union([computeSchema, publishSchema]);

// Flyer rules: the stage prize splits evenly among everyone who hit the
// stage perfectly. If cuartos or semis end with zero winners, their pot
// rolls over into the final prize.
//
// action=compute: evaluate a stage with the captured results, store the
// outcome in mundial_winners (unpublished) and return it for review.
// action=publish: toggle visibility on the public page.
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  const db = supabaseAdmin();

  if (parsed.data.action === "publish") {
    const { error } = await db
      .from("mundial_winners")
      .update({ published: parsed.data.published, updated_at: new Date().toISOString() })
      .eq("stage", parsed.data.stage);
    if (error) {
      return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { stage } = parsed.data;
  const [entriesRes, resultsRes, ticketsRes, savedWinnersRes] = await Promise.all([
    db.from("mundial_entries").select("*"),
    db.from("mundial_results").select("*").maybeSingle(),
    db.from("mundial_tickets").select("amount_usd, status, source, used_at"),
    db.from("mundial_winners").select("stage, payload, prize_usd"),
  ]);

  if (entriesRes.error || resultsRes.error || ticketsRes.error || savedWinnersRes.error) {
    return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }
  if (!resultsRes.data) {
    return NextResponse.json(
      { error: "Primero captura los resultados reales en la pestaña Resultados." },
      { status: 409 },
    );
  }

  const outcome = stageOutcome(
    stage,
    (entriesRes.data ?? []) as MundialEntryRow[],
    resultsRes.data as MundialResultsRow,
  );
  if (!outcome.ready) {
    return NextResponse.json(
      {
        error:
          "Faltan datos reales para esta etapa: captura sus ganadores/finalistas/campeón Y el marcador del partido clave en la pestaña Resultados.",
      },
      { status: 409 },
    );
  }

  // Only tickets actually sold fund the pool (pre-minted physical tickets
  // without a filled quiniela don't represent money received).
  const sold = (ticketsRes.data ?? []).filter(isSoldTicket);
  const totalUsd = sold.reduce((sum, t) => sum + Number(t.amount_usd ?? 0), 0);
  const pool = computePrizePool(sold.length, totalUsd);

  // Rollover into the final: earlier stages already computed with zero hitters.
  let rolloverUsd = 0;
  if (stage === "final") {
    for (const prev of ["cuartos", "semis"] as const) {
      const saved = (savedWinnersRes.data ?? []).find((w) => w.stage === prev);
      const p = saved?.payload as { rollsToFinal?: boolean } | null;
      if (p?.rollsToFinal) {
        rolloverUsd += pool.prizeByStage[prev];
      }
    }
  }

  const prizeTotal = Math.round((pool.prizeByStage[stage] + rolloverUsd) * 100) / 100;
  const prizePerWinner =
    outcome.winners.length > 0
      ? Math.round((prizeTotal / outcome.winners.length) * 100) / 100
      : 0;

  const payload = {
    computedAt: new Date().toISOString(),
    winners: outcome.winners.map((w) => ({
      fullName: w.fullName,
      submittedAt: w.submittedAt,
      distance: w.distance,
    })),
    count: outcome.winners.length,
    hitCount: outcome.hitCount,
    eligibleCount: outcome.eligibleCount,
    exact: outcome.winners.length > 0 && outcome.winners[0].distance === 0,
    prizePerWinner,
    rolloverUsd,
    // Nobody hit cuartos/semis → the pot rolls over to the final prize.
    rollsToFinal: stage !== "final" && outcome.hitCount === 0,
  };

  const { error: saveError } = await db.from("mundial_winners").upsert({
    stage,
    payload,
    prize_usd: prizeTotal,
    published: false,
    updated_at: new Date().toISOString(),
  });
  if (saveError) {
    console.error("[mundial admin winners] save failed", saveError);
    return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }

  return NextResponse.json({ outcome: payload, prizeTotal, winners: outcome.winners });
}

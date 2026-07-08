import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/mundial/adminAuth";
import { ALIVE_TEAMS } from "@/lib/mundial/teams";
import { FINAL_ENDING_IDS, FINAL_STAR_IDS, TOP_SCORER_IDS } from "@/lib/mundial/players";

export const runtime = "nodejs";

const teamId = z.enum(ALIVE_TEAMS as [string, ...string[]]);
const score = z.object({
  home: z.number().int().min(0).max(9),
  away: z.number().int().min(0).max(9),
});

const resultsSchema = z.object({
  qf_winners: z
    .object({
      qf1: teamId.optional(),
      qf2: teamId.optional(),
      qf3: teamId.optional(),
      qf4: teamId.optional(),
    })
    .default({}),
  finalists: z.array(teamId).max(2).default([]),
  champion: teamId.nullable().default(null),
  tiebreaker_scores: z
    .object({
      cuartos: score.optional(),
      semis: score.optional(),
      final: score.optional(),
    })
    .default({}),
  final_extras: z
    .object({
      topScorer: z.enum(TOP_SCORER_IDS as unknown as [string, ...string[]]).optional(),
      star: z.enum(FINAL_STAR_IDS).optional(),
      ending: z.enum(FINAL_ENDING_IDS).optional(),
    })
    .default({}),
});

// Admin captures real match results as the tournament unfolds (single row).
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = resultsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Resultados inválidos" }, { status: 400 });
  }

  const { error } = await supabaseAdmin()
    .from("mundial_results")
    .upsert({ id: true, ...parsed.data, updated_at: new Date().toISOString() });

  if (error) {
    console.error("[mundial admin results] upsert failed", error);
    return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

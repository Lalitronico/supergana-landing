import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/mundial/adminAuth";
import { eligibleStages } from "@/lib/mundial/config";
import { finalEndingLabel, finalStarLabel, topScorerLabel } from "@/lib/mundial/players";
import type { MundialEntryRow, MundialTicketRow } from "@/lib/mundial/schema";

export const runtime = "nodejs";

const csvCell = (value: unknown): string => {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// CSV of every ticket + its entry answers, for Excel review by Rotary.
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const [tickets, entries] = await Promise.all([
    db.from("mundial_tickets").select("*").order("created_at", { ascending: true }),
    db.from("mundial_entries").select("*"),
  ]);
  if (tickets.error || entries.error) {
    return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }

  const entryByTicket = new Map(
    ((entries.data ?? []) as MundialEntryRow[]).map((e) => [e.ticket_id, e]),
  );

  const header = [
    "boleto",
    "origen",
    "estado_pago",
    "monto_usd",
    "stripe_session",
    "comprado_en",
    "nombre",
    "email",
    "telefono",
    "quiniela_enviada_en",
    "etapas_elegibles",
    "qf1",
    "qf2",
    "qf3",
    "qf4",
    "finalista_a",
    "finalista_b",
    "campeon",
    "marcador_cuartos",
    "marcador_semis",
    "marcador_final",
    "como_termina",
    "goleador",
    "estrella_final",
  ];

  const lines = ((tickets.data ?? []) as MundialTicketRow[]).map((t) => {
    const e = entryByTicket.get(t.id);
    const a = e?.answers;
    return [
      t.id,
      t.source,
      t.status,
      t.amount_usd,
      t.stripe_session_id ?? "",
      t.created_at,
      e?.full_name ?? "",
      e?.email ?? t.email ?? "",
      e?.phone ?? "",
      e?.created_at ?? "",
      e ? eligibleStages(new Date(e.created_at)).join("|") : "",
      a?.qf1 ?? "",
      a?.qf2 ?? "",
      a?.qf3 ?? "",
      a?.qf4 ?? "",
      a?.sf1 ?? "",
      a?.sf2 ?? "",
      a?.champion ?? "",
      a?.tiebreakers.cuartos
        ? `${a.tiebreakers.cuartos.home}-${a.tiebreakers.cuartos.away}`
        : "",
      a?.tiebreakers.semis ? `${a.tiebreakers.semis.home}-${a.tiebreakers.semis.away}` : "",
      a ? `${a.tiebreakers.final.home}-${a.tiebreakers.final.away}` : "",
      a ? finalEndingLabel(a.finalEnding) : "",
      a ? topScorerLabel(a.topScorer) : "",
      a ? finalStarLabel(a.finalStar) : "",
    ]
      .map(csvCell)
      .join(",");
  });

  const csv = "﻿" + [header.join(","), ...lines].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quiniela-mundial-rotary.csv"`,
    },
  });
}

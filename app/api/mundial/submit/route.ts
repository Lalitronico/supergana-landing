import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mundialSubmissionSchema } from "@/lib/mundial/schema";
import { eligibleStages, isStageLocked } from "@/lib/mundial/config";
import { sendEntryConfirmationEmail } from "@/lib/mundial/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = mundialSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Faltan respuestas o hay campos inválidos. Revisa el formulario." },
      { status: 400 },
    );
  }
  const { ticket, fullName, email, phone, answers } = parsed.data;

  // After the final kicks off there is nothing left to compete for.
  if (isStageLocked("final")) {
    return NextResponse.json(
      { error: "La campaña ya cerró: la final del Mundial ya comenzó." },
      { status: 409 },
    );
  }

  // Rolling stages: the schema marks per-stage answers optional (the form
  // skips stages already played), so enforce here that every stage still
  // OPEN at submit time was answered.
  const missingCuartos =
    !isStageLocked("cuartos") &&
    !(answers.qf1 && answers.qf2 && answers.qf3 && answers.qf4 && answers.tiebreakers.cuartos);
  const missingSemis =
    !isStageLocked("semis") &&
    !(answers.sf1 && answers.sf2 && answers.tiebreakers.semis);
  if (missingCuartos || missingSemis) {
    return NextResponse.json(
      { error: "Faltan respuestas de una etapa aún en juego. Revisa el formulario." },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();
  const { data: ticketRow, error: ticketError } = await db
    .from("mundial_tickets")
    .select("id, status, used_at")
    .eq("id", ticket)
    .maybeSingle();

  if (ticketError) {
    console.error("[mundial submit] ticket lookup failed", ticketError);
    return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }
  if (!ticketRow || ticketRow.status !== "paid") {
    return NextResponse.json({ error: "Boleto no válido" }, { status: 404 });
  }
  if (ticketRow.used_at) {
    return NextResponse.json(
      { error: "Este boleto ya fue usado. Cada boleto vale una quiniela." },
      { status: 409 },
    );
  }

  const { data: entry, error: insertError } = await db
    .from("mundial_entries")
    .insert({
      ticket_id: ticket,
      full_name: fullName,
      email: email.toLowerCase(),
      phone,
      accepted_rules: true,
      answers,
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    // unique(ticket_id) — double submit race resolves to "already used"
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Este boleto ya fue usado. Cada boleto vale una quiniela." },
        { status: 409 },
      );
    }
    console.error("[mundial submit] insert failed", insertError);
    return NextResponse.json({ error: "No pudimos guardar tu quiniela" }, { status: 500 });
  }

  await db
    .from("mundial_tickets")
    .update({ used_at: entry.created_at })
    .eq("id", ticket);

  const eligible = eligibleStages(new Date(entry.created_at));
  // Fire-and-forget: a failed email must not fail the submission.
  sendEntryConfirmationEmail(email, fullName, answers, eligible).catch((e) =>
    console.error("[mundial submit] confirmation email failed", e),
  );

  return NextResponse.json({
    entryId: entry.id,
    submittedAt: entry.created_at,
    eligibleStages: eligible,
  });
}

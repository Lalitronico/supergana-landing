import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/mundial/adminAuth";
import { sendTicketEmail } from "@/lib/mundial/email";

export const runtime = "nodejs";

const manualTicketSchema = z.object({
  email: z.email().optional(),
  note: z.string().trim().max(200).optional(),
  sendEmail: z.boolean().default(false),
});

// Issues a manual ticket for payments received outside Stripe (transferencia,
// efectivo en el club). Returns the unique form link to share with the donor.
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
  const parsed = manualTicketSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { data: ticket, error } = await supabaseAdmin()
    .from("mundial_tickets")
    .insert({
      email: parsed.data.email ?? null,
      source: "manual",
      note: parsed.data.note ?? null,
    })
    .select("id")
    .single();

  if (error || !ticket) {
    console.error("[mundial admin tickets] insert failed", error);
    return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }

  if (parsed.data.sendEmail && parsed.data.email) {
    await sendTicketEmail(parsed.data.email, ticket.id);
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://supergana.fun";
  return NextResponse.json({
    ticket: ticket.id,
    link: `${site}/mundial/quiniela/?ticket=${ticket.id}`,
  });
}

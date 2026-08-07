import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { canReview, resolveStaff, staffDenialStatus } from "@/lib/tickets/access";
import { getCampaign } from "@/lib/tickets/campaigns";
import { MAX_RECEIPT_BYTES, RECEIPTS_BUCKET } from "@/lib/tickets/config";
import { runAndStoreExtraction } from "@/lib/tickets/ocr";

export const runtime = "nodejs";

// Leer un ticket tarda entre 8 y 15 segundos. El default de Vercel no alcanza
// con holgura y una relectura que muere a medio camino deja al revisor sin
// saber si falló el modelo o la función.
export const maxDuration = 60;

const bodySchema = z.object({ receiptId: z.uuid() });

/**
 * Vuelve a leer un ticket, a petición del revisor.
 *
 * Existe porque la lectura automática corre una sola vez, al subir, y puede
 * fallar por cosas que se arreglan solas: una caída del proveedor, un timeout,
 * una campaña a la que le prendieron el OCR después de que llegaron los
 * tickets. Sin este botón, la única salida sería teclear todo a mano — que es
 * exactamente lo que la lectura vino a quitar.
 *
 * A diferencia del disparo al subir, este SÍ espera el resultado: el revisor
 * pidió la relectura y está mirando la pantalla. Un `after()` aquí le
 * devolvería la misma pantalla vacía que lo hizo apretar el botón.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campana: string }> },
) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const access = await resolveStaff(campaign.id);
  if (access.kind !== "ok") {
    return NextResponse.json({ error: access.kind }, { status: staffDenialStatus(access) });
  }
  // Releer cuesta dinero y escribe una fila. Se pide el mismo rol que decidir,
  // no el de mirar: un asiento de solo lectura no debe poder gastar.
  if (!canReview(access.staff.role)) {
    return NextResponse.json({ error: "role_cannot_review" }, { status: 403 });
  }

  if (!campaign.config.ocr.enabled) {
    return NextResponse.json({ error: "ocr_disabled" }, { status: 409 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const db = supabaseAdmin();

  // El ticket tiene que ser de ESTA campaña: un revisor autorizado en una no
  // debe poder gastar el presupuesto de otra adivinando un id.
  const { data: receipt, error } = await db
    .from("receipts")
    .select("id, image_path")
    .eq("id", parsed.data.receiptId)
    .eq("campaign_id", campaign.id)
    .maybeSingle<{ id: string; image_path: string }>();

  if (error) {
    console.error("[tickets extract] lookup failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!receipt) return NextResponse.json({ error: "receipt_not_found" }, { status: 404 });

  const { data: file, error: downloadError } = await db.storage
    .from(RECEIPTS_BUCKET)
    .download(receipt.image_path);

  if (downloadError || !file) {
    console.error("[tickets extract] object unreadable", receipt.image_path, downloadError);
    return NextResponse.json({ error: "image_missing" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_RECEIPT_BYTES) {
    return NextResponse.json({ error: "image_missing" }, { status: 400 });
  }

  await runAndStoreExtraction({
    db,
    receiptId: receipt.id,
    campaignId: campaign.id,
    bytes,
    contentType: file.type || "image/jpeg",
    timezone: campaign.config.timezone,
    model: campaign.config.ocr.model,
  });

  // Se devuelve la fila recién escrita en vez del resultado en memoria: así el
  // navegador ve exactamente lo que quedó guardado, y no una versión paralela
  // que podría diferir si el insert falló.
  const { data: fresh } = await db
    .from("receipt_extractions")
    .select(
      "receipt_id, status, model, store_name, store_branch, purchase_date, purchase_date_raw, purchase_time, total_cents, total_printed, lines, legible, issues, error, latency_ms, input_tokens, output_tokens, created_at",
    )
    .eq("receipt_id", receipt.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ extraction: fresh ?? null });
}

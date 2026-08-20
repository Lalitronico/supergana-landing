import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { canReview, resolveStaff, staffDenialStatus } from "@/lib/tickets/access";
import { getCampaign } from "@/lib/tickets/campaigns";
import { RECEIPTS_BUCKET } from "@/lib/tickets/config";
import { autoStoreName } from "@/lib/tickets/autoreview";

export const runtime = "nodejs";

/**
 * What the model read, and what was decided about it — side by side.
 *
 * WHY THIS EXISTS. Auto-approval settles clean receipts without a human, which
 * means the receipts the machine is MOST confident about are exactly the ones
 * no person ever sees. The review queue only holds what it refused to decide.
 * So the console had a complete view of the machine's doubts and no view at all
 * of its judgements, and "is the OCR any good" was a question nobody could
 * answer from the product — only by reading rows in SQL.
 *
 * This is the answer: every receipt, the photo, the transcription, the outcome,
 * and — where a human touched it afterwards — what they typed instead. That
 * last column is the only honest basis for trusting the reading more or less
 * than we do today.
 *
 * REVIEWERS ONLY, and that is stricter than it looks. The queue is visible to
 * anyone with a seat; this is not, because it shows every receipt in the
 * campaign including settled ones, with the images attached. `canReview` is the
 * same gate the manual re-read uses.
 *
 * A SIGNED URL PER RECEIPT, minted here rather than fetched one at a time by
 * the browser: a page of thirty receipts would otherwise be thirty round trips
 * before the first photo appears. Five minutes, like the single-image route —
 * long enough to work through a page, short enough that a URL pasted into a
 * chat stops working.
 */

const PAGE = 30;
const SIGNED_URL_TTL_SECONDS = 300;

interface ExtractionRow {
  receipt_id: string;
  status: string;
  model: string;
  prompt_version: string;
  store_name: string | null;
  store_branch: string | null;
  purchase_date: string | null;
  purchase_date_raw: string | null;
  total_cents: number | null;
  total_printed: string | null;
  lines: unknown;
  legible: boolean | null;
  issues: unknown;
  error: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

interface ReceiptRow {
  id: string;
  status: string;
  image_path: string;
  submitted_at: string;
  store_name: string | null;
  purchase_date: string | null;
  total_cents: number | null;
  eligible_cents: number | null;
  reject_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export async function GET(
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
  // Seeing what a third party read off somebody's receipt is a reviewer's
  // privilege, not a seat's.
  if (!canReview(access.staff.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const page = Math.max(0, Number.parseInt(req.nextUrl.searchParams.get("page") ?? "0", 10) || 0);
  const db = supabaseAdmin();

  const { data: receipts, error, count } = await db
    .from("receipts")
    .select(
      "id, status, image_path, submitted_at, store_name, purchase_date, total_cents, eligible_cents, reject_reason, reviewed_at, reviewed_by",
      { count: "exact" },
    )
    .eq("campaign_id", campaign.id)
    .order("submitted_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1)
    .returns<ReceiptRow[]>();

  if (error) {
    console.error("[tickets readings] receipts failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const ids = (receipts ?? []).map((r) => r.id);
  if (ids.length === 0) {
    return NextResponse.json({ rows: [], page, pageSize: PAGE, total: count ?? 0 });
  }

  // Every reading, newest first — re-reads accumulate as history on purpose
  // (0025 has no uniqueness on receipt_id), and "the reviewer re-read it and
  // got something different" is worth seeing. Only the latest is shown; the
  // count says whether there were more.
  const { data: extractions } = await db
    .from("receipt_extractions")
    .select(
      "receipt_id, status, model, prompt_version, store_name, store_branch, purchase_date, purchase_date_raw, total_cents, total_printed, lines, legible, issues, error, latency_ms, input_tokens, output_tokens, created_at",
    )
    .in("receipt_id", ids)
    .order("created_at", { ascending: false })
    .returns<ExtractionRow[]>();

  const latest = new Map<string, ExtractionRow>();
  const readCount = new Map<string, number>();
  for (const row of extractions ?? []) {
    readCount.set(row.receipt_id, (readCount.get(row.receipt_id) ?? 0) + 1);
    if (!latest.has(row.receipt_id)) latest.set(row.receipt_id, row);
  }

  // The decision trail. `reviewer is null` is the machine's signature — that is
  // how `settleAutomatically` writes it, and it is what separates "approved by
  // the gate" from "approved by a person" without a second column to keep in
  // sync.
  const { data: reviews } = await db
    .from("receipt_reviews")
    .select("receipt_id, reviewer, decision, reason, created_at")
    .in("receipt_id", ids)
    .order("created_at", { ascending: true })
    .returns<{
      receipt_id: string;
      reviewer: string | null;
      decision: string;
      reason: string | null;
      created_at: string;
    }[]>();

  const trail = new Map<string, { reviewer: string | null; decision: string; reason: string | null; createdAt: string }[]>();
  for (const row of reviews ?? []) {
    const list = trail.get(row.receipt_id) ?? [];
    list.push({ reviewer: row.reviewer, decision: row.decision, reason: row.reason, createdAt: row.created_at });
    trail.set(row.receipt_id, list);
  }

  // Signed in one pass. `createSignedUrls` takes the whole list, so a page of
  // thirty is one call rather than thirty.
  const paths = (receipts ?? []).map((r) => r.image_path);
  const { data: signed } = await db.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  const urlByPath = new Map((signed ?? []).map((s) => [s.path ?? "", s.signedUrl]));

  const rows = (receipts ?? []).map((receipt) => {
    const extraction = latest.get(receipt.id) ?? null;
    const decisions = trail.get(receipt.id) ?? [];
    // The first decision is the one worth attributing: a receipt the gate
    // settled and a reviewer later corrected has two, and the question this
    // screen answers is what the MACHINE did.
    const first = decisions[0] ?? null;
    const humanAfter = decisions.find((d) => d.reviewer !== null) ?? null;

    return {
      receipt: {
        id: receipt.id,
        status: receipt.status,
        submittedAt: receipt.submitted_at,
        storeName: receipt.store_name,
        purchaseDate: receipt.purchase_date,
        totalCents: receipt.total_cents,
        eligibleCents: receipt.eligible_cents,
        rejectReason: receipt.reject_reason,
        reviewedAt: receipt.reviewed_at,
        imageUrl: urlByPath.get(receipt.image_path) ?? null,
      },
      reading: extraction && {
        status: extraction.status,
        model: extraction.model,
        promptVersion: extraction.prompt_version,
        // Resolved WITH the campaign's store list, which is the only way this
        // is the string the gate actually compared. Without it the column
        // headed "what it read" would show one name while "what was stored"
        // showed another, on the same receipt — this screen contradicting
        // itself about the one thing it exists to make legible.
        storeName: autoStoreName(extraction, campaign.config.stores),
        /** The two raw fields, so a reviewer can see how the receipt split them. */
        storeChain: extraction.store_name,
        storeBranch: extraction.store_branch,
        purchaseDate: extraction.purchase_date,
        purchaseDateRaw: extraction.purchase_date_raw,
        totalCents: extraction.total_cents,
        totalPrinted: extraction.total_printed,
        lines: Array.isArray(extraction.lines) ? extraction.lines : [],
        legible: extraction.legible,
        issues: Array.isArray(extraction.issues) ? extraction.issues : [],
        error: extraction.error,
        latencyMs: extraction.latency_ms,
        inputTokens: extraction.input_tokens,
        outputTokens: extraction.output_tokens,
        readAt: extraction.created_at,
        reads: readCount.get(receipt.id) ?? 0,
      },
      decision: first && {
        // The machine signs with a null reviewer. Nothing else does.
        byMachine: first.reviewer === null,
        decision: first.decision,
        reason: first.reason,
        at: first.createdAt,
      },
      /** A person touched it after the machine — the disagreement, if any. */
      humanAfterMachine: Boolean(first && first.reviewer === null && humanAfter),
    };
  });

  return NextResponse.json({ rows, page, pageSize: PAGE, total: count ?? 0 });
}

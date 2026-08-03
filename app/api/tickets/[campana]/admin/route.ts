import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveStaff, staffDenialStatus } from "@/lib/tickets/access";
import { getCampaign, getQuotaState } from "@/lib/tickets/campaigns";
import type { RiskFlag } from "@/lib/tickets/schema";

export const runtime = "nodejs";

const OPEN_STATUSES = ["received", "in_review", "needs_new_image"];
const NEW_ACCOUNT_MS = 2 * 60 * 60 * 1000;

interface ParticipantLite {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  zip: string | null;
  state: string | null;
  phone: string | null;
  /** Generated from last_name + zip, so it is null wherever the ZIP is (0015). */
  household_key: string | null;
  created_at: string;
}

interface ReceiptLite {
  id: string;
  participant_id: string;
  status: string;
  image_path: string;
  image_hash: string | null;
  submitted_at: string;
  store_name: string | null;
  purchase_date: string | null;
  total_cents: number | null;
  eligible_cents: number | null;
  reject_reason: string | null;
  reviewed_at: string | null;
}

/**
 * One snapshot for the whole console, the way the Mundial panel works. The
 * pilot's data fits comfortably in a single payload, and one request keeps the
 * queue, the fund and the ledger consistent with each other — a console
 * showing a stale fund next to a fresh queue is how money gets double-promised.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ campana: string }> },
) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const access = await resolveStaff(campaign.id);
  if (access.kind !== "ok") {
    return NextResponse.json(
      { error: access.kind },
      { status: staffDenialStatus(access) },
    );
  }
  const staff = access.staff;

  const db = supabaseAdmin();
  const [participantsQ, receiptsQ, rewardsQ, productsQ, consentsQ, quota] =
    await Promise.all([
      // `*` rather than a column list, unlike every other read here: `phone`
      // arrives with migration 0015 and an explicit list naming it would take
      // the whole console down on any project that has not run it yet — the
      // normal state between a deploy and a migration. What actually reaches
      // the browser is still an explicit projection, in `toRow` below.
      db.from("participants").select("*").eq("campaign_id", campaign.id),
      db
        .from("receipts")
        .select(
          "id, participant_id, status, image_path, image_hash, submitted_at, store_name, purchase_date, total_cents, eligible_cents, reject_reason, reviewed_at",
        )
        .eq("campaign_id", campaign.id)
        .order("submitted_at", { ascending: true }),
      db
        .from("rewards")
        .select(
          "id, participant_id, receipt_id, amount_cents, provider, external_id, provider_ref, status, household_key, week_start, note, created_at, sent_at",
        )
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false }),
      db
        .from("products")
        .select("id, brand, name, size, active, product_aliases(id, retailer, alias_text)")
        .eq("campaign_id", campaign.id)
        .order("brand"),
      db
        .from("consents")
        .select("participant_id, kind, accepted, accepted_at")
        .eq("kind", "marketing")
        .order("accepted_at", { ascending: false }),
      getQuotaState(campaign),
    ]);

  const firstError =
    participantsQ.error ?? receiptsQ.error ?? rewardsQ.error ?? productsQ.error;
  if (firstError) {
    console.error("[tickets admin] query failed", firstError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const participants = (participantsQ.data ?? []) as ParticipantLite[];
  const receipts = (receiptsQ.data ?? []) as ReceiptLite[];
  const rewards = rewardsQ.data ?? [];

  const byId = new Map(participants.map((p) => [p.id, p]));

  // Pre-aggregate what the flags need, so the queue stays O(receipts).
  const rewardedParticipants = new Set(
    rewards.filter((r) => r.status !== "canceled").map((r) => r.participant_id),
  );
  const rewardedHouseholds = new Set(
    rewards.filter((r) => r.status !== "canceled").map((r) => r.household_key),
  );
  // Null keys are skipped, not counted: a campaign that asks for no ZIP leaves
  // every participant without a household (0015), and grouping them under the
  // same absent key would flag the whole campaign as one enormous family.
  const householdSize = new Map<string, number>();
  for (const p of participants) {
    if (!p.household_key) continue;
    householdSize.set(p.household_key, (householdSize.get(p.household_key) ?? 0) + 1);
  }
  const receiptsPerParticipant = new Map<string, number>();
  for (const r of receipts) {
    receiptsPerParticipant.set(
      r.participant_id,
      (receiptsPerParticipant.get(r.participant_id) ?? 0) + 1,
    );
  }

  const flagsFor = (receipt: ReceiptLite, participant?: ParticipantLite): RiskFlag[] => {
    if (!participant) {
      return [{ level: "bad", code: "clean", detail: "Participante no encontrado" }];
    }
    const flags: RiskFlag[] = [];

    if (rewardedParticipants.has(participant.id)) {
      flags.push({
        level: "bad",
        code: "participant_rewarded",
        detail: "Este participante ya recibió una recompensa en esta campaña",
      });
    } else if (
      participant.household_key &&
      rewardedHouseholds.has(participant.household_key)
    ) {
      flags.push({
        level: "bad",
        code: "household_rewarded",
        detail: `Otro participante del mismo hogar (${participant.last_name} · ${participant.zip}) ya fue premiado`,
      });
    } else if (
      participant.household_key &&
      (householdSize.get(participant.household_key) ?? 0) > 1
    ) {
      flags.push({
        level: "warn",
        code: "household_shared",
        detail: `${householdSize.get(participant.household_key)} cuentas comparten apellido y ZIP — puede ser legítimo, revísalo`,
      });
    }

    const count = receiptsPerParticipant.get(participant.id) ?? 1;
    if (count > 1) {
      flags.push({
        level: "warn",
        code: "repeat_submitter",
        detail: `${count} tickets enviados por esta cuenta`,
      });
    }

    const age =
      new Date(receipt.submitted_at).getTime() - new Date(participant.created_at).getTime();
    if (age < NEW_ACCOUNT_MS) {
      flags.push({
        level: "warn",
        code: "new_account",
        detail: "Cuenta creada menos de 2 horas antes de enviar el ticket",
      });
    }

    if (flags.length === 0) {
      flags.push({
        level: "ok",
        code: "clean",
        detail: "Sin señales: hogar único, primera solicitud, cuenta con antigüedad",
      });
    }
    return flags;
  };

  const toRow = (r: ReceiptLite) => {
    const p = byId.get(r.participant_id);
    return {
      receipt: r,
      participant: p
        ? {
            id: p.id,
            email: p.email,
            firstName: p.first_name,
            lastName: p.last_name,
            zip: p.zip,
            state: p.state,
            phone: p.phone ?? null,
            householdKey: p.household_key,
            createdAt: p.created_at,
          }
        : null,
      flags: flagsFor(r, p),
    };
  };

  const queue = receipts.filter((r) => OPEN_STATUSES.includes(r.status)).map(toRow);
  const decided = receipts
    .filter((r) => !OPEN_STATUSES.includes(r.status))
    .slice(-60)
    .reverse()
    .map(toRow);

  // Median, not mean: one receipt reviewed after a weekend would drag an
  // average past the 48h promise while every other claim was answered in hours.
  const reviewMinutes = receipts
    .filter((r) => r.reviewed_at)
    .map(
      (r) =>
        (new Date(r.reviewed_at as string).getTime() - new Date(r.submitted_at).getTime()) /
        60000,
    )
    .sort((a, b) => a - b);
  const medianReviewMinutes =
    reviewMinutes.length === 0
      ? null
      : Math.round(reviewMinutes[Math.floor(reviewMinutes.length / 2)]);

  const marketingOptIn = new Set(
    (consentsQ.data ?? [])
      .filter((c) => c.accepted)
      .map((c) => c.participant_id)
      .filter((id) => byId.has(id)),
  ).size;

  const approvedCount = receipts.filter((r) => r.status === "approved").length;
  const eligibleTotal = receipts
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + Number(r.eligible_cents ?? 0), 0);

  return NextResponse.json({
    staff: { email: staff.email, role: staff.role },
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      name: campaign.name,
      orgName: campaign.orgName,
      status: campaign.status,
      config: campaign.config,
    },
    quota,
    summary: {
      participants: participants.length,
      receipts: receipts.length,
      approved: approvedCount,
      rejected: receipts.filter((r) => r.status === "rejected").length,
      needsNewImage: receipts.filter((r) => r.status === "needs_new_image").length,
      pending: queue.length,
      marketingOptIn,
      medianReviewMinutes,
      avgEligibleCents: approvedCount > 0 ? Math.round(eligibleTotal / approvedCount) : null,
    },
    queue,
    decided,
    rewards: rewards.map((r) => ({
      ...r,
      participantEmail: byId.get(r.participant_id)?.email ?? null,
      participantName: byId.get(r.participant_id)
        ? `${byId.get(r.participant_id)?.first_name} ${byId.get(r.participant_id)?.last_name}`
        : null,
    })),
    products: productsQ.data ?? [],
  });
}

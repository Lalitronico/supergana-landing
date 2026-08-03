import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { supabaseRoute } from "@/lib/supabase/route";
import { resolveParticipant } from "@/lib/tickets/access";
import { getCampaign, isVisible } from "@/lib/tickets/campaigns";
import { mechanicOf, weekStart } from "@/lib/tickets/config";
import { redeemSchema } from "@/lib/tickets/schema";
import {
  isMissingStoreRelation,
  redemptionHoldsStock,
  type DropStatus,
  type PrizeKind,
  type RedemptionStatus,
  type StorePrize,
  type StoreRedemption,
  type StoreSnapshot,
} from "@/lib/tickets/store";
import type { Campaign } from "@/lib/tickets/config";

export const runtime = "nodejs";

/**
 * The Prize Store, from the participant's side.
 *
 * Accumulation campaigns only: a threshold campaign pays a fixed reward per
 * receipt and has no balance to spend, so the store is not "empty" there — it
 * does not exist, and 404 says so.
 */
const HISTORY_LIMIT = 30;

interface DropRow {
  id: string;
  week_start: string;
  status: DropStatus;
}

interface ItemRow {
  id: string;
  name_es: string;
  name_en: string | null;
  kind: PrizeKind;
  points_cost: number;
  inventory: number;
  active: boolean;
  detail: Record<string, unknown> | null;
}

interface RedemptionRow {
  id: string;
  redemption_code: string;
  status: RedemptionStatus;
  points_spent: number;
  created_at: string;
  fulfilled_at: string | null;
  drop_item_id: string;
  prize_drop_items: { name_es: string; name_en: string | null; kind: PrizeKind } | null;
}

/** Monday 00:00 of the campaign's plaza, asked of Postgres so it matches the RPC. */
const currentWeekStart = async (campaign: Campaign): Promise<string> => {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("tickets_week_start", {
    p_tz: campaign.config.timezone,
  });
  if (error) console.error("[tickets store] week_start rpc failed", error);
  return typeof data === "string"
    ? data
    : weekStart(campaign.config.timezone).toISOString();
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ campana: string }> },
) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign || !isVisible(campaign)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (mechanicOf(campaign.config) !== "accumulation") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ctx = await resolveParticipant(campaign.id);
  if (!ctx) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const week = await currentWeekStart(campaign);
  const empty: StoreSnapshot = {
    available: true,
    weekStart: week,
    points: 0,
    drop: null,
    redemptions: [],
  };

  const db = supabaseAdmin();

  // Recent drops rather than an equality filter on the timestamp: comparing a
  // timestamptz through the query string means trusting two serialisations to
  // agree. The week is decided here, in one place, against the same instant the
  // RPC will use.
  const { data: dropRows, error: dropError } = await db
    .from("prize_drops")
    .select("id, week_start, status")
    .eq("campaign_id", campaign.id)
    .order("week_start", { ascending: false })
    .limit(6);

  // THE GUARD: between a deploy and its migration these tables do not exist.
  // That is a normal state, not an outage, and the panel must survive it.
  if (dropError) {
    if (isMissingStoreRelation(dropError)) {
      return NextResponse.json({ ...empty, available: false });
    }
    console.error("[tickets store] drop read failed", dropError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const weekMs = new Date(week).getTime();
  const drop =
    ((dropRows ?? []) as DropRow[]).find(
      (d) => d.status === "open" && new Date(d.week_start).getTime() === weekMs,
    ) ?? null;

  let items: StorePrize[] = [];
  if (drop) {
    const { data: itemRows, error: itemError } = await db
      .from("prize_drop_items")
      .select("id, name_es, name_en, kind, points_cost, inventory, active, detail")
      .eq("drop_id", drop.id)
      .eq("active", true)
      .order("points_cost", { ascending: true });

    if (itemError) {
      console.error("[tickets store] item read failed", itemError);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    const rows = (itemRows ?? []) as ItemRow[];
    // Remaining stock is counted, never read from a column: the redemptions ARE
    // the inventory ledger, exactly like points_entries is the balance.
    const claimed = new Map<string, number>();
    if (rows.length > 0) {
      const { data: taken, error: takenError } = await db
        .from("prize_redemptions")
        .select("drop_item_id, status")
        .in("drop_item_id", rows.map((r) => r.id));

      if (takenError) {
        console.error("[tickets store] redemption count failed", takenError);
        return NextResponse.json({ error: "db_error" }, { status: 500 });
      }
      for (const row of (taken ?? []) as { drop_item_id: string; status: RedemptionStatus }[]) {
        if (!redemptionHoldsStock(row.status)) continue;
        claimed.set(row.drop_item_id, (claimed.get(row.drop_item_id) ?? 0) + 1);
      }
    }

    items = rows.map((row) => ({
      id: row.id,
      nameEs: row.name_es,
      nameEn: row.name_en,
      kind: row.kind,
      pointsCost: row.points_cost,
      inventory: row.inventory,
      remaining: Math.max(0, row.inventory - (claimed.get(row.id) ?? 0)),
      active: row.active,
      detail: row.detail ?? {},
    }));
  }

  if (!ctx.participant) {
    return NextResponse.json({
      ...empty,
      drop: drop ? { id: drop.id, status: drop.status, weekStart: drop.week_start, items } : null,
    });
  }

  const [mine, ledger] = await Promise.all([
    db
      .from("prize_redemptions")
      .select(
        "id, redemption_code, status, points_spent, created_at, fulfilled_at, drop_item_id, prize_drop_items(name_es, name_en, kind)",
      )
      .eq("participant_id", ctx.participant.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    db.from("points_entries").select("points").eq("participant_id", ctx.participant.id),
  ]);

  if (mine.error) {
    console.error("[tickets store] history read failed", mine.error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const redemptions: StoreRedemption[] = ((mine.data ?? []) as unknown as RedemptionRow[]).map(
    (row) => ({
      id: row.id,
      code: row.redemption_code,
      status: row.status,
      pointsSpent: row.points_spent,
      createdAt: row.created_at,
      fulfilledAt: row.fulfilled_at,
      dropItemId: row.drop_item_id,
      prizeNameEs: row.prize_drop_items?.name_es ?? "—",
      prizeNameEn: row.prize_drop_items?.name_en ?? null,
      kind: row.prize_drop_items?.kind ?? "item",
    }),
  );

  const snapshot: StoreSnapshot = {
    available: true,
    weekStart: week,
    // The spendable balance, summed here for the same reason /me sums it: a
    // balance column is how a total and its history stop agreeing.
    points: ((ledger.data ?? []) as { points: number }[]).reduce((s, e) => s + e.points, 0),
    drop: drop ? { id: drop.id, status: drop.status, weekStart: drop.week_start, items } : null,
    redemptions,
  };

  return NextResponse.json(snapshot);
}

// Rules the database refuses on. Anything else is a failure, not a rule, and
// must surface as a 500 rather than as friendly copy over a broken write.
const REDEEM_RULE_CODES = new Set([
  "campaign_not_found",
  "not_a_participant",
  "item_not_found",
  "item_inactive",
  "drop_closed",
  "sold_out",
  "already_redeemed",
  "insufficient_points",
]);

/**
 * Redeem. Every rule lives inside `tickets_redeem_prize`, under a row lock, so
 * "first to redeem takes it" is decided by Postgres and not by whoever's
 * request arrived at whichever serverless instance.
 *
 * Called with the participant's own session, not the service role: the function
 * resolves who is spending from `auth.uid()`, which is precisely why no request
 * body can name somebody else's balance.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campana: string }> },
) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign || !isVisible(campaign)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (mechanicOf(campaign.config) !== "accumulation") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // A draft campaign still redeems: that is the rehearsal the console and the
  // client walk before launch, the same allowance receipts already have.
  const ctx = await resolveParticipant(campaign.id);
  if (!ctx) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  if (!ctx.participant) {
    return NextResponse.json({ error: "not_a_participant" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const parsed = redeemSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const asParticipant = await supabaseRoute();
  const { data, error } = await asParticipant.rpc("tickets_redeem_prize", {
    p_campaign_slug: campaign.slug,
    p_drop_item_id: parsed.data.dropItemId,
  });

  if (error) {
    if (isMissingStoreRelation(error)) {
      return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
    }
    const code = error.message?.trim();
    if (code && REDEEM_RULE_CODES.has(code)) {
      // 409: well-formed request, the campaign's rules refused it.
      return NextResponse.json({ error: code }, { status: 409 });
    }
    console.error("[tickets store] redeem failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, redemption: data });
}

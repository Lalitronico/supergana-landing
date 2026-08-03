import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { canManageStore } from "@/lib/tickets/roles";
import { resolveStaff, staffDenialStatus } from "@/lib/tickets/access";
import { getCampaign } from "@/lib/tickets/campaigns";
import { mechanicOf, weekStart } from "@/lib/tickets/config";
import { storeAdminSchema } from "@/lib/tickets/schema";
import {
  isMissingStoreRelation,
  redemptionHoldsStock,
  type DropStatus,
  type PrizeKind,
  type RedemptionStatus,
} from "@/lib/tickets/store";
import type { Campaign } from "@/lib/tickets/config";

export const runtime = "nodejs";

/**
 * The prize store from the console's side: curate the weekly Drop, price it,
 * stock it, and hand prizes over.
 *
 * Split from the main `/admin` snapshot on purpose. That route is one request
 * so the queue, the fund and the ledger can never disagree with each other —
 * but the store's tables arrive with a migration the deployed code does not
 * wait for, and folding them in would mean a pending migration takes the whole
 * console down. Here a missing table is a flag on one view.
 */

const DROPS_SHOWN = 8;
const REDEMPTIONS_SHOWN = 200;

interface DropRow {
  id: string;
  week_start: string;
  status: DropStatus;
  created_at: string;
}

interface ItemRow {
  id: string;
  drop_id: string;
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
  participant_id: string;
  drop_item_id: string;
  redemption_code: string;
  status: RedemptionStatus;
  points_spent: number;
  created_at: string;
  fulfilled_at: string | null;
}

const currentWeekStart = async (campaign: Campaign): Promise<string> => {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("tickets_week_start", {
    p_tz: campaign.config.timezone,
  });
  if (error) console.error("[tickets admin store] week_start rpc failed", error);
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
  if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const access = await resolveStaff(campaign.id);
  if (access.kind !== "ok") {
    return NextResponse.json({ error: access.kind }, { status: staffDenialStatus(access) });
  }

  const week = await currentWeekStart(campaign);
  const db = supabaseAdmin();

  const { data: dropRows, error: dropError } = await db
    .from("prize_drops")
    .select("id, week_start, status, created_at")
    .eq("campaign_id", campaign.id)
    .order("week_start", { ascending: false })
    .limit(DROPS_SHOWN);

  // THE GUARD, console side: the tables land with migration 0013. Until then
  // the view says so plainly instead of the console failing to load.
  if (dropError) {
    if (isMissingStoreRelation(dropError)) {
      return NextResponse.json({
        available: false,
        weekStart: week,
        canManage: canManageStore(access.staff.role),
        mechanic: mechanicOf(campaign.config),
        drops: [],
        redemptions: [],
      });
    }
    console.error("[tickets admin store] drop read failed", dropError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const drops = (dropRows ?? []) as DropRow[];
  const dropIds = drops.map((d) => d.id);

  const [itemsQ, redemptionsQ, participantsQ] = await Promise.all([
    dropIds.length > 0
      ? db
          .from("prize_drop_items")
          .select("id, drop_id, name_es, name_en, kind, points_cost, inventory, active, detail")
          .in("drop_id", dropIds)
          .order("points_cost", { ascending: true })
      : Promise.resolve({ data: [] as ItemRow[], error: null }),
    db
      .from("prize_redemptions")
      .select(
        "id, participant_id, drop_item_id, redemption_code, status, points_spent, created_at, fulfilled_at",
      )
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false })
      .limit(REDEMPTIONS_SHOWN),
    db
      .from("participants")
      .select("id, email, first_name, last_name, alias")
      .eq("campaign_id", campaign.id),
  ]);

  const failure = itemsQ.error ?? redemptionsQ.error ?? participantsQ.error;
  if (failure) {
    console.error("[tickets admin store] read failed", failure);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const items = (itemsQ.data ?? []) as ItemRow[];
  const redemptions = (redemptionsQ.data ?? []) as RedemptionRow[];
  const people = new Map(
    ((participantsQ.data ?? []) as {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      alias: string | null;
    }[]).map((p) => [p.id, p]),
  );

  // Derived stock again, and derived the same way as everywhere else: an
  // operator reading a different "remaining" than the participant sees is how a
  // prize gets promised twice.
  const claimed = new Map<string, number>();
  for (const r of redemptions) {
    if (!redemptionHoldsStock(r.status)) continue;
    claimed.set(r.drop_item_id, (claimed.get(r.drop_item_id) ?? 0) + 1);
  }
  const itemById = new Map(items.map((i) => [i.id, i]));

  return NextResponse.json({
    available: true,
    weekStart: week,
    canManage: canManageStore(access.staff.role),
    mechanic: mechanicOf(campaign.config),
    drops: drops.map((d) => ({
      id: d.id,
      weekStart: d.week_start,
      status: d.status,
      createdAt: d.created_at,
      isCurrentWeek: new Date(d.week_start).getTime() === new Date(week).getTime(),
      items: items
        .filter((i) => i.drop_id === d.id)
        .map((i) => ({
          id: i.id,
          nameEs: i.name_es,
          nameEn: i.name_en,
          kind: i.kind,
          pointsCost: i.points_cost,
          inventory: i.inventory,
          claimed: claimed.get(i.id) ?? 0,
          remaining: Math.max(0, i.inventory - (claimed.get(i.id) ?? 0)),
          active: i.active,
          detail: i.detail ?? {},
        })),
    })),
    redemptions: redemptions.map((r) => {
      const person = people.get(r.participant_id);
      return {
        id: r.id,
        code: r.redemption_code,
        status: r.status,
        pointsSpent: r.points_spent,
        createdAt: r.created_at,
        fulfilledAt: r.fulfilled_at,
        prizeName: itemById.get(r.drop_item_id)?.name_es ?? "—",
        prizeKind: itemById.get(r.drop_item_id)?.kind ?? null,
        participantName: person ? `${person.first_name} ${person.last_name}` : null,
        participantAlias: person?.alias ?? null,
        participantEmail: person?.email ?? null,
      };
    }),
  });
}

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
  if (!canManageStore(access.staff.role)) {
    return NextResponse.json({ error: "role_cannot_manage_store" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const parsed = storeAdminSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_body", issues: parsed.error.issues.map((i) => i.path.join(".")) },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const db = supabaseAdmin();

  /** Every drop id in a request is checked against this campaign before use. */
  const ownDrop = async (dropId: string) => {
    const { data } = await db
      .from("prize_drops")
      .select("id, status, week_start")
      .eq("id", dropId)
      .eq("campaign_id", campaign.id)
      .maybeSingle<{ id: string; status: DropStatus; week_start: string }>();
    return data ?? null;
  };

  try {
    if (body.action === "create_drop") {
      const week = await currentWeekStart(campaign);
      // Created closed-ish ('scheduled'), never open: a Drop that opens the
      // instant it exists is a Drop with no prizes in it, and the participant
      // who looks right then sees an empty store.
      const { data, error } = await db
        .from("prize_drops")
        .insert({
          campaign_id: campaign.id,
          week_start: week,
          status: "scheduled",
          created_by: access.staff.userId,
        })
        .select("id")
        .single();

      if (error) {
        if (isMissingStoreRelation(error)) {
          return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
        }
        // unique (campaign_id, week_start): this week already has its Drop.
        if (error.code === "23505") {
          return NextResponse.json({ error: "drop_exists" }, { status: 409 });
        }
        console.error("[tickets admin store] create drop failed", error);
        return NextResponse.json({ error: "db_error" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, dropId: data.id });
    }

    if (body.action === "set_drop_status") {
      const drop = await ownDrop(body.dropId);
      if (!drop) return NextResponse.json({ error: "drop_not_found" }, { status: 404 });

      const { error } = await db
        .from("prize_drops")
        .update({ status: body.status })
        .eq("id", drop.id);
      if (error) {
        console.error("[tickets admin store] status update failed", error);
        return NextResponse.json({ error: "db_error" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, status: body.status });
    }

    if (body.action === "add_item") {
      const drop = await ownDrop(body.dropId);
      if (!drop) return NextResponse.json({ error: "drop_not_found" }, { status: 404 });

      const { error } = await db.from("prize_drop_items").insert({
        drop_id: drop.id,
        name_es: body.nameEs,
        name_en: body.nameEn ?? null,
        kind: body.kind,
        points_cost: body.pointsCost,
        inventory: body.inventory,
        detail: body.detail ?? {},
      });
      if (error) {
        console.error("[tickets admin store] add item failed", error);
        return NextResponse.json({ error: "db_error" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "update_item") {
      const { data: item } = await db
        .from("prize_drop_items")
        .select("id, inventory, prize_drops!inner(campaign_id)")
        .eq("id", body.itemId)
        .eq("prize_drops.campaign_id", campaign.id)
        .maybeSingle<{ id: string; inventory: number }>();
      if (!item) return NextResponse.json({ error: "item_not_found" }, { status: 404 });

      if (body.inventory !== undefined) {
        // Stock can be raised or lowered, but never below what is already
        // claimed: those units are promises somebody is holding a code for.
        const { count, error: countError } = await db
          .from("prize_redemptions")
          .select("id", { count: "exact", head: true })
          .eq("drop_item_id", item.id)
          .neq("status", "canceled");
        if (countError) {
          console.error("[tickets admin store] claimed count failed", countError);
          return NextResponse.json({ error: "db_error" }, { status: 500 });
        }
        if (body.inventory < (count ?? 0)) {
          return NextResponse.json(
            { error: "inventory_below_claimed", claimed: count ?? 0 },
            { status: 409 },
          );
        }
      }

      const patch: Record<string, unknown> = {};
      if (body.nameEs !== undefined) patch.name_es = body.nameEs;
      if (body.nameEn !== undefined) patch.name_en = body.nameEn;
      if (body.kind !== undefined) patch.kind = body.kind;
      if (body.pointsCost !== undefined) patch.points_cost = body.pointsCost;
      if (body.inventory !== undefined) patch.inventory = body.inventory;
      if (body.active !== undefined) patch.active = body.active;
      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
      }

      const { error } = await db.from("prize_drop_items").update(patch).eq("id", item.id);
      if (error) {
        console.error("[tickets admin store] update item failed", error);
        return NextResponse.json({ error: "db_error" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    // fulfill: the prize left the counter. Recorded with who handed it over,
    // and guarded against the other operator who clicked a second earlier —
    // the same optimistic `.eq(status).select()` the payout route uses, for the
    // same reason: a silent no-op reads as success and the prize goes out twice.
    const { data: moved, error } = await db
      .from("prize_redemptions")
      .update({
        status: "fulfilled",
        fulfilled_at: new Date().toISOString(),
        fulfilled_by: access.staff.userId,
      })
      .eq("id", body.redemptionId)
      .eq("campaign_id", campaign.id)
      .eq("status", "confirmed")
      .select("id, redemption_code");

    if (error) {
      if (isMissingStoreRelation(error)) {
        return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
      }
      console.error("[tickets admin store] fulfill failed", error);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
    if ((moved ?? []).length === 0) {
      const { data: current } = await db
        .from("prize_redemptions")
        .select("status")
        .eq("id", body.redemptionId)
        .eq("campaign_id", campaign.id)
        .maybeSingle<{ status: RedemptionStatus }>();
      return NextResponse.json(
        { error: current ? "bad_status" : "redemption_not_found", now: current?.status },
        { status: current ? 409 : 404 },
      );
    }
    return NextResponse.json({ ok: true, code: moved[0].redemption_code });
  } catch (e) {
    console.error("[tickets admin store] unexpected failure", e);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}

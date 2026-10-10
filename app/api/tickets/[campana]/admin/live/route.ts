import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveStaff, staffDenialStatus } from "@/lib/tickets/access";
import { getCampaign } from "@/lib/tickets/campaigns";
import { POINTS_SPEND_KINDS } from "@/lib/tickets/config";
import { productLabel } from "@/lib/tickets/productLabel";
import { resolveAvatar } from "@/lib/tickets/avatar";
import { brandTone, castForBrand, castMember, type CastMember } from "@/lib/tickets/theme";

export const runtime = "nodejs";

/**
 * Snapshot for the projected "live screen".
 *
 * Read-only, staff-only (same gate as the console), and PII-free by
 * construction: the browser receives a public alias or initials, product
 * names, point totals and counters — never an email, a phone, a full name, a
 * receipt image or a store.
 *
 * Cost model: the screen polls every ~3 s, so the route does a FIXED number of
 * queries (five, in parallel) no matter how many participants exist — there is
 * no per-row follow-up. Every query is scoped by campaign_id, selects only the
 * narrow columns it needs, and is capped by `fetchAll`. The result is also
 * memoised for a couple of seconds per campaign, so two projectors and a staff
 * laptop on the same screen cost one round of queries, not three.
 */

const FEED_SIZE = 12;
const TOP_SIZE = 5;
const CACHE_MS = 2000;
const PAGE = 1000;
const MAX_ROWS = 5000;

/**
 * Pages through a query. PostgREST silently truncates at its row limit (1000
 * by default), and a counter that stops growing at 1000 without saying so is
 * the kind of bug that shows up in front of a client. The cap keeps a runaway
 * campaign from turning a poll into a table scan.
 */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

interface ParticipantRow {
  id: string;
  alias: string | null;
  first_name: string | null;
  last_name: string | null;
  /** The cast member they picked at sign-up; null for people who did not. */
  avatar: string | null;
}
interface ReceiptRow {
  id: string;
  status: string;
  reviewed_by: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}
interface PointsRow {
  participant_id: string;
  receipt_id: string | null;
  kind: string;
  points: number;
  created_at: string;
}
interface RedemptionRow {
  id: string;
  participant_id: string;
  created_at: string;
  prize_drop_items: { name_es: string } | null;
}
interface ItemRow {
  receipt_id: string;
  amount_cents: number;
  alias_matched: string | null;
  products: { brand: string; name: string; size: string | null } | null;
}

/** A character as the screen draws it: only what is public art. */
export interface LiveFigure {
  id: string;
  name: string;
  image: string;
}

export type LiveFeedItem =
  | {
      id: string;
      kind: "ticket";
      at: string;
      alias: string;
      avatar: LiveFigure | null;
      points: number;
      products: string[];
      /** True when the machine approved it without a human. */
      auto: boolean;
      /** The character of the brand that dominates this ticket, if the tenant has one. */
      cameo: LiveFigure | null;
    }
  | {
      id: string;
      kind: "redeem";
      at: string;
      alias: string;
      avatar: LiveFigure | null;
      prize: string;
    };

export interface LiveData {
  serverTime: string;
  joinUrl: string;
  campaign: { name: string; orgName: string; status: string };
  theme: {
    logoUrl: string | null;
    logoAlt: string | null;
    brand: string | null;
    /** The tenant colour is too pale for white text: use ink on it. */
    brandLight: boolean;
    poweredBy: boolean;
    mascots: Record<string, string>;
  };
  counters: {
    participants: number;
    tickets: number;
    approved: number;
    autoApproved: number;
    /**
     * Mean seconds from upload to approval across the tickets the machine
     * approved; null until there is one. A time reads as capability where a
     * small-sample percentage reads as "it mostly didn't work".
     */
    autoAvgSeconds: number | null;
    points: number;
    redemptions: number;
  };
  /** Most-bought product among approved lines; null until there is one. */
  topProduct: { label: string; units: number } | null;
  feed: LiveFeedItem[];
  /** The tenant's whole cast, for the stage; empty when it has none. */
  cast: (LiveFigure & { brand: string | null })[];
  top: { id: string; rank: number; alias: string; points: number; avatar: LiveFigure | null }[];
  mix: {
    brand: string;
    color: string;
    logoUrl: string | null;
    cents: number;
    units: number;
  }[];
}

/** Public name: the alias people chose, else initials. Never a name. */
const publicName = (p: ParticipantRow | undefined): string => {
  if (!p) return "—";
  const alias = p.alias?.trim();
  if (alias) return alias;
  const initials = [p.first_name, p.last_name]
    .map((part) => part?.trim().charAt(0).toUpperCase())
    .filter(Boolean)
    .join(". ");
  return initials ? `${initials}.` : "—";
};

const figureOf = (member: CastMember): LiveFigure => ({
  id: member.id,
  name: member.name,
  // The square bust when there is one; the full-body art otherwise.
  image: member.avatar ?? member.image,
});

const FALLBACK_COLORS = ["#1E90FF", "#FF4757", "#2ECC71", "#FFD93D", "#9B5DE5"];

const cache = new Map<string, { at: number; body: LiveData }>();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campana: string }> },
) {
  const { campana } = await params;
  const campaign = await getCampaign(campana);
  if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Authorization is checked on EVERY request, before the cache is consulted:
  // the memo saves queries, it must never become a way around the gate.
  const access = await resolveStaff(campaign.id);
  if (access.kind !== "ok") {
    return NextResponse.json({ error: access.kind }, { status: staffDenialStatus(access) });
  }

  const origin =
    (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "") || new URL(req.url).origin;
  const joinUrl = `${origin}/c/${campaign.slug}/`;

  const hit = cache.get(campaign.id);
  if (hit && Date.now() - hit.at < CACHE_MS && hit.body.joinUrl === joinUrl) {
    return NextResponse.json(hit.body, { headers: { "Cache-Control": "no-store" } });
  }

  const db = supabaseAdmin();
  try {
    const [participants, receipts, points, redemptions, items] = await Promise.all([
      fetchAll<ParticipantRow>((a, b) =>
        db
          .from("participants")
          .select("id, alias, first_name, last_name, avatar")
          .eq("campaign_id", campaign.id)
          .order("id")
          .range(a, b),
      ),
      fetchAll<ReceiptRow>((a, b) =>
        db
          .from("receipts")
          .select("id, status, reviewed_by, submitted_at, reviewed_at")
          .eq("campaign_id", campaign.id)
          .order("id")
          .range(a, b),
      ),
      fetchAll<PointsRow>((a, b) =>
        db
          .from("points_entries")
          .select("participant_id, receipt_id, kind, points, created_at")
          .eq("campaign_id", campaign.id)
          .order("created_at", { ascending: false })
          .order("id")
          .range(a, b),
      ),
      fetchAll<RedemptionRow>((a, b) =>
        db
          .from("prize_redemptions")
          .select("id, participant_id, created_at, prize_drop_items(name_es)")
          .eq("campaign_id", campaign.id)
          .neq("status", "canceled")
          .order("created_at", { ascending: false })
          .order("id")
          .range(a, b),
      ),
      // Lines of APPROVED receipts only, joined to the catalogue for the brand.
      // `!inner` makes the receipt filters apply to the rows returned.
      fetchAll<ItemRow>((a, b) =>
        db
          .from("receipt_items")
          .select(
            "receipt_id, amount_cents, alias_matched, products(brand, name, size), receipts!inner(campaign_id, status)",
          )
          .eq("receipts.campaign_id", campaign.id)
          .eq("receipts.status", "approved")
          .order("id")
          .range(a, b),
      ),
    ]);

    const byParticipant = new Map(participants.map((p) => [p.id, p]));

    // --- counters ---------------------------------------------------------
    const approved = receipts.filter((r) => r.status === "approved");
    // `reviewed_by` is null exactly when the gate (autoreview.ts) approved:
    // every human decision stamps the reviewer.
    const autoReceiptIds = new Set(
      approved.filter((r) => r.reviewed_by === null).map((r) => r.id),
    );
    const autoDurations = approved
      .filter((r) => r.reviewed_by === null && r.reviewed_at)
      .map((r) => (Date.parse(r.reviewed_at as string) - Date.parse(r.submitted_at)) / 1000)
      .filter((secs) => secs >= 0);
    const autoAvgSeconds = autoDurations.length
      ? autoDurations.reduce((a, b) => a + b, 0) / autoDurations.length
      : null;
    const spendKinds = new Set<string>(POINTS_SPEND_KINDS);
    const earned = points.filter((p) => !spendKinds.has(p.kind) && p.points > 0);

    // The character a participant picked, else a deterministic one from the
    // cast (hash of their id), else none: the screen then draws an initial.
    const cast = campaign.theme.cast;
    const avatarOf = (participantId: string): LiveFigure | null => {
      // The shared rule (lib/tickets/avatar.ts): the same participant gets the
      // same character here as on their own panel.
      const id = resolveAvatar(byParticipant.get(participantId)?.avatar, participantId, cast);
      const member = castMember(campaign.theme, id);
      return member ? figureOf(member) : null;
    };

    // --- ranking: points EARNED, so redeeming never drops anyone ----------
    const totals = new Map<string, number>();
    for (const p of points) {
      if (spendKinds.has(p.kind)) continue;
      totals.set(p.participant_id, (totals.get(p.participant_id) ?? 0) + p.points);
    }
    const top = [...totals.entries()]
      .filter(([, pts]) => pts > 0)
      .sort((x, y) => y[1] - x[1])
      .slice(0, TOP_SIZE)
      .map(([id, pts], i) => ({
        id,
        rank: i + 1,
        alias: publicName(byParticipant.get(id)),
        points: pts,
        avatar: avatarOf(id),
      }));

    // --- brand mix --------------------------------------------------------
    const brandsByReceipt = new Map<string, Map<string, number>>();
    const productUnits = new Map<string, number>();
    const brandTotals = new Map<string, { cents: number; units: number }>();
    for (const item of items) {
      // A SKU match carries the catalogue product. A brand-level match (the
      // `brand` eligibility mode, matching.ts) has no product, only the brand
      // name in `alias_matched`; a line that matched nothing has neither and
      // is not eligible spend, so it stays out of the mix.
      const brandName = item.products?.brand ?? item.alias_matched;
      if (!brandName) continue;
      const key = brandName.trim().toLowerCase();
      const acc = brandTotals.get(key) ?? { cents: 0, units: 0 };
      acc.cents += item.amount_cents;
      acc.units += 1;
      brandTotals.set(key, acc);
      const unitLabel = item.products ? productLabel(item.products) : brandName;
      productUnits.set(unitLabel, (productUnits.get(unitLabel) ?? 0) + 1);
      // Per receipt, count lines per brand: "Jarritos ×3 · Mineragua" reads from
      // across a room, a catalogue SKU with its size does not.
      const perBrand = brandsByReceipt.get(item.receipt_id) ?? new Map<string, number>();
      perBrand.set(brandName, (perBrand.get(brandName) ?? 0) + 1);
      brandsByReceipt.set(item.receipt_id, perBrand);
    }
    const best = [...productUnits.entries()].sort((x, y) => y[1] - x[1])[0];
    const topProduct = best ? { label: best[0], units: best[1] } : null;
    // Brands come from the campaign config (colour + logo); a catalogue brand
    // missing from the config still shows, on a neutral palette, instead of
    // silently vanishing from the chart.
    const configured = campaign.config.brands.map((b) => ({
      name: b.name,
      color: b.color,
      logoUrl: b.logoUrl,
      key: b.name.trim().toLowerCase(),
    }));
    const known = new Set(configured.map((b) => b.key));
    const extras = [...brandTotals.keys()]
      .filter((k) => !known.has(k))
      .map((k, i) => ({
        name: k.replace(/\b\w/g, (c) => c.toUpperCase()),
        key: k,
        color: FALLBACK_COLORS[i % FALLBACK_COLORS.length],
        logoUrl: null as string | null,
      }));
    // With brands configured the chart is exactly those brands: a stray label
    // from an older catalogue must not push a seventh bar off a fixed layout.
    const mix = (configured.length > 0 ? configured : extras).map((b) => ({
      brand: b.name,
      color: b.color,
      logoUrl: b.logoUrl,
      cents: brandTotals.get(b.key)?.cents ?? 0,
      units: brandTotals.get(b.key)?.units ?? 0,
    }));

    // The cast member of the brand that dominates a ticket (most lines; the
    // first printed wins a tie). Null when the tenant has no such character.
    const cameoOf = (receiptId: string): LiveFigure | null => {
      const perBrand = brandsByReceipt.get(receiptId);
      if (!perBrand) return null;
      const dominant = [...perBrand.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
      const member = castForBrand(campaign.theme, dominant);
      return member ? { id: member.id, name: member.name, image: member.image } : null;
    };

    // --- feed -------------------------------------------------------------
    const purchases = points
      .filter((p) => p.kind === "purchase" && p.receipt_id)
      .slice(0, FEED_SIZE)
      .map<LiveFeedItem>((p) => ({
        id: `t-${p.receipt_id}`,
        kind: "ticket",
        at: p.created_at,
        alias: publicName(byParticipant.get(p.participant_id)),
        avatar: avatarOf(p.participant_id),
        points: p.points,
        products: [...(brandsByReceipt.get(p.receipt_id as string) ?? [])]
          .slice(0, 3)
          .map(([brand, n]) => (n > 1 ? `${brand} ×${n}` : brand)),
        auto: autoReceiptIds.has(p.receipt_id as string),
        cameo: cameoOf(p.receipt_id as string),
      }));
    const redeemed = redemptions.slice(0, FEED_SIZE).map<LiveFeedItem>((r) => ({
      id: `r-${r.id}`,
      kind: "redeem",
      at: r.created_at,
      alias: publicName(byParticipant.get(r.participant_id)),
      avatar: avatarOf(r.participant_id),
      prize: r.prize_drop_items?.name_es ?? "Premio",
    }));
    const feed = [...purchases, ...redeemed]
      .sort((x, y) => (x.at < y.at ? 1 : -1))
      .slice(0, FEED_SIZE);

    const body: LiveData = {
      serverTime: new Date().toISOString(),
      joinUrl,
      campaign: { name: campaign.name, orgName: campaign.orgName, status: campaign.status },
      theme: {
        logoUrl: campaign.theme.logoUrl,
        logoAlt: campaign.theme.logoAlt,
        brand: campaign.theme.brand,
        brandLight: brandTone(campaign.theme) === "light",
        poweredBy: campaign.theme.poweredBy,
        mascots: campaign.theme.mascots as Record<string, string>,
      },
      counters: {
        participants: participants.length,
        tickets: receipts.length,
        approved: approved.length,
        autoApproved: autoReceiptIds.size,
        autoAvgSeconds,
        points: earned.reduce((sum, p) => sum + p.points, 0),
        redemptions: redemptions.length,
      },
      topProduct,
      feed,
      cast: cast.map((m) => ({ ...figureOf(m), image: m.image, brand: m.brand })),
      top,
      mix,
    };
    cache.set(campaign.id, { at: Date.now(), body });
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[tickets live] read failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}

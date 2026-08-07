// The Tuesday close, from the operator's side.
//
// The scoring itself is not here and must not be: `pickem_settle_week` (0026)
// counts the hits, credits the ledger, awards the prize and advances the open
// week, all in one transaction. This module answers the two questions the cron
// needs before and after that call — WHICH programmes are running, and WHAT the
// RPC's answer means for a machine that has to decide whether to retry.
//
// Server only. Service-role reads, like program.ts.

import { supabaseAdmin } from "@/lib/supabase/server";
import type { ProgramStatus } from "./schema";

/**
 * A programme the weekly operation should touch.
 *
 * `live` is the normal case. Draft-with-rehearsal is the other one, and it is
 * the same door `acceptsPicks` opens: somebody at Chapa has to walk a whole
 * jornada end to end before 9 September, and a rehearsal that takes picks but
 * never settles them is a rehearsal of half the product. A `paused` or `closed`
 * programme is shut to the cron too — pausing is an operational brake, and a
 * cron that ignored it would be a brake with no pedal.
 */
export interface OperableProgram {
  campaignId: string;
  slug: string;
  name: string;
  status: ProgramStatus;
  rehearsal: boolean;
  seasonId: string;
  seasonYear: number;
  totalWeeks: number;
  openWeek: number;
}

interface Row {
  id: string;
  slug: string;
  name: string;
  status: ProgramStatus;
  config: Record<string, unknown> | null;
  pickem_programs: {
    season_id: string;
    open_week: number;
    sport_seasons: { year: number; weeks: number } | null;
  } | null;
}

export const listOperablePrograms = async (): Promise<OperableProgram[]> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("campaigns")
    .select(
      `id, slug, name, status, config,
       pickem_programs(season_id, open_week, sport_seasons(year, weeks))`,
    )
    .eq("module", "pickem")
    .in("status", ["live", "draft"])
    .returns<Row[]>();

  if (error) throw new Error(`lectura de campaigns: ${error.message}`);

  const out: OperableProgram[] = [];
  for (const row of data ?? []) {
    // Half-seeded campaign: a `campaigns` row with no `pickem_programs` has no
    // season to ingest and no week to settle. Skipping it is not an error, it
    // is a campaign somebody is still building.
    if (!row.pickem_programs) continue;
    const rehearsal = row.config?.rehearsal === "anyone";
    if (row.status !== "live" && !(row.status === "draft" && rehearsal)) continue;
    const p = row.pickem_programs;
    out.push({
      campaignId: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      rehearsal,
      seasonId: p.season_id,
      seasonYear: p.sport_seasons?.year ?? 0,
      totalWeeks: p.sport_seasons?.weeks ?? 18,
      openWeek: p.open_week,
    });
  }
  return out;
};

/**
 * Games of a week still waiting for a final score, voided ones excluded.
 *
 * Exactly the condition `pickem_settle_week` refuses on. It is checked here
 * first so the cron can report "faltan 3 marcadores" instead of surfacing a
 * Postgres exception, and so the ordinary Tuesday where a game was postponed
 * reads as a state rather than a failure.
 */
export const countPendingScores = async (seasonId: string, week: number) => {
  const db = supabaseAdmin();
  const { count, error } = await db
    .from("sport_games")
    .select("id", { count: "exact", head: true })
    .eq("season_id", seasonId)
    .eq("week", week)
    .eq("voided", false)
    .is("away_score", null);
  if (error) throw new Error(`conteo de marcadores: ${error.message}`);
  return count ?? 0;
};

export const countWeekGames = async (seasonId: string, week: number) => {
  const db = supabaseAdmin();
  const { count, error } = await db
    .from("sport_games")
    .select("id", { count: "exact", head: true })
    .eq("season_id", seasonId)
    .eq("week", week);
  if (error) throw new Error(`conteo de partidos: ${error.message}`);
  return count ?? 0;
};

export type SettleStatus =
  /** The RPC ran. Points are credited; see `settled` for how many entries. */
  | "settled"
  /** Scores are missing. Not a failure — the week simply is not over. */
  | "week_incomplete"
  /** `open_week` is past the end of the season. Nothing left to close. */
  | "season_over"
  /** The open week has no games at all. A seeding problem, not a settle one. */
  | "no_games"
  /** The RPC raised. The only status a human needs to look at. */
  | "error";

export interface SettleOutcome {
  slug: string;
  week: number;
  status: SettleStatus;
  /** Entries closed by this run. Zero on a repeat: the RPC is idempotent. */
  settled?: number;
  awarded?: boolean;
  /**
   * Two or more players finished first with the same points and the tiebreak
   * did not separate them. The RPC deliberately awards nobody: who gets the
   * prize is a decision with a person's name on it. The week IS settled and
   * the points ARE credited — this only means a supervisor has to pick the
   * winner in the panel. It is never a reason for the cron to fail.
   */
  tiedAtTop?: boolean;
  /** Missing scores, when that is why nothing happened. */
  pending?: number;
  reason?: string;
}

/**
 * Closes one programme's open week.
 *
 * Idempotent end to end, because the cron will be retried by hand at least once
 * over eighteen weeks: the ledger's unique index refuses a second credit, the
 * `(campaign, week, place)` key refuses a second award, and `open_week` only
 * advances when it still equals the week being closed. Running this twice on
 * the same Tuesday settles nothing the second time and reports it plainly.
 */
export const settleProgram = async (program: OperableProgram): Promise<SettleOutcome> => {
  const week = program.openWeek;
  const base = { slug: program.slug, week };

  // A season that has run out. Without this the RPC would find zero missing
  // scores in a week that does not exist, settle nothing, and still advance
  // `open_week` — every Tuesday, forever.
  if (week > program.totalWeeks) {
    return { ...base, status: "season_over" };
  }

  const games = await countWeekGames(program.seasonId, week);
  if (games === 0) {
    return { ...base, status: "no_games", reason: "la jornada no tiene partidos sembrados" };
  }

  const pending = await countPendingScores(program.seasonId, week);
  if (pending > 0) {
    return {
      ...base,
      status: "week_incomplete",
      pending,
      reason: `faltan ${pending} marcador(es) de ${games} partidos`,
    };
  }

  const db = supabaseAdmin();
  const { data, error } = await db.rpc("pickem_settle_week", {
    p_campaign_slug: program.slug,
    p_week: week,
  });

  if (error) {
    const code = error.message?.trim();
    // The RPC's own guard, hit only if a score vanished between the count above
    // and the call. Same meaning, same non-failure.
    if (code === "week_incomplete") {
      return { ...base, status: "week_incomplete", reason: code };
    }
    return { ...base, status: "error", reason: code || "rpc_failed" };
  }

  const result = (data ?? {}) as { settled?: number; awarded?: boolean; tiedAtTop?: boolean };
  return {
    ...base,
    status: "settled",
    settled: Number(result.settled ?? 0),
    awarded: Boolean(result.awarded),
    tiedAtTop: Boolean(result.tiedAtTop),
  };
};

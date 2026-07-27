// Removal of receipt images that never became receipts.
//
// The browser writes to the private bucket first and registers the receipt
// afterwards. The API already deletes the object when its own insert fails, so
// what is left here is the gap it cannot reach: the network dying between the
// two calls, the tab closing mid-upload, or a signed-in account writing to the
// bucket directly without ever calling the API — which the storage policy
// permits inside the account's own folder and nothing bounds.
//
// Those objects are invisible to the console, count against storage, and carry
// someone's shopping habits and address. Keeping them is both a cost and a
// privacy liability, and neither improves with age.

import { supabaseAdmin } from "@/lib/supabase/server";
import { RECEIPTS_BUCKET } from "./config";

/**
 * How long an object may exist without a receipt row before it is treated as
 * abandoned.
 *
 * Not a tuning knob — it is the answer to "how slow can the round trip between
 * the upload and the insert plausibly be". Seconds, normally. Two hours leaves
 * enormous room for a phone on a bad connection in a store parking lot while
 * still clearing the same day.
 */
export const ORPHAN_GRACE_HOURS = 2;

export interface SweepResult {
  scanned: number;
  orphans: number;
  deleted: number;
  /** Orphans still inside the grace period; counted, deliberately untouched. */
  tooRecent: number;
  errors: string[];
}

/**
 * Finds and optionally deletes orphaned objects across every campaign prefix.
 *
 * `dryRun` exists because the first thing anyone sensible does with a script
 * that deletes files is ask what it would delete.
 */
export const sweepOrphanReceipts = async (
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<SweepResult> => {
  const db = supabaseAdmin();
  const result: SweepResult = { scanned: 0, orphans: 0, deleted: 0, tooRecent: 0, errors: [] };

  // Every image_path ever registered. The table is the source of truth about
  // which objects are real; anything absent here was never a claim.
  const known = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("receipts")
      .select("image_path")
      .range(from, from + PAGE - 1);
    if (error) {
      // Bailing out is the safe failure. A partial list of known paths would
      // make real receipts look orphaned and delete evidence for a live claim.
      result.errors.push(`receipts read failed: ${error.message}`);
      return result;
    }
    for (const row of data ?? []) known.add(row.image_path);
    if ((data?.length ?? 0) < PAGE) break;
  }

  const cutoff = Date.now() - ORPHAN_GRACE_HOURS * 60 * 60 * 1000;
  const doomed: string[] = [];

  const { data: prefixes, error: prefixError } = await db.storage
    .from(RECEIPTS_BUCKET)
    .list("", { limit: 1000 });
  if (prefixError) {
    result.errors.push(`bucket list failed: ${prefixError.message}`);
    return result;
  }

  // Layout is <campaign>/<auth-uid>/<file>, so reaching the objects is two
  // levels of listing. Both are paged: a campaign at full tilt has more than a
  // page of participants, and the default page size would silently stop early.
  for (const campaign of prefixes ?? []) {
    if (!campaign.name) continue;
    for (let offset = 0; ; offset += PAGE) {
      const { data: folders, error } = await db.storage
        .from(RECEIPTS_BUCKET)
        .list(campaign.name, { limit: PAGE, offset });
      if (error) {
        result.errors.push(`list ${campaign.name} failed: ${error.message}`);
        break;
      }
      for (const folder of folders ?? []) {
        if (!folder.name) continue;
        const { data: objects, error: objectError } = await db.storage
          .from(RECEIPTS_BUCKET)
          .list(`${campaign.name}/${folder.name}`, { limit: PAGE });
        if (objectError) {
          result.errors.push(`list ${campaign.name}/${folder.name}: ${objectError.message}`);
          continue;
        }
        for (const object of objects ?? []) {
          const path = `${campaign.name}/${folder.name}/${object.name}`;
          result.scanned += 1;
          if (known.has(path)) continue;
          result.orphans += 1;
          const created = Date.parse(object.created_at ?? "");
          // An unparseable timestamp means we cannot prove the object is old.
          // Leave it: a missed orphan costs storage, a wrong delete costs a claim.
          if (!Number.isFinite(created) || created > cutoff) {
            result.tooRecent += 1;
            continue;
          }
          doomed.push(path);
        }
      }
      if ((folders?.length ?? 0) < PAGE) break;
    }
  }

  if (dryRun || doomed.length === 0) return result;

  // Chunked: the storage API rejects unbounded remove() payloads, and one
  // oversized request failing would leave the whole sweep undone.
  for (let i = 0; i < doomed.length; i += 100) {
    const batch = doomed.slice(i, i + 100);
    const { error } = await db.storage.from(RECEIPTS_BUCKET).remove(batch);
    if (error) result.errors.push(`remove batch ${i / 100}: ${error.message}`);
    else result.deleted += batch.length;
  }

  return result;
};

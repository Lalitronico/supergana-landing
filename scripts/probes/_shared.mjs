/**
 * Shared plumbing for the attack probes.
 *
 * These run outside Next, so nothing has loaded .env.local for us, and they
 * sign in with passwords rather than OTP on purpose: the project's built-in
 * email sender allows two messages an hour, and a probe suite that consumed
 * that budget would lock real people out while it ran.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ROOT_ENV = new URL("../../.env.local", import.meta.url);

for (const line of readFileSync(ROOT_ENV, "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan variables en .env.local (URL, PUBLISHABLE_KEY, SERVICE_ROLE_KEY).");
  process.exit(1);
}

/** Service role: sets up and tears down. Never used to assert a permission. */
export const admin = () =>
  createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

/** A signed-out client — what an unauthenticated visitor gets. */
export const anonClient = () =>
  createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

export const PROBE_PASSWORD = "Pr0be!7xQz";

/** Creates the account if missing and returns a client signed in as it. */
export const signedInAs = async (email) => {
  const db = admin();
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) {
    await db.auth.admin.updateUserById(existing.id, {
      password: PROBE_PASSWORD, email_confirm: true,
    });
  } else {
    const { error } = await db.auth.admin.createUser({
      email, password: PROBE_PASSWORD, email_confirm: true,
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
  }
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email, password: PROBE_PASSWORD,
  });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return { client, userId: data.user.id };
};

/**
 * Deletes every auth account whose address matches, plus everything hanging
 * off it. Probes create accounts freely; without this the project accumulates
 * users that look real in a console screenshot.
 */
export const purgeAccounts = async (matcher) => {
  const db = admin();
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const doomed = (list?.users ?? []).filter((u) => matcher(u.email ?? ""));
  for (const user of doomed) {
    const { data: parts } = await db.from("participants")
      .select("id, campaign_id").eq("auth_user_id", user.id);
    for (const p of parts ?? []) {
      const { data: rs } = await db.from("receipts").select("id").eq("participant_id", p.id);
      const rids = (rs ?? []).map((r) => r.id);
      if (rids.length) {
        await db.from("receipt_items").delete().in("receipt_id", rids);
        await db.from("receipt_reviews").delete().in("receipt_id", rids);
      }
      await db.from("rewards").delete().eq("participant_id", p.id);
      if (rids.length) await db.from("receipts").delete().in("id", rids);
      await db.from("consents").delete().eq("participant_id", p.id);
    }
    await db.from("participants").delete().eq("auth_user_id", user.id);
    await db.from("campaign_admins").delete().eq("auth_user_id", user.id);
    await db.auth.admin.deleteUser(user.id);
  }
  return doomed.length;
};

/** Removes every object a set of accounts wrote, across every campaign prefix. */
export const purgeObjects = async (userIds) => {
  const db = admin();
  const { data: prefixes } = await db.storage.from("receipts").list("");
  let removed = 0;
  for (const prefix of prefixes ?? []) {
    for (const uid of userIds) {
      const { data } = await db.storage.from("receipts").list(`${prefix.name}/${uid}`);
      if (data?.length) {
        await db.storage.from("receipts")
          .remove(data.map((o) => `${prefix.name}/${uid}/${o.name}`));
        removed += data.length;
      }
    }
  }
  return removed;
};

// --------------------------------------------------------------- reporting --

export const makeReport = (title) => {
  const rows = [];
  return {
    check(name, ok, detail = "") {
      rows.push({ name, ok, detail });
      console.log(`${ok ? "  ok  " : "FALLA "} │ ${name}`);
      if (detail) console.log(`       │   ${detail}`);
    },
    finish() {
      const failed = rows.filter((r) => !r.ok).length;
      console.log("=".repeat(76));
      console.log(`${title}: ${rows.length - failed}/${rows.length} pasaron` +
        (failed ? ` · ${failed} FALLAS` : " · sin fallas"));
      return { total: rows.length, failed };
    },
  };
};

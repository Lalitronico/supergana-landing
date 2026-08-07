/**
 * Shared plumbing for the pick'em probes.
 *
 * Sits on top of `_shared.mjs` — same env loading, same service-role client,
 * same report format — and adds the two things the pick'em probes need that
 * the tickets ones did not:
 *
 *   1. A DISPOSABLE PROGRAMME. The tickets probes attack `ticket-al-tanque`,
 *      a real campaign, and undo their writes afterwards. A pick'em probe
 *      cannot do that: scoring needs final scores on `sport_games`, and that
 *      table is the shared NFL calendar — the same 272 rows serve Chapa and
 *      whoever signs next. Writing a score onto week 3 of 2026 to test a
 *      streak would corrupt a fact about the world for every tenant. So these
 *      probes build their own season under `league = 'probe'`, their own
 *      organisation, campaign and players, and delete all of it at the end.
 *
 *   2. A MIRROR GUARD. Two of the invariants being probed live in TypeScript
 *      (`getStreak`, `getSeasonPoints` in lib/pickem/access.ts) and cannot be
 *      imported from here: access.ts reaches for `@/lib/supabase/route`, a
 *      tsconfig path alias Node does not resolve, and through it for
 *      next/headers. The probe therefore holds a hand-written port of each
 *      function — and a port is a second implementation, which is the exact
 *      disease these probes exist to detect.
 *
 *      `mirrorCheck` is the antidote: it fingerprints the real function's
 *      source, comment-stripped and whitespace-normalised, and fails when it
 *      no longer matches the fingerprint recorded here. Editing access.ts
 *      turns the probe red until somebody re-reads the function and re-syncs
 *      the port. A silent port would be worse than no probe at all, because it
 *      would keep passing while the thing it claims to pin drifted away.
 *
 * ENV. Inherited from `_shared.mjs`, which fills `process.env` from
 * `.env.local` WITHOUT overwriting anything already set. So a shell that
 * exports NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY /
 * SUPABASE_SERVICE_ROLE_KEY aims these probes at a Supabase branch instead.
 * Point them at a branch. Everything here is namespaced (`probe-pickem-*`,
 * `league = 'probe'`, `@probe.invalid`) and torn down, but a probe that dies
 * halfway leaves rows behind, and rows nobody planned are how a production
 * database stops being trustworthy.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { admin, anonClient, makeReport, PROBE_PASSWORD } from "./_shared.mjs";

export { admin, anonClient, makeReport, PROBE_PASSWORD };

/** The module whose TypeScript halves these probes pin. */
export const ACCESS_TS = new URL("../../lib/pickem/access.ts", import.meta.url);

// ---------------------------------------------------------------- mirror ---

/**
 * The source of one `export const NAME = ...` binding, normalised.
 *
 * Comments and whitespace are dropped so that fixing a typo in a comment does
 * not turn a probe red, while any change to the logic does.
 */
export const fnSource = (fileUrl, name) => {
  const src = readFileSync(fileUrl, "utf8");
  const start = src.indexOf(`export const ${name} =`);
  if (start < 0) throw new Error(`no existe "export const ${name}" en ${fileUrl}`);
  const rest = src.slice(start);
  // Up to the next top-level export, which is where the declaration ends.
  const end = rest.indexOf("\nexport ", 1);
  const body = end < 0 ? rest : rest.slice(0, end);
  return body
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const fingerprint = (text) =>
  createHash("sha256").update(text).digest("hex").slice(0, 16);

/**
 * Asserts that the ported copy of a TypeScript function is still a copy.
 *
 * `expected` is the fingerprint recorded when the port was written. When this
 * fails, NOTHING else the probe reports about that function means anything:
 * re-read the real function, re-sync the port below it, and paste the new
 * fingerprint here.
 */
export const mirrorCheck = (report, { file, fn, expected }) => {
  const got = fingerprint(fnSource(file, fn));
  report.check(
    `el espejo de ${fn}() sigue siendo copia fiel`,
    got === expected,
    got === expected
      ? `huella ${got}`
      : `access.ts CAMBIÓ · huella ${got}, esperada ${expected} — re-lee ${fn}(), ` +
        `re-sincroniza el port de esta sonda y actualiza la huella. Hasta entonces ` +
        `el resto de este bloque no prueba nada.`,
  );
  return got === expected;
};

// ------------------------------------------------------------- accounts ----

export const probeEmail = (suffix, n) => `probe.pickem.${suffix}.${n}@probe.invalid`;

/** Creates the auth account if missing. `participants.auth_user_id` is NOT NULL. */
export const mkUser = async (email) => {
  const db = admin();
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const found = list?.users.find((u) => u.email === email);
  if (found) {
    await db.auth.admin.updateUserById(found.id, {
      password: PROBE_PASSWORD,
      email_confirm: true,
    });
    return found.id;
  }
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PROBE_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
};

// ------------------------------------------------------- disposable tenant -

export const orgSlugOf = (suffix) => `probe-pickem-${suffix}`;
export const campaignSlugOf = (suffix) => `probe-pickem-${suffix}-prog`;

/**
 * Tears the whole thing down, in dependency order and idempotently.
 *
 * Campaign first: `pickem_picks.game_id` is `on delete restrict`, so the games
 * cannot go until the picks that point at them are gone, and the picks go when
 * the campaign cascades. Getting this backwards leaves a season nobody can
 * delete and a probe that fails on its second run for reasons that have
 * nothing to do with what it tests.
 */
export const dropTenant = async ({ suffix, year }) => {
  const db = admin();
  await db.from("campaigns").delete().eq("slug", campaignSlugOf(suffix));
  await db.from("organizations").delete().eq("slug", orgSlugOf(suffix));
  await db.from("sport_seasons").delete().eq("league", "probe").eq("year", year);

  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list?.users ?? []) {
    if ((u.email ?? "").startsWith(`probe.pickem.${suffix}.`)) {
      await db.auth.admin.deleteUser(u.id);
    }
  }
};

/**
 * A whole programme of its own: season, games, organisation, campaign, config.
 *
 * Kickoffs are placed in 2020 on purpose. Everything downstream of a kickoff is
 * then unambiguous — the week is locked, the early-bird bonus cannot fire on an
 * entry inserted today, and no probe result depends on what time it was run.
 */
export const seedTenant = async ({
  suffix,
  year,
  weeks,
  mechanics = null,
  promoWeeks = [],
  venues = ["Sucursal Probe"],
}) => {
  const db = admin();
  await dropTenant({ suffix, year });

  const { data: season, error: seasonError } = await db
    .from("sport_seasons")
    .insert({ league: "probe", year, weeks })
    .select("id")
    .single();
  if (seasonError) throw new Error(`sport_seasons: ${seasonError.message}`);

  const rows = [];
  for (let w = 1; w <= weeks; w += 1) {
    rows.push({
      season_id: season.id,
      week: w,
      away: "AAA",
      home: "BBB",
      kickoff_at: new Date(Date.UTC(2020, 0, 5 + 7 * w, 20, 0, 0)).toISOString(),
      network: "PROBE",
    });
  }
  const { data: games, error: gamesError } = await db
    .from("sport_games")
    .insert(rows)
    .select("id, week")
    .order("week", { ascending: true });
  if (gamesError) throw new Error(`sport_games: ${gamesError.message}`);

  const { data: org, error: orgError } = await db
    .from("organizations")
    .upsert({ slug: orgSlugOf(suffix), name: `Probe Pickem ${suffix}` }, { onConflict: "slug" })
    .select("id")
    .single();
  if (orgError) throw new Error(`organizations: ${orgError.message}`);

  const { data: campaign, error: campaignError } = await db
    .from("campaigns")
    .upsert(
      {
        org_id: org.id,
        slug: campaignSlugOf(suffix),
        name: `Probe Pickem ${suffix}`,
        module: "pickem",
        status: "draft",
        locales: ["es"],
        config: { timezone: "America/Ciudad_Juarez" },
      },
      { onConflict: "slug" },
    )
    .select("id, slug")
    .single();
  if (campaignError) throw new Error(`campaigns: ${campaignError.message}`);

  const program = {
    campaign_id: campaign.id,
    season_id: season.id,
    open_week: weeks,
    venues,
    promo_weeks: promoWeeks,
  };
  if (mechanics) program.mechanics = mechanics;
  const { error: programError } = await db
    .from("pickem_programs")
    .upsert(program, { onConflict: "campaign_id" });
  if (programError) throw new Error(`pickem_programs: ${programError.message}`);

  return {
    seasonId: season.id,
    campaignId: campaign.id,
    campaignSlug: campaign.slug,
    /** week → game id */
    gameOf: new Map((games ?? []).map((g) => [g.week, g.id])),
  };
};

/** Captures a final score on one probe week. Never touches a real season. */
export const scoreWeek = async ({ seasonId, week, away, home }) => {
  const db = admin();
  const { error } = await db
    .from("sport_games")
    .update({ away_score: away, home_score: home })
    .eq("season_id", seasonId)
    .eq("week", week);
  if (error) throw new Error(`score week ${week}: ${error.message}`);
};

/** A verified (or deliberately unverified) player of the probe programme. */
export const seedPlayer = async ({ campaignId, suffix, n, alias, verified = true }) => {
  const db = admin();
  const authId = await mkUser(probeEmail(suffix, n));
  const { data, error } = await db
    .from("participants")
    .upsert(
      {
        campaign_id: campaignId,
        auth_user_id: authId,
        alias,
        // E.164, `^\+[0-9]{10,15}$`. Reserved-looking and obviously fake.
        phone: `+5299900${String(10000 + n).slice(-5)}`,
        locale: "es",
        phone_verified_at: verified ? new Date().toISOString() : null,
      },
      { onConflict: "campaign_id,auth_user_id" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`participant ${alias}: ${error.message}`);
  return { participantId: data.id, authId };
};

/**
 * An entry with its picks, written directly.
 *
 * Deliberately not through `pickem_save_picks`: that function is the player's
 * door and refuses everything these probes need to set up — a locked week, a
 * week that is not the open one, an unverified number. Seeding is the service
 * role's job; what is being probed is what the READERS do with the rows.
 */
export const seedEntry = async ({ campaignId, participantId, week, gameId, choice, tiebreak = null }) => {
  const db = admin();
  const { data: entry, error } = await db
    .from("pickem_entries")
    .upsert(
      { campaign_id: campaignId, participant_id: participantId, week, tiebreak },
      { onConflict: "campaign_id,participant_id,week" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`entry w${week}: ${error.message}`);

  if (gameId) {
    const { error: pickError } = await db
      .from("pickem_picks")
      .upsert({ entry_id: entry.id, game_id: gameId, choice }, { onConflict: "entry_id,game_id" });
    if (pickError) throw new Error(`pick w${week}: ${pickError.message}`);
  }
  return entry.id;
};

/**
 * Money integrity under concurrency.
 *
 * tickets_approve_receipt claims to be the only place a reward is born and to
 * check every limit under a campaign row lock. Reading the SQL is not evidence:
 * the failure mode that matters is two reviewers pressing approve in the same
 * second, and that only shows up when the calls actually overlap.
 *
 * Runs against a disposable campaign with deliberately tiny limits, so the
 * boundaries are reachable and Novamex's numbers are never touched.
 */

import { admin, anonClient, purgeAccounts, purgeObjects, SUPABASE_URL, ANON_KEY, PROBE_PASSWORD } from "./_shared.mjs";
const db = admin();

const REWARD = 2000;
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : "FALLA "} │ ${name}\n       │   ${detail}`);
};

// ------------------------------------------------------------- scaffolding --
const { data: org } = await db.from("organizations")
  .upsert({ slug: "probe-conc", name: "Probe Concurrencia" }, { onConflict: "slug" })
  .select("id").single();

const reviewer = (await db.auth.admin.listUsers({ perPage: 1000 })).data.users
  .find((u) => u.email === "edu_lalitogol@hotmail.com").id;

const buildCampaign = async (config) => {
  await db.from("campaigns").delete().eq("slug", "probe-conc");
  const { data, error } = await db.from("campaigns").insert({
    org_id: org.id, slug: "probe-conc", name: "Probe Concurrencia", module: "tickets",
    status: "live", locales: ["es"],
    config: {
      min_purchase_cents: 1000, reward_cents: REWARD, review_sla_hours: 48,
      eligible_states: ["TX"], rules_version: "probe", timezone: "America/Denver",
      ...config,
    },
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
};

let seq = 0;
const seedClaim = async (campaignId, { last, zip }) => {
  seq += 1;
  const email = `conc${seq}@probe.invalid`;
  const { data: user } = await db.auth.admin.createUser({ email, email_confirm: true });
  const { data: p, error: pe } = await db.from("participants").insert({
    campaign_id: campaignId, auth_user_id: user.user.id, email,
    first_name: "C", last_name: last, zip, state: "TX", locale: "es",
  }).select("id").single();
  if (pe) throw new Error(pe.message);
  const { data: r, error: re } = await db.from("receipts").insert({
    campaign_id: campaignId, participant_id: p.id, status: "received",
    image_path: `probe-conc/${user.user.id}/r.jpg`,
    image_hash: seq.toString().padStart(64, "0"),
  }).select("id").single();
  if (re) throw new Error(re.message);
  return { receipt: r.id, participant: p.id, authUser: user.user.id };
};

const approve = (receiptId, i = 0) =>
  db.rpc("tickets_approve_receipt", {
    p_receipt_id: receiptId, p_reviewer: reviewer,
    p_store_name: `Tienda ${i}`, p_purchase_date: "2026-07-26",
    p_total_cents: 3000, p_eligible_cents: 1500, p_items: [], p_note: null,
  });

const tally = (settled) => {
  const okCount = settled.filter((r) => !r.error).length;
  const codes = {};
  for (const r of settled) if (r.error) {
    const c = r.error.message.replace(/\s+/g, " ").slice(0, 40);
    codes[c] = (codes[c] ?? 0) + 1;
  }
  return { okCount, codes };
};

const rewardsOf = async (campaignId) => {
  const { data } = await db.from("rewards").select("id, amount_cents, status")
    .eq("campaign_id", campaignId).neq("status", "canceled");
  return data ?? [];
};

// =========================================================== 1. same receipt =
{
  const cid = await buildCampaign({ weekly_quota: 50, total_reward_slots: 50, fund_cents: 1000000 });
  const claim = await seedClaim(cid, { last: "Uno", zip: "79901" });
  const settled = await Promise.all(Array.from({ length: 6 }, (_, i) => approve(claim.receipt, i)));
  const { okCount, codes } = tally(settled);
  const rw = await rewardsOf(cid);
  check("6 aprobaciones simultáneas del MISMO ticket → 1 recompensa",
    okCount === 1 && rw.length === 1,
    `${okCount} llamadas ok · ${rw.length} recompensas · rechazos: ${JSON.stringify(codes)}`);
}

// ============================================================ 2. weekly quota =
{
  const cid = await buildCampaign({ weekly_quota: 3, total_reward_slots: 50, fund_cents: 1000000 });
  const claims = [];
  for (let i = 0; i < 8; i++) claims.push(await seedClaim(cid, { last: `Q${i}`, zip: `799${10 + i}` }));
  const settled = await Promise.all(claims.map((c, i) => approve(c.receipt, i)));
  const { okCount, codes } = tally(settled);
  const rw = await rewardsOf(cid);
  check("8 aprobaciones simultáneas con cupo semanal 3 → exactamente 3",
    okCount === 3 && rw.length === 3,
    `${okCount} ok · ${rw.length} recompensas · rechazos: ${JSON.stringify(codes)}`);
}

// ================================================================= 3. fondo ==
{
  // Room for exactly 2 rewards, then a few cents left over.
  const cid = await buildCampaign({ weekly_quota: 50, total_reward_slots: 50, fund_cents: REWARD * 2 + 500 });
  const claims = [];
  for (let i = 0; i < 7; i++) claims.push(await seedClaim(cid, { last: `F${i}`, zip: `798${10 + i}` }));
  const settled = await Promise.all(claims.map((c, i) => approve(c.receipt, i)));
  const { okCount, codes } = tally(settled);
  const rw = await rewardsOf(cid);
  const spent = rw.reduce((s, r) => s + r.amount_cents, 0);
  check("7 simultáneas con fondo para 2 → el fondo no se sobregira",
    okCount === 2 && spent <= REWARD * 2 + 500,
    `${okCount} ok · gastó ${spent} de ${REWARD * 2 + 500} · rechazos: ${JSON.stringify(codes)}`);
}

// ============================================================== 4. slots ====
{
  const cid = await buildCampaign({ weekly_quota: 50, total_reward_slots: 2, fund_cents: 1000000 });
  const claims = [];
  for (let i = 0; i < 6; i++) claims.push(await seedClaim(cid, { last: `S${i}`, zip: `797${10 + i}` }));
  const settled = await Promise.all(claims.map((c, i) => approve(c.receipt, i)));
  const { okCount, codes } = tally(settled);
  const rw = await rewardsOf(cid);
  check("6 simultáneas con 2 slots de campaña → exactamente 2",
    okCount === 2 && rw.length === 2,
    `${okCount} ok · ${rw.length} recompensas · rechazos: ${JSON.stringify(codes)}`);
}

// =========================================================== 5. mismo hogar ==
{
  const cid = await buildCampaign({ weekly_quota: 50, total_reward_slots: 50, fund_cents: 1000000 });
  const claims = [];
  // Same surname + ZIP = same household_key, three separate accounts.
  for (let i = 0; i < 3; i++) claims.push(await seedClaim(cid, { last: "Hogar", zip: "79950" }));
  const settled = await Promise.all(claims.map((c, i) => approve(c.receipt, i)));
  const { okCount, codes } = tally(settled);
  check("3 cuentas del MISMO hogar aprobadas a la vez → 1 sola",
    okCount === 1, `${okCount} ok · rechazos: ${JSON.stringify(codes)}`);
}

// ============================================== 6. mismo participante, 2 tickets
{
  const cid = await buildCampaign({ weekly_quota: 50, total_reward_slots: 50, fund_cents: 1000000 });
  const claim = await seedClaim(cid, { last: "Doble", zip: "79960" });
  seq += 1;
  const { data: second } = await db.from("receipts").insert({
    campaign_id: cid, participant_id: claim.participant, status: "received",
    image_path: `probe-conc/${claim.authUser}/r2.jpg`,
    image_hash: ("2" + seq).padStart(64, "0"),
  }).select("id").single();
  const settled = await Promise.all([approve(claim.receipt, 1), approve(second.id, 2)]);
  const { okCount, codes } = tally(settled);
  check("2 tickets del MISMO participante aprobados a la vez → 1 sola recompensa",
    okCount === 1, `${okCount} ok · rechazos: ${JSON.stringify(codes)}`);
}

// ==================================================== 7. ticket duplicado ====
{
  const cid = await buildCampaign({ weekly_quota: 50, total_reward_slots: 50, fund_cents: 1000000 });
  const a = await seedClaim(cid, { last: "DupA", zip: "79970" });
  const b = await seedClaim(cid, { last: "DupB", zip: "79971" });
  // Identical store + date + total from two different people: same physical
  // receipt photographed twice. Fired together so neither sees the other's row.
  const same = (id) => db.rpc("tickets_approve_receipt", {
    p_receipt_id: id, p_reviewer: reviewer, p_store_name: "El Super #114",
    p_purchase_date: "2026-07-20", p_total_cents: 4444, p_eligible_cents: 1500,
    p_items: [], p_note: null,
  });
  const settled = await Promise.all([same(a.receipt), same(b.receipt)]);
  const { okCount, codes } = tally(settled);
  check("el MISMO ticket físico reclamado por 2 personas a la vez → 1 sola",
    okCount === 1, `${okCount} ok · rechazos: ${JSON.stringify(codes)}`);
}

// ------------------------------------------------------------------ report --
console.log("\n" + "=".repeat(78));
const bad = results.filter((r) => !r.ok).length;
console.log(`${results.length - bad}/${results.length} pasaron` + (bad ? ` · ${bad} FALLAS` : " · sin fallas"));

// ----------------------------------------------------------------- cleanup --
// Deliberately driven off auth.users, not participants. Each scenario rebuilds
// the campaign, and that delete cascades its participants away -- so reading
// `participants` at the end only ever finds the last scenario's rows and the
// earlier accounts survive as orphans. The first run of this probe left 26
// behind exactly that way.
await db.from("campaigns").delete().eq("slug", "probe-conc");
await db.from("organizations").delete().eq("slug", "probe-conc");
const purged = await purgeAccounts((email) => /@probe\.invalid$/.test(email));
console.log(`\nlimpieza: campaña desechable y ${purged} cuentas eliminadas`);

process.exit(bad ? 1 : 0);

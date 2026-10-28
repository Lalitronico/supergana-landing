// Run with:  npm test
//
// What a campaign may say about its own look: the hero's prop and sky, the
// progress meter, the name on screen, and theme keys over its organisation's.
// Every one of these is hand-edited jsonb, so the assertions are about typos
// failing toward a plainer screen, never toward a broken one or an unsafe URL.

import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_STAGE, NO_PARTNERS, parseCampaignConfig } from "./config.ts";
import { campaignTheme } from "./theme.ts";

test("a campaign that says nothing gets no prop and the blue sky", () => {
  const c = parseCampaignConfig({});
  assert.deepEqual(c.stage, DEFAULT_STAGE);
  assert.equal(c.progressMeter, "bar");
  assert.equal(c.sponsorName, null);
  assert.equal(c.themeOverride, null);
});

test("the pump is asked for by name", () => {
  assert.deepEqual(parseCampaignConfig({ stage: { prop: "pump" } }).stage, {
    prop: { kind: "pump" },
    backdrop: "blue",
  });
});

test("a picture prop carries its dial only when all three numbers are fractions", () => {
  const placed = parseCampaignConfig({
    stage: { prop: "/brands/love-kitchen/props/asador.webp", backdrop: "red", readout: { x: 0.5, y: 0.2, size: 0.3 } },
  }).stage;
  assert.deepEqual(placed, {
    prop: { kind: "image", url: "/brands/love-kitchen/props/asador.webp", readout: { x: 0.5, y: 0.2, size: 0.3 } },
    backdrop: "red",
  });

  const sloppy = parseCampaignConfig({
    stage: { prop: "/brands/love-kitchen/props/asador.webp", readout: { x: 50, y: 0.2, size: 0.3 } },
  }).stage;
  assert.equal(sloppy.prop?.kind === "image" && sloppy.prop.readout, null);
});

test("a picture prop with no readout carries no dial", () => {
  // Love & Kitchen's grill stands alone: the "+10" floating over it read as noise.
  const plain = parseCampaignConfig({ stage: { prop: "/brands/love-kitchen/props/asador.webp", backdrop: "red" } }).stage;
  assert.deepEqual(plain.prop, { kind: "image", url: "/brands/love-kitchen/props/asador.webp", readout: null });
});

test("an unsafe or unknown prop is no prop, and an unknown sky is blue", () => {
  for (const prop of ["javascript:alert(1)", "//evil.example/x.png", "data:image/png;base64,AAA", "grill", 42]) {
    assert.equal(parseCampaignConfig({ stage: { prop } }).stage.prop, null, String(prop));
  }
  assert.equal(parseCampaignConfig({ stage: { backdrop: "#ff0000" } }).stage.backdrop, "blue");
});

test("the meter accepts the three it knows and nothing else", () => {
  assert.equal(parseCampaignConfig({ progress_meter: "fuel" }).progressMeter, "fuel");
  assert.equal(parseCampaignConfig({ progress_meter: "bottle" }).progressMeter, "bottle");
  assert.equal(parseCampaignConfig({ progress_meter: "jar" }).progressMeter, "bar");
});

test("the sponsor name is trimmed and an empty one is no name", () => {
  assert.equal(parseCampaignConfig({ sponsor_name: "  Love & Kitchen " }).sponsorName, "Love & Kitchen");
  assert.equal(parseCampaignConfig({ sponsor_name: "   " }).sponsorName, null);
});

test("a campaign's theme keys win over its organisation's, and are validated the same way", () => {
  const org = {
    logo_url: "/brands/bafar/logo.png",
    brand: "#0055A4",
    cast: [{ id: "oso", name: "Oso", image: "/brands/bafar/cast/oso.webp" }],
  };
  const t = campaignTheme(org, {
    logo_url: "/brands/love-kitchen/logo.png",
    brand: "#FF0000",
    cast: [{ id: "dino", name: "Dino", image: "/brands/love-kitchen/cast/dino.webp", brand: "Salsa BBQ" }],
  });
  assert.equal(t.logoUrl, "/brands/love-kitchen/logo.png");
  assert.equal(t.brand, "#FF0000");
  // Cast is replaced whole, never mixed.
  assert.deepEqual(t.cast.map((m) => m.id), ["dino"]);

  // A bad override value is dropped exactly like a bad org value would be.
  assert.equal(campaignTheme(org, { logo_url: "javascript:x" }).logoUrl, null);
  // No override: the organisation's theme as it always was.
  assert.equal(campaignTheme(org, null).brand, "#0055A4");
});

test("a campaign that names no partners has no partner band", () => {
  assert.deepEqual(parseCampaignConfig({}).partners, NO_PARTNERS);
  for (const partners of [null, "Bachi", ["Bachi"], 42]) {
    assert.deepEqual(parseCampaignConfig({ partners }).partners, NO_PARTNERS, String(partners));
  }
});

test("partners keep their order, need a name, and an unsafe logo falls back to the name", () => {
  const p = parseCampaignConfig({
    partners: {
      brands: [
        { name: " Love & Kitchen ", logo_url: "/brands/love-kitchen/monograma.png" },
        { name: "Bachi", logo_url: "/brands/bafar/partners/bachi.png" },
        { logo_url: "/brands/bafar/partners/nameless.png" },
        "Sabori",
      ],
      stores: [
        { name: "La Pastora", logo_url: "javascript:alert(1)" },
        { name: "CarneMart", logo_url: "//evil.example/x.png" },
      ],
    },
  }).partners;
  assert.deepEqual(p.brands, [
    { name: "Love & Kitchen", logoUrl: "/brands/love-kitchen/monograma.png" },
    { name: "Bachi", logoUrl: "/brands/bafar/partners/bachi.png" },
  ]);
  assert.deepEqual(p.stores, [
    { name: "La Pastora", logoUrl: null },
    { name: "CarneMart", logoUrl: null },
  ]);
});

test("a partner row is capped, so a pasted list cannot bury the home", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ name: `Tienda ${i}` }));
  assert.equal(parseCampaignConfig({ partners: { stores: many } }).partners.stores.length, 6);
});

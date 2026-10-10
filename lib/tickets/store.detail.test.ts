import { test } from "node:test";
import assert from "node:assert/strict";
import { prizeDetail } from "./store.ts";

test("prizeDetail reads the documented keys", () => {
  const d = prizeDetail(
    {
      detail: {
        demo: true,
        image_url: "/brands/x/premios/a.png",
        value_cents: 500,
        provider: "Tremendous",
        entrega: "Entrega digital.",
        entrega_en: "Digital delivery.",
      },
    },
    "es",
  );
  assert.deepEqual(d, {
    imageUrl: "/brands/x/premios/a.png",
    valueCents: 500,
    provider: "Tremendous",
    delivery: "Entrega digital.",
  });
});

test("prizeDetail prefers the English note in English, falls back to Spanish", () => {
  assert.equal(prizeDetail({ detail: { entrega: "es", entrega_en: "en" } }, "en").delivery, "en");
  assert.equal(prizeDetail({ detail: { entrega: "es" } }, "en").delivery, "es");
});

test("prizeDetail drops unsafe or malformed values and never exposes internal flags", () => {
  const d = prizeDetail(
    { detail: { image_url: "javascript:alert(1)", value_cents: "500", provider: 7, demo: true } },
    "es",
  );
  assert.equal(d.imageUrl, null);
  assert.equal(d.valueCents, null);
  assert.equal(d.provider, null);
  assert.equal("demo" in d, false);
  assert.deepEqual(prizeDetail({ detail: null }, "es"), {
    imageUrl: null, valueCents: null, provider: null, delivery: null,
  });
});

import { bestAffordablePrize, type StoreSnapshot, type StorePrize } from "./store.ts";

const item = (id: string, cost: number, remaining = 5): StorePrize => ({
  id, nameEs: id, nameEn: null, kind: "giftcard", pointsCost: cost,
  inventory: 10, remaining, active: true, detail: {},
});
const shelf = (points: number, items: StorePrize[], taken: string[] = []): StoreSnapshot => ({
  available: true, weekStart: "", points,
  drop: { id: "d", status: "open", weekStart: "", items },
  redemptions: taken.map((dropItemId) => ({
    id: dropItemId, code: "X", status: "confirmed" as const, pointsSpent: 0, createdAt: "",
    fulfilledAt: null, dropItemId, prizeNameEs: "", prizeNameEn: null, kind: "giftcard" as const,
  })),
});

test("bestAffordablePrize picks the most valuable claimable prize", () => {
  const s = shelf(700, [item("a", 150), item("b", 300), item("c", 600), item("d", 1500)]);
  assert.equal(bestAffordablePrize(s)?.id, "c");
});

test("bestAffordablePrize skips taken and sold-out prizes, and returns null when nothing is reachable", () => {
  assert.equal(bestAffordablePrize(shelf(700, [item("a", 150), item("c", 600, 0)], ["a"])), null);
  assert.equal(bestAffordablePrize(shelf(50, [item("a", 150)])), null);
  assert.equal(bestAffordablePrize(null), null);
});

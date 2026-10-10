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

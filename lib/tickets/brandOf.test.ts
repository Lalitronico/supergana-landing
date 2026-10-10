import { test } from "node:test";
import assert from "node:assert/strict";
import { brandOfLabel, dominantBrand } from "./brandOf.ts";

const brands = [{ name: "Sidral Mundet" }, { name: "Sangría Señorial" }, { name: "D'Gari" }];

test("brandOfLabel matches by prefix, ignoring accents, case and punctuation", () => {
  assert.equal(brandOfLabel("Sidral Mundet Manzana 1.5 L", brands)?.name, "Sidral Mundet");
  assert.equal(brandOfLabel("SANGRIA SENORIAL 750 ml", brands)?.name, "Sangría Señorial");
  assert.equal(brandOfLabel("DGari Fresa", brands)?.name, "D'Gari");
  assert.equal(brandOfLabel("Leche entera", brands), null);
});

test("dominantBrand picks the brand with most labels and keeps per-label brands", () => {
  const r = dominantBrand(
    ["Sangría Señorial 750 ml", "Sidral Mundet Manzana", "Sidral Mundet Piña", "Pan"],
    brands,
  );
  assert.equal(r.dominant?.name, "Sidral Mundet");
  assert.deepEqual(r.byLabel.map((b) => b?.name ?? null), ["Sangría Señorial", "Sidral Mundet", "Sidral Mundet", null]);
  assert.equal(dominantBrand([], brands).dominant, null);
});

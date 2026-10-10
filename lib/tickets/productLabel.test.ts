// Run with:  npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { productLabel } from "./productLabel.ts";

test("appends brand and size when the name carries neither", () => {
  assert.equal(
    productLabel({ brand: "Jarritos", name: "Tamarindo", size: "1.5 L" }),
    "Jarritos Tamarindo 1.5 L",
  );
});

test("does not repeat a presentation the name already has", () => {
  assert.equal(
    productLabel({ brand: "Jarritos", name: "Tamarindo 1.5 L", size: "1.5 L" }),
    "Jarritos Tamarindo 1.5 L",
  );
});

test("does not repeat the brand, case-insensitively", () => {
  assert.equal(
    productLabel({ brand: "Jarritos", name: "JARRITOS Fresa 1.5 l", size: "1.5 L" }),
    "JARRITOS Fresa 1.5 l",
  );
});

test("withBrand false drops the brand but keeps the presentation once", () => {
  assert.equal(
    productLabel({ brand: "Alaska", name: "Botella 600 ml", size: "600 ml" }, { withBrand: false }),
    "Botella 600 ml",
  );
});

test("tolerates a missing size", () => {
  assert.equal(productLabel({ brand: "Mineragua", name: "Agua mineral", size: null }), "Mineragua Agua mineral");
});

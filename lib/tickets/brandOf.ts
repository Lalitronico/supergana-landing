// Which brand a product label belongs to, from the labels the participant's own
// receipt produced ("Sidral Mundet Manzana 1.5 L").
//
// `/me` sends labels, not ids, so the brand is deduced by prefix against the
// campaign's brand list — accent- and case-insensitive, like `castForBrand`,
// because the label and the brand name are typed by different people. Longest
// brand name wins ("Sidral Mundet" before a hypothetical "Sidral").

export interface BrandLike {
  name: string;
}

const key = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

/** The brand a label starts with, or null when none matches. */
export const brandOfLabel = <B extends BrandLike>(label: string, brands: B[]): B | null => {
  const wanted = key(label);
  let best: B | null = null;
  for (const brand of brands) {
    const k = key(brand.name);
    if (k && wanted.startsWith(k) && (!best || k.length > key(best.name).length)) best = brand;
  }
  return best;
};

/**
 * The brand that appears most among the labels (ties go to the first seen), and
 * the per-label brand for chips. Labels with no known brand map to null.
 */
export const dominantBrand = <B extends BrandLike>(
  labels: string[],
  brands: B[],
): { dominant: B | null; byLabel: (B | null)[] } => {
  const byLabel = labels.map((l) => brandOfLabel(l, brands));
  const counts = new Map<B, number>();
  for (const b of byLabel) if (b) counts.set(b, (counts.get(b) ?? 0) + 1);
  let dominant: B | null = null;
  let top = 0;
  for (const [b, n] of counts) {
    if (n > top) {
      top = n;
      dominant = b;
    }
  }
  return { dominant, byLabel };
};

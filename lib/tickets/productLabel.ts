// One way to spell a catalogue product, everywhere it is shown.
//
// `products.name` is free text and often already carries the presentation
// ("Tamarindo 1.5 L") or even the brand ("Jarritos Tamarindo"); `size` and
// `brand` are separate columns. Gluing all three together produced
// "Tamarindo 1.5 L 1.5 L" in the console. This is the single place that
// decides what to append, so no screen re-invents the rule.

export interface LabelableProduct {
  brand: string;
  name: string;
  size?: string | null;
}

const contains = (haystack: string, needle: string | null | undefined): boolean =>
  Boolean(needle) && haystack.toLowerCase().includes((needle as string).trim().toLowerCase());

/**
 * "Jarritos Tamarindo 1.5 L" with `withBrand` (the default), "Tamarindo 1.5 L"
 * without it. Brand and size are each appended only when the name does not
 * already say them, compared case-insensitively.
 */
export const productLabel = (
  product: LabelableProduct,
  { withBrand = true }: { withBrand?: boolean } = {},
): string => {
  const name = product.name.trim();
  const brand = product.brand.trim();
  const size = product.size?.trim() ?? "";
  return [
    withBrand && brand && !contains(name, brand) ? brand : null,
    name,
    size && !contains(name, size) ? size : null,
  ]
    .filter(Boolean)
    .join(" ");
};

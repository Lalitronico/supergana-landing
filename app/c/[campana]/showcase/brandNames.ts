import type { Brand, Locale } from "@/lib/tickets/config";

/**
 * "Jarritos y Mineragua" / "Jarritos and Mineragua": the participating brands as
 * a sentence fragment, with the conjunction of the reader's language. Intl does
 * the grammar (Spanish "y" becomes "e" before an i-sound, English keeps the
 * serial comma), so this works for N brands without a table per language.
 *
 * Returns null when the campaign defines no brands, which tells the caller to
 * keep talking about the organisation as it always did.
 */
export const brandNames = (brands: Brand[], locale: Locale): string | null => {
  const names = brands.map((b) => b.name.trim()).filter(Boolean);
  if (names.length === 0) return null;
  return new Intl.ListFormat(locale === "en" ? "en-US" : "es-MX", {
    style: "long",
    type: "conjunction",
  }).format(names);
};

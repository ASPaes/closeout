/**
 * Normalize a product name for deduplication.
 * Mirrors the DB function public.normalize_product_name().
 *
 * Steps: lowercase → trim → remove accents → remove punctuation → collapse spaces
 */
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-z0-9 ]/g, "")     // remove punctuation
    .replace(/\s+/g, " ")           // collapse spaces
    .trim();
}

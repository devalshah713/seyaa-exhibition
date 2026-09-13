// Offline lookup over the bundled price sheet (lib/stock/data.json), which is
// generated from the exhibition Excel by scripts/generate-data.mjs. No network
// and no database: the whole sheet ships with the app.

import data from "./stock/data.json";
import type { LookupResult, Quotation } from "./types";

const PRODUCTS = data as Quotation[];

function normalizeCode(code: string): string {
  return code.trim().replace(/\s+/g, "").toUpperCase();
}

// Pre-index by SR number AND stock code, so a salesperson finds the product
// whichever of the two numbers is printed on the tag they are holding. A single
// key can map to several products when a number repeats across sheet tabs.
const INDEX: Map<string, Quotation[]> = (() => {
  const m = new Map<string, Quotation[]>();
  const add = (raw: string | undefined, q: Quotation) => {
    const key = normalizeCode(raw ?? "");
    if (!key) return;
    const list = m.get(key) ?? [];
    // Guard against a product whose SR and stock code are identical.
    if (!list.includes(q)) list.push(q);
    m.set(key, list);
  };
  for (const q of PRODUCTS) {
    add(q.srNo, q);
    add(q.stockCode, q);
  }
  return m;
})();

/**
 * Look up a product by stock number. Exact match first; otherwise up to 8
 * partial matches (number substring or design-name match) as suggestions.
 */
export function lookupStock(rawCode: string): LookupResult {
  const code = normalizeCode(rawCode);
  if (!code) return { matches: [], suggestions: [] };

  const matches = INDEX.get(code) ?? [];
  if (matches.length > 0) return { matches, suggestions: [] };

  const needle = code.toLowerCase();
  const suggestions: Quotation[] = [];
  for (const q of PRODUCTS) {
    if (
      q.srNo.toLowerCase().includes(needle) ||
      (q.stockCode ?? "").toLowerCase().includes(needle) ||
      (q.design ?? "").toLowerCase().includes(needle)
    ) {
      suggestions.push(q);
      if (suggestions.length >= 8) break;
    }
  }
  return { matches, suggestions };
}

/** Number of products in the bundled sheet. */
export function productCount(): number {
  return PRODUCTS.length;
}

/** Category tab names present in the bundled data, for display. */
export function stockCategories(): string[] {
  return [...new Set(PRODUCTS.map((q) => q.sourceTab))];
}

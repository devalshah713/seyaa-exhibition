"use server";

import { lookupStock } from "@/lib/stock";
import type { LookupResult } from "@/lib/types";

/** Stock-number lookup for the sales portal. No auth: the portal is open. */
export async function stockSearchAction(query: string): Promise<LookupResult> {
  return lookupStock(query);
}

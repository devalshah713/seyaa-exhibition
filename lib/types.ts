// Domain types for the Seyaa Diamonds SR quotation lookup.

export type LineItem = {
  stoneWeightBreakup?: number;
  stonePcs?: number;
  pointers?: number;
  shape?: string;
  sieveSize?: string;
  productCode?: string;
  diamondPriceUsd?: number;
  diamondPriceInr?: number;
};

export type PriceSummary = {
  // Diamond cost is the SUM of every line item's diamond price.
  diamondUsd?: number;
  diamondInr?: number;
  // Gold / labor / total come straight off the product's header row.
  goldUsd?: number;
  goldInr?: number;
  laborUsd?: number;
  laborInr?: number;
  totalUsd?: number;
  totalInr?: number;
};

export type Quotation = {
  srNo: string;
  sourceTab: string;
  date?: string;
  design?: string;
  stockCode?: string;
  location?: string;
  partyName?: string;
  goldDetails?: string;
  inchSize?: string;
  grossWeight?: number;
  netWeight?: number;
  totalDiamondWeight?: number;
  totalStonePcs?: number;
  comments?: string;
  price: PriceSummary;
  lineItems: LineItem[];
  // Set when a specific pendant/variant has been chosen for split-stock items
  // (e.g. S0145C's "Green Heart" / "Yellow Heart"). Used for display + PDF.
  variantLabel?: string;
};

export type Tab = {
  name: string;
  rows: string[][];
};

export type LookupResult = {
  matches: Quotation[]; // exact SR matches (usually one, more if SR repeats across tabs)
  suggestions: Quotation[]; // partial matches when there is no exact hit
};

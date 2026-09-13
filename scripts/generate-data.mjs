// Import the exhibition Excel into the bundled price sheet.
//
//   npm run import-sheet -- <path-to-xlsx> [--currency=USD|INR]
//   node scripts/generate-data.mjs <path-to-xlsx> [--currency=USD|INR]
//
// Writes lib/stock/data.json, and in lib/config.ts flips PORTAL.usingSampleData
// off and sets PORTAL.currency to match the sheet.
//
// Handles both price-sheet layouts Seyaa uses:
//   * FLAT     — one row per product, a single FINAL PRICE column.
//   * GROUPED  — a row with an SR number starts a product, and the rows beneath
//                it are that product's diamond/stone line items, whose diamond
//                prices are summed into the product's diamond cost.
// The two are distinguished by whether any line-item column is present, so the
// same script reads either without a flag.

import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const args = process.argv.slice(2);
const xlsxPath = args.find((a) => !a.startsWith("--"));
if (!xlsxPath) {
  console.error("Usage: node scripts/generate-data.mjs <path-to-xlsx> [--currency=USD|INR]");
  process.exit(1);
}

const currencyArg = (args.find((a) => a.startsWith("--currency=")) ?? "").split("=")[1];
const CURRENCY = (currencyArg ?? "USD").toUpperCase();
if (CURRENCY !== "USD" && CURRENCY !== "INR") {
  console.error(`Unsupported --currency=${currencyArg}. Use USD or INR.`);
  process.exit(1);
}
// A sheet's single unlabelled price column ("FINAL PRICE", "PRICE", "TOTAL")
// lands in whichever total the chosen currency uses.
const TOTAL_KEY = CURRENCY === "USD" ? "totalUsd" : "totalInr";
const DIAMOND_KEY = CURRENCY === "USD" ? "diamondPriceUsd" : "diamondPriceInr";
console.log(`Currency: ${CURRENCY}`);

const workbook = XLSX.readFile(xlsxPath);
console.log("Sheets found:", workbook.SheetNames);

// ── Column mapping ───────────────────────────────────────────────────────────
// Every spelling of a column we have seen in the Seyaa price sheets. Add new
// aliases here when a sheet arrives with a different header.

const HEADER_ALIASES = {
  "sr. no.": "srNo", "sr no.": "srNo", "sr no": "srNo",
  "sr.no.": "srNo", "srno": "srNo", "sr": "srNo", "s. no.": "srNo", "s no": "srNo",
  "date": "date",
  "design": "design", "design name": "design", "item": "design", "item name": "design",
  "stock code": "stockCode", "stk code": "stockCode", "stock no": "stockCode",
  "stock no.": "stockCode", "stock number": "stockCode", "stock": "stockCode",
  "location": "location", "loc": "location",
  "type": "type", "category": "type", "product type": "type",
  "gold details": "goldDetails", "gold detail": "goldDetails",
  // Labelled "GOLD WEIGHT" in some sheets but holds the karat/colour
  // ("14K WHITE"), not a number — so it maps to the gold description.
  "gold weight": "goldDetails", "gold": "goldDetails", "gold colour": "goldDetails",
  "gold color": "goldDetails", "metal": "goldDetails",
  "inch size": "inchSize", "size": "inchSize",
  "gross weight": "grossWeight", "gross wt": "grossWeight", "gross wt.": "grossWeight",
  "net weight": "netWeight", "net wt": "netWeight", "net wt.": "netWeight",
  "total diamond weight": "totalDiamondWeight", "total diamond wt": "totalDiamondWeight",
  "diamond weight": "totalDiamondWeight", "diamond wt": "totalDiamondWeight",
  "diamond pics": "totalStonePcs", "diamond pcs": "totalStonePcs",
  "diamond pieces": "totalStonePcs", "no of diamonds": "totalStonePcs",
  "diamond size": "diamondSize", "dia size": "diamondSize",
  "stone weight breakup": "stoneWeightBreakup", "stone wt breakup": "stoneWeightBreakup",
  "stone pcs.": "stonePcs", "stone pcs": "stonePcs",
  "total stone pcs": "totalStonePcs", "total stone pcs.": "totalStonePcs",
  "pointers": "pointers", "pointer": "pointers",
  "shape": "shape",
  "sieve / size": "sieveSize", "sieve/size": "sieveSize", "sieve size": "sieveSize",
  "mfg name": "mfgName", "party name": "partyName", "product code": "productCode",
  "diamond price ($)": "diamondPriceUsd", "gold price ($)": "goldPriceUsd",
  "labor ($)": "laborUsd", "labour ($)": "laborUsd", "total ($)": "totalUsd",
  "diamond price (₹)": "diamondPriceInr", "gold price (₹)": "goldPriceInr",
  "labor (₹)": "laborInr", "labour (₹)": "laborInr", "total (₹)": "totalInr",
  // Sales-price spellings — all map to the INR total shown on the card.
  // Unlabelled single-price columns → resolved to the --currency total below.
  "final price": "finalPrice", "sales price": "finalPrice", "sale price": "finalPrice",
  "selling price": "finalPrice", "price": "finalPrice", "total": "finalPrice",
  "total price": "finalPrice", "grand total": "finalPrice", "amount": "finalPrice",
  "comments": "comments", "remarks": "comments", "comment": "comments",
};

const SR_HEADERS = new Set(["sr. no.", "sr no.", "sr no", "sr.no.", "srno", "sr", "s. no.", "s no"]);

function normalizeHeader(raw) {
  return String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function mapColumns(headerRow) {
  const map = {};
  const unmapped = [];
  headerRow.forEach((cell, idx) => {
    const norm = normalizeHeader(cell);
    if (norm === "") return;
    const key = HEADER_ALIASES[norm];
    if (key) {
      if (map[key] === undefined) map[key] = idx;
    } else {
      unmapped.push(norm);
    }
  });
  return { map, unmapped };
}

function cellVal(row, cols, key) {
  const idx = cols[key];
  if (idx === undefined) return "";
  return String(row[idx] ?? "").trim();
}

function num(raw) {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[,$₹\s]/g, "");
  if (cleaned === "") return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function str(raw) {
  const v = raw.trim();
  return v === "" ? undefined : v;
}

function isProductStart(raw) {
  const v = raw.trim();
  return v !== "" && v.toUpperCase() !== "NA";
}

function lineItemFrom(row, cols) {
  const item = {
    stoneWeightBreakup: num(cellVal(row, cols, "stoneWeightBreakup")),
    stonePcs: num(cellVal(row, cols, "stonePcs")),
    pointers: num(cellVal(row, cols, "pointers")),
    shape: str(cellVal(row, cols, "shape")),
    sieveSize: str(cellVal(row, cols, "sieveSize")),
    productCode: str(cellVal(row, cols, "productCode")),
    diamondPriceUsd: num(cellVal(row, cols, "diamondPriceUsd")),
    diamondPriceInr: num(cellVal(row, cols, "diamondPriceInr")),
  };
  const hasData = Object.values(item).some((v) => v !== undefined);
  return hasData ? item : null;
}

function sumItems(items, key) {
  let total = 0;
  let seen = false;
  for (const it of items) {
    if (it[key] !== undefined) {
      total += it[key];
      seen = true;
    }
  }
  return seen ? Math.round(total * 100) / 100 : undefined;
}

function parseSheet(sheetName, sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  // Find the header row — the first row carrying an SR-number column.
  const headerIdx = rows.findIndex((r) => r.some((c) => SR_HEADERS.has(normalizeHeader(c))));
  if (headerIdx === -1) {
    console.log(`  [skip] "${sheetName}" — no SR header found`);
    return [];
  }

  const { map: cols, unmapped } = mapColumns(rows[headerIdx]);
  if (cols.srNo === undefined) {
    console.log(`  [skip] "${sheetName}" — srNo column not mapped`);
    return [];
  }
  if (unmapped.length > 0) {
    console.log(`  [note] "${sheetName}" — ignored columns: ${unmapped.join(", ")}`);
  }

  const quotations = [];
  let current = null;

  const finalize = (q) => {
    if (!q) return;
    // Grouped sheets only: diamond cost is the sum of the product's line items.
    if (q.lineItems.length > 0) {
      q.price.diamondUsd = sumItems(q.lineItems, "diamondPriceUsd");
      q.price.diamondInr = sumItems(q.lineItems, "diamondPriceInr");
      // With no explicit total, the product is worth its parts.
      if (q.price[TOTAL_KEY] === undefined) {
        q.price[TOTAL_KEY] = sumItems(q.lineItems, DIAMOND_KEY);
      }
    }
    // Drop keys left undefined so data.json stays small and readable.
    for (const [k, v] of Object.entries(q.price)) {
      if (v === undefined) delete q.price[k];
    }
    for (const [k, v] of Object.entries(q)) {
      if (v === undefined) delete q[k];
    }
    quotations.push(q);
  };

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const srRaw = cellVal(row, cols, "srNo");

    if (isProductStart(srRaw)) {
      // A new SR number starts a new product; rows beneath it are its stones.
      finalize(current);
      current = {
        srNo: srRaw.trim(),
        sourceTab: sheetName,
        date: str(cellVal(row, cols, "date")),
        design: str(cellVal(row, cols, "design")),
        stockCode: str(cellVal(row, cols, "stockCode")),
        location: str(cellVal(row, cols, "location")),
        partyName: str(cellVal(row, cols, "partyName")),
        type: str(cellVal(row, cols, "type")),
        goldDetails: str(cellVal(row, cols, "goldDetails")),
        inchSize: str(cellVal(row, cols, "inchSize")),
        grossWeight: num(cellVal(row, cols, "grossWeight")),
        netWeight: num(cellVal(row, cols, "netWeight")),
        totalDiamondWeight: num(cellVal(row, cols, "totalDiamondWeight")),
        totalStonePcs: num(cellVal(row, cols, "totalStonePcs")),
        diamondSize: str(cellVal(row, cols, "diamondSize")),
        comments: str(cellVal(row, cols, "comments")),
        price: {
          goldUsd: num(cellVal(row, cols, "goldPriceUsd")),
          goldInr: num(cellVal(row, cols, "goldPriceInr")),
          laborUsd: num(cellVal(row, cols, "laborUsd")),
          laborInr: num(cellVal(row, cols, "laborInr")),
          totalUsd: num(cellVal(row, cols, "totalUsd")),
          totalInr: num(cellVal(row, cols, "totalInr")),
        },
        lineItems: [],
      };
      // A sheet with one unlabelled price column feeds the chosen currency's total.
      const finalPrice = num(cellVal(row, cols, "finalPrice"));
      if (finalPrice !== undefined && current.price[TOTAL_KEY] === undefined) {
        current.price[TOTAL_KEY] = finalPrice;
      }
      const li = lineItemFrom(row, cols);
      if (li) current.lineItems.push(li);
    } else if (current) {
      const li = lineItemFrom(row, cols);
      if (li) current.lineItems.push(li);
    }
  }
  finalize(current);
  return quotations;
}

// ── Main ─────────────────────────────────────────────────────────────────────

// Rate/config tabs that are not exhibition products. Deliberately does NOT
// include "Sheet1": a single-tab export names its only data tab exactly that.
// Tabs with no SR-number header are skipped automatically anyway.
const SKIP_SHEETS = new Set(["Price List", "Rates", "Config"]);

const allProducts = [];
for (const name of workbook.SheetNames) {
  if (SKIP_SHEETS.has(name)) {
    console.log(`  [skip] "${name}" — excluded sheet`);
    continue;
  }
  const products = parseSheet(name, workbook.Sheets[name]);
  console.log(`  "${name}" → ${products.length} products`);
  allProducts.push(...products);
}

console.log(`\nTotal products: ${allProducts.length}`);

const missingPrice = allProducts.filter((p) => p.price[TOTAL_KEY] === undefined);
if (missingPrice.length > 0) {
  console.warn(
    `\n⚠ ${missingPrice.length} product(s) have no sales price and will show "—":`,
    missingPrice.slice(0, 10).map((p) => p.srNo).join(", "),
    missingPrice.length > 10 ? "…" : "",
  );
}

if (allProducts.length === 0) {
  console.error("\n✗ No products parsed — data.json was NOT overwritten.");
  console.error("  Check the [note]/[skip] lines above and add any missing header aliases.");
  process.exit(1);
}

const dataPath = new URL("../lib/stock/data.json", import.meta.url).pathname;
writeFileSync(dataPath, JSON.stringify(allProducts, null, 2));
console.log(`\n✓ Written ${dataPath}`);

// Real data is in — drop the sample-data banner.
const configPath = new URL("../lib/config.ts", import.meta.url).pathname;
const before = readFileSync(configPath, "utf8");
const after = before
  .replace("usingSampleData: true", "usingSampleData: false")
  .replace(/currency: "(USD|INR)" as Currency/, `currency: "${CURRENCY}" as Currency`);
if (after !== before) {
  writeFileSync(configPath, after);
  console.log(`✓ lib/config.ts updated — currency ${CURRENCY}, sample-data banner off`);
}

// A single-tab workbook has no meaningful category names; say so once.
const tabs = [...new Set(allProducts.map((p) => p.sourceTab))];
const types = [...new Set(allProducts.map((p) => p.type).filter(Boolean))];
console.log(`  Tabs: ${tabs.join(", ")}`);
if (types.length > 0) console.log(`  Types: ${types.join(", ")}`);

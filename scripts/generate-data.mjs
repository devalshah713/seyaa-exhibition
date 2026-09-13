// Import the exhibition Excel into the bundled price sheet.
//
//   npm run import-sheet -- <path-to-xlsx>
//   node scripts/generate-data.mjs <path-to-xlsx>
//
// Writes lib/stock/data.json and flips PORTAL.usingSampleData off in
// lib/config.ts so the "sample data" banner disappears.

import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const xlsxPath = process.argv[2];
if (!xlsxPath) {
  console.error("Usage: node scripts/generate-data.mjs <path-to-xlsx>");
  process.exit(1);
}

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
  "location": "location",
  "gold details": "goldDetails", "gold detail": "goldDetails",
  "inch size": "inchSize", "size": "inchSize",
  "gross weight": "grossWeight", "gross wt": "grossWeight", "gross wt.": "grossWeight",
  "net weight": "netWeight", "net wt": "netWeight", "net wt.": "netWeight",
  "total diamond weight": "totalDiamondWeight", "total diamond wt": "totalDiamondWeight",
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
  "sales price": "totalInr", "sale price": "totalInr", "selling price": "totalInr",
  "sales price (₹)": "totalInr", "price (₹)": "totalInr", "price": "totalInr",
  "total": "totalInr", "total price": "totalInr", "grand total": "totalInr",
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
    // Diamond cost is the sum of every line item under the product.
    q.price.diamondUsd = sumItems(q.lineItems, "diamondPriceUsd");
    q.price.diamondInr = sumItems(q.lineItems, "diamondPriceInr");
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
        goldDetails: str(cellVal(row, cols, "goldDetails")),
        inchSize: str(cellVal(row, cols, "inchSize")),
        grossWeight: num(cellVal(row, cols, "grossWeight")),
        netWeight: num(cellVal(row, cols, "netWeight")),
        totalDiamondWeight: num(cellVal(row, cols, "totalDiamondWeight")),
        totalStonePcs: num(cellVal(row, cols, "totalStonePcs")),
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

// Rate/config tabs that are not exhibition products.
const SKIP_SHEETS = new Set(["Price List", "Sheet1", "Rates", "Config"]);

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

const missingPrice = allProducts.filter((p) => p.price.totalInr === undefined);
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
const config = readFileSync(configPath, "utf8");
if (config.includes("usingSampleData: true")) {
  writeFileSync(configPath, config.replace("usingSampleData: true", "usingSampleData: false"));
  console.log("✓ Sample-data banner turned off in lib/config.ts");
}

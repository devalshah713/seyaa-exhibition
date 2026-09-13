# Seyaa Exhibition — Sales Portal

A single-page sales portal for exhibitions. A salesperson opens the URL, types a
**stock number**, and immediately sees the **sales price** plus the full product
detail from the price sheet.

- **No login.** The portal is open — there is no sign-in step to slow the floor down.
- **No database, no network.** The whole price sheet is imported from Excel at
  build time and bundled into the app, so lookups are instant and work on a weak
  exhibition-hall connection.
- **UI copied from** the Wedding Asia module in `devalshah713/seyaa-jewels`.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

The app ships with three clearly-labelled **sample** products so you can see the
UI before the real sheet is loaded. A banner at the top says so.

## Loading the real price sheet

```bash
npm run import-sheet -- /path/to/price-sheet.xlsx
```

This reads every tab of the workbook, writes `lib/stock/data.json`, and turns the
sample-data banner off. Re-run it whenever the sheet changes, then redeploy.

The importer prints what it did:

```
Sheets found: [ 'Rings', 'Bracelets', 'Price List' ]
  "Rings" → 142 products
  [note] "Rings" — ignored columns: supplier ref
  [skip] "Price List" — excluded sheet
Total products: 268
```

Watch for two lines:

- `[note] … ignored columns:` — a column in the sheet that the importer does not
  recognise. If one of those holds a price you need, add it to `HEADER_ALIASES`
  in `scripts/generate-data.mjs`.
- `⚠ N product(s) have no sales price` — those rows will show `—` instead of a
  price. Usually means the total column is named something new.

### How a sheet is read

- The **header row** is the first row containing an `SR No.` column.
- A row with an SR number **starts a new product**; the rows beneath it, until
  the next SR number, are that product's **diamond/stone line items**.
- The product's diamond cost is the **sum** of its line items' diamond prices.
- Gold, labour and the total are read from the product's own row.
- Tabs named `Price List`, `Sheet1`, `Rates` or `Config` are skipped
  (`SKIP_SHEETS` in the script).

## Search behaviour

A search matches **either** the SR number or the stock code, so whichever number
is printed on the tag will find the product. Spaces and case are ignored. With no
exact hit, up to 8 partial matches are offered as suggestions.

## Configuration

Everything that varies per exhibition lives in `lib/config.ts`:

| Setting | What it does |
| --- | --- |
| `title` / `subtitle` | Shown in the header |
| `coupon` | Set to `{ code: "EXPO15", percent: 15 }` for a one-click discount button, or `null` to hide it |
| `showSpecialDiscount` | Shows the "Special discount (₹)" input for a negotiated amount |
| `usingSampleData` | The sample-data banner; the importer turns this off for you |

## PDF quotes

Any result can be exported as a branded PDF, and several products can be added to
an export list and exported together with combined weight and payable totals. PDF
generation runs entirely in the browser — nothing is uploaded anywhere.

## Deploying

A standard Next.js app — deploy to Vercel (or any Node host) with no environment
variables. Because the price sheet is bundled, **changing prices means re-running
the importer and redeploying**.

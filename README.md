# Seyaa Exhibition — Sales Portal

A single-page sales portal for exhibitions. A salesperson opens the URL, types a
**stock number**, and immediately sees the **sales price** plus the full product
detail from the price sheet.

- **No login.** The portal is open — there is no sign-in step to slow the floor down.
- **No database, no network calls.** The whole price sheet is imported from Excel
  at build time and bundled into the app, so lookups are instant and survive a
  weak exhibition-hall connection.
- **Runs on Cloudflare Workers** via the OpenNext adapter.
- UI copied from the Wedding Asia module in `devalshah713/seyaa-jewels`.

Currently loaded: **162 products** from the merged Hong Kong stock sheet,
priced in **USD**.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000 — plain Next.js, fastest for UI work
```

To run the app exactly as Cloudflare will, on the real Workers runtime:

```bash
npm run preview      # builds the worker and serves it locally
```

## Deploying to Cloudflare

The project is configured as the Worker **`seyaa-exhibition`** (`wrangler.jsonc`),
separate from the existing `seyaa-order` Worker. `workers_dev` is on, so it
publishes to a public `https://seyaa-exhibition.<your-subdomain>.workers.dev`
URL. No environment variables or secrets are needed — the price sheet ships
inside the app.

**There is no login, by design.** Anyone with the link can look up a stock number
and see the price. Nothing in the app reads a session, cookie or password, and
there is no middleware.

### Option A — from a terminal (two commands)

```bash
npx wrangler login   # one time, opens a browser to authorise
npm run deploy       # builds the Worker and publishes it
```

`npm run deploy` prints the live URL when it finishes. Re-run it to ship an
update.

### Option B — from the Cloudflare dashboard (no local tooling)

**Workers & Pages → Create → Import a repository →** pick `seyaa-exhibition`.
Cloudflare's auto-detected defaults — build `npm run build`, deploy
`npx wrangler deploy` — are correct as they stand, because `npm run build` is
wired to `opennextjs-cloudflare build` rather than a bare `next build`.

Cloudflare then rebuilds and redeploys on every push to the production branch.

> **Why `build` is not `next build`.** `wrangler deploy` needs the worker under
> `.open-next/`, which only `opennextjs-cloudflare build` produces — a bare
> `next build` fails with *"Could not find compiled Open Next config"*. OpenNext
> in turn shells out to `npm run build` by default, so `open-next.config.ts`
> pins its inner command to `next build` to stop the two recursing. Use
> `npm run build:next` if you ever want a plain Next.js build.

### Checking it locally first

```bash
npm run preview      # runs the built Worker on the real Workers runtime
```

## Loading a new price sheet

```bash
npm run import-sheet -- /path/to/sheet.xlsx --currency=USD
```

This reads every tab, writes `lib/stock/data.json`, and updates `lib/config.ts`
with the currency. Re-run it whenever prices change, then `npm run deploy` (or push, on Option B).

The importer prints what it did:

```
Currency: USD
Sheets found: [ 'MERGED STOCK' ]
  "MERGED STOCK" → 162 products
Total products: 162
  Types: BRACELET, PENDANT, RING, STUD, CHAIN, NECKLACE, EARRING
```

Watch for two lines:

- `[note] … ignored columns:` — a column the importer does not recognise. If one
  of them holds something you need, add it to `HEADER_ALIASES` in
  `scripts/generate-data.mjs`.
- `⚠ N product(s) have no sales price` — those rows show `—` instead of a price,
  usually because the price column is named something new.

If nothing parses at all, the importer **refuses to overwrite** the existing data
and exits with an error, so a bad run cannot wipe a working price sheet.

### Sheet layouts

The importer handles both layouts Seyaa uses, and tells them apart on its own:

- **Flat** — one row per product with a single `FINAL PRICE` column. This is what
  the Hong Kong sheet uses.
- **Grouped** — a row with an SR number starts a product, and the rows beneath it
  are that product's diamond/stone line items; their diamond prices are summed
  into the product's diamond cost.

The result card adapts: with a flat sheet it shows one sales price, and with a
grouped sheet it also shows the diamond/gold/labour split and the stone breakup
table.

Notes on column names:

- The header row is the first row containing an SR or stock-number column.
- A sheet keyed by `STOCK NO.` rather than `SR. NO.` uses that as the product's
  identity; either way both numbers are searchable.
- `GOLD WEIGHT` / `GOLD` holds the karat and colour (`14K WHITE`), not a number,
  so it maps to the gold description.
- `SOURCE FILE` in a merged workbook is recorded as provenance, not displayed.
- Blank spacer rows are skipped.
- Tabs named `Price List`, `Rates` or `Config` are skipped (`SKIP_SHEETS`).
  `Sheet1` is **not** skipped — a single-tab export names its only data tab that.

## Search behaviour

A search matches **either** the SR number or the stock code, so whichever number
is printed on the tag will find the product. Case and spaces are ignored, so
`s1146c` finds `S1146C`. With no exact hit, up to 8 partial matches — on the
number or the design name — are offered as suggestions.

## Configuration

Everything that varies per exhibition lives in `lib/config.ts`:

| Setting | What it does |
| --- | --- |
| `title` / `subtitle` | Shown in the header |
| `currency` | `USD` or `INR`; the importer keeps this in step with the sheet |
| `coupon` | Set to `{ code: "HK15", percent: 15 }` for a one-click discount button, or `null` to hide it |
| `showSpecialDiscount` | Shows the "Special discount" input for a negotiated amount |
| `usingSampleData` | The placeholder-data banner; the importer turns this off |

## PDF quotes

Any result can be exported as a branded PDF, and several products can be added to
an export list and exported together with combined weight and payable totals. PDF
generation runs entirely in the browser — nothing is uploaded anywhere.

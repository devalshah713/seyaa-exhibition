import type { Quotation } from "@/lib/types";
import { money, numberOrDash, textOrDash, currencySymbol } from "@/lib/format";
import { PORTAL, applyCoupon, applySpecialDiscount } from "@/lib/config";

// Result card for the sales portal. Shows the sales price up front, then the
// product detail. Sheets vary in how much they carry — a flat sheet has a single
// price and no stone breakup, a grouped one has both — so every section below
// renders only when its data is actually present.

const CURRENCY = PORTAL.currency;
const SYMBOL = currencySymbol(CURRENCY);

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-stone-50 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-stone-900">{value}</dd>
    </div>
  );
}

function PriceChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
      <span className="text-xs text-stone-600">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-stone-900">{value}</span>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-stone-300 px-2 py-0.5 text-xs text-stone-600">
      {children}
    </span>
  );
}

export function StockCard({
  quotation: q,
  discounted,
  onToggleDiscount,
  specialDiscount,
  onSpecialDiscountChange,
  actionSlot,
}: {
  quotation: Quotation;
  discounted: boolean;
  onToggleDiscount: () => void;
  specialDiscount?: number;
  onSpecialDiscountChange?: (amount: number) => void;
  actionSlot?: React.ReactNode;
}) {
  const coupon = PORTAL.coupon;
  const total = CURRENCY === "USD" ? q.price.totalUsd : q.price.totalInr;
  const diamond = CURRENCY === "USD" ? q.price.diamondUsd : q.price.diamondInr;
  const gold = CURRENCY === "USD" ? q.price.goldUsd : q.price.goldInr;
  const labor = CURRENCY === "USD" ? q.price.laborUsd : q.price.laborInr;

  const specialAmt = specialDiscount && specialDiscount > 0 ? specialDiscount : 0;
  const afterCoupon = discounted ? applyCoupon(total) : total;
  const finalTotal = specialAmt > 0 ? applySpecialDiscount(afterCoupon, specialAmt) : afterCoupon;
  const isDiscounted = (discounted && !!coupon) || specialAmt > 0;

  // A flat sheet prices the piece as a whole — show the cost split only when
  // the sheet actually breaks it down.
  const hasCostSplit = diamond !== undefined || gold !== undefined || labor !== undefined;

  const details = [
    { label: "Type", value: q.type },
    { label: "Gold", value: q.goldDetails },
    { label: "Inch Size", value: q.inchSize },
    { label: "Gross Wt", value: q.grossWeight },
    { label: "Net Wt", value: q.netWeight },
    { label: "Diamond Wt", value: q.totalDiamondWeight },
    { label: "Diamond Pcs", value: q.totalStonePcs },
    { label: "Diamond Size", value: q.diamondSize },
    { label: "Location", value: q.location },
  ].filter((d) => d.value !== undefined && String(d.value).trim() !== "");

  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      {/* Header */}
      <header className="border-b border-stone-200 bg-stone-50 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                SR {q.srNo}
              </span>
              {q.stockCode && <Tag>Stock {q.stockCode}</Tag>}
              {q.date && <span className="text-xs text-stone-500">{q.date}</span>}
            </div>
            <h2 className="mt-1.5 text-lg font-semibold leading-tight text-stone-900">
              {textOrDash(q.design)}
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {q.type && <Tag>{q.type}</Tag>}
            {q.location && <Tag>{q.location}</Tag>}
          </div>
        </div>
        {actionSlot && <div className="mt-3 flex flex-wrap justify-end gap-2">{actionSlot}</div>}
      </header>

      {/* Sales price */}
      <div className="border-b border-stone-200 px-4 py-5 sm:px-6">
        <p className="text-[11px] uppercase tracking-wide text-stone-500">Sales price</p>
        {isDiscounted ? (
          <div className="mt-1 flex flex-wrap items-end gap-3">
            <p className="text-3xl font-bold tabular-nums text-green-700">
              {money(finalTotal, CURRENCY)}
            </p>
            <p className="pb-1 text-base font-medium tabular-nums text-stone-400 line-through">
              {money(total, CURRENCY)}
            </p>
            {discounted && coupon && (
              <span className="mb-1 rounded-md bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                {coupon.code} · {coupon.percent}% OFF
              </span>
            )}
            {specialAmt > 0 && (
              <span className="mb-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                Special discount · {money(specialAmt, CURRENCY)} OFF
              </span>
            )}
          </div>
        ) : (
          <p className="mt-1 text-3xl font-bold tabular-nums text-brand-600">
            {money(total, CURRENCY)}
          </p>
        )}

        {/* Coupon control — only when a coupon is configured */}
        {coupon && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleDiscount}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                discounted
                  ? "border border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                  : "bg-green-600 text-white hover:bg-green-500"
              }`}
            >
              {discounted
                ? `✓ ${coupon.code} applied — tap to remove`
                : `🎁 Apply ${coupon.code} — ${coupon.percent}% OFF`}
            </button>
          </div>
        )}

        {/* Negotiated discount */}
        {PORTAL.showSpecialDiscount && onSpecialDiscountChange && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label
              className="text-xs font-medium text-stone-600"
              htmlFor={`disc-${q.sourceTab}-${q.srNo}`}
            >
              Special discount ({SYMBOL})
            </label>
            <input
              id={`disc-${q.sourceTab}-${q.srNo}`}
              type="number"
              min={0}
              step={CURRENCY === "USD" ? 0.01 : 1}
              value={specialAmt === 0 ? "" : specialAmt}
              onChange={(e) => {
                const v = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value));
                onSpecialDiscountChange(v);
              }}
              placeholder="Enter amount"
              className="w-36 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30"
            />
            {specialAmt > 0 && (
              <button
                type="button"
                onClick={() => onSpecialDiscountChange(0)}
                className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs text-stone-600 hover:bg-stone-100"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {hasCostSplit && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <PriceChip label="Diamond" value={money(diamond, CURRENCY)} />
            <PriceChip label="Gold" value={money(gold, CURRENCY)} />
            <PriceChip label="Labor" value={money(labor, CURRENCY)} />
          </div>
        )}
      </div>

      {/* Product details */}
      {details.length > 0 && (
        <div className="px-4 py-4 sm:px-6">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {details.map((d) => (
              <Detail
                key={d.label}
                label={d.label}
                value={typeof d.value === "number" ? numberOrDash(d.value) : textOrDash(String(d.value))}
              />
            ))}
          </dl>
        </div>
      )}

      {/* Diamond / stone breakup — grouped sheets only */}
      {q.lineItems.length > 0 && (
        <div className="px-4 pb-5 sm:px-6">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-stone-500">
            Diamond / stone breakup
          </p>
          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-500">
                  <th className="px-3 py-2 font-medium">Shape</th>
                  <th className="px-3 py-2 font-medium">Sieve / Size</th>
                  <th className="px-3 py-2 text-right font-medium">Wt</th>
                  <th className="px-3 py-2 text-right font-medium">Pcs</th>
                  <th className="px-3 py-2 text-right font-medium">Pointers</th>
                  <th className="px-3 py-2 font-medium">Product Code</th>
                  <th className="px-3 py-2 text-right font-medium">Diamond {SYMBOL}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {q.lineItems.map((li, i) => (
                  <tr key={i} className="text-stone-700">
                    <td className="px-3 py-2">{textOrDash(li.shape)}</td>
                    <td className="px-3 py-2">{textOrDash(li.sieveSize)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {numberOrDash(li.stoneWeightBreakup)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{numberOrDash(li.stonePcs)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{numberOrDash(li.pointers)}</td>
                    <td className="px-3 py-2">{textOrDash(li.productCode)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(
                        CURRENCY === "USD" ? li.diamondPriceUsd : li.diamondPriceInr,
                        CURRENCY,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {q.comments && (
        <div className="border-t border-stone-200 px-4 py-3 text-sm text-stone-600 sm:px-6">
          <span className="text-stone-500">Comments: </span>
          {q.comments}
        </div>
      )}
    </article>
  );
}

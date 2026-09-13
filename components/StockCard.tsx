import type { Quotation } from "@/lib/types";
import { money, numberOrDash, textOrDash } from "@/lib/format";
import { PORTAL, applyCoupon, applySpecialDiscount } from "@/lib/config";

// Result card for the sales portal (INR only). Shows the sales price up front,
// then the full product detail from the sheet.

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
  const total = q.price.totalInr;
  const specialAmt = specialDiscount && specialDiscount > 0 ? specialDiscount : 0;
  const afterCoupon = discounted ? applyCoupon(total) : total;
  const finalTotal = specialAmt > 0 ? applySpecialDiscount(afterCoupon, specialAmt) : afterCoupon;
  const isDiscounted = (discounted && !!coupon) || specialAmt > 0;

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
              {q.stockCode && (
                <span className="rounded-md border border-stone-300 px-2 py-0.5 text-xs text-stone-600">
                  Stock {q.stockCode}
                </span>
              )}
              {q.date && <span className="text-xs text-stone-500">{q.date}</span>}
            </div>
            <h2 className="mt-1.5 text-lg font-semibold leading-tight text-stone-900">
              {textOrDash(q.design)}
            </h2>
          </div>
          <span className="rounded-md border border-stone-300 px-2 py-0.5 text-xs text-stone-600">
            {q.sourceTab}
          </span>
        </div>
        {actionSlot && <div className="mt-3 flex flex-wrap justify-end gap-2">{actionSlot}</div>}
      </header>

      {/* Sales price */}
      <div className="border-b border-stone-200 px-4 py-5 sm:px-6">
        <p className="text-[11px] uppercase tracking-wide text-stone-500">Sales price</p>
        {isDiscounted ? (
          <div className="mt-1 flex flex-wrap items-end gap-3">
            <p className="text-3xl font-bold tabular-nums text-green-700">{money(finalTotal, "INR")}</p>
            <p className="pb-1 text-base font-medium tabular-nums text-stone-400 line-through">
              {money(total, "INR")}
            </p>
            {discounted && coupon && (
              <span className="mb-1 rounded-md bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                {coupon.code} · {coupon.percent}% OFF
              </span>
            )}
            {specialAmt > 0 && (
              <span className="mb-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                Special discount · {money(specialAmt, "INR")} OFF
              </span>
            )}
          </div>
        ) : (
          <p className="mt-1 text-3xl font-bold tabular-nums text-brand-600">{money(total, "INR")}</p>
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

        {/* Negotiated rupee discount */}
        {PORTAL.showSpecialDiscount && onSpecialDiscountChange && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-stone-600" htmlFor={`disc-${q.sourceTab}-${q.srNo}`}>
              Special discount (₹)
            </label>
            <input
              id={`disc-${q.sourceTab}-${q.srNo}`}
              type="number"
              min={0}
              step={1}
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

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <PriceChip label="Diamond" value={money(q.price.diamondInr, "INR")} />
          <PriceChip label="Gold" value={money(q.price.goldInr, "INR")} />
          <PriceChip label="Labor" value={money(q.price.laborInr, "INR")} />
        </div>
      </div>

      {/* Product details */}
      <div className="px-4 py-4 sm:px-6">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <Detail label="Gold" value={textOrDash(q.goldDetails)} />
          <Detail label="Inch Size" value={textOrDash(q.inchSize)} />
          <Detail label="Gross Wt" value={numberOrDash(q.grossWeight)} />
          <Detail label="Net Wt" value={numberOrDash(q.netWeight)} />
          <Detail label="Total Diamond Wt" value={numberOrDash(q.totalDiamondWeight)} />
          <Detail label="Total Stone Pcs" value={numberOrDash(q.totalStonePcs)} />
        </dl>
      </div>

      {/* Diamond / stone breakup */}
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
                  <th className="px-3 py-2 text-right font-medium">Diamond ₹</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {q.lineItems.map((li, i) => (
                  <tr key={i} className="text-stone-700">
                    <td className="px-3 py-2">{textOrDash(li.shape)}</td>
                    <td className="px-3 py-2">{textOrDash(li.sieveSize)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{numberOrDash(li.stoneWeightBreakup)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{numberOrDash(li.stonePcs)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{numberOrDash(li.pointers)}</td>
                    <td className="px-3 py-2">{textOrDash(li.productCode)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(li.diamondPriceInr, "INR")}</td>
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

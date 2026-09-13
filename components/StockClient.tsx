"use client";

import { useRef, useState } from "react";
import { stockSearchAction } from "@/app/actions";
import type { LookupResult, Quotation } from "@/lib/types";
import { StockCard } from "./StockCard";
import { PORTAL } from "@/lib/config";
import { money } from "@/lib/format";

const keyOf = (q: Quotation) => `${q.sourceTab}-${q.srNo}`;

export function StockClient() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Quotation[]>([]);
  const [discountMap, setDiscountMap] = useState<Record<string, boolean>>({});
  const [specialDiscountMap, setSpecialDiscountMap] = useState<Record<string, number>>({});
  const [exporting, setExporting] = useState(false);
  const reqId = useRef(0);

  const selectedKeys = new Set(selected.map(keyOf));

  function addToExport(q: Quotation) {
    setSelected((prev) => (prev.some((s) => keyOf(s) === keyOf(q)) ? prev : [...prev, q]));
  }
  function removeFromExport(key: string) {
    setSelected((prev) => prev.filter((s) => keyOf(s) !== key));
  }
  function clearExport() {
    setSelected([]);
  }
  function toggleDiscount(key: string) {
    setDiscountMap((p) => ({ ...p, [key]: !p[key] }));
  }
  function setSpecialDiscount(key: string, amount: number) {
    setSpecialDiscountMap((p) => ({ ...p, [key]: amount }));
  }

  async function runExport(quotations: Quotation[]) {
    if (quotations.length === 0) return;
    setError(null);
    setExporting(true);
    try {
      const { exportStockPdf } = await import("@/lib/pdf");
      await exportStockPdf(
        quotations.map((q) => ({
          quotation: q,
          discounted: !!discountMap[keyOf(q)],
          specialDiscount: specialDiscountMap[keyOf(q)] || 0,
        })),
      );
    } catch {
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function runSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;

    const id = ++reqId.current;
    setSubmitted(trimmed);
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await stockSearchAction(trimmed);
      if (id !== reqId.current) return;
      setResult(res);
    } catch {
      if (id !== reqId.current) return;
      setResult(null);
      setError("Could not run the search. Try again in a moment.");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  const hasMatches = result && result.matches.length > 0;
  const hasSuggestions = result && result.matches.length === 0 && result.suggestions.length > 0;
  const noResults =
    result && result.matches.length === 0 && result.suggestions.length === 0 && !loading;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter stock number (e.g. 1002, 773 or S0259C)"
          className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none placeholder:text-stone-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30"
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "…" : "Search"}
        </button>
      </form>

      {/* Results */}
      <div className="mt-6 space-y-4">
        {loading && <p className="py-10 text-center text-sm text-stone-500">Searching…</p>}

        {!loading && !result && !error && (
          <p className="py-10 text-center text-sm text-stone-500">
            Enter a stock number above to see its sales price.
          </p>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {!loading &&
          hasMatches &&
          result!.matches.map((q, i) => {
            const k = keyOf(q);
            const isSelected = selectedKeys.has(k);
            return (
              <StockCard
                key={`${k}-${i}`}
                quotation={q}
                discounted={!!discountMap[k]}
                onToggleDiscount={() => toggleDiscount(k)}
                specialDiscount={specialDiscountMap[k] || 0}
                onSpecialDiscountChange={(amount) => setSpecialDiscount(k, amount)}
                actionSlot={
                  <>
                    <button
                      type="button"
                      onClick={() => (isSelected ? removeFromExport(k) : addToExport(q))}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? "border-brand-400 bg-brand-50 text-brand-700"
                          : "border-stone-300 text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      {isSelected ? "✓ In export list" : "+ Add to export list"}
                    </button>
                    <button
                      type="button"
                      onClick={() => runExport([q])}
                      disabled={exporting}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-60"
                    >
                      Export this PDF
                    </button>
                  </>
                }
              />
            );
          })}

        {!loading && hasSuggestions && (
          <div>
            <p className="mb-3 text-sm text-stone-600">
              No exact match for{" "}
              <span className="font-semibold text-stone-900">“{submitted}”</span>. Did you mean:
            </p>
            <ul className="space-y-2">
              {result!.suggestions.map((s, i) => (
                <li key={`${s.sourceTab}-${s.srNo}-${i}`}>
                  <button
                    onClick={() => {
                      setQuery(s.srNo);
                      runSearch(s.srNo);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-brand-400"
                  >
                    <span className="min-w-0 truncate text-sm text-stone-700">
                      <span className="font-semibold text-brand-600">Stock {s.srNo}</span>
                      <span className="mx-2 text-stone-400">·</span>
                      {s.design ?? "—"}
                    </span>
                    <span className="shrink-0 text-xs text-stone-500">{s.sourceTab}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {noResults && (
          <div className="py-10 text-center">
            <p className="text-sm text-stone-600">
              No product found for{" "}
              <span className="font-semibold text-stone-900">“{submitted}”</span>.
            </p>
            <p className="mt-1 text-xs text-stone-400">Check the stock number and try again.</p>
          </div>
        )}
      </div>

      {/* Sticky export tray */}
      {selected.length > 0 && (
        <div className="sticky bottom-3 z-10 mt-6 rounded-xl border border-stone-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-stone-600">
              Export list ({selected.length})
            </span>
            {selected.map((s) => {
              const k = keyOf(s);
              return (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded-md bg-brand-100 px-2 py-1 text-xs font-medium text-brand-700"
                >
                  Stock {s.srNo}
                  {specialDiscountMap[k] > 0 && (
                    <span className="text-green-700">
                      −{money(specialDiscountMap[k], PORTAL.currency)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFromExport(k)}
                    aria-label={`Remove stock ${s.srNo}`}
                    className="text-brand-700/70 hover:text-brand-900"
                  >
                    ×
                  </button>
                </span>
              );
            })}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={clearExport}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => runExport(selected)}
                disabled={exporting}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-60"
              >
                {exporting ? "Exporting…" : `Export PDF (${selected.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

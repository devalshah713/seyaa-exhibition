import Image from "next/image";
import { StockClient } from "@/components/StockClient";
import { PORTAL } from "@/lib/config";
import { productCount } from "@/lib/stock";

export default function Home() {
  const count = productCount();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo-mark.png"
              alt="Seyaa Solitaire"
              width={292}
              height={398}
              priority
              className="h-9 w-auto"
            />
            <div>
              <h1 className="text-base font-semibold tracking-tight text-stone-900">
                {PORTAL.title}
              </h1>
              <p className="text-[11px] text-stone-500">{PORTAL.subtitle}</p>
            </div>
          </div>
          <span className="hidden shrink-0 text-xs text-stone-500 sm:inline">
            {count.toLocaleString("en-US")} products
          </span>
        </div>
      </header>

      <main className="flex-1">
        {PORTAL.usingSampleData && (
          <div className="border-b border-amber-200 bg-amber-50">
            <p className="mx-auto w-full max-w-3xl px-4 py-2 text-xs text-amber-800">
              <span className="font-semibold">Sample data.</span> These are
              placeholder products — import the exhibition Excel with{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">
                npm run import-sheet &lt;file.xlsx&gt;
              </code>{" "}
              to show real prices.
            </p>
          </div>
        )}
        <StockClient />
      </main>

      <footer className="border-t border-stone-200 py-4">
        <p className="mx-auto w-full max-w-3xl px-4 text-center text-[11px] text-stone-400">
          Seyaa Solitaire · Internal sales tool · Prices are confidential
        </p>
      </footer>
    </div>
  );
}

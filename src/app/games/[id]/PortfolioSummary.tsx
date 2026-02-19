"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCurrencyForSymbol, getExchangeRateToCHF } from "@/lib/finnhub";

type Position = { symbol: string; qty: number; avg_cost: number };
type PendingOrder = { symbol: string; side: string; qty: number; limit_price: number };

type Props = {
  gameId: string;
  initialCash: number;
  myCash: number;
  positions: Position[];
  pendingOrders: PendingOrder[];
  currencyMap: Record<string, string>;
  feeBps: number;
};

const FX_RATES: Record<string, number> = { CHF: 1, USD: 0.88, EUR: 0.94, SEK: 0.083 };

function fmt(n: number, d = 0) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function PortfolioSummary({
  gameId,
  initialCash,
  myCash,
  positions,
  pendingOrders,
  currencyMap,
  feeBps,
}: Props) {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const symbols = [...new Set(positions.map((p) => p.symbol))];
  const fx = (sym: string) => FX_RATES[currencyMap[sym] ?? "USD"] ?? 1;

  const fetchPrices = useCallback(async () => {
    if (symbols.length === 0) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols.join(","))}`);
      if (!res.ok) return;
      const data = await res.json();
      const next: Record<string, number> = {};
      for (const sym of symbols) {
        const p = data.prices?.[sym]?.price;
        if (p != null) next[sym] = Number(p);
      }
      setPrices(next);
    } finally {
      setLoading(false);
    }
  }, [symbols.join(",")]);

  useEffect(() => {
    fetchPrices();
    const iv = setInterval(fetchPrices, 20_000);
    return () => clearInterval(iv);
  }, [fetchPrices]);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchPrices();
    router.refresh();
  };

  // Reserved cash from open buy limit orders (réintégré dans le total, comme game-state)
  const reserved = pendingOrders
    .filter((o) => o.side === "buy")
    .reduce((sum, o) => {
      const rate = getExchangeRateToCHF(getCurrencyForSymbol(o.symbol));
      return sum + o.limit_price * o.qty * rate;
    }, 0);
  const reserveFee = reserved > 0 ? Math.min(15, Math.round((reserved * feeBps) / 10000 * 100) / 100) : 0;

  let totalValue = myCash + reserved + reserveFee;
  for (const pos of positions) {
    const pr = prices[pos.symbol];
    if (pr != null) {
      totalValue += pos.qty * pr * fx(pos.symbol);
    }
  }

  const pnl = totalValue - initialCash;
  const pnlPct = initialCash > 0 ? (pnl / initialCash) * 100 : 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
      <div>
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Cash</p>
        <p className="text-sm font-semibold text-slate-900 font-mono">
          {fmt(myCash, 2)} CHF
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">P&amp;L</p>
        <p className={`text-sm font-semibold font-mono ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
          {(pnl >= 0 ? "+" : "") + fmt(pnl, 2)} CHF
        </p>
        <p className="text-[10px] text-slate-500">
          {(pnlPct >= 0 ? "+" : "") + pnlPct.toFixed(2)}%
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Total</p>
        <p className="text-sm font-semibold text-slate-900 font-mono">
          {loading && symbols.length > 0 && Object.keys(prices).length === 0 ? "…" : fmt(totalValue, 0)} CHF
        </p>
      </div>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        className="px-2 py-1 text-xs bg-teal-100 text-teal-700 rounded hover:bg-teal-200 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Rafraîchir le solde et les valorisations"
      >
        {loading ? "…" : "Rafraîchir"}
      </button>
    </div>
  );
}

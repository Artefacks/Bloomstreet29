"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Position = { symbol: string; qty: number; avg_cost: number };
type PendingOrder = { symbol: string; side: string; qty: number; limit_price: number };

type Props = {
  initialCash: number;
  myCash: number;
  positions: Position[];
  pendingOrders: PendingOrder[];
  leverageMultiplier?: number;
  onRefreshComplete?: () => void;
  refreshIntervalMs?: number;
};


function fmt(n: number, d = 2) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function PortfolioSummary({
  initialCash,
  myCash,
  positions,
  pendingOrders,
  leverageMultiplier = 1,
  onRefreshComplete,
  refreshIntervalMs = 20000,
}: Props) {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const symbols = [...new Set([
    ...positions.map((p) => p.symbol),
    ...pendingOrders.filter((o) => o.side === "sell").map((o) => o.symbol),
  ])];
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
    const iv = setInterval(fetchPrices, refreshIntervalMs);
    const onPricesRefreshed = () => fetchPrices();
    window.addEventListener("bloomstreet:prices-refreshed", onPricesRefreshed);
    return () => {
      clearInterval(iv);
      window.removeEventListener("bloomstreet:prices-refreshed", onPricesRefreshed);
    };
  }, [fetchPrices, refreshIntervalMs]);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchPrices();
    router.refresh();
    onRefreshComplete?.();
  };

  // Réserve achats : déjà soustraite du cash DB — on la réintègre pour le total portefeuille (pas de frais réservés).
  const reservedBuy = pendingOrders
    .filter((o) => o.side === "buy")
    .reduce((sum, o) => sum + o.limit_price * o.qty, 0);

  let totalValue = myCash + reservedBuy;
  for (const pos of positions) {
    const pr = prices[pos.symbol];
    if (pr != null) {
      const costBasis = pos.qty * pos.avg_cost;
      const marketValue = pos.qty * pr;
      const positionValue = costBasis + (marketValue - costBasis) * leverageMultiplier;
      totalValue += positionValue;
    }
  }
  pendingOrders
    .filter((o) => o.side === "sell")
    .forEach((o) => {
      const pr = prices[o.symbol];
      if (pr != null) {
        totalValue += o.qty * pr;
      }
    });

  const pnl = totalValue - initialCash;
  const pnlPct = initialCash > 0 ? (pnl / initialCash) * 100 : 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
      <div>
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Cash disponible</p>
        <p className="text-sm font-semibold text-slate-900 font-mono">
          {fmt(myCash, 2)} USD
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">P&amp;L</p>
        <p className={`text-sm font-semibold font-mono ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
          {(pnl >= 0 ? "+" : "") + fmt(pnl, 2)} USD
        </p>
        <p className="text-[10px] text-slate-500">
          {(pnlPct >= 0 ? "+" : "") + pnlPct.toFixed(2)}%
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Total portefeuille</p>
        <p className="text-sm font-semibold text-slate-900 font-mono">
          {loading && symbols.length > 0 && Object.keys(prices).length === 0 ? "…" : fmt(totalValue, 2)} USD
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

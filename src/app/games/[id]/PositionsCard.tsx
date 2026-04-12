"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

type Position = {
  symbol: string;
  qty: number;
  avg_cost: number;
};

type Props = {
  gameId: string;
  positions: Position[];
  symbols: string[];
  initialPrices: Record<string, number | null>;
  leverageMultiplier?: number;
  refreshIntervalMs?: number;
};

function fmt(n: number, d = 2) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function PositionsCard({ gameId, positions, symbols, initialPrices, leverageMultiplier = 1, refreshIntervalMs = 15000 }: Props) {
  const [prices, setPrices] = useState<Record<string, number | null>>(initialPrices);
  const fetchingRef = useRef(false);

  const fetchPrices = useCallback(async () => {
    if (fetchingRef.current || symbols.length === 0) return;
    fetchingRef.current = true;
    try {
      const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols.join(","))}`);
      if (!res.ok) return;
      const data = await res.json();
      const pricesMap = data.prices ?? {};
      const updated: Record<string, number | null> = {};
      for (const sym of symbols) {
        updated[sym] = pricesMap[sym]?.price ?? prices[sym] ?? null;
      }
      setPrices(updated);
    } catch {
      // ignore
    } finally {
      fetchingRef.current = false;
    }
  }, [symbols, prices]);

  useEffect(() => {
    if (symbols.length === 0) return;
    fetchPrices();
    const iv = setInterval(fetchPrices, refreshIntervalMs);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(","), refreshIntervalMs]);

  if (positions.length === 0) {
    return <p className="text-slate-400 text-sm">Aucune position.</p>;
  }

  let totalValueUsd = 0;
  let totalCostUsd = 0;
  for (const pos of positions) {
    const curPrice = prices[pos.symbol];
    if (curPrice != null) {
      const costBasis = pos.qty * pos.avg_cost;
      const marketValue = pos.qty * curPrice;
      totalValueUsd += costBasis + (marketValue - costBasis) * leverageMultiplier;
      totalCostUsd += costBasis;
    }
  }
  const totalPnl = totalValueUsd - totalCostUsd;
  const totalPnlPct = totalCostUsd > 0 ? (totalPnl / totalCostUsd) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-100">
        <span className="text-slate-500">Valeur totale</span>
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-slate-800">{fmt(totalValueUsd, 0)} USD</span>
          <span className={`font-mono font-medium ${totalPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
            {totalPnl >= 0 ? "+" : ""}{fmt(totalPnl, 0)} ({totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(1)}%)
          </span>
        </div>
      </div>

      <div className="space-y-1 max-h-52 overflow-y-auto">
        {positions.map((pos) => {
          const curPrice = prices[pos.symbol];
          const marketVal = curPrice != null ? pos.qty * curPrice : null;
          const costBasis = pos.qty * pos.avg_cost;
          const pnlUsd = marketVal != null ? (marketVal - costBasis) * leverageMultiplier : null;
          const pnlPct = pos.avg_cost > 0 && curPrice != null
            ? ((curPrice - pos.avg_cost) / pos.avg_cost) * 100 * leverageMultiplier
            : null;

          return (
            <Link
              key={pos.symbol}
              href={`/games/${gameId}?symbol=${encodeURIComponent(pos.symbol)}`}
              className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-teal-50 transition-colors block"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-medium text-slate-800 text-sm">{pos.symbol}</span>
                  <span className="text-slate-400 text-[11px]">x{pos.qty % 1 === 0 ? pos.qty : pos.qty.toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Coût {fmt(pos.avg_cost)} $ | Val. {marketVal != null ? fmt(marketVal, 0) : "—"} USD
                </div>
              </div>

              <div className="text-right flex-shrink-0 ml-2">
                <div className="font-mono text-sm text-slate-700">
                  {curPrice != null ? fmt(curPrice) : "—"} $
                </div>
                {pnlUsd != null && pnlPct != null ? (
                  <div className={`font-mono text-[11px] font-medium ${pnlUsd >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {pnlUsd >= 0 ? "+" : ""}{fmt(pnlUsd)} USD ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-300">—</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type Position = {
  symbol: string;
  qty: number;
  avg_cost: number;
};

type Props = {
  positions: Position[];
  symbols: string[];
  initialPrices: Record<string, number | null>;
  currencyMap: Record<string, string>;
  fxRates: Record<string, number>; // currency → CHF rate
};

function fmtCcy(c: string) {
  return c === "CHF" ? "CHF" : c === "EUR" ? "€" : c === "USD" ? "$" : c === "SEK" ? "kr" : c;
}

function fmt(n: number, d = 2) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function PositionsCard({ positions, symbols, initialPrices, currencyMap, fxRates }: Props) {
  const [prices, setPrices] = useState<Record<string, number | null>>(initialPrices);
  const fetchingRef = useRef(false);

  const fx = (sym: string) => fxRates[currencyMap[sym] ?? "USD"] ?? 1;

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
    const iv = setInterval(fetchPrices, 15_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(",")]);

  if (positions.length === 0) {
    return <p className="text-slate-400 text-sm">Aucune position.</p>;
  }

  // Compute totals in CHF
  let totalValueCHF = 0;
  let totalCostCHF = 0;
  for (const pos of positions) {
    const curPrice = prices[pos.symbol];
    const rate = fx(pos.symbol);
    if (curPrice != null) {
      totalValueCHF += pos.qty * curPrice * rate;
      totalCostCHF += pos.qty * pos.avg_cost * rate;
    }
  }
  const totalPnl = totalValueCHF - totalCostCHF;
  const totalPnlPct = totalCostCHF > 0 ? (totalPnl / totalCostCHF) * 100 : 0;

  return (
    <div className="space-y-2">
      {/* Header with total */}
      <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-100">
        <span className="text-slate-500">Valeur totale</span>
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-slate-800">{fmt(totalValueCHF, 0)} CHF</span>
          <span className={`font-mono font-medium ${totalPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
            {totalPnl >= 0 ? "+" : ""}{fmt(totalPnl, 0)} ({totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Position rows */}
      <div className="space-y-1 max-h-52 overflow-y-auto">
        {positions.map((pos) => {
          const curPrice = prices[pos.symbol];
          const ccy = currencyMap[pos.symbol] ?? "USD";
          const ccyLabel = fmtCcy(ccy);
          const rate = fx(pos.symbol);
          const marketVal = curPrice != null ? pos.qty * curPrice : null;
          const marketValCHF = marketVal != null ? marketVal * rate : null;
          const costBasis = pos.qty * pos.avg_cost;
          const pnl = marketVal != null ? marketVal - costBasis : null;
          const pnlCHF = pnl != null ? pnl * rate : null;
          const pnlPct = pos.avg_cost > 0 && curPrice != null
            ? ((curPrice - pos.avg_cost) / pos.avg_cost) * 100
            : null;

          return (
            <div key={pos.symbol} className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-slate-50 transition-colors">
              {/* Left: symbol + qty + cost */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-medium text-slate-800 text-sm">{pos.symbol}</span>
                  <span className="text-slate-400 text-[11px]">x{pos.qty % 1 === 0 ? pos.qty : pos.qty.toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Coût {fmt(pos.avg_cost)} {ccyLabel}
                  {ccy !== "CHF" && <> | Val. {marketValCHF != null ? fmt(marketValCHF, 0) : "—"} CHF</>}
                  {ccy === "CHF" && <> | Val. {marketVal != null ? fmt(marketVal) : "—"} CHF</>}
                </div>
              </div>

              {/* Right: current price + P&L */}
              <div className="text-right flex-shrink-0 ml-2">
                <div className="font-mono text-sm text-slate-700">
                  {curPrice != null ? fmt(curPrice) : "—"} {ccyLabel}
                </div>
                {pnlCHF != null && pnlPct != null ? (
                  <div className={`font-mono text-[11px] font-medium ${pnlCHF >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {pnlCHF >= 0 ? "+" : ""}{fmt(pnlCHF)} CHF ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-300">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { PortfolioSummary } from "./PortfolioSummary";
import { EquityChart } from "./EquityChart";

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

export function PortfolioSection(props: Props) {
  const [chartRefreshKey, setChartRefreshKey] = useState(0);

  const handleRefreshComplete = () => {
    setChartRefreshKey((k) => k + 1);
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <PortfolioSummary
        {...props}
        onRefreshComplete={handleRefreshComplete}
      />
      <div className="border-t border-slate-100 pt-2">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">
          Evolution du capital
        </p>
        <div className="h-36">
          <EquityChart
            gameId={props.gameId}
            myCash={props.myCash}
            positions={props.positions}
            currencyMap={props.currencyMap}
            fxRates={{ CHF: 1, USD: 0.88, EUR: 0.94, SEK: 0.083 }}
            refreshTrigger={chartRefreshKey}
          />
        </div>
      </div>
    </section>
  );
}

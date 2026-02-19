"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { GameTradeForm } from "./GameTradeForm";
import { LivePrices } from "./LivePrices";
import { PriceChartSingle } from "./PriceChartSingle";
import { NewsFeed } from "./NewsFeed";
import { SectorOverview } from "./SectorOverview";
import { SECTORS, getSectorForSymbol, getSectorId, getExchangeForSymbol, isMarketOpen } from "@/lib/sectors";
import { getCurrencyForSymbol, getExchangeRateToCHF } from "@/lib/finnhub";
import { tickOscillation } from "@/lib/price-oscillation";

type Instrument = {
  symbol: string;
  name: string | null;
  price: number | null;
  currency: string;
};

function fmtCcy(currency: string): string {
  switch (currency) {
    case "CHF": return "CHF";
    case "EUR": return "€";
    case "USD": return "$";
    case "SEK": return "kr";
    default: return currency;
  }
}

type Position = {
  symbol: string;
  qty: number;
  avg_cost: number;
};

type PendingOrder = {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  limit_price: number;
  status: string;
};

type SortKey = "symbol" | "name" | "price" | "sector" | "change";
type PriceDirection = "up" | "down" | "none";

export function MarketSection({
  gameId,
  instruments: initialInstruments,
  myPositions,
  myCash,
  feeBps,
  gameEnded,
  allowFractional,
  symbolFromUrl,
  pendingOrders = [],
}: {
  gameId: string;
  instruments: Instrument[];
  myPositions: Position[];
  myCash: number;
  feeBps: number;
  gameEnded: boolean;
  allowFractional: boolean;
  symbolFromUrl?: string | null;
  pendingOrders?: PendingOrder[];
}) {
  const [instruments, setInstruments] = useState<Instrument[]>(initialInstruments);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("symbol");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(symbolFromUrl ?? null);
  const router = useRouter();
  const pathname = usePathname();
  const detailPanelRef = useRef<HTMLDivElement>(null);

  const handleCloseDetail = useCallback(() => {
    setSelectedSymbol(null);
    if (symbolFromUrl) router.replace(pathname);
  }, [symbolFromUrl, router, pathname]);

  useEffect(() => {
    if (symbolFromUrl) {
      setSelectedSymbol(symbolFromUrl);
    }
  }, [symbolFromUrl]);

  useEffect(() => {
    if (selectedSymbol && symbolFromUrl === selectedSymbol && detailPanelRef.current) {
      detailPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedSymbol, symbolFromUrl]);
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const [chartRefreshKey, setChartRefreshKey] = useState(0);

  // Price tracking: two refs
  // basePricesRef = prices at page load, never updated → used for % change
  // prevPricesRef = previous tick prices → used for flash direction only
  const [directions, setDirections] = useState<Record<string, PriceDirection>>({});
  const basePricesRef = useRef<Record<string, number>>({});
  const prevPricesRef = useRef<Record<string, number>>({});
  const flashTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handlePricesUpdate = useCallback((prices: Record<string, number | null>) => {
    const prev = prevPricesRef.current;
    const newDirs: Record<string, PriceDirection> = {};

    for (const sym of Object.keys(prices)) {
      const oldP = prev[sym];
      const newP = prices[sym];
      if (oldP != null && newP != null && oldP !== newP) {
        newDirs[sym] = newP > oldP ? "up" : "down";
      }
    }

    if (Object.keys(newDirs).length > 0) {
      setDirections((d) => ({ ...d, ...newDirs }));
      for (const sym of Object.keys(newDirs)) {
        if (flashTimersRef.current[sym]) clearTimeout(flashTimersRef.current[sym]);
        flashTimersRef.current[sym] = setTimeout(() => {
          setDirections((d) => {
            const copy = { ...d };
            delete copy[sym];
            return copy;
          });
        }, 2500);
      }
    }

    // Update prev prices for next flash comparison
    const newPrev: Record<string, number> = {};
    for (const [sym, p] of Object.entries(prices)) {
      if (p != null) newPrev[sym] = p;
    }
    prevPricesRef.current = newPrev;

    setInstruments((prev) =>
      prev.map((inst) => ({
        ...inst,
        price: prices[inst.symbol] ?? inst.price,
      }))
    );
  }, []);

  const symbols = instruments.map((i) => i.symbol);
  const initialPrices: Record<string, number | null> = {};
  instruments.forEach((inst) => {
    initialPrices[inst.symbol] = inst.price;
  });

  // Initialize BOTH refs on first render (base never changes after this)
  if (Object.keys(basePricesRef.current).length === 0) {
    for (const inst of instruments) {
      if (inst.price != null) {
        basePricesRef.current[inst.symbol] = inst.price;
        prevPricesRef.current[inst.symbol] = inst.price;
      }
    }
  }

  // Filter by search + sector
  const filtered = useMemo(() => {
    let list = instruments;
    if (activeSector) {
      list = list.filter((i) => getSectorId(i.symbol) === activeSector);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.symbol.toLowerCase().includes(q) ||
          (i.name ?? "").toLowerCase().includes(q) ||
          (getSectorForSymbol(i.symbol)?.name ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [instruments, search, activeSector]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "symbol") {
        cmp = a.symbol.localeCompare(b.symbol);
      } else if (sortBy === "name") {
        cmp = (a.name ?? "").localeCompare(b.name ?? "");
      } else if (sortBy === "sector") {
        cmp = (getSectorForSymbol(a.symbol)?.name ?? "").localeCompare(getSectorForSymbol(b.symbol)?.name ?? "");
      } else if (sortBy === "change") {
        const chgA = a.price && basePricesRef.current[a.symbol] ? (a.price - basePricesRef.current[a.symbol]) / basePricesRef.current[a.symbol] : 0;
        const chgB = b.price && basePricesRef.current[b.symbol] ? (b.price - basePricesRef.current[b.symbol]) / basePricesRef.current[b.symbol] : 0;
        cmp = chgA - chgB;
      } else {
        cmp = (a.price ?? 0) - (b.price ?? 0);
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortBy, sortAsc]);

  const selectedInstrument = selectedSymbol
    ? instruments.find((i) => i.symbol === selectedSymbol)
    : null;
  const selectedPosition = selectedSymbol
    ? myPositions.find((p) => p.symbol === selectedSymbol)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800">Marché</h2>
        <LivePrices
          symbols={symbols}
          initialPrices={initialPrices}
          onPricesUpdate={handlePricesUpdate}
          onRefreshComplete={() => setChartRefreshKey((k) => k + 1)}
          refreshInterval={15000}
        />
      </div>

      {/* Sector indices */}
      <SectorOverview
        instruments={instruments}
        basePrices={basePricesRef.current}
        onSectorClick={setActiveSector}
        activeSector={activeSector}
      />

      {/* News feed */}
      <NewsFeed
        instruments={instruments}
        prevPrices={basePricesRef.current}
        onSymbolClick={setSelectedSymbol}
      />

      {/* Search + sort */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Rechercher (symbole, nom, secteur)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="px-2 py-2 border border-slate-300 rounded-lg text-xs"
          >
            <option value="symbol">Symbole</option>
            <option value="name">Nom</option>
            <option value="price">Prix</option>
            <option value="sector">Secteur</option>
            <option value="change">Variation</option>
          </select>
          <button
            type="button"
            onClick={() => setSortAsc((a) => !a)}
            className="px-2 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
          >
            {sortAsc ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Instruments table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white max-h-72 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Symbole</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs hidden sm:table-cell">Secteur</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600 text-xs">Prix</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600 text-xs w-16">Var.</th>
              <th className="px-3 py-2 text-center font-medium text-slate-600 text-xs w-12 hidden md:table-cell">Bourse</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((inst) => {
              const dir = directions[inst.symbol];
              const sector = getSectorForSymbol(inst.symbol);
              const exchange = getExchangeForSymbol(inst.symbol);
              const marketStatus = isMarketOpen(exchange);

              const base = basePricesRef.current[inst.symbol];
              const changePct = inst.price && base && base > 0
                ? ((inst.price - base) / base) * 100
                : null;

              const flashBg = dir === "up" ? "bg-green-50" : dir === "down" ? "bg-red-50" : "";

              return (
                <tr
                  key={inst.symbol}
                  onClick={() => setSelectedSymbol(inst.symbol)}
                  className={`
                    border-t border-slate-100 cursor-pointer transition-colors duration-500
                    hover:bg-teal-50
                    ${selectedSymbol === inst.symbol ? "bg-teal-50 ring-1 ring-inset ring-teal-200" : flashBg}
                  `}
                >
                  <td className="px-3 py-2">
                    <div className="font-mono font-medium text-slate-800 text-[13px]">{inst.symbol}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[140px]">{inst.name ?? ""}</div>
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell">
                    {sector && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: sector.color + "18", color: sector.color }}
                      >
                        {sector.emoji} {sector.name}
                      </span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-[13px] transition-colors duration-500 ${
                    dir === "up" ? "text-green-700 font-semibold" : dir === "down" ? "text-red-700 font-semibold" : "text-slate-800"
                  }`}>
                    {inst.price != null ? (
                      <>
                        {dir === "up" && <span className="text-green-500 text-[10px] mr-0.5">&#9650;</span>}
                        {dir === "down" && <span className="text-red-500 text-[10px] mr-0.5">&#9660;</span>}
                        {inst.price.toFixed(2)} {fmtCcy(inst.currency)}
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] font-mono">
                    {changePct != null ? (
                      <span className={changePct >= 0 ? "text-green-600" : "text-red-600"}>
                        {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center hidden md:table-cell">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${marketStatus.open ? "bg-green-500" : "bg-slate-300"}`}
                      title={`${exchange.flag} ${exchange.name} — ${marketStatus.nextEvent}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p className="p-4 text-slate-500 text-center text-sm">Aucun instrument trouvé.</p>
        )}
      </div>
      <div className="text-[10px] text-slate-400">
        {sorted.length} instrument{sorted.length > 1 ? "s" : ""}
        {activeSector && ` dans ${SECTORS.find((s) => s.id === activeSector)?.name ?? activeSector}`}
      </div>

      {/* Detail panel */}
      {selectedSymbol && selectedInstrument && (
        <div ref={detailPanelRef}>
        <DetailPanel
          gameId={gameId}
          inst={selectedInstrument}
          position={selectedPosition}
          myCash={myCash}
          feeBps={feeBps}
          gameEnded={gameEnded}
          allowFractional={allowFractional}
          onClose={handleCloseDetail}
          chartRefreshKey={chartRefreshKey}
          pendingOrders={pendingOrders.filter((o) => o.symbol === selectedSymbol && o.status === "open")}
        />
        </div>
      )}
    </div>
  );
}

/* ──── Detail panel when a stock is selected ──── */

function DetailPanel({
  gameId, inst, position, myCash, feeBps, gameEnded, allowFractional, onClose, chartRefreshKey, pendingOrders = [],
}: {
  gameId: string;
  inst: { symbol: string; name: string | null; price: number | null; currency: string };
  position: { symbol: string; qty: number; avg_cost: number } | undefined | null;
  myCash: number;
  feeBps: number;
  gameEnded: boolean;
  allowFractional: boolean;
  onClose: () => void;
  chartRefreshKey?: number;
  pendingOrders?: PendingOrder[];
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(iv);
  }, []);

  const exchange = getExchangeForSymbol(inst.symbol);
  const marketStatus = isMarketOpen(exchange);
  const basePrice = inst.price ?? 0;
  // Oscillation uniquement quand le marché est ouvert
  const livePrice = basePrice > 0 && marketStatus.open
    ? tickOscillation(basePrice, inst.symbol, tick)
    : basePrice > 0 ? basePrice : null;

  const sector = getSectorForSymbol(inst.symbol);

  return (
    <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg">
            {inst.name ?? inst.symbol}
          </h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="font-mono text-sm text-slate-500">{inst.symbol}</span>
            {sector && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: sector.color + "18", color: sector.color }}
              >
                {sector.emoji} {sector.name}
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              marketStatus.open
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-500"
            }`}>
              {exchange.flag} {marketStatus.open ? "Ouvert" : "Fermé"} — {marketStatus.nextEvent}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-slate-400 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100"
        >
          Fermer
        </button>
      </div>

      {/* Chart */}
      <PriceChartSingle
        symbol={inst.symbol}
        displayPrice={livePrice}
        refreshTrigger={chartRefreshKey}
        pendingOrders={pendingOrders}
      />

      {/* Trade form */}
      <div className="pt-2 border-t border-slate-100">
        <GameTradeForm
          gameId={gameId}
          symbol={inst.symbol}
          price={livePrice ?? inst.price}
          tick={tick}
          currency={inst.currency}
          hasPosition={!!position}
          positionQty={position?.qty ?? 0}
          avgCost={position?.avg_cost ?? 0}
          myCash={myCash}
          feeBps={feeBps}
          gameEnded={gameEnded}
          allowFractional={allowFractional}
          fxRate={getExchangeRateToCHF(getCurrencyForSymbol(inst.symbol))}
        />
      </div>
    </div>
  );
}
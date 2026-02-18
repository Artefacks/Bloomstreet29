"use client";

import { useMemo, useRef } from "react";
import { SECTORS, getSectorId, type Sector } from "@/lib/sectors";

type Instrument = {
  symbol: string;
  name: string | null;
  price: number | null;
};

type SectorPerf = {
  sector: Sector;
  count: number;
  changePct: number;
};

export function SectorOverview({
  instruments,
  basePrices,
  onSectorClick,
  activeSector,
}: {
  instruments: Instrument[];
  basePrices: Record<string, number>;
  onSectorClick: (sectorId: string | null) => void;
  activeSector: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const sectorPerfs = useMemo(() => {
    const data: Record<string, { count: number; totalChange: number }> = {};

    for (const inst of instruments) {
      const sectorId = getSectorId(inst.symbol);
      if (!data[sectorId]) data[sectorId] = { count: 0, totalChange: 0 };
      data[sectorId].count += 1;

      const base = basePrices[inst.symbol];
      if (inst.price != null && base != null && base > 0) {
        data[sectorId].totalChange += ((inst.price - base) / base) * 100;
      }
    }

    return SECTORS
      .map((sector): SectorPerf | null => {
        const d = data[sector.id];
        if (!d || d.count === 0) return null;
        return { sector, count: d.count, changePct: d.totalChange / d.count };
      })
      .filter((s): s is SectorPerf => s !== null)
      .sort((a, b) => b.changePct - a.changePct);
  }, [instruments, basePrices]);

  if (sectorPerfs.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Secteurs</h3>
        {activeSector && (
          <button onClick={() => onSectorClick(null)} className="text-[10px] text-teal-600 hover:underline">
            Tous
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin"
        style={{ scrollbarWidth: "thin" }}
      >
        {sectorPerfs.map(({ sector, count, changePct }) => {
          const isActive = activeSector === sector.id;
          const isPositive = changePct >= 0;

          return (
            <button
              key={sector.id}
              onClick={() => onSectorClick(isActive ? null : sector.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 border text-[11px] transition-all whitespace-nowrap ${
                isActive
                  ? "border-teal-400 bg-teal-50 ring-1 ring-teal-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span>{sector.emoji}</span>
              <span className="font-medium text-slate-700">{sector.name}</span>
              <span className={`font-mono font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
                {isPositive ? "+" : ""}{changePct.toFixed(1)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

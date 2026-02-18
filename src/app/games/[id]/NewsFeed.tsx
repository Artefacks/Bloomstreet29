"use client";

import { useState, useEffect, useMemo } from "react";
import { generateNewsFeed, type NewsItem } from "@/lib/market-news";

type Instrument = {
  symbol: string;
  name: string | null;
  price: number | null;
};

export function NewsFeed({
  instruments,
  prevPrices,
  onSymbolClick,
}: {
  instruments: Instrument[];
  prevPrices: Record<string, number>;
  onSymbolClick?: (symbol: string) => void;
}) {
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // Refresh every 30s to keep news fresh
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const news = useMemo(() => {
    return generateNewsFeed(instruments, prevPrices, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruments.length, tick, Object.keys(prevPrices).length]);

  if (news.length === 0) return null;

  const shown = expanded ? news : news.slice(0, 3);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Actualites
        </h3>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-[10px] text-teal-600 hover:underline"
        >
          {expanded ? "Reduire" : `Voir tout (${news.length})`}
        </button>
      </div>
      <div className="space-y-0.5">
        {shown.map((item) => (
          <div
            key={item.id}
            className={`flex items-start gap-2 px-2 py-1 rounded text-[12px] leading-snug ${
              item.sentiment === "positive"
                ? "text-green-800 bg-green-50/60"
                : item.sentiment === "negative"
                  ? "text-red-800 bg-red-50/60"
                  : "text-slate-700 bg-slate-50/60"
            }`}
          >
            <span className="flex-shrink-0 mt-0.5">
              {item.sentiment === "positive" ? "+" : item.sentiment === "negative" ? "-" : "~"}
            </span>
            <span className="flex-1 min-w-0">
              <span>{item.headline}</span>
              {item.symbols.length > 0 && (
                <>
                  {" "}
                  {item.symbols.map((sym) => (
                    <button
                      key={sym}
                      onClick={() => onSymbolClick?.(sym)}
                      className="font-mono text-[10px] text-teal-600 hover:underline"
                    >
                      {sym}
                    </button>
                  ))}
                </>
              )}
            </span>
            <span className="flex-shrink-0 text-[9px] text-slate-400 mt-0.5">
              {formatTimeAgo(item.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type Time,
  ColorType,
} from "lightweight-charts";

type RawPoint = { price: number; at: string };
type TimeRange = "1H" | "4H" | "1J" | "1S";
type ChartMode = "line" | "candle";

const RANGE_CONFIG: Record<TimeRange, { limit: number; candleMinutes: number; label: string }> = {
  "1H": { limit: 60, candleMinutes: 1, label: "1H" },
  "4H": { limit: 240, candleMinutes: 5, label: "4H" },
  "1J": { limit: 500, candleMinutes: 15, label: "1J" },
  "1S": { limit: 500, candleMinutes: 60, label: "1S" },
};

function toUnixBucket(at: string, candleMinutes: number): number {
  const ts = new Date(at).getTime();
  return Math.floor(ts / (candleMinutes * 60_000)) * candleMinutes * 60;
}

function groupIntoCandles(points: RawPoint[], candleMinutes: number): CandlestickData[] {
  if (points.length === 0) return [];
  const buckets = new Map<number, number[]>();

  for (const p of points) {
    const bucket = toUnixBucket(p.at, candleMinutes);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(p.price);
  }

  const candles: CandlestickData[] = [];
  for (const key of [...buckets.keys()].sort((a, b) => a - b)) {
    const prices = buckets.get(key)!;
    candles.push({
      time: key as Time,
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
    });
  }
  return candles;
}

function toLineData(points: RawPoint[], candleMinutes: number): LineData[] {
  if (points.length === 0) return [];
  const buckets = new Map<number, number>();

  for (const p of points) {
    const bucket = toUnixBucket(p.at, candleMinutes);
    buckets.set(bucket, p.price); // last price in bucket
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, value]) => ({ time: time as Time, value }));
}

export function PriceChartSingle({ symbol }: { symbol: string }) {
  const [raw, setRaw] = useState<RawPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("4H");
  const [mode, setMode] = useState<ChartMode>("line");
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const config = RANGE_CONFIG[range];

  const fetchHistory = useCallback(async () => {
    if (!symbol) return;
    try {
      const res = await fetch(
        `/api/prices/history?symbols=${encodeURIComponent(symbol)}&limit=${config.limit}`
      );
      if (!res.ok) return;
      const json = await res.json();
      setRaw(json.history?.[symbol] ?? []);
    } finally {
      setLoading(false);
    }
  }, [symbol, config.limit]);

  useEffect(() => {
    if (!symbol) { setLoading(false); return; }
    setLoading(true);
    fetchHistory();
    const iv = setInterval(fetchHistory, 30_000);
    return () => clearInterval(iv);
  }, [symbol, fetchHistory]);

  const candles = useMemo(() => groupIntoCandles(raw, config.candleMinutes), [raw, config.candleMinutes]);
  const lineData = useMemo(() => toLineData(raw, config.candleMinutes), [raw, config.candleMinutes]);

  const stats = useMemo(() => {
    if (lineData.length < 2) return null;
    const first = lineData[0].value;
    const last = lineData[lineData.length - 1].value;
    const allVals = lineData.map((d) => d.value);
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const change = last - first;
    const changePct = first > 0 ? (change / first) * 100 : 0;
    return { first, last, min, max, change, changePct };
  }, [lineData]);

  const trend = stats ? (stats.change >= 0 ? "up" : "down") : "neutral";

  // Create / update chart
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const hasData = mode === "candle" ? candles.length >= 2 : lineData.length >= 2;
    if (!hasData) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#f1f5f9" },
        horzLines: { color: "#f1f5f9" },
      },
      crosshair: {
        vertLine: { color: "#cbd5e1", width: 1, labelBackgroundColor: "#334155" },
        horzLine: { color: "#cbd5e1", width: 1, labelBackgroundColor: "#334155" },
      },
      rightPriceScale: { borderColor: "#e2e8f0" },
      timeScale: { borderColor: "#e2e8f0", timeVisible: true, secondsVisible: false },
    });

    if (mode === "candle") {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#16a34a",
        downColor: "#dc2626",
        borderUpColor: "#16a34a",
        borderDownColor: "#dc2626",
        wickUpColor: "#16a34a",
        wickDownColor: "#dc2626",
      });
      series.setData(candles);
    } else {
      const color = trend === "up" ? "#16a34a" : "#dc2626";
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });
      series.setData(lineData);
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, lineData, mode, trend]);

  if (!symbol) return null;

  if (loading) {
    return (
      <div className="h-[260px] flex items-center justify-center text-slate-400 rounded-lg bg-slate-50 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-teal-500 rounded-full animate-spin" />
          Chargement...
        </div>
      </div>
    );
  }

  if (lineData.length < 2) {
    return (
      <div className="h-[260px] flex items-center justify-center text-slate-400 rounded-lg bg-slate-50 text-sm text-center px-4">
        Pas encore assez de donnees. Les prix se mettent a jour automatiquement.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Stats + controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {stats && (
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-semibold text-slate-800">
              {stats.last.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`font-mono text-sm font-medium ${stats.change >= 0 ? "text-green-600" : "text-red-600"}`}>
              {stats.change >= 0 ? "+" : ""}{stats.change.toFixed(2)} ({stats.changePct >= 0 ? "+" : ""}{stats.changePct.toFixed(2)}%)
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              L {stats.min.toFixed(2)} — H {stats.max.toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* Chart mode toggle */}
          <div className="flex bg-slate-100 rounded overflow-hidden">
            <button
              onClick={() => setMode("line")}
              className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${
                mode === "line" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-200"
              }`}
              title="Courbe"
            >
              Ligne
            </button>
            <button
              onClick={() => setMode("candle")}
              className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${
                mode === "candle" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-200"
              }`}
              title="Chandeliers"
            >
              Bougie
            </button>
          </div>
          {/* Time range */}
          <div className="flex gap-0.5">
            {(Object.keys(RANGE_CONFIG) as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  range === r
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {RANGE_CONFIG[r].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" />
    </div>
  );
}

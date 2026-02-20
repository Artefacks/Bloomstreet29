"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type Point = { at: string; value: number; date: string; label: string };
type Position = { symbol: string; qty: number; avg_cost: number };

type Props = {
  gameId: string;
  myCash: number;
  positions: Position[];
  currencyMap: Record<string, string>;
  fxRates: Record<string, number>;
  refreshTrigger?: number;
};

function toPoint(at: string, value: number): Point {
  return {
    at,
    value,
    date: new Date(at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    label: new Date(at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function EquityChart({ gameId, myCash, positions, currencyMap, fxRates, refreshTrigger }: Props) {
  const [history, setHistory] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveValue, setLiveValue] = useState<number | null>(null);
  const fetchingRef = useRef(false);

  const symbols = useMemo(() => positions.map((p) => p.symbol), [positions]);

  // Fetch historical equity snapshots
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}/equity-history`);
      if (!res.ok) return;
      const json = await res.json();
      const raw = json.history ?? [];
      setHistory(raw.map((p: { value: number; at: string }) => toPoint(p.at, p.value)));
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  // Compute live equity from current prices (toujours cohérent avec Cash/Total affichés)
  const computeLive = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      let equity = myCash;
      if (symbols.length > 0) {
        const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols.join(","))}`);
        if (!res.ok) return;
        const json = await res.json();
        const pricesMap = json.prices ?? {};
        for (const pos of positions) {
          const p = pricesMap[pos.symbol]?.price;
          if (p != null) {
            const ccy = currencyMap[pos.symbol] ?? "USD";
            const rate = fxRates[ccy] ?? 1;
            equity += pos.qty * Number(p) * rate;
          }
        }
      }
      setLiveValue(equity);
    } catch {
      // ignore
    } finally {
      fetchingRef.current = false;
    }
  }, [symbols, positions, myCash, currencyMap, fxRates]);

  useEffect(() => {
    setLoading(true);
    fetchHistory();
    computeLive();
    const histIv = setInterval(fetchHistory, 120_000); // refresh history every 2min
    const liveIv = setInterval(computeLive, 20_000);   // refresh live point every 20s
    return () => { clearInterval(histIv); clearInterval(liveIv); };
  }, [fetchHistory, computeLive]);

  // Recalculer la valeur live quand l'utilisateur clique Rafraîchir (header ou portfolio)
  useEffect(() => {
    if (refreshTrigger != null && refreshTrigger > 0) {
      computeLive();
    }
  }, [refreshTrigger, computeLive]);

  // Écouter le Rafraîchir du header (LivePrices) pour synchroniser le dernier point
  useEffect(() => {
    const onPricesRefreshed = () => computeLive();
    window.addEventListener("bloomstreet:prices-refreshed", onPricesRefreshed);
    return () => window.removeEventListener("bloomstreet:prices-refreshed", onPricesRefreshed);
  }, [computeLive]);

  // Combine history + live point — le dernier point reflète toujours la valeur live actuelle
  const data = useMemo(() => {
    const pts = [...history];
    if (liveValue != null) {
      const now = new Date().toISOString();
      const livePoint = toPoint(now, liveValue);
      if (pts.length === 0) {
        pts.push(livePoint);
      } else {
        // Toujours remplacer le dernier point par la valeur live pour cohérence avec Cash/Total
        pts[pts.length - 1] = livePoint;
      }
    }
    return pts;
  }, [history, liveValue]);

  const stats = useMemo(() => {
    if (data.length < 2) return null;
    const first = data[0].value;
    const last = data[data.length - 1].value;
    const change = last - first;
    const changePct = first > 0 ? (change / first) * 100 : 0;
    return { first, last, change, changePct };
  }, [data]);

  const trend = stats ? (stats.change >= 0 ? "up" : "down") : "neutral";

  if (loading) {
    return (
      <div className="h-full min-h-[100px] flex items-center justify-center text-slate-400 rounded-lg bg-slate-50 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-slate-300 border-t-teal-500 rounded-full animate-spin" />
          Chargement...
        </div>
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="h-full min-h-[100px] flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg text-xs text-center px-4">
        Pas encore assez de donnees. Effectue des trades pour voir l&apos;evolution.
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const padding = Math.max((maxV - minV) * 0.15, maxV * 0.005);
  const color = trend === "up" ? "#16a34a" : "#dc2626";

  return (
    <div className="h-full w-full">
      <div className="h-full min-h-[100px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={[minV - padding, maxV + padding]}
              tick={{ fontSize: 9, fill: "#94a3b8" }}
              tickFormatter={(v) => v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
              tickLine={false}
              axisLine={false}
              width={55}
            />
            <Tooltip content={<EquityTooltip />} />
            {stats && (
              <ReferenceLine y={stats.first} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill="url(#equityGrad)"
              dot={false}
              animationDuration={400}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EquityTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 text-white px-3 py-1.5 rounded-lg shadow-lg text-xs">
      <p className="font-mono font-medium">
        {payload[0].value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} CHF
      </p>
      <p className="text-slate-400 text-[10px]">{label}</p>
    </div>
  );
}

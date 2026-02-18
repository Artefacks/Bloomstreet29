"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#9333ea"];

type Point = Record<string, string | number>;

export function PriceCharts({ symbols }: { symbols: string[] }) {
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (symbols.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/prices/history?symbols=${encodeURIComponent(symbols.join(","))}&limit=100`
        );
        if (!res.ok) return;
        const json = await res.json();
        const history: Record<string, { price: number; at: string }[]> = json.history ?? {};
        if (cancelled) return;

        const byTime = new Map<string, Record<string, number>>();
        symbols.forEach((sym) => {
          (history[sym] ?? []).forEach((p: { price: number; at: string }) => {
            const t = p.at;
            if (!byTime.has(t)) byTime.set(t, {});
            byTime.get(t)![sym] = p.price;
          });
        });

        const sorted = Array.from(byTime.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([at, values]) => ({
            at,
            date: new Date(at).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }),
            ...values,
          }));

        setData(sorted);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbols.join(",")]);

  if (loading) {
    return (
      <div className="h-64 min-h-[200px] flex items-center justify-center text-slate-500 rounded-lg bg-slate-50">
        Chargement des cours...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-64 min-h-[200px] flex items-center justify-center text-slate-500 rounded-lg bg-slate-50 text-sm text-center px-4">
        Aucun historique de prix. Utilisez « Rafraîchir » pour enregistrer les cours.
      </div>
    );
  }

  return (
    <div className="h-64 min-h-[200px] w-full rounded-lg p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => v.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number) => [value?.toLocaleString("fr-FR"), ""]}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend />
          {symbols.map((sym, i) => (
            <Line
              key={sym}
              type="monotone"
              dataKey={sym}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={1.5}
              dot={false}
              name={sym}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

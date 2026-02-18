"use client";

import { useEffect, useState, useRef } from "react";

type PricesMap = Record<string, { price: number; as_of: string }>;

export function LivePrices({
  symbols,
  initialPrices,
  onPricesUpdate,
  refreshInterval = 15000,
}: {
  symbols: string[];
  initialPrices: Record<string, number | null>;
  onPricesUpdate: (prices: Record<string, number | null>) => void;
  refreshInterval?: number;
}) {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetchingRef = useRef(false);

  const fetchPrices = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const symbolsParam = symbols.join(",");
      const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbolsParam)}`);
      if (!res.ok) return;

      const data = await res.json();
      const pricesMap: PricesMap = data.prices ?? {};

      const updatedPrices: Record<string, number | null> = {};
      symbols.forEach((symbol) => {
        updatedPrices[symbol] = pricesMap[symbol]?.price ?? initialPrices[symbol] ?? null;
      });

      onPricesUpdate(updatedPrices);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("[LivePrices] fetch error:", error);
    } finally {
      fetchingRef.current = false;
    }
  };

  const refreshFromAPI = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/prices/refresh-public", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        console.log("[LivePrices] Refresh:", data);
        // Immediately re-fetch prices after refresh
        await fetchPrices();
      } else {
        console.error("[LivePrices] Refresh failed:", data);
        const missing = data.missing?.length ? ` (manquant: ${data.missing.join(", ")})` : "";
        alert(`Erreur: ${data.error || "Erreur inconnue"}${missing}`);
      }
    } catch (error) {
      console.error("[LivePrices] refresh error:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (symbols.length === 0) return;
    fetchPrices();
    const interval = setInterval(fetchPrices, refreshInterval);
    return () => clearInterval(interval);
  }, [symbols.join(","), refreshInterval]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center gap-2 text-xs">
      {lastUpdate ? (
        <span className="text-gray-500">
          MàJ : {lastUpdate.toLocaleTimeString("fr-FR")}
        </span>
      ) : (
        <span className="text-gray-400">Chargement...</span>
      )}
      <button
        onClick={refreshFromAPI}
        disabled={isRefreshing}
        className="px-2 py-1 text-xs bg-teal-100 text-teal-700 rounded hover:bg-teal-200 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Rafraîchir les prix US (Finnhub) + simuler les internationaux"
      >
        {isRefreshing ? "..." : "Rafraîchir"}
      </button>
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSimulated } from "@/lib/price-sim";
import { getExchangeForSymbol, isMarketOpen } from "@/lib/sectors";
import { getSymbolsWithRecentHistory } from "@/lib/price-history";
import { matchPendingOrders } from "@/lib/order-matching";

/** Micro-oscillation affichage pour US stocks (±0.05%) — prix plus vivants entre les refresh */
function usDisplayOscillation(price: number, symbol: string, now: number): number {
  const sec10 = Math.floor(now / 10_000); // change toutes les 10s
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = ((h << 5) - h + symbol.charCodeAt(i)) | 0;
  const seed = (h ^ sec10) >>> 0;
  const r = ((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff * 2 - 1;
  return Math.round(price * (1 + r * 0.0005) * 10000) / 10000;
}

/**
 * GET /api/prices?symbols=AAPL,NESN.SW,...
 *
 * Returns current prices from prices_latest (US live feed).
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ prices: {} });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const url = new URL(request.url);
  const symbolsParam = url.searchParams.get("symbols");
  const symbols = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null;

  // Load all instruments if no filter
  let symbolsToFetch: string[];
  if (symbols && symbols.length > 0) {
    symbolsToFetch = symbols;
  } else {
    const { data: instruments } = await supabase
      .from("instruments")
      .select("symbol")
      .limit(200);
    symbolsToFetch = instruments?.map((i) => i.symbol) ?? [];
  }

  if (symbolsToFetch.length === 0) {
    return NextResponse.json({ prices: {} });
  }

  // Load latest prices
  const { data: prices } = await supabase
    .from("prices_latest")
    .select("symbol, price, as_of")
    .in("symbol", symbolsToFetch);

  const priceMap: Record<string, { price: number; as_of: string }> = {};
  prices?.forEach((p) => {
    const entry = { price: Number(p.price), as_of: p.as_of };
    priceMap[p.symbol] = entry;
  });

  const now = Date.now();
  const nowISO = new Date(now).toISOString();

  // Fallback for symbols with no price at all
  const missing = symbolsToFetch.filter((s) => !priceMap[s]);
  if (missing.length > 0) {
    const { data: historyRows } = await supabase
      .from("price_history")
      .select("symbol, price, as_of")
      .in("symbol", missing)
      .order("as_of", { ascending: false });
    const seen = new Set<string>();
    historyRows?.forEach((r) => {
      if (!seen.has(r.symbol)) {
        seen.add(r.symbol);
        priceMap[r.symbol] = { price: Number(r.price), as_of: r.as_of };
      }
    });
  }

  // Micro-oscillation automatique pour US stocks — uniquement quand le marché est ouvert
  const usSymbols = symbolsToFetch.filter((s) => !isSimulated(s));
  const usToWrite: { symbol: string; price: number }[] = [];
  for (const sym of usSymbols) {
    const entry = priceMap[sym];
    if (entry && entry.price > 0) {
      const exchange = getExchangeForSymbol(sym);
      const marketOpen = isMarketOpen(exchange).open;
      if (marketOpen) {
        const oscillated = usDisplayOscillation(entry.price, sym, now);
        priceMap[sym] = { ...entry, price: oscillated };
        usToWrite.push({ symbol: sym, price: oscillated });
      }
    }
  }
  if (usToWrite.length > 0) {
    const bgWork = async () => {
      const writeSymbols = usToWrite.map((t) => t.symbol);
      const recentHistory = await getSymbolsWithRecentHistory(supabase, writeSymbols);
      for (const { symbol, price } of usToWrite) {
        await supabase.from("prices_latest").upsert(
          { symbol, price, as_of: nowISO, source: "finnhub" },
          { onConflict: "symbol" }
        );
        // Écriture price_history avec sampling (1 point / 5 min) pour que les graphiques US aient des données
        if (!recentHistory.has(symbol)) {
          await supabase.from("price_history").insert({ symbol, price, as_of: nowISO });
          recentHistory.add(symbol);
        }
      }
    };
    bgWork().catch((e) => console.warn("[prices GET] US oscillation error:", e));
  }

  void matchPendingOrders(supabase).catch((e) => console.warn("[prices GET] matchPendingOrders:", e));

  return NextResponse.json({ prices: priceMap });
}

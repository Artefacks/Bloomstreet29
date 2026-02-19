import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSimulated, simulatePriceForward } from "@/lib/price-sim";
import { getExchangeForSymbol, isMarketOpen } from "@/lib/sectors";

/** Micro-oscillation affichage pour US stocks (±0.05%) — prix plus vivants entre les refresh */
function usDisplayOscillation(price: number, symbol: string, now: number): number {
  const sec10 = Math.floor(now / 10_000); // change toutes les 10s
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = ((h << 5) - h + symbol.charCodeAt(i)) | 0;
  const seed = (h ^ sec10) >>> 0;
  const r = ((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff * 2 - 1;
  return Math.round(price * (1 + r * 0.0005) * 10000) / 10000;
}
import { matchPendingOrders } from "@/lib/order-matching";
import { getSymbolsWithRecentHistory } from "@/lib/price-history";

/**
 * GET /api/prices?symbols=AAPL,NESN.SW,...
 *
 * Returns current prices:
 *  - US stocks: last known from prices_latest (real Finnhub data)
 *  - Simulated stocks: computed LIVE by fast-forwarding from last recorded
 *    price to current minute. Prices move every minute automatically.
 *
 * Also writes the new simulated price back to prices_latest + price_history
 * so charts build up over time.
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
  const rawMap = new Map<string, { price: number; as_of: string }>();

  prices?.forEach((p) => {
    const entry = { price: Number(p.price), as_of: p.as_of };
    rawMap.set(p.symbol, entry);
    priceMap[p.symbol] = entry;
  });

  // Load seed_prices for simulated stocks
  const simSymbols = symbolsToFetch.filter((s) => isSimulated(s));
  const seedMap = new Map<string, number>();

  const exchangeSuffixMap = new Map<string, string | null>();
  if (simSymbols.length > 0) {
    try {
      const { data: instData } = await supabase
        .from("instruments")
        .select("symbol, seed_price, exchange_suffix")
        .in("symbol", simSymbols);
      instData?.forEach((i) => {
        if (i.seed_price) seedMap.set(i.symbol, Number(i.seed_price));
        if ("exchange_suffix" in i) exchangeSuffixMap.set(i.symbol, i.exchange_suffix ?? null);
      });
    } catch {
      // seed_price / exchange_suffix column might not exist yet
    }
  }

  // ─── Simulate forward for international stocks ───
  const now = Date.now();
  const nowISO = new Date(now).toISOString();
  const toWrite: { symbol: string; price: number }[] = [];

  for (const symbol of simSymbols) {
    const last = rawMap.get(symbol);
    if (!last || last.price <= 0) continue;

    const lastMs = new Date(last.as_of).getTime();
    const lastMinute = Math.floor(lastMs / 60_000);
    const nowMinute = Math.floor(now / 60_000);

    // Only simulate if at least 1 minute has passed
    if (nowMinute <= lastMinute) {
      // Same minute — keep existing price
      continue;
    }

    const seedPrice = seedMap.get(symbol);
    const exchangeSuffix = exchangeSuffixMap.get(symbol);
    const newPrice = simulatePriceForward(last.price, symbol, lastMs, now, seedPrice, exchangeSuffix);

    priceMap[symbol] = { price: newPrice, as_of: nowISO };
    toWrite.push({ symbol, price: newPrice });
  }

  // Write updated simulated prices + match pending orders (fire-and-forget)
  if (toWrite.length > 0) {
    const bgWork = async () => {
      const writeSymbols = toWrite.map((t) => t.symbol);
      const recentHistory = await getSymbolsWithRecentHistory(supabase, writeSymbols);
      for (const { symbol, price } of toWrite) {
        await supabase.from("prices_latest").upsert(
          { symbol, price, as_of: nowISO, source: "sim" },
          { onConflict: "symbol" }
        );
        if (!recentHistory.has(symbol)) {
          await supabase.from("price_history").insert({ symbol, price, as_of: nowISO });
          recentHistory.add(symbol);
        }
      }
      // After prices are written, check if any limit orders can be filled
      try {
        await matchPendingOrders(supabase);
      } catch (e) {
        console.warn("[prices GET] order matching error:", e);
      }
    };
    bgWork().catch((e) => console.warn("[prices GET] background error:", e));
  }

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
      for (const { symbol, price } of usToWrite) {
        await supabase.from("prices_latest").upsert(
          { symbol, price, as_of: nowISO, source: "finnhub" },
          { onConflict: "symbol" }
        );
        // Pas de price_history pour les micro-oscillations (évite de saturer les graphiques)
      }
      try {
        await matchPendingOrders(supabase);
      } catch (e) {
        console.warn("[prices GET] order matching error:", e);
      }
    };
    bgWork().catch((e) => console.warn("[prices GET] US oscillation error:", e));
  }

  // Toujours vérifier les ordres limite (même sans nouveau prix — la DB peut avoir été mise à jour par refresh-public)
  matchPendingOrders(supabase).catch((e) => console.warn("[prices GET] order matching:", e));

  return NextResponse.json({ prices: priceMap });
}

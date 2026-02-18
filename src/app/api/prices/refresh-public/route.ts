import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchQuote, batchProcess } from "@/lib/finnhub";
import { isSimulated, simulatePrice } from "@/lib/price-sim";
import { getExchangeForSymbol, isMarketOpen } from "@/lib/sectors";

/** Micro-oscillation déterministe pour les actions US (±0.08%) — simule les petits mouvements réels, aide les ordres limite */
function usPriceOscillation(price: number, symbol: string, timestampMs: number): number {
  const minute = Math.floor(timestampMs / 60_000);
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = ((h << 5) - h + symbol.charCodeAt(i)) | 0;
  const seed = (h ^ minute) >>> 0;
  const t = (seed * 1103515245 + 12345) & 0x7fffffff;
  const r = (t / 0x7fffffff) * 2 - 1; // -1 à 1
  const noise = r * 0.0008; // ±0.08% (~10 ct sur Apple à 120$)
  return Math.max(0.01, Math.round(price * (1 + noise) * 10000) / 10000);
}

const MAX_DURATION_MS = 50_000;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 5200; // ~57 Finnhub calls/min

type Inst = {
  id: string;
  symbol: string;
  name: string | null;
  quote_symbol: string | null;
  seed_price: number | null;
  exchange_suffix: string | null;
};

/**
 * POST /api/prices/refresh-public
 *
 * Hybrid strategy:
 *  - US stocks → real Finnhub Quote (batched, rate-limited)
 *  - International stocks → deterministic simulation from last known price
 */
export async function POST(request: NextRequest) {
  try {
    const finnhubKey = process.env.FINNHUB_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "Configuration manquante", missing: [!supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL", !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean) },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // Load instruments (try with seed_price, fallback without if column missing)
  let instruments: Inst[] | null = null;
  let instErr = null;

  const res1 = await supabase.from("instruments").select("id, symbol, name, quote_symbol, seed_price, exchange_suffix").limit(200);
  if (res1.error && /seed_price|exchange_suffix|column/.test(res1.error.message ?? "")) {
    const res2 = await supabase.from("instruments").select("id, symbol, name, quote_symbol").limit(200);
    instruments = (res2.data ?? []).map((i) => ({ ...i, seed_price: null, exchange_suffix: null }));
    instErr = res2.error;
  } else {
    instruments = res1.data;
    instErr = res1.error;
  }

  if (instErr) {
    console.error("[prices/refresh-public] instruments:", instErr);
    return NextResponse.json({ ok: false, error: "Erreur base de données." }, { status: 500 });
  }

  const list: Inst[] = instruments ?? [];
  if (list.length === 0) return NextResponse.json({ ok: true, updated: 0 });

  // Load current prices for simulated stocks (need last price as base)
  const simSymbols = list.filter((i) => isSimulated(i.symbol)).map((i) => i.symbol);
  const priceMap = new Map<string, number>();

  if (simSymbols.length > 0) {
    const { data: currentPrices } = await supabase
      .from("prices_latest")
      .select("symbol, price")
      .in("symbol", simSymbols);
    currentPrices?.forEach((p) => priceMap.set(p.symbol, Number(p.price)));
  }

  const now = Date.now();
  const nowISO = new Date(now).toISOString();
  let updatedReal = 0;
  let updatedSim = 0;

  // ─── 1. Simulate international stocks (instant, no API calls) ───
  for (const inst of list) {
    if (!isSimulated(inst.symbol)) continue;

    const lastPrice = priceMap.get(inst.symbol);
    if (lastPrice == null || lastPrice <= 0) continue; // no seed price yet → skip

    const seedPrice = inst.seed_price ? Number(inst.seed_price) : undefined;
    const newPrice = simulatePrice(lastPrice, inst.symbol, now, seedPrice, inst.exchange_suffix);

    const { error: upsertErr } = await supabase.from("prices_latest").upsert(
      { symbol: inst.symbol, price: newPrice, as_of: nowISO, source: "sim" },
      { onConflict: "symbol" }
    );
    if (!upsertErr) {
      updatedSim++;
      await supabase.from("price_history").insert({ symbol: inst.symbol, price: newPrice, as_of: nowISO });
    }
  }

  // ─── 2. Fetch US stocks from Finnhub (batched) ───
  const usStocks = finnhubKey ? list.filter((i) => !isSimulated(i.symbol)) : [];

  const processUS = async (inst: Inst) => {
    try {
      const sym = inst.quote_symbol ?? inst.symbol;
      const rawPrice = await fetchQuote(finnhubKey, sym);
      if (rawPrice == null) return;
      const exchange = getExchangeForSymbol(inst.symbol);
      const price = isMarketOpen(exchange).open
        ? usPriceOscillation(rawPrice, inst.symbol, now)
        : rawPrice; // Marché fermé : pas d'oscillation

      const { error: upsertErr } = await supabase.from("prices_latest").upsert(
        { symbol: inst.symbol, price, as_of: nowISO, source: "finnhub" },
        { onConflict: "symbol" }
      );
      if (!upsertErr) {
        updatedReal++;
        await supabase.from("price_history").insert({ symbol: inst.symbol, price, as_of: nowISO });
      }
    } catch (e) {
      console.warn("[prices/refresh-public]", inst.symbol, e);
    }
  };

  await batchProcess(usStocks, processUS, BATCH_SIZE, BATCH_DELAY_MS, MAX_DURATION_MS);

  return NextResponse.json({
    ok: true,
    updated: updatedReal + updatedSim,
    real: updatedReal,
    simulated: updatedSim,
    us_total: usStocks.length,
    finnhub_configured: !!finnhubKey,
    total: list.length,
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[prices/refresh-public]", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

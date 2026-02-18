import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchQuote, batchProcess } from "@/lib/finnhub";
import { isSimulated, simulatePrice } from "@/lib/price-sim";

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 5200;

type Inst = {
  id: string;
  symbol: string;
  name: string | null;
  quote_symbol: string | null;
  seed_price: number | null;
  exchange_suffix: string | null;
};

/**
 * POST /api/prices/refresh   (cron, protected by CRON_SECRET)
 * Same hybrid logic: US real, international simulated.
 */
export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const expected = process.env.CRON_SECRET;

  if (!expected || (cronSecret ?? bearerSecret) !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !finnhubKey || !supabaseUrl) {
    return NextResponse.json({ ok: false, error: "Missing env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

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
    return NextResponse.json({ ok: false, error: instErr.message }, { status: 500 });
  }

  const list: Inst[] = instruments ?? [];
  if (list.length === 0) return NextResponse.json({ ok: true, updated: 0 });

  // Load last prices for simulated
  const simSymbols = list.filter((i) => isSimulated(i.symbol)).map((i) => i.symbol);
  const priceMap = new Map<string, number>();
  if (simSymbols.length > 0) {
    const { data: cp } = await supabase.from("prices_latest").select("symbol, price").in("symbol", simSymbols);
    cp?.forEach((p) => priceMap.set(p.symbol, Number(p.price)));
  }

  const now = Date.now();
  const nowISO = new Date(now).toISOString();
  let updatedReal = 0;
  let updatedSim = 0;

  // 1. Simulate international
  for (const inst of list) {
    if (!isSimulated(inst.symbol)) continue;
    const lastPrice = priceMap.get(inst.symbol);
    if (lastPrice == null || lastPrice <= 0) continue;
    const seedPrice = inst.seed_price ? Number(inst.seed_price) : undefined;
    const newPrice = simulatePrice(lastPrice, inst.symbol, now, seedPrice, inst.exchange_suffix);

    const { error } = await supabase.from("prices_latest").upsert(
      { symbol: inst.symbol, price: newPrice, as_of: nowISO, source: "sim" },
      { onConflict: "symbol" }
    );
    if (!error) {
      updatedSim++;
      await supabase.from("price_history").insert({ symbol: inst.symbol, price: newPrice, as_of: nowISO });
    }
  }

  // 2. Fetch US
  const usStocks = list.filter((i) => !isSimulated(i.symbol));
  const processUS = async (inst: Inst) => {
    try {
      const sym = inst.quote_symbol ?? inst.symbol;
      const price = await fetchQuote(finnhubKey, sym);
      if (price == null) return;
      const { error } = await supabase.from("prices_latest").upsert(
        { symbol: inst.symbol, price, as_of: nowISO, source: "finnhub" },
        { onConflict: "symbol" }
      );
      if (!error) {
        updatedReal++;
        await supabase.from("price_history").insert({ symbol: inst.symbol, price, as_of: nowISO });
      }
    } catch (e) {
      console.warn("[prices/refresh]", inst.symbol, e);
    }
  };

  await batchProcess(usStocks, processUS, BATCH_SIZE, BATCH_DELAY_MS);

  return NextResponse.json({ ok: true, updated: updatedReal + updatedSim, real: updatedReal, simulated: updatedSim });
}

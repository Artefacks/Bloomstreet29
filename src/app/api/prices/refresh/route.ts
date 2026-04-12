import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchQuote, batchProcess } from "@/lib/finnhub";
import { isSimulated } from "@/lib/price-sim";
import { getSymbolsWithRecentHistory } from "@/lib/price-history";
import { matchPendingOrders } from "@/lib/order-matching";

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
 * US only real-time prices from Finnhub.
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

  const allSymbols = list.map((i) => i.symbol);
  const recentHistory = await getSymbolsWithRecentHistory(supabase, allSymbols);

  const now = Date.now();
  const nowISO = new Date(now).toISOString();
  let updatedReal = 0;
  // Fetch US live symbols only
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
        if (!recentHistory.has(inst.symbol)) {
          await supabase.from("price_history").insert({ symbol: inst.symbol, price, as_of: nowISO });
          recentHistory.add(inst.symbol);
        }
      }
    } catch (e) {
      console.warn("[prices/refresh]", inst.symbol, e);
    }
  };

  await batchProcess(usStocks, processUS, BATCH_SIZE, BATCH_DELAY_MS);

  try {
    await matchPendingOrders(supabase);
  } catch (e) {
    console.warn("[prices/refresh] matchPendingOrders:", e);
  }

  return NextResponse.json({ ok: true, updated: updatedReal, real: updatedReal, simulated: 0 });
}

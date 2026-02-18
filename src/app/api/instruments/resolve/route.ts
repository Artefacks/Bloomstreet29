import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveQuoteSymbol, batchProcess } from "@/lib/finnhub";

/**
 * POST /api/instruments/resolve
 * Pré-résout quote_symbol pour les instruments sans via Finnhub Symbol Search.
 * Protégé par CRON_SECRET. Exécuter après avoir ajouté de nouveaux instruments.
 * Traite 3 instruments en parallèle, ~35 calls/min (chaque instrument = 1-2 search calls).
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

  const { data: instruments, error } = await supabase
    .from("instruments")
    .select("id, symbol, name, quote_symbol")
    .is("quote_symbol", null)
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const list = instruments ?? [];
  if (list.length === 0) {
    return NextResponse.json({ ok: true, resolved: 0, message: "All instruments already have quote_symbol" });
  }

  let resolved = 0;
  const results: { symbol: string; quote_symbol: string | null }[] = [];

  const processInst = async (inst: (typeof list)[0]) => {
    try {
      const qs = await resolveQuoteSymbol(finnhubKey, inst.symbol, inst.name ?? null);
      results.push({ symbol: inst.symbol, quote_symbol: qs });
      if (qs) {
        await supabase.from("instruments").update({ quote_symbol: qs }).eq("id", inst.id);
        resolved++;
      }
    } catch (e) {
      console.warn("[instruments/resolve]", inst.symbol, e);
      results.push({ symbol: inst.symbol, quote_symbol: null });
    }
  };

  // 3 concurrent, 3.5s between batches → ~51 search calls/min
  await batchProcess(list, processInst, 3, 3500);

  return NextResponse.json({ ok: true, resolved, total: list.length, results });
}

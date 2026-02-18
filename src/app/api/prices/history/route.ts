import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

/**
 * GET /api/prices/history?symbols=AAPL,MSFT&limit=100
 * Historique des prix par symbole (pour graphiques).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const symbolsParam = url.searchParams.get("symbols");
  const limit = Math.min(500, Math.max(10, parseInt(url.searchParams.get("limit") ?? "100", 10)));

  const symbols = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : [];

  const response = NextResponse.json({});
  const supabase = createSupabaseRouteClient(request, response);

  if (symbols.length === 0) {
    return NextResponse.json({ history: {} });
  }

  const history: Record<string, { price: number; at: string }[]> = {};
  for (const symbol of symbols) {
    const { data: rows, error } = await supabase
      .from("price_history")
      .select("price, as_of")
      .eq("symbol", symbol)
      .order("as_of", { ascending: false })
      .limit(limit);

    if (!error && rows?.length) {
      const sorted = [...rows].reverse();
      history[symbol] = sorted.map((r) => ({
        price: Number(r.price),
        at: r.as_of,
      }));
    }
  }

  return NextResponse.json({ history });
}

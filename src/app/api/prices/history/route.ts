import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

/**
 * GET /api/prices/history?symbols=AAPL,MSFT&limit=100
 * Historique des prix par symbole (pour graphiques).
 * Rétention DB : 7 jours (cleanup cron quotidien).
 * Max 700 points pour couvrir 1 semaine complète (sampling 5 min).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const symbolsParam = url.searchParams.get("symbols");
  const limit = Math.min(700, Math.max(10, parseInt(url.searchParams.get("limit") ?? "100", 10)));

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

    let points: { price: number; at: string }[] = [];
    if (!error && rows?.length) {
      const sorted = [...rows].reverse();
      points = sorted.map((r) => ({
        price: Number(r.price),
        at: r.as_of,
      }));
    }

    // Fallback : si < 2 points (ex. actions US sans refresh récent), compléter avec prices_latest
    if (points.length < 2) {
      const { data: latest } = await supabase
        .from("prices_latest")
        .select("price, as_of")
        .eq("symbol", symbol)
        .single();
      if (latest && Number(latest.price) > 0) {
        const now = new Date().toISOString();
        const current = { price: Number(latest.price), at: latest.as_of ?? now };
        if (points.length === 0) {
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          points = [{ ...current, at: fiveMinAgo }, { ...current, at: now }];
        } else {
          points = [...points, { ...current, at: now }];
        }
      }
    }
    if (points.length > 0) history[symbol] = points;
  }

  return NextResponse.json({ history });
}

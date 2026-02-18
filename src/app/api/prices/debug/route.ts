import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/prices/debug
 * Diagnostic pour identifier les problèmes de refresh des prix.
 * N'expose aucune clé secrète.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const finnhubKey = process.env.FINNHUB_API_KEY;

  const config = {
    supabase_url: !!supabaseUrl,
    supabase_service_role: !!serviceRoleKey,
    finnhub_api_key: !!finnhubKey,
  };

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({
      config,
      error: "Supabase non configuré",
      hint: "Vérifie NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sur Vercel",
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Récupérer les derniers prix pour AAPL et quelques autres
  const { data: prices } = await supabase
    .from("prices_latest")
    .select("symbol, price, as_of, source")
    .in("symbol", ["AAPL", "MSFT", "NESN.SW"])
    .limit(10);

  const samplePrices = (prices ?? []).reduce(
    (acc, p) => {
      acc[p.symbol] = { price: p.price, as_of: p.as_of, source: p.source };
      return acc;
    },
    {} as Record<string, { price: number; as_of: string; source: string }>
  );

  // Vérifier un appel Finnhub si la clé est configurée
  let finnhubTest: { ok?: boolean; error?: string } = {};
  if (finnhubKey) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(finnhubKey)}`
      );
      const data = await res.json();
      const price = data?.c;
      if (res.status === 429) {
        finnhubTest = { error: "Rate limit (429) - trop d'appels" };
      } else if (res.status === 401) {
        finnhubTest = { error: "Clé invalide (401)" };
      } else if (typeof price === "number" && price > 0) {
        finnhubTest = { ok: true };
      } else {
        finnhubTest = { error: `Réponse inattendue: ${JSON.stringify(data).slice(0, 100)}` };
      }
    } catch (e) {
      finnhubTest = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json({
    config,
    sample_prices: samplePrices,
    finnhub_test: finnhubTest,
    hint: !finnhubKey
      ? "Ajoute FINNHUB_API_KEY sur Vercel et redéploie pour les prix US en temps réel"
      : finnhubTest.error
        ? `Finnhub: ${finnhubTest.error}`
        : "Finnhub OK - vérifie que tu as bien redéployé après avoir ajouté la clé",
  });
}

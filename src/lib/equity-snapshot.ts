import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrencyForSymbol, getExchangeRateToCHF } from "@/lib/finnhub";

/**
 * Enregistre un snapshot de la valorisation totale du joueur (pour le graphique d'évolution).
 * Appelé après chaque trade (marché ou limite).
 */
export async function recordEquitySnapshot(
  supabase: SupabaseClient,
  gameId: string,
  userId: string,
  cash: number
) {
  const { data: positions } = await supabase
    .from("positions")
    .select("symbol, qty")
    .eq("game_id", gameId)
    .eq("user_id", userId);
  const symbols = [...new Set((positions ?? []).map((p) => p.symbol))];
  if (symbols.length === 0) {
    await supabase.from("player_equity_snapshots").insert({
      game_id: gameId,
      user_id: userId,
      total_value: cash,
    });
    return;
  }
  const { data: prices } = await supabase
    .from("prices_latest")
    .select("symbol, price")
    .in("symbol", symbols);
  const priceMap = new Map<string, number>();
  prices?.forEach((p) => priceMap.set(p.symbol, Number(p.price)));
  let totalValue = cash;
  positions?.forEach((p) => {
    const pr = priceMap.get(p.symbol);
    if (pr != null) {
      const fxRate = getExchangeRateToCHF(getCurrencyForSymbol(p.symbol));
      totalValue += Number(p.qty) * pr * fxRate;
    }
  });
  await supabase.from("player_equity_snapshots").insert({
    game_id: gameId,
    user_id: userId,
    total_value: totalValue,
  });
}

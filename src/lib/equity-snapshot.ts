import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrencyForSymbol, getExchangeRateToCHF } from "@/lib/finnhub";

/**
 * Enregistre un snapshot de la valorisation totale du joueur (pour le graphique d'évolution).
 * Appelé après chaque trade (marché ou limite).
 * Prend en compte l'effet de levier (Blitz) si game.leverage_multiplier > 1.
 * Inclut le cash réservé (ordres limite d'achat) et les actions réservées (ordres limite vente).
 */
export async function recordEquitySnapshot(
  supabase: SupabaseClient,
  gameId: string,
  userId: string,
  cash: number
) {
  const { data: game } = await supabase
    .from("games")
    .select("leverage_multiplier, fee_bps")
    .eq("id", gameId)
    .single();
  const leverage = Number(game?.leverage_multiplier ?? 1);
  const feeBps = Number((game as { fee_bps?: number } | null)?.fee_bps ?? 10);

  const { data: positions } = await supabase
    .from("positions")
    .select("symbol, qty, avg_cost")
    .eq("game_id", gameId)
    .eq("user_id", userId);

  const { data: pendingOrders } = await supabase
    .from("pending_orders")
    .select("symbol, side, qty, limit_price")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .eq("status", "open");

  const symbols = [
    ...new Set([
      ...(positions ?? []).map((p) => p.symbol),
      ...(pendingOrders ?? []).map((o) => o.symbol),
    ]),
  ];

  const priceMap = new Map<string, number>();
  if (symbols.length > 0) {
    const { data: prices } = await supabase
      .from("prices_latest")
      .select("symbol, price")
      .in("symbol", symbols);
    prices?.forEach((p) => priceMap.set(p.symbol, Number(p.price)));
  }

  let totalValue = cash;

  // Réintégrer le cash réservé des ordres limite d'achat (comme game-state / PortfolioSummary)
  let reserved = 0;
  (pendingOrders ?? [])
    .filter((o) => o.side === "buy")
    .forEach((o) => {
      const fxRate = getExchangeRateToCHF(getCurrencyForSymbol(o.symbol));
      reserved += Number(o.limit_price) * Number(o.qty) * fxRate;
    });
  const reserveFee = reserved > 0 ? Math.min(15, Math.round((reserved * feeBps) / 10000 * 100) / 100) : 0;
  totalValue += reserved + reserveFee;

  // Positions
  positions?.forEach((p) => {
    const pr = priceMap.get(p.symbol);
    if (pr != null) {
      const fxRate = getExchangeRateToCHF(getCurrencyForSymbol(p.symbol));
      const qty = Number(p.qty);
      const avgCost = Number(p.avg_cost);
      const costBasis = qty * avgCost * fxRate;
      const marketValue = qty * pr * fxRate;
      const positionValue = costBasis + (marketValue - costBasis) * leverage;
      totalValue += positionValue;
    }
  });

  // Actions réservées (ordres limite vente) valorisées au cours actuel
  (pendingOrders ?? [])
    .filter((o) => o.side === "sell")
    .forEach((o) => {
      const pr = priceMap.get(o.symbol);
      if (pr != null) {
        const fxRate = getExchangeRateToCHF(getCurrencyForSymbol(o.symbol));
        totalValue += Number(o.qty) * pr * fxRate;
      }
    });

  await supabase.from("player_equity_snapshots").insert({
    game_id: gameId,
    user_id: userId,
    total_value: totalValue,
  });
}

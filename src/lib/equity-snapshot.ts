import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Enregistre un snapshot de la valorisation totale du joueur (pour le graphique d'évolution).
 * Appelé après chaque trade (marché ou limite).
 * Prend en compte l'effet de levier si game.leverage_multiplier > 1.
 * Cash DB = disponible ; réserve achats = somme (qty × limite) ; pas de double comptage ni « frais réservés ».
 */
export async function recordEquitySnapshot(
  supabase: SupabaseClient,
  gameId: string,
  userId: string,
  cash: number
) {
  const { data: game } = await supabase
    .from("games")
    .select("leverage_multiplier")
    .eq("id", gameId)
    .single();
  const leverage = Number(game?.leverage_multiplier ?? 1);

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

  let reservedBuy = 0;
  (pendingOrders ?? [])
    .filter((o) => o.side === "buy")
    .forEach((o) => {
      reservedBuy += Number(o.limit_price) * Number(o.qty);
    });
  totalValue += reservedBuy;

  // Positions
  positions?.forEach((p) => {
    const pr = priceMap.get(p.symbol);
    if (pr != null) {
      const qty = Number(p.qty);
      const avgCost = Number(p.avg_cost);
      const costBasis = qty * avgCost;
      const marketValue = qty * pr;
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
        totalValue += Number(o.qty) * pr;
      }
    });

  await supabase.from("player_equity_snapshots").insert({
    game_id: gameId,
    user_id: userId,
    total_value: totalValue,
  });
}

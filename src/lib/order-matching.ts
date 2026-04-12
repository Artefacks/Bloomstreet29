import type { SupabaseClient } from "@supabase/supabase-js";
import { recordEquitySnapshot } from "@/lib/equity-snapshot";
import { getBidAsk } from "@/lib/bid-ask";
import { getExchangeForSymbol, isMarketOpen } from "@/lib/sectors";

type PendingRow = {
  id: string;
  game_id: string;
  user_id: string;
  symbol: string;
  side: string;
  qty: number;
  limit_price: number;
  created_at: string;
  market_deferred?: boolean | null;
};

/**
 * Order matching engine.
 * Aucun remplissage tant que la bourse du titre est fermée.
 *
 * Ordre limite : achat si cours ≤ limite, vente si cours ≥ limite.
 * Ordre au marché différé (market_deferred) : exécution au bid/ask courant dès l’ouverture.
 */
export async function matchPendingOrders(supabase: SupabaseClient) {
  // 1. Load all open pending orders
  const { data: pendingOrders, error: poErr } = await supabase
    .from("pending_orders")
    .select("id, game_id, user_id, symbol, side, qty, limit_price, created_at, market_deferred")
    .eq("status", "open")
    .limit(500);

  if (poErr || !pendingOrders || pendingOrders.length === 0) return 0;

  // 2. Get unique symbols and load current prices
  const symbols = [...new Set(pendingOrders.map((o) => o.symbol))];
  const { data: priceRows } = await supabase
    .from("prices_latest")
    .select("symbol, price")
    .in("symbol", symbols);

  const priceMap = new Map<string, number>();
  priceRows?.forEach((p) => priceMap.set(p.symbol, Number(p.price)));

  // 3. Get unique game_ids to load fee_bps
  const gameIds = [...new Set(pendingOrders.map((o) => o.game_id))];
  const { data: gameRows } = await supabase
    .from("games")
    .select("id, fee_bps, status, ends_at")
    .in("id", gameIds);

  const gameMap = new Map<string, { fee_bps: number; active: boolean }>();
  gameRows?.forEach((g) => {
    const ended = g.ends_at && new Date(g.ends_at) < new Date();
    const active = !ended && (g.status === "active" || g.status === "pending");
    gameMap.set(g.id, { fee_bps: Number(g.fee_bps ?? 10), active });
  });

  let filled = 0;

  for (const order of pendingOrders as PendingRow[]) {
    const game = gameMap.get(order.game_id);
    if (!game) continue;

    const limitPrice = Number(order.limit_price);
    const qty = Number(order.qty);
    const feeBps = game.fee_bps;

    // Partie terminée : rembourser l'achat (cash réservé) ou rendre les titres (vente)
    if (!game.active) {
      const { data: player } = await supabase
        .from("game_players")
        .select("id, cash")
        .eq("game_id", order.game_id)
        .eq("user_id", order.user_id)
        .maybeSingle();

      if (order.side === "buy" && player) {
        const reserveTotal = qty * limitPrice;
        const reserveFee = Math.min(15, Math.round((reserveTotal * feeBps) / 10000 * 100) / 100);
        const refund = reserveTotal + reserveFee;
        await supabase
          .from("game_players")
          .update({ cash: Number(player.cash) + refund })
          .eq("id", player.id);
      } else if (order.side === "sell") {
        const { data: existingPos } = await supabase
          .from("positions")
          .select("id, qty, avg_cost")
          .eq("game_id", order.game_id)
          .eq("user_id", order.user_id)
          .eq("symbol", order.symbol)
          .maybeSingle();
        if (existingPos) {
          const newQty = Number(existingPos.qty) + qty;
          await supabase.from("positions").update({ qty: newQty }).eq("id", existingPos.id);
        } else {
          await supabase.from("positions").insert({
            game_id: order.game_id,
            user_id: order.user_id,
            symbol: order.symbol,
            qty,
            avg_cost: limitPrice,
          });
        }
      }

      await supabase
        .from("pending_orders")
        .update({ status: "expired", cancelled_at: new Date().toISOString() })
        .eq("id", order.id);
      continue;
    }

    const marketPrice = priceMap.get(order.symbol);
    if (marketPrice == null) continue;

    const exchange = getExchangeForSymbol(order.symbol);
    if (!isMarketOpen(exchange).open) continue;

    const marketDeferred = order.market_deferred === true;
    let fillPrice: number;

    if (marketDeferred) {
      const { bid, ask } = getBidAsk(marketPrice);
      fillPrice = order.side === "buy" ? ask : bid;
    } else {
      const eps = Math.max(0.0001, limitPrice * 0.0001);
      const shouldFill =
        (order.side === "buy" && marketPrice <= limitPrice + eps) ||
        (order.side === "sell" && marketPrice >= limitPrice - eps);
      if (!shouldFill) continue;
      fillPrice = limitPrice;
    }

    const totalUsd = qty * fillPrice;
    const feeAmount = Math.min(15, Math.round((totalUsd * feeBps) / 10000 * 100) / 100);

    // Load player cash
    const { data: player } = await supabase
      .from("game_players")
      .select("id, cash")
      .eq("game_id", order.game_id)
      .eq("user_id", order.user_id)
      .single();

    if (!player) continue;
    const cash = Number(player.cash);

    if (order.side === "buy") {
      let cashAfterBuy = cash;
      // Cash déjà déduit à la création (limit_price = ask de référence si market_deferred).
      if (marketDeferred) {
        const ask0 = limitPrice;
        const feeReserved = Math.min(15, Math.round((qty * ask0 * feeBps) / 10000 * 100) / 100);
        const reserved = qty * ask0 + feeReserved;
        const actual = qty * fillPrice + feeAmount;
        const cashAdjust = reserved - actual;
        if (cashAdjust !== 0) {
          cashAfterBuy = cash + cashAdjust;
          await supabase.from("game_players").update({ cash: cashAfterBuy }).eq("id", player.id);
        }
      }
      // Update/create position
      const { data: existingPos } = await supabase
        .from("positions")
        .select("id, qty, avg_cost")
        .eq("game_id", order.game_id)
        .eq("user_id", order.user_id)
        .eq("symbol", order.symbol)
        .maybeSingle();

      if (existingPos) {
        const oldQty = Number(existingPos.qty);
        const oldAvg = Number(existingPos.avg_cost);
        const newQty = oldQty + qty;
        const newAvg = (oldQty * oldAvg + qty * fillPrice) / newQty;
        await supabase.from("positions").update({ qty: newQty, avg_cost: newAvg }).eq("id", existingPos.id);
      } else {
        await supabase.from("positions").insert({
          game_id: order.game_id,
          user_id: order.user_id,
          symbol: order.symbol,
          qty,
          avg_cost: fillPrice,
        });
      }

      // Record in orders history
      await supabase.from("orders").insert({
        game_id: order.game_id,
        user_id: order.user_id,
        symbol: order.symbol,
        side: "buy",
        qty,
        price: fillPrice,
        fee_amount: feeAmount,
      });

      // Mark filled
      await supabase
        .from("pending_orders")
        .update({
          status: "filled",
          filled_at: new Date().toISOString(),
          fill_price: fillPrice,
          fee_amount: feeAmount,
        })
        .eq("id", order.id);

      await recordEquitySnapshot(supabase, order.game_id, order.user_id, cashAfterBuy);
      filled++;
    } else {
      // Sell: shares were already reserved (position reduced) when the order was placed.
      // We do NOT check position here - just credit cash and mark filled.
      const creditUsd = totalUsd - feeAmount;
      const newCash = cash + creditUsd;
      await supabase.from("game_players").update({ cash: newCash }).eq("id", player.id);

      await supabase.from("orders").insert({
        game_id: order.game_id,
        user_id: order.user_id,
        symbol: order.symbol,
        side: "sell",
        qty,
        price: fillPrice,
        fee_amount: feeAmount,
      });

      await supabase
        .from("pending_orders")
        .update({
          status: "filled",
          filled_at: new Date().toISOString(),
          fill_price: fillPrice,
          fee_amount: feeAmount,
        })
        .eq("id", order.id);

      await recordEquitySnapshot(supabase, order.game_id, order.user_id, newCash);
      filled++;
    }
  }

  return filled;
}

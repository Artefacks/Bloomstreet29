import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrencyForSymbol, getExchangeRateToCHF } from "@/lib/finnhub";
import { recordEquitySnapshot } from "@/lib/equity-snapshot";

/**
 * Order matching engine.
 * Checks all open pending_orders against current prices.
 * Fills orders whose limit price has been reached.
 *
 * Buy limit: fills when market price ≤ limit_price (buy at limit or better)
 * Sell limit: fills when market price ≥ limit_price (sell at limit or better)
 */
export async function matchPendingOrders(supabase: SupabaseClient) {
  // 1. Load all open pending orders
  const { data: pendingOrders, error: poErr } = await supabase
    .from("pending_orders")
    .select("id, game_id, user_id, symbol, side, qty, limit_price, created_at")
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

  for (const order of pendingOrders) {
    const marketPrice = priceMap.get(order.symbol);
    if (marketPrice == null) continue;

    const game = gameMap.get(order.game_id);
    if (!game) continue;

    // Cancel if game is no longer active
    if (!game.active) {
      await supabase
        .from("pending_orders")
        .update({ status: "expired", cancelled_at: new Date().toISOString() })
        .eq("id", order.id);
      continue;
    }

    const limitPrice = Number(order.limit_price);
    const qty = Number(order.qty);
    const eps = Math.max(0.0001, limitPrice * 0.0001); // tolérance arrondi
    const shouldFill =
      (order.side === "buy" && marketPrice <= limitPrice + eps) ||
      (order.side === "sell" && marketPrice >= limitPrice - eps);

    if (!shouldFill) continue;

    // Execute at limit price (you get your price or better)
    const fillPrice = limitPrice;
    const total = qty * fillPrice; // in instrument currency
    const fxRate = getExchangeRateToCHF(getCurrencyForSymbol(order.symbol));
    const totalCHF = total * fxRate;
    const feeAmount = Math.min(15, Math.round((totalCHF * game.fee_bps) / 10000 * 100) / 100);

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
      const totalWithFee = totalCHF + feeAmount;
      if (cash < totalWithFee) {
        await supabase
          .from("pending_orders")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", order.id);
        continue;
      }

      // Execute buy (deduct CHF from cash)
      const newCash = cash - totalWithFee;
      await supabase.from("game_players").update({ cash: newCash }).eq("id", player.id);

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

      await recordEquitySnapshot(supabase, order.game_id, order.user_id, newCash);
      filled++;
    } else {
      // Sell
      const { data: pos } = await supabase
        .from("positions")
        .select("id, qty")
        .eq("game_id", order.game_id)
        .eq("user_id", order.user_id)
        .eq("symbol", order.symbol)
        .single();

      if (!pos || Number(pos.qty) < qty) {
        await supabase
          .from("pending_orders")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", order.id);
        continue;
      }

      const creditCHF = totalCHF - feeAmount;
      const newCash = cash + creditCHF;
      await supabase.from("game_players").update({ cash: newCash }).eq("id", player.id);

      const newQty = Number(pos.qty) - qty;
      if (newQty <= 0) {
        await supabase.from("positions").delete().eq("id", pos.id);
      } else {
        await supabase.from("positions").update({ qty: newQty }).eq("id", pos.id);
      }

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

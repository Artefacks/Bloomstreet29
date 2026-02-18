import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { getCurrencyForSymbol, getExchangeRateToCHF } from "@/lib/finnhub";

/**
 * POST /api/trade/cancel
 * Cancel an open pending order. Refunds reserved cash (buy) or shares (sell).
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  const supabase = createSupabaseRouteClient(request, response);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const form = await request.formData();
  const orderId = (form.get("orderId") as string)?.trim() ?? "";
  const gameId = (form.get("gameId") as string)?.trim() ?? "";

  if (!orderId || !gameId) {
    const url = new URL(gameId ? `/games/${gameId}` : "/", request.url);
    url.searchParams.set("error", "Paramètres invalides.");
    return NextResponse.redirect(url);
  }

  const redirect = (success?: string, error?: string) => {
    const url = new URL(`/games/${gameId}`, request.url);
    if (success) url.searchParams.set("success", success);
    if (error) url.searchParams.set("error", error);
    return NextResponse.redirect(url);
  };

  // Load the pending order
  const { data: order } = await supabase
    .from("pending_orders")
    .select("id, game_id, user_id, symbol, side, qty, limit_price, status")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();

  if (!order) return redirect(undefined, "Ordre introuvable.");
  if (order.status !== "open") return redirect(undefined, "Cet ordre n'est plus ouvert.");

  const { data: gameRow } = await supabase
    .from("games")
    .select("fee_bps")
    .eq("id", order.game_id)
    .single();

  const feeBps = Number(gameRow?.fee_bps ?? 10);
  const qty = Number(order.qty);
  const limitPrice = Number(order.limit_price);

  // Load player
  const { data: player } = await supabase
    .from("game_players")
    .select("id, cash")
    .eq("game_id", order.game_id)
    .eq("user_id", user.id)
    .single();

  if (!player) return redirect(undefined, "Joueur introuvable.");

  // Refund
  if (order.side === "buy") {
    const fxRate = getExchangeRateToCHF(getCurrencyForSymbol(order.symbol));
    const reserveTotal = qty * limitPrice;
    const reserveTotalCHF = reserveTotal * fxRate;
    const reserveFee = Math.min(15, Math.round((reserveTotalCHF * feeBps) / 10000 * 100) / 100);
    const refund = reserveTotalCHF + reserveFee;
    const newCash = Number(player.cash) + refund;
    await supabase.from("game_players").update({ cash: newCash }).eq("id", player.id);
  } else {
    // Sell: return shares to position
    const { data: existingPos } = await supabase
      .from("positions")
      .select("id, qty, avg_cost")
      .eq("game_id", order.game_id)
      .eq("user_id", user.id)
      .eq("symbol", order.symbol)
      .maybeSingle();

    if (existingPos) {
      const newQty = Number(existingPos.qty) + qty;
      await supabase.from("positions").update({ qty: newQty }).eq("id", existingPos.id);
    } else {
      await supabase.from("positions").insert({
        game_id: order.game_id,
        user_id: user.id,
        symbol: order.symbol,
        qty,
        avg_cost: limitPrice,
      });
    }
  }

  // Mark cancelled
  await supabase
    .from("pending_orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", order.id);

  return redirect(`Ordre limite annulé : ${qty} ${order.symbol} @ ${limitPrice.toFixed(2)}.`);
}

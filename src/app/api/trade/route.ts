import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { getCurrencyForSymbol, getExchangeRateToCHF } from "@/lib/finnhub";
import { recordEquitySnapshot } from "@/lib/equity-snapshot";

function redirectToGame(
  request: NextRequest,
  gameId: string,
  success?: string,
  error?: string,
  symbol?: string
) {
  const url = new URL(`/games/${gameId}`, request.url);
  if (success) url.searchParams.set("success", success);
  if (error) url.searchParams.set("error", error);
  if (symbol) url.searchParams.set("symbol", symbol);
  return NextResponse.redirect(url);
}

/** Simulate bid/ask spread from mid price */
function getBidAsk(midPrice: number): { bid: number; ask: number } {
  const spreadPct = 0.0008; // 0.08% typical
  const half = midPrice * spreadPct * 0.5;
  return {
    bid: Math.round((midPrice - half) * 10000) / 10000,
    ask: Math.round((midPrice + half) * 10000) / 10000,
  };
}

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  const supabase = createSupabaseRouteClient(request, response);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const form = await request.formData();
  const gameId = (form.get("gameId") as string)?.trim() ?? "";
  const symbol = (form.get("symbol") as string)?.trim().toUpperCase() ?? "";
  const qty = Number(form.get("qty")) || 0;
  const side: "buy" | "sell" = form.get("side") === "sell" ? "sell" : "buy";
  const orderType = form.get("orderType") as string ?? "market";
  const limitPriceRaw = form.get("limitPrice");
  const limitPrice = limitPriceRaw != null ? Number(limitPriceRaw) : null;

  if (!gameId || !symbol || qty <= 0) {
    if (gameId) return redirectToGame(request, gameId, undefined, "Paramètres invalides.", symbol || undefined);
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Load player
  const { data: player } = await supabase
    .from("game_players")
    .select("id, cash")
    .eq("game_id", gameId)
    .eq("user_id", user.id)
    .single();

  if (!player) return redirectToGame(request, gameId, undefined, "Pas membre de cette partie.", symbol);

  // Load game settings
  const { data: gameRow } = await supabase
    .from("games")
    .select("status, ends_at, fee_bps, allow_fractional, min_order_amount")
    .eq("id", gameId)
    .single();

  if (!gameRow) return redirectToGame(request, gameId, undefined, "Partie introuvable.", symbol);

  const endsAt = gameRow.ends_at ?? null;
  const effectiveStatus = endsAt && new Date(endsAt) < new Date() ? "finished" : (gameRow.status ?? "active");
  if (effectiveStatus !== "active") {
    return redirectToGame(request, gameId, undefined, "Partie terminée.", symbol);
  }

  const feeBps = Number(gameRow.fee_bps ?? 10);
  const allowFractional = gameRow.allow_fractional !== false;

  let qtyFinal = qty;
  if (!allowFractional) {
    qtyFinal = Math.floor(qty);
    if (qtyFinal <= 0) return redirectToGame(request, gameId, undefined, "Quantité entière requise.", symbol);
  }

  // Load market price
  const { data: priceRow } = await supabase
    .from("prices_latest")
    .select("price")
    .eq("symbol", symbol)
    .single();

  if (!priceRow) return redirectToGame(request, gameId, undefined, `Prix absent pour ${symbol}.`, symbol);

  const marketPrice = Number(priceRow.price);
  const { bid, ask } = getBidAsk(marketPrice);
  const cash = Number(player.cash);
  const fxRate = getExchangeRateToCHF(getCurrencyForSymbol(symbol));

  // ═══════════════════════════════════════════════
  // LIMIT ORDER → save as pending, don't execute
  // ═══════════════════════════════════════════════
  if (orderType === "limit" && limitPrice != null && isFinite(limitPrice) && limitPrice > 0) {
    const deviation = Math.abs(limitPrice - marketPrice) / marketPrice;
    if (deviation > 0.10) {
      return redirectToGame(request, gameId, undefined, "Prix limite trop éloigné du marché (max 10%).", symbol);
    }

    // For buy limit: reserve the cash (limit_price * qty * fxRate + fees)
    if (side === "buy") {
      const reserveTotal = qtyFinal * limitPrice;
      const reserveTotalCHF = reserveTotal * fxRate;
      const reserveFee = Math.min(15, Math.round((reserveTotalCHF * feeBps) / 10000 * 100) / 100);
      if (cash < reserveTotalCHF + reserveFee) {
        return redirectToGame(request, gameId, undefined, "Cash insuffisant pour cet ordre limite.", symbol);
      }
      const newCash = cash - reserveTotalCHF - reserveFee;
      await supabase.from("game_players").update({ cash: newCash }).eq("id", player.id);
    }

    // For sell limit: check position exists
    if (side === "sell") {
      const { data: pos } = await supabase
        .from("positions")
        .select("id, qty")
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .single();
      if (!pos || Number(pos.qty) < qtyFinal) {
        return redirectToGame(request, gameId, undefined, "Position insuffisante.", symbol);
      }
      // Reserve the shares (reduce position)
      const newQty = Number(pos.qty) - qtyFinal;
      if (newQty <= 0) {
        await supabase.from("positions").delete().eq("id", pos.id);
      } else {
        await supabase.from("positions").update({ qty: newQty }).eq("id", pos.id);
      }
    }

    // Insert pending order
    const { error: insertErr } = await supabase.from("pending_orders").insert({
      game_id: gameId,
      user_id: user.id,
      symbol,
      side,
      qty: qtyFinal,
      limit_price: limitPrice,
      status: "open",
    });

    if (insertErr) {
      console.error("[trade] pending insert:", insertErr);
      return redirectToGame(request, gameId, undefined, "Erreur création ordre limite.", symbol);
    }

    return redirectToGame(
      request,
      gameId,
      `Ordre limite ${side === "buy" ? "d'achat" : "de vente"} : ${qtyFinal} ${symbol} @ ${limitPrice.toFixed(2)}. En attente d'exécution.`,
      undefined,
      symbol
    );
  }

  // ═══════════════════════════════════════════════
  // MARKET ORDER → execute immediately at bid/ask
  // ═══════════════════════════════════════════════
  const price = side === "buy" ? ask : bid;
  const total = qtyFinal * price; // in instrument currency
  const totalCHF = total * fxRate; // converted to CHF
  const feeAmount = Math.min(15, Math.round((totalCHF * feeBps) / 10000 * 100) / 100);

  if (side === "buy") {
    const totalWithFee = totalCHF + feeAmount;
    if (cash < totalWithFee) {
      return redirectToGame(request, gameId, undefined, "Cash insuffisant (montant + frais).", symbol);
    }

    const { data: existingPos } = await supabase
      .from("positions")
      .select("id, qty, avg_cost")
      .eq("game_id", gameId)
      .eq("user_id", user.id)
      .eq("symbol", symbol)
      .maybeSingle();

    await supabase.from("orders").insert({
      game_id: gameId, user_id: user.id, symbol, side: "buy",
      qty: qtyFinal, price, fee_amount: feeAmount,
    });

    const newCash = cash - totalWithFee;
    await supabase.from("game_players").update({ cash: newCash }).eq("id", player.id);

    if (existingPos) {
      const oldQty = Number(existingPos.qty);
      const oldAvg = Number(existingPos.avg_cost);
      const newQty = oldQty + qtyFinal;
      const newAvg = (oldQty * oldAvg + qtyFinal * price) / newQty;
      await supabase.from("positions").update({ qty: newQty, avg_cost: newAvg }).eq("id", existingPos.id);
    } else {
      await supabase.from("positions").insert({
        game_id: gameId, user_id: user.id, symbol, qty: qtyFinal, avg_cost: price,
      });
    }

    await recordEquitySnapshot(supabase, gameId, user.id, newCash);
    const ccyLabel = getCurrencyForSymbol(symbol);
    return redirectToGame(request, gameId, `Achat : ${qtyFinal} ${symbol} @ ${price.toFixed(4)} ${ccyLabel} (${totalCHF.toFixed(2)} CHF, frais ${feeAmount.toFixed(2)} CHF).`, undefined, symbol);
  }

  // SELL market
  const { data: pos } = await supabase
    .from("positions")
    .select("id, qty")
    .eq("game_id", gameId)
    .eq("user_id", user.id)
    .eq("symbol", symbol)
    .single();

  if (!pos || Number(pos.qty) < qtyFinal) {
    return redirectToGame(request, gameId, undefined, "Position insuffisante.", symbol);
  }

  const creditCHF = totalCHF - feeAmount;
  await supabase.from("orders").insert({
    game_id: gameId, user_id: user.id, symbol, side: "sell",
    qty: qtyFinal, price, fee_amount: feeAmount,
  });

  const newCash = cash + creditCHF;
  await supabase.from("game_players").update({ cash: newCash }).eq("id", player.id);

  const newQty = Number(pos.qty) - qtyFinal;
  if (newQty <= 0) {
    await supabase.from("positions").delete().eq("id", pos.id);
  } else {
    await supabase.from("positions").update({ qty: newQty }).eq("id", pos.id);
  }

  await recordEquitySnapshot(supabase, gameId, user.id, newCash);
  const ccyLabel = getCurrencyForSymbol(symbol);
  return redirectToGame(request, gameId, `Vente : ${qtyFinal} ${symbol} @ ${price.toFixed(4)} ${ccyLabel} (${creditCHF.toFixed(2)} CHF, frais ${feeAmount.toFixed(2)} CHF).`, undefined, symbol);
}

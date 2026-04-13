import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { recordEquitySnapshot } from "@/lib/equity-snapshot";
import { getBidAsk } from "@/lib/bid-ask";
import { getExchangeForSymbol, isMarketOpen } from "@/lib/sectors";

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
    .select("status, ends_at, started_at, fee_bps, allow_fractional, min_order_amount, game_mode")
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
  const exchange = getExchangeForSymbol(symbol);
  const sessionOpen = isMarketOpen(exchange).open;

  const price = side === "buy" ? ask : bid;
  const totalUsd = qtyFinal * price;
  const feeAmount = Math.min(15, Math.round((totalUsd * feeBps) / 10000 * 100) / 100);

  // ═══════════════════════════════════════════════
  // Marché fermé → ordre au marché mis en attente (exécution à l’ouverture)
  // ═══════════════════════════════════════════════
  if (!sessionOpen) {
    if (side === "buy") {
      // Réserve = notionnel seul ; frais prélevés à l'exécution
      if (cash < totalUsd) {
        return redirectToGame(request, gameId, undefined, "Cash insuffisant pour cet ordre.", symbol);
      }
      const { error: poErr } = await supabase.from("pending_orders").insert({
        game_id: gameId,
        user_id: user.id,
        symbol,
        side: "buy",
        qty: qtyFinal,
        limit_price: ask,
        status: "open",
        market_deferred: true,
      });
      if (poErr) {
        console.error("[trade] pending buy:", poErr);
        return redirectToGame(request, gameId, undefined, "Impossible d'enregistrer l'ordre.", symbol);
      }
      const newCash = cash - totalUsd;
      await supabase.from("game_players").update({ cash: newCash }).eq("id", player.id);
      await recordEquitySnapshot(supabase, gameId, user.id, newCash);
      return redirectToGame(
        request,
        gameId,
        `Ordre en attente : achat ${qtyFinal} ${symbol} (${totalUsd.toFixed(2)} $ réservés, frais à l'exécution — ouverture ${exchange.name}).`,
        undefined,
        symbol
      );
    }

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

    const { error: poErr } = await supabase.from("pending_orders").insert({
      game_id: gameId,
      user_id: user.id,
      symbol,
      side: "sell",
      qty: qtyFinal,
      limit_price: bid,
      status: "open",
      market_deferred: true,
    });
    if (poErr) {
      console.error("[trade] pending sell:", poErr);
      return redirectToGame(request, gameId, undefined, "Impossible d'enregistrer l'ordre.", symbol);
    }

    const newQty = Number(pos.qty) - qtyFinal;
    if (newQty <= 0) {
      await supabase.from("positions").delete().eq("id", pos.id);
    } else {
      await supabase.from("positions").update({ qty: newQty }).eq("id", pos.id);
    }

    await recordEquitySnapshot(supabase, gameId, user.id, cash);
    return redirectToGame(
      request,
      gameId,
      `Ordre en attente : vente ${qtyFinal} ${symbol} (marché fermé — exécution à l'ouverture de ${exchange.name}).`,
      undefined,
      symbol
    );
  }

  // ═══════════════════════════════════════════════
  // Marché ouvert → exécution immédiate au bid/ask
  // ═══════════════════════════════════════════════

  if (side === "buy") {
    const totalWithFee = totalUsd + feeAmount;
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
    return redirectToGame(request, gameId, `Achat : ${qtyFinal} ${symbol} @ ${price.toFixed(4)} USD (${totalUsd.toFixed(2)} $, frais ${feeAmount.toFixed(2)} $).`, undefined, symbol);
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

  const creditUsd = totalUsd - feeAmount;
  await supabase.from("orders").insert({
    game_id: gameId, user_id: user.id, symbol, side: "sell",
    qty: qtyFinal, price, fee_amount: feeAmount,
  });

  const newCash = cash + creditUsd;
  await supabase.from("game_players").update({ cash: newCash }).eq("id", player.id);

  const newQty = Number(pos.qty) - qtyFinal;
  if (newQty <= 0) {
    await supabase.from("positions").delete().eq("id", pos.id);
  } else {
    await supabase.from("positions").update({ qty: newQty }).eq("id", pos.id);
  }

  await recordEquitySnapshot(supabase, gameId, user.id, newCash);
  return redirectToGame(request, gameId, `Vente : ${qtyFinal} ${symbol} @ ${price.toFixed(4)} USD (${creditUsd.toFixed(2)} $, frais ${feeAmount.toFixed(2)} $).`, undefined, symbol);
}

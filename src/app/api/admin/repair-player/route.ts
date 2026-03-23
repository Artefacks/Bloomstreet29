import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrencyForSymbol, getExchangeRateToCHF } from "@/lib/finnhub";

/**
 * POST /api/admin/repair-player
 * Répare le cash d'un joueur victime du bug de double déduction (ordres limite d'achat exécutés).
 * Le cash avait été déduit deux fois : à la création de l'ordre ET à l'exécution.
 * On rembourse le montant incorrectement déduit à l'exécution.
 *
 * Corps: { userId: "uuid" }
 * Auth: CRON_SECRET ou Bearer CRON_SECRET
 */
export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const expected = process.env.CRON_SECRET;

  if (!expected || (cronSecret ?? bearerSecret) !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "userId requis" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ ok: false, error: "Missing env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // Ordres limite d'achat exécutés : le cash a été déduit 2x (création + fill).
    // On rembourse (totalCHF + feeAmount) par ordre.
    const { data: filledBuyOrders, error: poErr } = await supabase
      .from("pending_orders")
      .select("game_id, symbol, qty, limit_price, fill_price, fee_amount")
      .eq("user_id", userId)
      .eq("side", "buy")
      .eq("status", "filled");

    if (poErr) {
      console.error("[repair-player] pending_orders:", poErr);
      return NextResponse.json({ ok: false, error: String(poErr.message) }, { status: 500 });
    }

    if (!filledBuyOrders || filledBuyOrders.length === 0) {
      return NextResponse.json({
        ok: true,
        repaired: 0,
        message: "Aucun ordre limite d'achat exécuté trouvé pour ce joueur.",
      });
    }

    // Grouper par game_id et sommer les remboursements
    const refundByGame = new Map<string, number>();
    for (const o of filledBuyOrders) {
      const fillPrice = Number(o.fill_price ?? o.limit_price ?? 0);
      const qty = Number(o.qty);
      const feeAmount = Number(o.fee_amount ?? 0);
      const fxRate = getExchangeRateToCHF(getCurrencyForSymbol(o.symbol));
      const totalCHF = qty * fillPrice * fxRate;
      const toRefund = totalCHF + feeAmount;
      refundByGame.set(o.game_id, (refundByGame.get(o.game_id) ?? 0) + toRefund);
    }

    let repaired = 0;
    for (const [gameId, refund] of refundByGame) {
      const { data: player, error: gpErr } = await supabase
        .from("game_players")
        .select("id, cash")
        .eq("game_id", gameId)
        .eq("user_id", userId)
        .single();

      if (gpErr || !player) {
        console.warn(`[repair-player] game_players not found for game ${gameId}`);
        continue;
      }

      const currentCash = Number(player.cash);
      const newCash = currentCash + refund;

      const { error: updateErr } = await supabase
        .from("game_players")
        .update({ cash: newCash })
        .eq("id", player.id);

      if (updateErr) {
        console.error(`[repair-player] update game_players:`, updateErr);
        continue;
      }

      repaired++;
    }

    return NextResponse.json({
      ok: true,
      repaired,
      refundByGame: Object.fromEntries(
        [...refundByGame.entries()].map(([k, v]) => [k, { refund: v }])
      ),
      message: `Remboursé ${repaired} partie(s) pour le joueur ${userId}.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[repair-player]", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

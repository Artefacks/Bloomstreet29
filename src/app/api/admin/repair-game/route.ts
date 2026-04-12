import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/admin/repair-game
 * Répare le cash de tous les joueurs affectés dans une partie
 * (bug de double déduction sur ordres limite d'achat exécutés).
 *
 * Corps: { gameId: string }
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

  let body: { gameId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const gameId = typeof body.gameId === "string" ? body.gameId.trim() : "";
  if (!gameId) {
    return NextResponse.json({ error: "gameId requis" }, { status: 400 });
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
    const { data: filledBuyOrders, error: poErr } = await supabase
      .from("pending_orders")
      .select("user_id, symbol, qty, limit_price, fill_price, fee_amount")
      .eq("game_id", gameId)
      .eq("side", "buy")
      .eq("status", "filled");

    if (poErr) {
      console.error("[repair-game] pending_orders:", poErr);
      return NextResponse.json({ ok: false, error: String(poErr.message) }, { status: 500 });
    }

    if (!filledBuyOrders || filledBuyOrders.length === 0) {
      return NextResponse.json({
        ok: true,
        repaired: 0,
        refundByUser: {},
        message: "Aucun ordre limite d'achat exécuté trouvé pour cette partie.",
      });
    }

    const refundByUser = new Map<string, number>();
    for (const o of filledBuyOrders) {
      const fillPrice = Number(o.fill_price ?? o.limit_price ?? 0);
      const qty = Number(o.qty);
      const feeAmount = Number(o.fee_amount ?? 0);
      const totalUsd = qty * fillPrice;
      const toRefund = totalUsd + feeAmount;
      refundByUser.set(o.user_id, (refundByUser.get(o.user_id) ?? 0) + toRefund);
    }

    const results: Record<string, { refund: number; cashBefore: number; cashAfter: number }> = {};
    let repaired = 0;

    for (const [userId, refund] of refundByUser) {
      const { data: player, error: gpErr } = await supabase
        .from("game_players")
        .select("id, cash")
        .eq("game_id", gameId)
        .eq("user_id", userId)
        .single();

      if (gpErr || !player) {
        console.warn(`[repair-game] game_players not found for user ${userId}`);
        continue;
      }

      const currentCash = Number(player.cash);
      const newCash = currentCash + refund;

      const { error: updateErr } = await supabase
        .from("game_players")
        .update({ cash: newCash })
        .eq("id", player.id);

      if (updateErr) {
        console.error(`[repair-game] update game_players:`, updateErr);
        continue;
      }

      results[userId] = { refund, cashBefore: currentCash, cashAfter: newCash };
      repaired++;
    }

    return NextResponse.json({
      ok: true,
      repaired,
      refundByUser: results,
      message: `Remboursé ${repaired} joueur(s) dans la partie ${gameId}.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[repair-game]", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

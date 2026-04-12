/**
 * Script pour réparer le cash d'un joueur victime du bug de double déduction.
 *
 * Usage: npx ts-node scripts/repair-player.ts <userId>
 * ou: npx tsx scripts/repair-player.ts d2083f07-e290-4e2c-91fe-46a835144432
 *
 * Nécessite .env.local avec SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 */
import { createClient } from "@supabase/supabase-js";

const userId = process.argv[2] || "d2083f07-e290-4e2c-91fe-46a835144432";

async function main() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    console.error(
      "Variables d'environnement requises: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL"
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: filledBuyOrders, error: poErr } = await supabase
    .from("pending_orders")
    .select("game_id, symbol, qty, limit_price, fill_price, fee_amount")
    .eq("user_id", userId)
    .eq("side", "buy")
    .eq("status", "filled");

  if (poErr) {
    console.error("Erreur pending_orders:", poErr);
    process.exit(1);
  }

  if (!filledBuyOrders || filledBuyOrders.length === 0) {
    console.log("Aucun ordre limite d'achat exécuté trouvé pour ce joueur.");
    return;
  }

  const refundByGame = new Map<string, number>();
  for (const o of filledBuyOrders) {
    const fillPrice = Number(o.fill_price ?? o.limit_price ?? 0);
    const qty = Number(o.qty);
    const feeAmount = Number(o.fee_amount ?? 0);
    const totalUsd = qty * fillPrice;
    const toRefund = totalUsd + feeAmount;
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
      console.warn(`game_players non trouvé pour game ${gameId}`);
      continue;
    }

    const currentCash = Number(player.cash);
    const newCash = currentCash + refund;

    const { error: updateErr } = await supabase
      .from("game_players")
      .update({ cash: newCash })
      .eq("id", player.id);

    if (updateErr) {
      console.error(`Erreur update game_players:`, updateErr);
      continue;
    }

    console.log(
      `Game ${gameId}: cash ${currentCash.toFixed(2)} -> ${newCash.toFixed(2)} (+${refund.toFixed(2)} USD)`
    );
    repaired++;
  }

  console.log(`\nRemboursé ${repaired} partie(s) pour le joueur ${userId}.`);
}

main();

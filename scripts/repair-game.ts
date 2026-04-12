/**
 * Script pour réparer le cash de tous les joueurs affectés dans une partie
 * (bug de double déduction sur ordres limite d'achat exécutés).
 *
 * Usage: npx tsx scripts/repair-game.ts <gameId>
 *       npx tsx scripts/repair-game.ts <gameId> --dry-run
 *
 * Nécessite .env.local avec SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 */
import { createClient } from "@supabase/supabase-js";

const gameId = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

async function main() {
  if (!gameId) {
    console.error("Usage: npx tsx scripts/repair-game.ts <gameId> [--dry-run]");
    process.exit(1);
  }

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
    .select("user_id, symbol, qty, limit_price, fill_price, fee_amount")
    .eq("game_id", gameId)
    .eq("side", "buy")
    .eq("status", "filled");

  if (poErr) {
    console.error("Erreur pending_orders:", poErr);
    process.exit(1);
  }

  if (!filledBuyOrders || filledBuyOrders.length === 0) {
    console.log(
      "Aucun ordre limite d'achat exécuté trouvé pour cette partie."
    );
    return;
  }

  // Grouper par user_id et sommer les remboursements
  const refundByUser = new Map<string, number>();
  for (const o of filledBuyOrders) {
    const fillPrice = Number(o.fill_price ?? o.limit_price ?? 0);
    const qty = Number(o.qty);
    const feeAmount = Number(o.fee_amount ?? 0);
    const totalUsd = qty * fillPrice;
    const toRefund = totalUsd + feeAmount;
    refundByUser.set(
      o.user_id,
      (refundByUser.get(o.user_id) ?? 0) + toRefund
    );
  }

  if (dryRun) {
    console.log(`[DRY-RUN] Partie ${gameId}`);
    console.log(`${refundByUser.size} joueur(s) seraient remboursés :\n`);
    for (const [userId, refund] of refundByUser) {
      const { data: player } = await supabase
        .from("game_players")
        .select("id, cash, display_name")
        .eq("game_id", gameId)
        .eq("user_id", userId)
        .single();
      const currentCash = player ? Number(player.cash) : 0;
      const newCash = currentCash + refund;
      const name = (player as { display_name?: string } | null)?.display_name ?? userId.slice(0, 8);
      console.log(
        `  ${name}: ${currentCash.toFixed(2)} -> ${newCash.toFixed(2)} USD (+${refund.toFixed(2)})`
      );
    }
    console.log("\nExécutez sans --dry-run pour appliquer les modifications.");
    return;
  }

  let repaired = 0;
  for (const [userId, refund] of refundByUser) {
    const { data: player, error: gpErr } = await supabase
      .from("game_players")
      .select("id, cash, display_name")
      .eq("game_id", gameId)
      .eq("user_id", userId)
      .single();

    if (gpErr || !player) {
      console.warn(`game_players non trouvé pour user ${userId}`);
      continue;
    }

    const currentCash = Number(player.cash);
    const newCash = currentCash + refund;
    const name = (player as { display_name?: string }).display_name ?? userId.slice(0, 8);

    const { error: updateErr } = await supabase
      .from("game_players")
      .update({ cash: newCash })
      .eq("id", player.id);

    if (updateErr) {
      console.error(`Erreur update game_players pour ${name}:`, updateErr);
      continue;
    }

    console.log(
      `${name}: cash ${currentCash.toFixed(2)} -> ${newCash.toFixed(2)} USD (+${refund.toFixed(2)})`
    );
    repaired++;
  }

  console.log(
    `\nRemboursé ${repaired} joueur(s) dans la partie ${gameId}.`
  );
}

main();

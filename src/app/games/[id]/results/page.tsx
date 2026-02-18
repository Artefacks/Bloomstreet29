import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameState } from "@/lib/game-state";
import { redirect } from "next/navigation";

type TradePnl = {
  orderId: string;
  symbol: string;
  side: string;
  qty: number;
  price: number;
  endPrice: number;
  pnl: number;
  created_at: string;
};

export default async function GameResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: gameId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.rpc("finalize_game", { p_game_id: gameId });

  const state = await getGameState(supabase, gameId, user.id);

  if (!state.game || !state.isMember) {
    redirect(`/games/${gameId}`);
  }

  if (state.game.status !== "finished") {
    redirect(`/games/${gameId}`);
  }

  const { data: endPricesRows } = await supabase
    .from("game_end_prices")
    .select("symbol, price")
    .eq("game_id", gameId);

  const endPriceMap = new Map<string, number>();
  endPricesRows?.forEach((r) => endPriceMap.set(r.symbol, Number(r.price)));

  const buyOrders = state.orders.filter((o) => o.side === "buy");
  const tradesWithPnl: TradePnl[] = buyOrders.map((o) => {
    const endPrice = endPriceMap.get(o.symbol);
    const pnl = endPrice != null ? o.qty * (endPrice - o.price) : 0;
    return {
      orderId: o.id,
      symbol: o.symbol,
      side: o.side,
      qty: o.qty,
      price: o.price,
      endPrice: endPrice ?? o.price,
      pnl,
      created_at: o.created_at,
    };
  });

  const sortedByPnl = [...tradesWithPnl].sort((a, b) => b.pnl - a.pnl);
  const topTrade = sortedByPnl[0] ?? null;
  const worstTrade = sortedByPnl[sortedByPnl.length - 1] ?? null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Fin de partie — {state.game.join_code}</h1>
          <Link href={`/games/${gameId}`} className="text-blue-600 hover:underline text-sm">
            Retour à la partie
          </Link>
        </div>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Classement final</h2>
          <ol className="bg-white border rounded-lg divide-y list-decimal list-inside">
            {state.leaderboard.map((entry, idx) => (
              <li key={entry.user_id} className="px-4 py-3 flex justify-between items-center">
                <span>
                  {idx + 1}. {entry.user_id === user.id ? "Toi" : (entry.displayName ?? "Joueur " + entry.user_id.slice(0, 8))}
                </span>
                <span className="flex items-center gap-4">
                  <span className="text-sm font-mono">
                    {entry.totalValue.toLocaleString("fr-FR")}
                  </span>
                  <span className={`text-sm font-medium ${entry.pnlPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {entry.pnlPct >= 0 ? "+" : ""}{entry.pnlPct.toFixed(2)} %
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Ta performance</h2>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-gray-600">Valorisation finale : <span className="font-mono font-semibold">{state.myTotalValue != null ? state.myTotalValue.toLocaleString("fr-FR") : "—"}</span></p>
            {state.myPnl != null && state.myPnlPct != null && (
              <p className={state.myPnl >= 0 ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
                P&L : {state.myPnl >= 0 ? "+" : ""}{state.myPnl.toLocaleString("fr-FR")} ({state.myPnlPct >= 0 ? "+" : ""}{state.myPnlPct.toFixed(2)} %)
              </p>
            )}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Top trade / Pire trade</h2>
          <p className="text-sm text-gray-500 mb-2">Variation prix entre achat et clôture.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {topTrade ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-800 mb-1">Meilleur trade</h3>
                <p className="text-sm">Achat {topTrade.qty} {topTrade.symbol} à {topTrade.price.toFixed(2)}</p>
                <p className="text-sm text-gray-600">Prix de clôture : {topTrade.endPrice.toFixed(2)}</p>
                <p className="font-mono font-semibold text-green-700">+{topTrade.pnl.toLocaleString("fr-FR")}</p>
              </div>
            ) : (
              <div className="bg-gray-50 border rounded-lg p-4">
                <h3 className="font-medium text-gray-600 mb-1">Meilleur trade</h3>
                <p className="text-sm text-gray-500">Aucun achat enregistré.</p>
              </div>
            )}
            {worstTrade && worstTrade.orderId !== topTrade?.orderId ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-medium text-red-800 mb-1">Pire trade</h3>
                <p className="text-sm">Achat {worstTrade.qty} {worstTrade.symbol} à {worstTrade.price.toFixed(2)}</p>
                <p className="text-sm text-gray-600">Prix de clôture : {worstTrade.endPrice.toFixed(2)}</p>
                <p className="font-mono font-semibold text-red-700">{worstTrade.pnl.toLocaleString("fr-FR")}</p>
              </div>
            ) : (
              <div className="bg-gray-50 border rounded-lg p-4">
                <h3 className="font-medium text-gray-600 mb-1">Pire trade</h3>
                <p className="text-sm text-gray-500">Aucun autre trade.</p>
              </div>
            )}
          </div>
        </section>

        <p className="text-center">
          <Link href="/" className="text-blue-600 hover:underline">Retour à l&apos;accueil</Link>
        </p>
      </div>
    </div>
  );
}

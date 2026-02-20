import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameState } from "@/lib/game-state";
import { getCurrencyForSymbol, formatCurrency } from "@/lib/finnhub";
import { redirect } from "next/navigation";
import { MarketSection } from "./MarketSection";
import { EquityChart } from "./EquityChart";
import { PositionsCard } from "./PositionsCard";
import { PortfolioSection } from "./PortfolioSection";

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { id: gameId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const state = await getGameState(supabase, gameId, user.id);

  if (!state.game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="max-w-md mx-auto text-center px-4">
          <p className="text-red-600 font-medium">Partie introuvable.</p>
          <Link href="/" className="text-blue-600 hover:underline mt-2 inline-block">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  if (!state.isMember) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="max-w-md mx-auto text-center px-4">
          <p className="text-red-600 font-medium">Pas membre / acces refuse.</p>
          <Link href="/" className="text-blue-600 hover:underline mt-2 inline-block">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  const urlParams = await searchParams as { success?: string; error?: string; symbol?: string };
  const success = urlParams.success;
  const error = urlParams.error;
  const endDate = state.game.ends_at
    ? new Date(state.game.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const openPendingOrders = state.pendingOrders.filter((o) => o.status === "open");

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-slate-800 text-slate-100 px-4 py-3 shadow">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-5">
            <Link href="/" className="text-lg font-semibold tracking-tight text-white hover:text-slate-200">
              Bloomstreet29
            </Link>
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <span>
                Code : <strong className="font-mono text-white">{state.game.join_code}</strong>
              </span>
              {state.game.status === "finished" ? (
                <span className="px-2 py-0.5 rounded bg-slate-600 text-[10px]">Terminee</span>
              ) : endDate ? (
                <span>Fin : {endDate}</span>
              ) : null}
              {state.game.fee_bps > 0 && (
                <span className="text-slate-400">Frais : {(state.game.fee_bps / 100).toFixed(2)}%</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {state.game.status === "finished" && (
              <Link
                href={`/games/${gameId}/results`}
                className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded hover:bg-amber-500"
              >
                Resultats
              </Link>
            )}
            <Link href="/" className="text-xs text-slate-300 hover:text-white">
              Accueil
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* Alerts */}
        {success && (
          <div className="p-3 bg-green-100 text-green-800 rounded-lg text-sm border border-green-200">
            {success}
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-100 text-red-800 rounded-lg text-sm border border-red-200">
            {error}
          </div>
        )}

        {/* ═══ TOP: Market section (full width, the star of the show) ═══ */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5" id="market-section">
          <MarketSection
            gameId={gameId}
            instruments={state.instruments}
            myPositions={state.myPositions}
            myCash={state.myCash ?? 0}
            feeBps={state.game.fee_bps}
            gameEnded={state.game.status === "finished"}
            allowFractional={state.game.allow_fractional}
            symbolFromUrl={urlParams.symbol}
            pendingOrders={state.pendingOrders}
          />
        </section>

        {/* ═══ MIDDLE: 3-column layout ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

          {/* Col 1: Cash + Performance + Equity chart */}
          <div className="space-y-4">
            {/* Cash + Perf combined */}
            <PortfolioSection
              gameId={gameId}
              initialCash={state.game.initial_cash}
              myCash={state.myCash ?? 0}
              positions={state.myPositions}
              pendingOrders={state.pendingOrders.filter((o) => o.status === "open")}
              currencyMap={Object.fromEntries(
                state.instruments.map((i) => [i.symbol, i.currency])
              )}
              feeBps={state.game.fee_bps}
            />
          </div>

          {/* Col 2: Classement */}
          <div>
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h2 className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">
                Classement
              </h2>
              <ol className="space-y-1.5">
                {state.leaderboard.map((entry, idx) => (
                  <li
                    key={entry.user_id}
                    className={`flex justify-between items-center py-1.5 px-2.5 rounded-lg text-sm ${
                      entry.user_id === user.id ? "bg-teal-50 border border-teal-100" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                        idx === 0 ? "bg-amber-100 text-amber-700" : idx === 1 ? "bg-slate-200 text-slate-600" : idx === 2 ? "bg-orange-100 text-orange-600" : "text-slate-400"
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-medium text-slate-800 text-sm">
                        {entry.user_id === user.id ? "Toi" : (entry.displayName ?? "Joueur")}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="font-mono font-semibold text-slate-900 text-sm">
                        {entry.totalValue.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} CHF
                      </span>
                      <span className={`block text-[10px] font-mono ${entry.pnlPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {(entry.pnlPct >= 0 ? "+" : "") + entry.pnlPct.toFixed(1)}%
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Col 3: Positions + Pending orders */}
          <div className="space-y-4">
            {/* Positions with live P&L */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h2 className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">
                Positions ({state.myPositions.length})
              </h2>
              <PositionsCard
                gameId={gameId}
                positions={state.myPositions}
                symbols={state.myPositions.map((p) => p.symbol)}
                initialPrices={Object.fromEntries(
                  state.instruments.map((i) => [i.symbol, i.price])
                )}
                currencyMap={Object.fromEntries(
                  state.instruments.map((i) => [i.symbol, i.currency])
                )}
                fxRates={{ CHF: 1, USD: 0.88, EUR: 0.94, SEK: 0.083 }}
              />
            </section>

            {/* Pending orders */}
            {openPendingOrders.length > 0 && (
              <section className="bg-white rounded-xl shadow-sm border border-amber-200 p-4">
                <h2 className="text-[10px] font-medium text-amber-600 uppercase tracking-wide mb-2">
                  Ordres en attente ({openPendingOrders.length})
                </h2>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {openPendingOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between py-1 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold ${o.side === "buy" ? "text-green-600" : "text-red-600"}`}>
                          {o.side === "buy" ? "ACH" : "VEN"}
                        </span>
                        <Link
                          href={`/games/${gameId}?symbol=${encodeURIComponent(o.symbol)}`}
                          className="font-mono font-medium text-slate-800 hover:text-teal-600 hover:underline"
                        >
                          {o.symbol}
                        </Link>
                        <span className="text-slate-400 text-xs">x{o.qty}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">
                          @ {o.limit_price.toFixed(2)} {formatCurrency(getCurrencyForSymbol(o.symbol))}
                        </span>
                        <form method="POST" action="/api/trade/cancel" className="inline">
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="gameId" value={gameId} />
                          <button
                            type="submit"
                            className="text-[10px] text-red-500 hover:text-red-700 hover:underline"
                          >
                            &times;
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* ═══ BOTTOM: Orders history (collapsible) ═══ */}
        <details className="bg-white rounded-xl shadow-sm border border-slate-200">
          <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl select-none">
            Historique des ordres ({state.orders.length})
          </summary>
          <div className="px-5 pb-4">
            {state.orders.length === 0 ? (
              <p className="text-slate-400 text-sm py-2">Aucun ordre.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Symbole</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Qte</th>
                      <th className="pb-2 font-medium">Prix</th>
                      <th className="pb-2 font-medium">Frais</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.orders.map((o) => (
                      <tr key={o.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 text-xs text-slate-500">
                          {new Date(o.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2 font-mono text-xs">{o.symbol}</td>
                        <td className="py-2">
                          <span className={`text-xs ${o.side === "buy" ? "text-green-600" : "text-red-600"}`}>
                            {o.side === "buy" ? "Achat" : "Vente"}
                          </span>
                        </td>
                        <td className="py-2 text-xs">{o.qty}</td>
                        <td className="py-2 font-mono text-xs">{o.price.toFixed(2)} {formatCurrency(getCurrencyForSymbol(o.symbol))}</td>
                        <td className="py-2 font-mono text-xs text-slate-400">{o.fee_amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      </main>
    </div>
  );
}

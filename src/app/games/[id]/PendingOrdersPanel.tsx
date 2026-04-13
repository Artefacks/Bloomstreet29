"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export type PendingOrderRow = {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  limit_price: number;
  created_at: string;
  market_deferred: boolean;
};

const MATCH_INTERVAL_MS = 15_000;

function fmtQty(q: number) {
  return q % 1 === 0 ? String(q) : q.toFixed(2);
}

export function PendingOrdersPanel({
  gameId,
  orders,
  gameEnded,
}: {
  gameId: string;
  orders: PendingOrderRow[];
  gameEnded: boolean;
}) {
  const router = useRouter();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (gameEnded || orders.length === 0) return;

    const runMatch = async () => {
      try {
        const res = await fetch(`/api/games/${gameId}/match-pending`, { method: "POST" });
        const data = (await res.json()) as { ok?: boolean; filled?: number };
        if (!mounted.current) return;
        if (data.ok && (data.filled ?? 0) > 0) {
          router.refresh();
          window.dispatchEvent(new CustomEvent("bloomstreet:prices-refreshed"));
        }
      } catch {
        // ignore
      }
    };

    runMatch();
    const iv = setInterval(runMatch, MATCH_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [gameId, gameEnded, orders.length, router]);

  if (orders.length === 0) {
    return null;
  }

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h2 className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-3">
        Ordres en attente ({orders.length})
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="pb-2 font-medium">Date</th>
              <th className="pb-2 font-medium">Symbole</th>
              <th className="pb-2 font-medium">Sens</th>
              <th className="pb-2 font-medium">Qté</th>
              <th className="pb-2 font-medium">Prix réf.</th>
              <th className="pb-2 font-medium text-right">Total</th>
              <th className="pb-2 font-medium">Type</th>
              {!gameEnded && <th className="pb-2 font-medium w-24" />}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 text-xs text-slate-500">
                  {new Date(o.created_at).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-2 font-mono text-xs font-medium text-slate-800">{o.symbol}</td>
                <td className="py-2">
                  <span className={`text-xs font-medium ${o.side === "buy" ? "text-green-600" : "text-red-600"}`}>
                    {o.side === "buy" ? "Achat" : "Vente"}
                  </span>
                </td>
                <td className="py-2 font-mono text-xs">{fmtQty(o.qty)}</td>
                <td className="py-2 font-mono text-xs">{o.limit_price.toFixed(4)} $</td>
                <td className="py-2 font-mono text-xs text-right">
                  {(o.qty * o.limit_price).toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  $
                </td>
                <td className="py-2 text-xs text-slate-600">
                  {o.market_deferred ? (
                    <span className="inline-flex items-center rounded bg-amber-50 text-amber-800 px-1.5 py-0.5 text-[10px] font-medium border border-amber-200">
                      Au marché (ouverture)
                    </span>
                  ) : (
                    <span className="text-slate-500">Limite</span>
                  )}
                </td>
                {!gameEnded && (
                  <td className="py-2 text-right">
                    <form action="/api/trade/cancel" method="POST" className="inline">
                      <input type="hidden" name="gameId" value={gameId} />
                      <input type="hidden" name="orderId" value={o.id} />
                      <button
                        type="submit"
                        className="text-[10px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                      >
                        Annuler
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-400 mt-2">
        Achat en attente : montant réservé (hors frais). Les frais sont prélevés à l&apos;exécution.
      </p>
    </section>
  );
}

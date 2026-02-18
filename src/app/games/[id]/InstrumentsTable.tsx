"use client";

import { useState } from "react";
import { GameTradeForm } from "./GameTradeForm";
import { LivePrices } from "./LivePrices";

type Instrument = {
  symbol: string;
  name: string | null;
  price: number | null;
  currency?: string;
};

type Position = {
  symbol: string;
  qty: number;
  avg_cost: number;
};

export function InstrumentsTable({
  gameId,
  instruments: initialInstruments,
  myPositions,
  myCash = 0,
  feeBps = 0,
  gameEnded,
  allowFractional,
}: {
  gameId: string;
  instruments: Instrument[];
  myPositions: Position[];
  myCash?: number;
  feeBps?: number;
  gameEnded: boolean;
  allowFractional: boolean;
}) {
  const [instruments, setInstruments] = useState<Instrument[]>(initialInstruments);

  const handlePricesUpdate = (prices: Record<string, number | null>) => {
    setInstruments((prev) =>
      prev.map((inst) => ({
        ...inst,
        price: prices[inst.symbol] ?? inst.price,
      }))
    );
  };

  const symbols = instruments.map((i) => i.symbol);
  const initialPrices: Record<string, number | null> = {};
  instruments.forEach((inst) => {
    initialPrices[inst.symbol] = inst.price;
  });

  return (
    <section className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">Instruments (achat / vente)</h2>
        <LivePrices
          symbols={symbols}
          initialPrices={initialPrices}
          onPricesUpdate={handlePricesUpdate}
          refreshInterval={10000}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full bg-white border rounded-lg">
          <thead>
            <tr className="border-b text-left">
              <th className="px-4 py-2">Symbole</th>
              <th className="px-4 py-2">Nom</th>
              <th className="px-4 py-2">Prix actuel</th>
              <th className="px-4 py-2">Quantité / Actions</th>
            </tr>
          </thead>
          <tbody>
            {instruments.map((inst) => {
              const position = myPositions.find((p) => p.symbol === inst.symbol);
              return (
                <tr key={inst.symbol} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono">{inst.symbol}</td>
                  <td className="px-4 py-2">{inst.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    {inst.price != null ? (
                      <span className="font-mono">{inst.price.toFixed(2)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <GameTradeForm
                      gameId={gameId}
                      symbol={inst.symbol}
                      price={inst.price}
                      currency={inst.currency ?? "USD"}
                      hasPosition={!!position}
                      positionQty={position?.qty ?? 0}
                      avgCost={position?.avg_cost ?? 0}
                      myCash={myCash}
                      feeBps={feeBps}
                      gameEnded={gameEnded}
                      allowFractional={allowFractional}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {instruments.length === 0 && (
        <p className="text-gray-500 py-2">Aucun instrument. Exécutez le seed SQL.</p>
      )}
    </section>
  );
}

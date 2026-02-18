"use client";

import { useState, useMemo, useEffect } from "react";

/* ──── PRNG helpers ──── */

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ──── Dynamic order book (changes every ~5 seconds) ──── */

type BookLevel = { price: number; qty: number };
type OrderBook = { bids: BookLevel[]; asks: BookLevel[]; spread: number; spreadPct: number };

function generateOrderBook(symbol: string, midPrice: number, tick: number): OrderBook {
  // tick changes every ~5s → book updates live
  const seed = hashSeed(`${symbol}:${Math.floor(midPrice * 100)}:${tick}`);
  const rng = mulberry32(seed);

  const spreadPct = 0.0003 + rng() * 0.0012;
  const halfSpread = midPrice * spreadPct * 0.5;
  const bestBid = midPrice - halfSpread;
  const bestAsk = midPrice + halfSpread;

  const bids: BookLevel[] = [];
  const asks: BookLevel[] = [];

  let bidCursor = bestBid;
  let askCursor = bestAsk;

  for (let i = 0; i < 5; i++) {
    const bidStep = i === 0 ? 0 : (rng() * 0.0008 + 0.0001) * midPrice;
    const askStep = i === 0 ? 0 : (rng() * 0.0008 + 0.0001) * midPrice;

    bids.push({ price: r4(bidCursor), qty: Math.floor(20 + rng() * 800) });
    asks.push({ price: r4(askCursor), qty: Math.floor(20 + rng() * 800) });

    bidCursor -= bidStep;
    askCursor += askStep;
  }

  return { bids, asks, spread: r4(bestAsk - bestBid), spreadPct: spreadPct * 100 };
}

function r4(n: number) { return Math.round(n * 10000) / 10000; }
function r2(n: number) { return Math.round(n * 100) / 100; }

function fmt(n: number, d = 2) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function ccy(c: string) {
  return c === "CHF" ? "CHF" : c === "EUR" ? "€" : c === "USD" ? "$" : c === "SEK" ? "kr" : c;
}

/* ──── Component ──── */

type OrderType = "market" | "limit";

type Props = {
  gameId: string;
  symbol: string;
  price: number | null;
  currency: string;
  hasPosition: boolean;
  positionQty: number;
  avgCost: number;
  myCash: number;
  feeBps: number;
  gameEnded?: boolean;
  allowFractional?: boolean;
  fxRate?: number; // currency → CHF rate
};

export function GameTradeForm({
  gameId, symbol, price, currency, hasPosition, positionQty, avgCost,
  myCash, feeBps, gameEnded = false, allowFractional = true, fxRate = 1,
}: Props) {
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [qty, setQty] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [tick, setTick] = useState(0);

  const c = ccy(currency);

  // Tick every 5s for dynamic order book
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(iv);
  }, []);

  // Order book
  const book = useMemo(() => {
    if (price == null || price <= 0) return null;
    return generateOrderBook(symbol, price, tick);
  }, [symbol, price, tick]);

  const bestBid = book?.bids[0]?.price ?? price ?? 0;
  const bestAsk = book?.asks[0]?.price ?? price ?? 0;

  // Execution price
  const execPrice = useMemo(() => {
    if (orderType === "limit") {
      const lp = parseFloat(limitPrice);
      return isFinite(lp) && lp > 0 ? lp : null;
    }
    return side === "buy" ? bestAsk : bestBid;
  }, [orderType, limitPrice, side, bestAsk, bestBid]);

  const qtyNum = parseFloat(qty) || 0;
  const qtyFinal = allowFractional ? qtyNum : Math.floor(qtyNum);

  // Preview (costs converted to CHF for cash impact)
  const preview = useMemo(() => {
    if (!execPrice || qtyFinal <= 0) return null;
    const sub = qtyFinal * execPrice; // in instrument currency
    const subCHF = r2(sub * fxRate);
    const fee = Math.min(15, r2((subCHF * feeBps) / 10000));
    const totalCHF = side === "buy" ? r2(subCHF + fee) : r2(subCHF - fee);
    const newCash = side === "buy" ? r2(myCash - subCHF - fee) : r2(myCash + subCHF - fee);
    return { sub: r2(sub), subCHF, fee, totalCHF, newCash };
  }, [execPrice, qtyFinal, feeBps, side, myCash, fxRate]);

  const canBuy = preview != null && preview.newCash >= 0 && qtyFinal > 0;
  const canSell = preview != null && qtyFinal > 0 && qtyFinal <= positionQty;

  const setMaxBuy = () => {
    if (!execPrice || execPrice <= 0) return;
    const costPerUnitCHF = execPrice * fxRate;
    const feeM = 1 + feeBps / 10000;
    const max = Math.floor((myCash / (costPerUnitCHF * feeM)) * 100) / 100;
    setQty(allowFractional ? max.toFixed(2) : Math.floor(max).toString());
  };

  if (price == null || price <= 0) {
    return <p className="text-sm text-slate-400">Prix indisponible.</p>;
  }

  return (
    <div className="space-y-3">
      {/* ──── Order book ──── */}
      {book && (
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div>
            <p className="text-[10px] uppercase font-sans font-medium text-green-700 mb-1">Bid (Achat)</p>
            {book.bids.map((b, i) => (
              <div key={i} className="flex justify-between py-0.5 px-1.5 rounded transition-all duration-500"
                style={{ background: `rgba(22,163,74,${0.15 - i * 0.025})` }}>
                <span className="text-green-800">{fmt(b.price, 4)}</span>
                <span className="text-slate-500">{b.qty}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[10px] uppercase font-sans font-medium text-red-700 mb-1">Ask (Vente)</p>
            {book.asks.map((a, i) => (
              <div key={i} className="flex justify-between py-0.5 px-1.5 rounded transition-all duration-500"
                style={{ background: `rgba(220,38,38,${0.15 - i * 0.025})` }}>
                <span className="text-red-800">{fmt(a.price, 4)}</span>
                <span className="text-slate-500">{a.qty}</span>
              </div>
            ))}
          </div>
          <div className="col-span-2 text-center text-[10px] text-slate-500">
            Spread : {fmt(book.spread, 4)} {c} ({book.spreadPct.toFixed(3)}%)
          </div>
        </div>
      )}

      {/* ──── Side ──── */}
      <div className="flex rounded-lg overflow-hidden border border-slate-200">
        <button type="button" onClick={() => setSide("buy")}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${side === "buy" ? "bg-green-600 text-white" : "bg-white text-slate-600 hover:bg-green-50"}`}>
          Acheter
        </button>
        <button type="button" onClick={() => setSide("sell")}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${side === "sell" ? "bg-red-600 text-white" : "bg-white text-slate-600 hover:bg-red-50"}`}
          disabled={!hasPosition || positionQty <= 0}>
          Vendre
        </button>
      </div>

      {/* ──── Order type ──── */}
      <div className="flex gap-3">
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input type="radio" checked={orderType === "market"} onChange={() => setOrderType("market")} className="accent-teal-600" />
          Ordre au marché
        </label>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input type="radio" checked={orderType === "limit"} onChange={() => {
            setOrderType("limit");
            setLimitPrice(r4((bestBid + bestAsk) / 2).toFixed(4));
          }} className="accent-teal-600" />
          Ordre limite
        </label>
      </div>

      {/* ──── Limit price ──── */}
      {orderType === "limit" && (
        <div>
          <label className="text-xs text-slate-500 block mb-1">Prix limite ({c})</label>
          <input type="number" step="0.0001" min="0.01" value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            placeholder={r4((bestBid + bestAsk) / 2).toFixed(4)} />
          {execPrice != null && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              {side === "buy"
                ? execPrice >= bestAsk
                  ? "Exécution immédiate (limite ≥ ask)"
                  : `En attente — exécuté quand le ask descend à ${fmt(execPrice, 4)}`
                : execPrice <= bestBid
                  ? "Exécution immédiate (limite ≤ bid)"
                  : `En attente — exécuté quand le bid monte à ${fmt(execPrice, 4)}`}
            </p>
          )}
        </div>
      )}

      {/* ──── Quantity ──── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-slate-500">Quantité</label>
          <div className="flex gap-1">
            {side === "buy" && (
              <button type="button" onClick={setMaxBuy} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">MAX</button>
            )}
            {side === "sell" && hasPosition && (
              <>
                <button type="button" onClick={() => setQty(allowFractional ? (positionQty * 0.25).toFixed(2) : Math.floor(positionQty * 0.25).toString())} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">25%</button>
                <button type="button" onClick={() => setQty(allowFractional ? (positionQty * 0.5).toFixed(2) : Math.floor(positionQty * 0.5).toString())} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">50%</button>
                <button type="button" onClick={() => setQty(allowFractional ? positionQty.toFixed(2) : Math.floor(positionQty).toString())} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">100%</button>
              </>
            )}
          </div>
        </div>
        <input type="number" min={allowFractional ? 0.01 : 1} step={allowFractional ? 0.01 : 1}
          value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Quantité"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          disabled={gameEnded} />
        {side === "sell" && hasPosition && (
          <p className="text-[11px] text-slate-400 mt-0.5">Position : {fmt(positionQty)} @ {fmt(avgCost)} {c}</p>
        )}
      </div>

      {/* ──── Preview ──── */}
      {preview && qtyFinal > 0 && (
        <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1 border border-slate-200">
          {orderType === "limit" && (
            <div className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mb-1 font-medium">
              Ordre limite — exécuté quand le cours atteint ton prix
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600">{orderType === "market" ? "Prix" : "Prix limite"}</span>
            <span className="font-mono">{fmt(execPrice!, 4)} {c}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">{qtyFinal} x {fmt(execPrice!, 4)}</span>
            <span className="font-mono">{fmt(preview.sub)} {c}</span>
          </div>
          {currency !== "CHF" && (
            <div className="flex justify-between text-slate-400 text-xs">
              <span>Taux de change</span>
              <span className="font-mono">1 {c} = {fxRate.toFixed(4)} CHF → {fmt(preview.subCHF)} CHF</span>
            </div>
          )}
          <div className="flex justify-between text-slate-500">
            <span>Frais ({(feeBps / 100).toFixed(2)}%, max 15 CHF)</span>
            <span className="font-mono">{side === "buy" ? "+" : "−"}{fmt(preview.fee)} CHF</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-slate-200 pt-1">
            <span>{side === "buy" ? "Coût total" : "Crédit net"}</span>
            <span className={`font-mono ${side === "buy" ? "text-red-700" : "text-green-700"}`}>
              {side === "buy" ? "−" : "+"}{fmt(preview.totalCHF)} CHF
            </span>
          </div>
          <div className="flex justify-between text-xs text-slate-500 pt-1">
            <span>Cash actuel</span>
            <span className="font-mono">{fmt(myCash)} CHF</span>
          </div>
          <div className="flex justify-between text-xs font-medium">
            <span>Nouveau solde</span>
            <span className={`font-mono ${preview.newCash < 0 ? "text-red-600" : "text-slate-800"}`}>{fmt(preview.newCash)} CHF</span>
          </div>
          {side === "buy" && preview.newCash < 0 && <p className="text-xs text-red-600">Cash insuffisant.</p>}
          {side === "sell" && qtyFinal > positionQty && <p className="text-xs text-red-600">Position insuffisante.</p>}
        </div>
      )}

      {/* ──── Submit ──── */}
      <form method="POST" action="/api/trade">
        <input type="hidden" name="gameId" value={gameId} />
        <input type="hidden" name="symbol" value={symbol} />
        <input type="hidden" name="qty" value={qtyFinal > 0 ? qtyFinal : ""} />
        <input type="hidden" name="side" value={side} />
        <input type="hidden" name="orderType" value={orderType} />
        {orderType === "limit" && execPrice != null && (
          <input type="hidden" name="limitPrice" value={execPrice} />
        )}
        <button type="submit"
          disabled={gameEnded || qtyFinal <= 0 || execPrice == null || (side === "buy" && !canBuy) || (side === "sell" && !canSell)}
          className={`w-full py-2.5 rounded-lg font-medium text-sm text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${side === "buy" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
          {orderType === "limit"
            ? `Placer ordre limite ${side === "buy" ? "d'achat" : "de vente"} ${qtyFinal > 0 ? qtyFinal + " " + symbol : ""}`
            : side === "buy"
              ? `Acheter au marché ${qtyFinal > 0 ? qtyFinal + " " + symbol : ""}`
              : `Vendre au marché ${qtyFinal > 0 ? qtyFinal + " " + symbol : ""}`}
        </button>
      </form>
    </div>
  );
}

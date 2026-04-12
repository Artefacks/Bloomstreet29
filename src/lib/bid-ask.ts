/** Simulate bid/ask spread from mid price (aligné avec l’exécution au marché). */
export function getBidAsk(midPrice: number): { bid: number; ask: number } {
  const spreadPct = 0.0008; // 0.08% typical
  const half = midPrice * spreadPct * 0.5;
  return {
    bid: Math.round((midPrice - half) * 10000) / 10000,
    ask: Math.round((midPrice + half) * 10000) / 10000,
  };
}

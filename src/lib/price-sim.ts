/**
 * Price simulation for international stocks (non-US).
 *
 * Deterministic seeded PRNG — all players see the same prices at the same minute.
 * Designed for a GAME: visible, exciting price swings with realistic patterns.
 *
 * Features:
 *  - Intraday volatility curve (higher at open/close, lower at lunch)
 *  - Sector correlation (stocks in same sector move together)
 *  - Momentum (trends persist across ticks)
 *  - Market-wide sentiment shifts (~every 15 min)
 *  - Event spikes (earnings, news)
 *  - Mean-reversion to seed price over days
 */

import { getSectorId } from "./sectors";

/* ──── Deterministic PRNG (mulberry32) ──── */

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/* ──── Box-Muller: uniform → normal ──── */

function normalRandom(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/* ──── Intraday volatility curve (CET timezone) ──── */

/**
 * Returns a volatility multiplier based on hour-of-day in CET.
 * Higher at open (9h) and close (17h30), lower at lunch (12-14h).
 * Range: ~0.5x to ~2.0x
 */
function intradayVolMultiplier(timestampMs: number): number {
  // Get CET hour (UTC+1, ignoring DST for simplicity)
  const utcHours = (timestampMs / 3_600_000) % 24;
  const cetHour = (utcHours + 1) % 24;

  // Trading session: 9h-17h30 CET
  if (cetHour < 8 || cetHour > 18) {
    return 0.4; // low overnight vol
  }

  // Peak at open (9h) and close (17h30)
  // Trough at lunch (13h)
  // Use a double-hump curve: two peaks at 9 and 17.5, valley at 13
  const openDist = Math.abs(cetHour - 9);
  const closeDist = Math.abs(cetHour - 17.5);
  const openPeak = Math.exp(-0.5 * openDist * openDist);
  const closePeak = Math.exp(-0.5 * closeDist * closeDist);
  const peak = Math.max(openPeak, closePeak);

  // Scale: 0.6 at trough, 1.8 at peaks
  return 0.6 + 1.2 * peak;
}

/* ──── Market-wide sentiment ──── */

/**
 * Returns a market-wide drift (-0.003 to +0.003) that shifts every ~15 minutes.
 * Same for ALL stocks at the same 15-min window.
 */
function marketSentiment(timestampMs: number): number {
  const window15 = Math.floor(timestampMs / (15 * 60_000));
  const seed = hashStr(`market:${window15}`);
  const rng = mulberry32(seed);
  return (rng() - 0.5) * 0.006; // range: -0.003 to +0.003
}

/* ──── Sector correlation ──── */

/**
 * Returns a sector-specific drift for this minute.
 * Stocks in the same sector share this component.
 */
function sectorDrift(sectorId: string, timestampMs: number): number {
  const minute = Math.floor(timestampMs / 60_000);
  const seed = hashStr(`sector:${sectorId}:${minute}`);
  const rng = mulberry32(seed);
  const z = normalRandom(rng);
  return z * 0.002; // sector component: ~0.2% contribution
}

/* ──── Momentum ──── */

/**
 * Returns a momentum term based on the previous minute's move direction.
 * ~30% of the previous tick's return carries forward.
 */
function momentumDrift(symbol: string, timestampMs: number): number {
  const minute = Math.floor(timestampMs / 60_000);
  const prevSeed = hashStr(`${symbol}:${minute - 1}`);
  const prevRng = mulberry32(prevSeed);
  const prevZ = normalRandom(prevRng);
  // Carry forward 30% of previous tick's random component
  return prevZ * 0.006 * 0.3;
}

/* ──── Public API ──── */

export function isSimulated(symbol: string): boolean {
  if (symbol.includes(".")) {
    if (symbol === "BRK.B") return false;
    return true;
  }
  return false;
}

/**
 * Simulate a new price for one tick (1 minute).
 *
 * Model: geometric random walk with:
 *  - Intraday volatility curve
 *  - Sector correlation
 *  - Momentum (trend persistence)
 *  - Market-wide sentiment
 *  - Event spikes (~5% chance)
 *  - Mean-reversion toward seed price
 */
export function simulatePrice(
  lastPrice: number,
  symbol: string,
  timestamp: number,
  seedPrice?: number
): number {
  const minute = Math.floor(timestamp / 60_000);
  const seed = hashStr(`${symbol}:${minute}`);
  const rng = mulberry32(seed);

  const z = normalRandom(rng);
  const eventRoll = rng();

  // Base per-minute volatility, modulated by time of day
  const baseSigma = 0.005;
  const volMult = intradayVolMultiplier(timestamp);
  let sigma = baseSigma * volMult;

  // ~5% chance of a "news event" → 3x volatility
  if (eventRoll < 0.05) {
    sigma *= 3;
  }

  // Stock-specific random component
  const stockMove = sigma * z;

  // Sector correlation component
  const secId = getSectorId(symbol);
  const secDrift = sectorDrift(secId, timestamp);

  // Market-wide sentiment
  const mktSentiment = marketSentiment(timestamp);

  // Momentum from previous tick
  const momentum = momentumDrift(symbol, timestamp);

  // Mean-reversion toward seed price (gentle: 0.8% pull per tick)
  let meanRev = 0;
  if (seedPrice && seedPrice > 0) {
    const deviation = (lastPrice - seedPrice) / seedPrice;
    meanRev = -0.008 * deviation;
  }

  // Combine all components
  const totalChange = stockMove + secDrift + mktSentiment + momentum + meanRev;
  const newPrice = lastPrice * (1 + totalChange);

  return Math.max(0.01, Math.round(newPrice * 10000) / 10000);
}

/**
 * Advance a price by N minutes from a starting price.
 */
export function simulatePriceForward(
  startPrice: number,
  symbol: string,
  fromTimestampMs: number,
  toTimestampMs: number,
  seedPrice?: number
): number {
  const fromMinute = Math.floor(fromTimestampMs / 60_000);
  const toMinute = Math.floor(toTimestampMs / 60_000);

  if (toMinute <= fromMinute) return startPrice;

  const steps = Math.min(toMinute - fromMinute, 480);
  let price = startPrice;

  for (let i = 1; i <= steps; i++) {
    const tickMs = (fromMinute + i) * 60_000;
    price = simulatePrice(price, symbol, tickMs, seedPrice);
  }

  return price;
}

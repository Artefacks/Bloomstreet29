/**
 * Finnhub API helpers : Symbol Search + Quote.
 * NO built-in rate limiting — callers must handle batching/delays.
 */

const FINNHUB_QUOTE = "https://finnhub.io/api/v1/quote";
const FINNHUB_SEARCH = "https://finnhub.io/api/v1/search";

/* ──── Currency helpers ──── */

export function getCurrencyForSymbol(symbol: string): string {
  if (symbol.endsWith(".SW")) return "CHF";
  if (symbol.endsWith(".ST")) return "SEK";
  if (
    symbol.endsWith(".PA") ||
    symbol.endsWith(".DE") ||
    symbol.endsWith(".AS") ||
    symbol.endsWith(".MC") ||
    symbol.endsWith(".MI") ||
    symbol.endsWith(".HE")
  )
    return "EUR";
  return "USD";
}

export function formatCurrency(currency: string): string {
  switch (currency) {
    case "CHF":
      return "CHF";
    case "EUR":
      return "€";
    case "USD":
      return "$";
    case "SEK":
      return "kr";
    default:
      return currency;
  }
}

/* ──── Exchange rates to CHF (approximate, updated periodically) ──── */
const FX_TO_CHF: Record<string, number> = {
  CHF: 1,
  USD: 0.88,
  EUR: 0.94,
  SEK: 0.083,
};

export function getExchangeRateToCHF(currency: string): number {
  return FX_TO_CHF[currency] ?? 1;
}

export function convertToCHF(amount: number, currency: string): number {
  return amount * getExchangeRateToCHF(currency);
}

/* ──── Types ──── */

export type SearchResult = {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
};

/* ──── Quote (single) ──── */

export async function fetchQuote(
  token: string,
  symbol: string
): Promise<number | null> {
  try {
    const res = await fetch(
      `${FINNHUB_QUOTE}?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`
    );
    if (res.status === 429) return null; // rate limited
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.c;
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0)
      return null;
    return price;
  } catch {
    return null;
  }
}

/* ──── Symbol Search ──── */

export async function searchSymbol(
  token: string,
  q: string,
  exchange?: string
): Promise<string | null> {
  try {
    const params = new URLSearchParams({ q: q.trim(), token });
    if (exchange) params.set("exchange", exchange);
    const res = await fetch(`${FINNHUB_SEARCH}?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const results: SearchResult[] = data?.result ?? [];
    if (results.length === 0) return null;
    return results[0]?.symbol ?? null;
  } catch {
    return null;
  }
}

/* ──── Quick fetch: use quote_symbol, fallback to symbol and base symbol ──── */

export async function quickFetchPrice(
  token: string,
  symbol: string,
  quoteSymbol: string | null
): Promise<{ price: number | null; resolvedSymbol: string }> {
  const sym = quoteSymbol ?? symbol;
  const price = await fetchQuote(token, sym);
  if (price != null) return { price, resolvedSymbol: sym };

  // Try base symbol (e.g. NESN for NESN.SW) — only if different
  if (symbol.includes(".")) {
    const base = symbol.split(".")[0];
    if (base && base !== sym) {
      const p2 = await fetchQuote(token, base);
      if (p2 != null) return { price: p2, resolvedSymbol: base };
    }
  }

  return { price: null, resolvedSymbol: sym };
}

/* ──── Full resolve: Search + Quote (slower, use for resolution only) ──── */

export async function resolveAndFetchQuote(
  token: string,
  ourSymbol: string,
  name: string | null,
  existingQuoteSymbol: string | null
): Promise<{ quoteSymbol: string | null; price: number | null }> {
  // 1. Quick path
  const { price: quickPrice, resolvedSymbol } = await quickFetchPrice(
    token,
    ourSymbol,
    existingQuoteSymbol
  );
  if (quickPrice != null) return { quoteSymbol: resolvedSymbol, price: quickPrice };

  // 2. Symbol Search (by symbol, then by name)
  for (const query of [ourSymbol, name].filter(Boolean) as string[]) {
    const resolved = await searchSymbol(token, query);
    if (!resolved || resolved === resolvedSymbol) continue;
    const price = await fetchQuote(token, resolved);
    if (price != null) return { quoteSymbol: resolved, price };
  }

  return { quoteSymbol: existingQuoteSymbol ?? null, price: null };
}

/**
 * Resolve quote_symbol via Symbol Search only (no price fetch).
 */
export async function resolveQuoteSymbol(
  token: string,
  ourSymbol: string,
  name: string | null
): Promise<string | null> {
  const resolved = await searchSymbol(token, ourSymbol);
  if (resolved) return resolved;
  if (name) {
    const byName = await searchSymbol(token, name);
    if (byName) return byName;
  }
  return null;
}

/* ──── Batch helper: run functions N at a time with delay between batches ──── */

export async function batchProcess<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
  delayBetweenBatchesMs: number,
  maxDurationMs?: number
): Promise<R[]> {
  const results: R[] = [];
  const start = Date.now();

  for (let i = 0; i < items.length; i += concurrency) {
    if (maxDurationMs && Date.now() - start > maxDurationMs) break;

    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);

    if (i + concurrency < items.length && delayBetweenBatchesMs > 0) {
      await new Promise((r) => setTimeout(r, delayBetweenBatchesMs));
    }
  }

  return results;
}

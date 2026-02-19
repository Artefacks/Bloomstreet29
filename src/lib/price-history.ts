import type { SupabaseClient } from "@supabase/supabase-js";

/** Fenêtre de sampling : au plus 1 point par instrument par N minutes */
export const PRICE_HISTORY_WINDOW_MINUTES = 5;

/**
 * Retourne les symboles qui ont déjà un point dans price_history
 * dans les N dernières minutes (évite de saturer la table).
 */
export async function getSymbolsWithRecentHistory(
  supabase: SupabaseClient,
  symbols: string[],
  windowMinutes = PRICE_HISTORY_WINDOW_MINUTES
): Promise<Set<string>> {
  if (symbols.length === 0) return new Set();
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("price_history")
    .select("symbol")
    .in("symbol", symbols)
    .gte("as_of", cutoff);
  return new Set((data ?? []).map((r) => r.symbol));
}

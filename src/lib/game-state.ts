import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrencyForSymbol, getExchangeRateToCHF } from "@/lib/finnhub";

export type GameStatus = "pending" | "active" | "finished";

export type GameState = {
  game: {
    id: string;
    join_code: string;
    duration_days: number;
    initial_cash: number;
    status: GameStatus;
    ends_at: string | null;
    fee_bps: number;
    allow_fractional: boolean;
    min_order_amount: number;
  } | null;
  players: { user_id: string; cash: number }[];
  myCash: number | null;
  myTotalValue: number | null;
  myPnl: number | null;
  myPnlPct: number | null;
  myPositions: { symbol: string; qty: number; avg_cost: number }[];
  instruments: { symbol: string; name: string | null; price: number | null; currency: string }[];
  leaderboard: {
    user_id: string;
    totalValue: number;
    cash: number;
    displayName: string | null;
    pnl: number;
    pnlPct: number;
  }[];
  orders: { id: string; symbol: string; side: string; qty: number; price: number; fee_amount: number; created_at: string }[];
  pendingOrders: { id: string; symbol: string; side: string; qty: number; limit_price: number; status: string; created_at: string }[];
  isMember: boolean;
};

export async function getGameState(
  supabase: SupabaseClient,
  gameId: string,
  userId: string
): Promise<GameState> {
  const { data: game } = await supabase
    .from("games")
    .select("id, join_code, duration_days, initial_cash, started_at, ends_at, status, fee_bps, allow_fractional, min_order_amount")
    .eq("id", gameId)
    .single();

  if (!game) {
    return {
      game: null,
      players: [],
      myCash: null,
      myTotalValue: null,
      myPnl: null,
      myPnlPct: null,
      myPositions: [],
      instruments: [],
      leaderboard: [],
      orders: [],
      pendingOrders: [],
      isMember: false,
    };
  }

  const endsAt = game.ends_at ?? null;
  const effectiveStatus: GameStatus =
    endsAt && new Date(endsAt) < new Date() ? "finished" : (game.status as GameStatus) ?? "active";
  const initialCash = Number(game.initial_cash);

  const { data: players } = await supabase
    .from("game_players")
    .select("user_id, cash, display_name")
    .eq("game_id", gameId);

  const myPlayer = players?.find((p) => p.user_id === userId);
  if (!myPlayer) {
    return {
      game: {
        id: game.id,
        join_code: game.join_code,
        duration_days: game.duration_days,
        initial_cash: initialCash,
        status: effectiveStatus,
        ends_at: endsAt,
        fee_bps: Number(game.fee_bps ?? 10),
        allow_fractional: game.allow_fractional !== false,
        min_order_amount: Number(game.min_order_amount ?? 0),
      },
      players: players ?? [],
      myCash: null,
      myTotalValue: null,
      myPnl: null,
      myPnlPct: null,
      myPositions: [],
      instruments: [],
      leaderboard: [],
      orders: [],
      pendingOrders: [],
      isMember: false,
    };
  }

  const { data: positions } = await supabase
    .from("positions")
    .select("symbol, qty, avg_cost")
    .eq("game_id", gameId)
    .eq("user_id", userId);

  const { data: instruments } = await supabase
    .from("instruments")
    .select("symbol, name")
    .limit(100);

  const symbols = instruments?.map((i) => i.symbol) ?? [];
  const { data: prices } = await supabase
    .from("prices_latest")
    .select("symbol, price")
    .in("symbol", symbols.length ? symbols : ["__none__"]);

  const priceMap = new Map<string, number>();
  prices?.forEach((p) => priceMap.set(p.symbol, Number(p.price)));

  // Fallback: pour les symboles sans prix (ex. suisses/européens), utiliser le dernier prix connu dans price_history
  const missingSymbols = symbols.filter((s) => !priceMap.has(s));
  if (missingSymbols.length > 0) {
    const { data: historyRows } = await supabase
      .from("price_history")
      .select("symbol, price, as_of")
      .in("symbol", missingSymbols)
      .order("as_of", { ascending: false });
    const seen = new Set<string>();
    historyRows?.forEach((r) => {
      if (!seen.has(r.symbol)) {
        seen.add(r.symbol);
        priceMap.set(r.symbol, Number(r.price));
      }
    });
  }

  const instrumentsWithPrice = (instruments ?? []).map((i) => ({
    symbol: i.symbol,
    name: i.name,
    price: priceMap.get(i.symbol) ?? null,
    currency: getCurrencyForSymbol(i.symbol),
  }));

  const myPositions = (positions ?? []).map((p) => ({
    symbol: p.symbol,
    qty: Number(p.qty),
    avg_cost: Number(p.avg_cost),
  }));

  const { data: allPositions } = await supabase
    .from("positions")
    .select("user_id, symbol, qty")
    .eq("game_id", gameId);

  const positionMap = new Map<string, { symbol: string; qty: number }[]>();
  allPositions?.forEach((p) => {
    const list = positionMap.get(p.user_id) ?? [];
    list.push({ symbol: p.symbol, qty: Number(p.qty) });
    positionMap.set(p.user_id, list);
  });

  // Reserved cash from open buy limit orders (ne compte pas comme P&L négatif)
  const { data: allPending } = await supabase
    .from("pending_orders")
    .select("user_id, symbol, side, qty, limit_price")
    .eq("game_id", gameId)
    .eq("status", "open");
  const reservedByUser = new Map<string, number>();
  (allPending ?? []).forEach((o) => {
    if (o.side !== "buy") return;
    const fxRate = getExchangeRateToCHF(getCurrencyForSymbol(o.symbol));
    const reserved = Number(o.limit_price) * Number(o.qty) * fxRate;
    reservedByUser.set(o.user_id, (reservedByUser.get(o.user_id) ?? 0) + reserved);
  });

  const feeBps = Number(game.fee_bps ?? 10);
  const leaderboard = (players ?? []).map((p) => {
    const posList = positionMap.get(p.user_id) ?? [];
    let value = Number(p.cash); // cash déjà déduit des réserves
    // Réintégrer la réserve des ordres limite d'achat pour le calcul P&L (comme les apps bancaires)
    const reserved = reservedByUser.get(p.user_id) ?? 0;
    const reserveFee = reserved > 0 ? Math.min(15, Math.round((reserved * feeBps) / 10000 * 100) / 100) : 0;
    value += reserved + reserveFee;
    posList.forEach(({ symbol, qty }) => {
      const pr = priceMap.get(symbol);
      if (pr != null) {
        const fxRate = getExchangeRateToCHF(getCurrencyForSymbol(symbol));
        value += qty * pr * fxRate;
      }
    });
    const pnl = value - initialCash;
    const pnlPct = initialCash > 0 ? (pnl / initialCash) * 100 : 0;
    return {
      user_id: p.user_id,
      cash: Number(p.cash),
      totalValue: value,
      displayName: (p as { display_name?: string | null }).display_name?.trim() || null,
      pnl,
      pnlPct,
    };
  });
  leaderboard.sort((a, b) => b.totalValue - a.totalValue);

  const myEntry = leaderboard.find((e) => e.user_id === userId);

  const { data: orders } = await supabase
    .from("orders")
    .select("id, symbol, side, qty, price, fee_amount, created_at")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  // Pending limit orders
  let pendingOrdersRaw: { id: string; symbol: string; side: string; qty: number; limit_price: number; status: string; created_at: string }[] = [];
  try {
    const { data: po } = await supabase
      .from("pending_orders")
      .select("id, symbol, side, qty, limit_price, status, created_at")
      .eq("game_id", gameId)
      .eq("user_id", userId)
      .in("status", ["open", "filled"])
      .order("created_at", { ascending: false })
      .limit(50);
    pendingOrdersRaw = (po ?? []).map((o) => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side,
      qty: Number(o.qty),
      limit_price: Number(o.limit_price),
      status: o.status,
      created_at: o.created_at,
    }));
  } catch {
    // Table might not exist yet
  }

  return {
    game: {
      id: game.id,
      join_code: game.join_code,
      duration_days: game.duration_days,
      initial_cash: initialCash,
      status: effectiveStatus,
      ends_at: endsAt,
      fee_bps: Number(game.fee_bps ?? 10),
      allow_fractional: game.allow_fractional !== false,
      min_order_amount: Number(game.min_order_amount ?? 0),
    },
    players: (players ?? []).map((p) => ({ user_id: p.user_id, cash: Number(p.cash) })),
    myCash: Number(myPlayer.cash),
    myTotalValue: myEntry?.totalValue ?? null,
    myPnl: myEntry != null ? myEntry.pnl : null,
    myPnlPct: myEntry != null ? myEntry.pnlPct : null,
    myPositions,
    instruments: instrumentsWithPrice,
    leaderboard,
    orders: (orders ?? []).map((o) => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side,
      qty: Number(o.qty),
      price: Number(o.price),
      fee_amount: Number((o as { fee_amount?: number }).fee_amount ?? 0),
      created_at: o.created_at,
    })),
    pendingOrders: pendingOrdersRaw,
    isMember: true,
  };
}

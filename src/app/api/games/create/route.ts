import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;

function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const response = NextResponse.redirect(new URL("/login", origin));
  const supabase = createSupabaseRouteClient(request, response);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const form = await request.formData();
  const durationDaysRaw = form.get("durationDays");
  const initialCashRaw = form.get("initialCash");
  const durationDays = durationDaysRaw && typeof durationDaysRaw === "string"
    ? Math.max(1, parseInt(durationDaysRaw, 10) || 7)
    : 7;
  const initialCash = initialCashRaw && typeof initialCashRaw === "string"
    ? Math.max(0, parseFloat(initialCashRaw) || 100000)
    : 100000;

  let joinCode: string | null = null;
  for (let i = 0; i < 10; i++) {
    const candidate = generateJoinCode();
    const { data: existing } = await supabase
      .from("games")
      .select("id")
      .eq("join_code", candidate)
      .maybeSingle();
    if (!existing) {
      joinCode = candidate;
      break;
    }
  }

  if (!joinCode) {
    return NextResponse.redirect(new URL("/games/new?error=code", origin));
  }

  const startedAt = new Date().toISOString();
  const endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({
      join_code: joinCode,
      duration_days: durationDays,
      initial_cash: initialCash,
      created_by: user.id,
      started_at: startedAt,
      ends_at: endsAt,
      status: "active",
      fee_bps: 10,
      allow_fractional: true,
      min_order_amount: 0,
    })
    .select("id")
    .single();

  if (gameError || !game) {
    console.error("[games/create] insert game:", gameError);
    return NextResponse.redirect(new URL("/games/new?error=creation", origin));
  }

  const displayName =
    (user.user_metadata?.full_name as string)?.trim() ||
    (user.email ?? "").split("@")[0] ||
    user.id.slice(0, 8);

  const { error: playerError } = await supabase.from("game_players").insert({
    game_id: game.id,
    user_id: user.id,
    cash: initialCash,
    display_name: displayName || null,
  });

  if (playerError) {
    console.error("[games/create] insert game_players:", playerError);
    return NextResponse.redirect(new URL("/games/new?error=membership", origin));
  }

  await supabase.from("player_equity_snapshots").insert({
    game_id: game.id,
    user_id: user.id,
    total_value: initialCash,
  });

  return NextResponse.redirect(new URL(`/games/${game.id}`, origin));
}

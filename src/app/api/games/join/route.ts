import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

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
  const joinCodeRaw = form.get("joinCode");
  const joinCode =
    typeof joinCodeRaw === "string" ? joinCodeRaw.trim().toUpperCase() : "";

  if (!joinCode) {
    return NextResponse.redirect(new URL("/games/join?error=code_required", origin));
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, initial_cash")
    .eq("join_code", joinCode)
    .maybeSingle();

  if (gameError || !game) {
    return NextResponse.redirect(new URL("/games/join?error=not_found", origin));
  }

  const { data: existing } = await supabase
    .from("game_players")
    .select("id")
    .eq("game_id", game.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.redirect(new URL(`/games/${game.id}`, origin));
  }

  const displayName =
    (user.user_metadata?.full_name as string)?.trim() ||
    (user.email ?? "").split("@")[0] ||
    user.id.slice(0, 8);

  const { error: playerError } = await supabase.from("game_players").insert({
    game_id: game.id,
    user_id: user.id,
    cash: game.initial_cash,
    display_name: displayName || null,
  });

  if (playerError) {
    console.error("[games/join] insert game_players:", playerError);
    return NextResponse.redirect(new URL("/games/join?error=join_failed", origin));
  }

  await supabase.from("player_equity_snapshots").insert({
    game_id: game.id,
    user_id: user.id,
    total_value: game.initial_cash,
  });

  return NextResponse.redirect(new URL(`/games/${game.id}`, origin));
}

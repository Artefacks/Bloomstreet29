import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

/**
 * GET /api/games/[id]/equity-history
 * Historique de la valorisation (capital) du joueur connecté pour cette partie.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params;
  const response = NextResponse.json({});
  const supabase = createSupabaseRouteClient(request, response);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from("player_equity_snapshots")
    .select("total_value, recorded_at")
    .eq("game_id", gameId)
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const history = (rows ?? []).map((r) => ({
    value: Number(r.total_value),
    at: r.recorded_at,
  }));

  return NextResponse.json({ history });
}

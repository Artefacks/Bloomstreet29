import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { matchPendingOrders } from "@/lib/order-matching";

/**
 * POST /api/games/[id]/match-pending
 * Membre authentifié uniquement. Exécute le moteur de matching (tous les ordres ouverts),
 * pour déclencher les exécutions dès l’ouverture du marché sans attendre un refresh prix global.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("game_players")
    .select("id")
    .eq("game_id", gameId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Server configuration" }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  try {
    const filled = await matchPendingOrders(admin);
    return NextResponse.json({ ok: true, filled });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[match-pending]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createSupabaseRouteClient(request, response);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const leagueId = request.cookies.get("current_room_id")?.value;
  if (!leagueId) {
    return NextResponse.json(
      { error: "Aucune compétition sélectionnée" },
      { status: 400 }
    );
  }

  const { data: membership, error: memberError } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError || !membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });
  }

  const { data: league, error: fetchError } = await supabase
    .from("leagues")
    .select("status")
    .eq("id", leagueId)
    .single();

  if (fetchError || !league) {
    return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
  }

  if (league.status !== "active") {
    return NextResponse.json(
      { error: "Seule une compétition en cours peut être clôturée" },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from("leagues")
    .update({ status: "completed" })
    .eq("id", leagueId);

  if (updateError) {
    console.error("[admin/status/finish]", updateError);
    return NextResponse.json(
      { error: "Impossible de clôturer la compétition" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, status: "completed" });
}

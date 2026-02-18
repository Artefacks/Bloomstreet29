import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
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

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id, name, display_name, invite_code, status, start_date, end_date, initial_cash, fee_bps, created_at")
    .eq("id", leagueId)
    .single();

  if (leagueError || !league) {
    return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
  }

  const { data: members, error: membersError } = await supabase
    .from("league_members")
    .select("user_id, role, joined_at")
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true });

  if (membersError) {
    return NextResponse.json(
      { error: "Impossible de charger les membres" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    league: {
      id: league.id,
      name: league.name,
      displayName: league.display_name,
      inviteCode: league.invite_code,
      status: league.status,
      startDate: league.start_date,
      endDate: league.end_date,
      initialCash: league.initial_cash,
      feeBps: league.fee_bps,
      createdAt: league.created_at,
    },
    members: (members ?? []).map((m) => ({
      userId: m.user_id,
      role: m.role,
      joinedAt: m.joined_at,
    })),
  });
}

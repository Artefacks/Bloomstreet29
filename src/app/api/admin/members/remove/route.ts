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

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide" },
      { status: 400 }
    );
  }

  const targetUserId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!targetUserId) {
    return NextResponse.json(
      { error: "userId requis" },
      { status: 400 }
    );
  }

  if (targetUserId === user.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas vous retirer vous-même. Passez le rôle à un autre admin." },
      { status: 400 }
    );
  }

  const { data: admins, error: adminsError } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("role", "admin");

  const targetIsAdmin = admins?.some((a) => a.user_id === targetUserId);
  if (targetIsAdmin && admins?.length === 1) {
    return NextResponse.json(
      { error: "Impossible de retirer le dernier administrateur" },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabase
    .from("league_members")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", targetUserId);

  if (deleteError) {
    console.error("[admin/members/remove]", deleteError);
    return NextResponse.json(
      { error: "Impossible de retirer ce membre" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

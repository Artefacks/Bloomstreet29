import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

const AUTO_ADMIN_EMAIL = "montavon.mael2001@gmail.com";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  const supabase = createSupabaseRouteClient(request, response);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const form = await request.formData();
  const codeRaw = form.get("code");
  const code =
    typeof codeRaw === "string" ? codeRaw.trim().toUpperCase() : "";

  if (!code) {
    return NextResponse.redirect(new URL("/onboarding?error=code", request.url));
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id")
    .eq("invite_code", code)
    .maybeSingle();

  if (leagueError || !league) {
    return NextResponse.redirect(new URL("/onboarding?error=code", request.url));
  }

  const leagueId = league.id as string;

  const role = user.email?.toLowerCase() === AUTO_ADMIN_EMAIL ? "admin" : "player";

  const { error: memberError } = await supabase
    .from("league_members")
    .upsert(
      {
        league_id: leagueId,
        user_id: user.id,
        role,
        joined_at: new Date().toISOString(),
      },
      { onConflict: "league_id,user_id" }
    );

  if (memberError) {
    console.error("[join-room] erreur upsert membership:", memberError);
    return NextResponse.redirect(
      new URL("/onboarding?error=membership", request.url)
    );
  }

  // Poser le cookie current_room_id
  response.cookies.set("current_room_id", leagueId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}



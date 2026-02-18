import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function addDuration(start: Date, duration: string): Date {
  const end = new Date(start);
  switch (duration) {
    case "1h":
      end.setHours(end.getHours() + 1);
      break;
    case "1d":
      end.setDate(end.getDate() + 1);
      break;
    case "30d":
      end.setDate(end.getDate() + 30);
      break;
    case "7d":
    default:
      end.setDate(end.getDate() + 7);
      break;
  }
  return end;
}

function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 7; i++) {
    const idx = Math.floor(Math.random() * INVITE_ALPHABET.length);
    code += INVITE_ALPHABET[idx];
  }
  return code;
}

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  const supabase = createSupabaseRouteClient(request, response);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log("[create-room] hasUser:", !!user, "userError:", userError);
  if (user) {
    console.log("[create-room] userId:", user.id, "email:", user.email);
  }

  if (userError || !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const form = await request.formData();
  const durationRaw = form.get("duration");
  const duration =
    typeof durationRaw === "string" && durationRaw ? durationRaw : "7d";

  const start = new Date();
  const end = addDuration(start, duration);

  // Générer un code unique
  let inviteCode: string | null = null;
  for (let i = 0; i < 5; i++) {
    const candidate = generateInviteCode();
    const { data: existing, error: checkError } = await supabase
      .from("leagues")
      .select("id")
      .eq("invite_code", candidate)
      .maybeSingle();
    if (checkError) {
      console.error("[create-room] erreur check code:", checkError);
      break;
    }
    if (!existing) {
      inviteCode = candidate;
      break;
    }
  }

  if (!inviteCode) {
    return NextResponse.redirect(new URL("/onboarding?error=code", request.url));
  }

  // Validation explicite de user.id
  if (!user.id || typeof user.id !== "string") {
    console.error("[create-room] user.id invalide:", user.id);
    return NextResponse.redirect(new URL("/onboarding?error=user", request.url));
  }

  const leaguePayload = {
    name: "Compétition",
    display_name: "Compétition",
    invite_code: inviteCode,
    status: "draft" as const,
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    initial_cash: 100_000_000, // 1 000 000 cents = 10 000.00
    fee_bps: 10,
    created_by: user.id, // UUID string
  };

  console.log("[create-room] league insert payload:", JSON.stringify(leaguePayload, null, 2));
  console.log("[create-room] user.id type:", typeof user.id, "value:", user.id);

  // Vérifier que la session est bien active avant l'INSERT
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log("[create-room] session active:", !!session, "sessionError:", sessionError);
  if (sessionError || !session) {
    console.error("[create-room] pas de session active, redirection login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert(leaguePayload)
    .select("id")
    .single();

  if (leagueError) {
    console.error("[create-room] erreur insert league:", leagueError);
    console.error("[create-room] code erreur:", leagueError.code);
    console.error("[create-room] message erreur:", leagueError.message);
    console.error("[create-room] détails erreur:", leagueError.details);
    return NextResponse.redirect(new URL("/onboarding?error=creation", request.url));
  }

  if (!league) {
    console.error("[create-room] insert réussi mais pas de data retournée");
    return NextResponse.redirect(new URL("/onboarding?error=creation", request.url));
  }

  const leagueId = league.id as string;

  const { error: memberError } = await supabase
    .from("league_members")
    .insert({
      league_id: leagueId,
      user_id: user.id,
      role: "admin",
      joined_at: new Date().toISOString(),
    });

  if (memberError) {
    console.error("[create-room] erreur insert membership:", memberError);
    return NextResponse.redirect(new URL("/onboarding?error=membership", request.url));
  }

  // Instruments statiques V1
  const instruments = ["AAPL", "MSFT", "GOOG", "BTCUSD", "ETHUSD"].map(
    (ticker) => ({
      league_id: leagueId,
      ticker,
      active: true,
    })
  );

  const { error: instrumentsError } = await supabase
    .from("instruments")
    .upsert(instruments, { onConflict: "league_id,ticker" });

  if (instrumentsError) {
    console.error("[create-room] erreur insert instruments:", instrumentsError);
    // On continue malgré tout pour ne pas bloquer la navigation V1
  }

  // Poser le cookie current_room_id (Route Handler = écriture autorisée)
  response.cookies.set("current_room_id", leagueId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}



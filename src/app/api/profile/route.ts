import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const response = NextResponse.json({ profile: null });
  const supabase = createSupabaseRouteClient(request, response);

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ profile: null }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    profile: profile ? { display_name: profile.display_name, avatar: profile.avatar } : null,
  });
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: false });
  const supabase = createSupabaseRouteClient(request, response);

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const body = await request.json();
  const displayName = typeof body.display_name === "string"
    ? body.display_name.trim().slice(0, 50)
    : "";
  const avatar = typeof body.avatar === "string"
    ? body.avatar.trim().slice(0, 20)
    : null;

  if (!displayName || displayName.length < 2) {
    return NextResponse.json({ error: "Choisis un nom d'au moins 2 caractères." }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: displayName,
      avatar: avatar || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[profile] upsert:", error);
    return NextResponse.json({ error: "Erreur lors de la sauvegarde." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

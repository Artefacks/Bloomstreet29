import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

/**
 * POST /api/profile/reset
 * Supprime le profil de l'utilisateur connecté.
 * Au prochain login (ou refresh), il sera redirigé vers /profile/setup.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: false });
  const supabase = createSupabaseRouteClient(request, response);

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  await supabase.from("profiles").delete().eq("id", user.id);

  return NextResponse.json({ ok: true });
}

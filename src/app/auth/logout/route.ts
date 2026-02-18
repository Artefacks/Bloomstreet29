import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

/**
 * POST /auth/logout
 * Déconnecte l'utilisateur et redirige vers /.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const response = NextResponse.redirect(new URL("/", origin));
  const supabase = createSupabaseRouteClient(request, response);

  await supabase.auth.signOut();

  return response;
}

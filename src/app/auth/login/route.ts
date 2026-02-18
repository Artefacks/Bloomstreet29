import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

async function handleLogin(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;

  const redirectTo = new URL("/auth/callback", origin).toString();

  // IMPORTANT: Créer la réponse de redirection AVANT l'appel à signInWithOAuth
  // et utiliser la MÊME réponse objet que Supabase écrira les cookies PKCE dessus.
  // Ensuite, on modifie uniquement l'URL de redirection sans créer de nouvelle réponse,
  // ce qui préserve tous les cookies PKCE que Supabase a écrits.
  const response = NextResponse.redirect(new URL("/login?status=redirecting", origin));
  const supabase = createSupabaseRouteClient(request, response);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data?.url) {
    const code = error?.code ?? "auth_failed";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, origin));
  }

  // Modifier uniquement l'URL de redirection, en conservant tous les cookies PKCE
  // Les cookies sont déjà sur cette réponse, donc ils seront préservés
  response.headers.set("Location", data.url);

  return response;
}

export async function GET(request: NextRequest) {
  return handleLogin(request);
}

export async function POST(request: NextRequest) {
  return handleLogin(request);
}

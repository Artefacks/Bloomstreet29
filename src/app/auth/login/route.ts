import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

async function handleLogin(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;

  const redirectTo = new URL("/auth/callback", origin).toString();

  // Response temporaire: Supabase va y écrire les cookies PKCE
  const cookieResponse = NextResponse.redirect(new URL("/login?status=redirecting", origin));
  const supabase = createSupabaseRouteClient(request, cookieResponse);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data?.url) {
    const code = error?.code ?? "auth_failed";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, origin));
  }

  // Vraie redirection vers Google
  const redirectResponse = NextResponse.redirect(data.url);

  // Copier les cookies posés par Supabase (PKCE) vers la redirection Google
  for (const c of cookieResponse.cookies.getAll()) {
    redirectResponse.cookies.set(c.name, c.value, c);
  }

  return redirectResponse;
}

export async function GET(request: NextRequest) {
  return handleLogin(request);
}

export async function POST(request: NextRequest) {
  return handleLogin(request);
}

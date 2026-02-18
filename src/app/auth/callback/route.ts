import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;

  const code = url.searchParams.get("code");
  const errorCode = url.searchParams.get("error_code");

  if (errorCode) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorCode)}`, origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  const response = NextResponse.redirect(new URL("/", origin));
  const supabase = createSupabaseRouteClient(request, response);

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const params = new URLSearchParams({
      error: error.code ?? "auth_failed",
      details: error.message,
    });
    return NextResponse.redirect(new URL(`/login?${params.toString()}`, origin));
  }

  return response;
}

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export function createSupabaseRouteClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          const isProd = process.env.NODE_ENV === "production";

          cookiesToSet.forEach(({ name, value, options }) => {
            // Préserver les options de Supabase et ajuster pour le développement local
            response.cookies.set(name, value, {
              ...options,
              path: options?.path || "/",
              sameSite: (options?.sameSite as "lax" | "strict" | "none") || "lax",
              secure: options?.secure !== undefined ? options.secure : isProd,
            });
          });
        },
      },
    }
  );
}

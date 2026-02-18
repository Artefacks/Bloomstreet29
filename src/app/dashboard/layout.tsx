import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "../../lib/supabase/server";

type LeagueContext = { leagueId: string; role: "admin" | "player" } | null;

async function getCurrentLeagueContext(userId: string): Promise<LeagueContext> {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient();

  const cookieLeagueId = cookieStore.get("current_room_id")?.value;
  if (cookieLeagueId) {
    const { data: member, error: memberError } = await supabase
      .from("league_members")
      .select("league_id, role")
      .eq("user_id", userId)
      .eq("league_id", cookieLeagueId)
      .maybeSingle();

    if (memberError) {
      console.error("[DashboardLayout] Erreur vérification membership cookie:", memberError);
    } else if (member?.league_id) {
      return { leagueId: member.league_id, role: member.role as "admin" | "player" };
    }
  }

  const { data, error } = await supabase
    .from("league_members")
    .select("league_id, role")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[DashboardLayout] Erreur lecture league_members:", error);
    return null;
  }

  if (!data?.league_id) return null;
  return { leagueId: data.league_id, role: data.role as "admin" | "player" };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();

  // Étape 1 : vérifier session Supabase
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userId = user.id;

  const leagueContext = await getCurrentLeagueContext(userId);

  if (!leagueContext) {
    redirect("/onboarding");
  }

  const { role } = leagueContext;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <a
                href="/dashboard"
                className="flex items-center px-3 py-2 text-lg font-semibold"
              >
                Bloomstreet 1929
              </a>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/dashboard/portfolio"
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Portfolio
              </a>
              <a
                href="/dashboard/orders"
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Ordres
              </a>
              <a
                href="/dashboard/leaderboard"
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Classement
              </a>
              {role === "admin" && (
                <a
                  href="/dashboard/admin"
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Admin
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}



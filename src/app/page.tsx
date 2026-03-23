import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAvatarEmoji } from "@/lib/avatars";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { display_name: string | null; avatar: string | null } | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-2xl mx-auto text-center px-4">
          <h1 className="text-4xl font-bold mb-4">Bloomstreet 29</h1>
          <p className="text-lg text-gray-600 mb-8">
            Jeu de trading fictif. Connecte-toi pour créer ou rejoindre une
            partie.
          </p>
          <Link
            href="/login"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profile?.display_name?.trim() || user.email?.split("@")[0] || "utilisateur";
  const avatarEmoji = getAvatarEmoji(profile?.avatar);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-2xl mx-auto text-center px-4">
        <h1 className="text-4xl font-bold mb-4">Bloomstreet 29</h1>
        <p className="text-lg text-gray-600 mb-8 flex items-center justify-center gap-2">
          <span className="text-2xl">{avatarEmoji}</span>
          Bonjour, {displayName}.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/games/new"
            className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition"
          >
            Créer une partie
          </Link>
          <Link
            href="/games/join"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Rejoindre une partie
          </Link>
        </div>
        <div className="mt-8 flex items-center justify-center gap-4 text-sm flex-wrap">
          <Link href="/profile/setup" className="text-gray-600 hover:text-gray-800 underline">
            Modifier mon profil
          </Link>
          <form method="POST" action="/auth/logout" className="inline">
            <button type="submit" className="text-gray-600 hover:text-gray-800 underline">
              Déconnexion
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

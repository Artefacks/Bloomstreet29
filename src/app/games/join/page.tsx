import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function JoinGamePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const error = params.error;

  const errorMessages: Record<string, string> = {
    code_required: "Entrez le code de la partie.",
    not_found: "Aucune partie avec ce code.",
    join_failed: "Impossible de rejoindre. Réessayez.",
  };
  const errorMessage = error ? errorMessages[error] ?? `Erreur : ${error}` : null;

  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("id, join_code, game_mode, status, ends_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const now = Date.now();
  const visibleGames = (games ?? []).filter((g) => {
    if (g.status === "finished") return false;
    if (!g.ends_at) return true;
    return new Date(g.ends_at).getTime() > now;
  });
  const visibleGameIds = visibleGames.map((g) => g.id);

  const joinedSet = new Set<string>();
  if (visibleGameIds.length > 0) {
    const { data: myMemberships } = await supabase
      .from("game_players")
      .select("game_id")
      .eq("user_id", user.id)
      .in("game_id", visibleGameIds);

    (myMemberships ?? []).forEach((m) => joinedSet.add(m.game_id));
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white p-8 rounded-lg shadow">
          <h1 className="text-2xl font-bold mb-6">Rejoindre une partie</h1>

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
              {errorMessage}
            </div>
          )}

          <form method="POST" action="/api/games/join" className="space-y-4">
            <div>
              <label htmlFor="joinCode" className="block text-sm font-medium mb-1">
                Code de la partie (6 caractères)
              </label>
              <input
                type="text"
                id="joinCode"
                name="joinCode"
                required
                maxLength={6}
                placeholder="ABC123"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Rejoindre
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            <Link href="/" className="text-blue-600 hover:underline">
              Retour à l&apos;accueil
            </Link>
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Parties existantes</h2>
          {gamesError ? (
            <p className="text-sm text-red-600">
              Impossible de charger la liste des parties ({gamesError.message}).
            </p>
          ) : visibleGames.length === 0 ? (
            <p className="text-sm text-gray-500">
              Aucune partie visible pour l&apos;instant. Crée une partie ou demande un code à un ami.
            </p>
          ) : (
            <div className="space-y-2">
              {visibleGames.map((game) => {
                const isJoined = joinedSet.has(game.id);
                const modeLabel = game.game_mode === "blitz" ? "⚡ Blitz" : "📈 Classique";
                const endsAt =
                  game.ends_at && !Number.isNaN(new Date(game.ends_at).getTime())
                    ? new Date(game.ends_at).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : null;

                return (
                  <div key={game.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold tracking-wide">{game.join_code}</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{modeLabel}</span>
                      </div>
                      {endsAt && (
                        <p className="text-xs text-gray-500 mt-1">Fin prévue : {endsAt}</p>
                      )}
                    </div>
                    <div>
                      {isJoined ? (
                        <Link
                          href={`/games/${game.id}`}
                          className="inline-block px-3 py-1.5 text-xs rounded bg-teal-600 text-white hover:bg-teal-700"
                        >
                          Ouvrir
                        </Link>
                      ) : (
                        <form method="POST" action="/api/games/join">
                          <input type="hidden" name="joinCode" value={game.join_code} />
                          <button
                            type="submit"
                            className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Rejoindre
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

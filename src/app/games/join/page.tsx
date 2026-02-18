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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
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
    </div>
  );
}

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NewGamePage({
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
    code: "Impossible de générer un code unique. Réessayez.",
    creation: "Erreur lors de la création de la partie.",
    membership: "Partie créée mais erreur d’inscription. Contactez le support.",
  };
  const errorMessage = error ? errorMessages[error] ?? `Erreur : ${error}` : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6">Créer une partie</h1>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        <form method="POST" action="/api/games/create" className="space-y-4">
          <div>
            <label htmlFor="durationDays" className="block text-sm font-medium mb-1">
              Durée (jours)
            </label>
            <input
              type="number"
              id="durationDays"
              name="durationDays"
              min={1}
              defaultValue={7}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="initialCash" className="block text-sm font-medium mb-1">
              Cash initial
            </label>
            <input
              type="number"
              id="initialCash"
              name="initialCash"
              min={0}
              step={1000}
              defaultValue={100000}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
          >
            Créer la partie
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

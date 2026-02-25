import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NewGameForm } from "./NewGameForm";

const errorMessages: Record<string, string> = {
  code: "Impossible de générer un code unique. Réessayez.",
  creation: "Erreur lors de la création de la partie.",
  membership: "Partie créée mais erreur d'inscription. Contactez le support.",
};

export default async function NewGamePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] ?? `Erreur : ${params.error}` : null;

  return <NewGameForm errorMessage={errorMessage} />;
}

"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    auth_failed: "Échec de l'authentification.",
    missing_code: "Code manquant. Réessayez depuis Google.",
    redirect_url_not_allowed:
      "URL de redirection non autorisée. Vérifie Supabase → Authentication → URL Configuration.",
  };

  const details = searchParams.get("details");
  const errorMessage = error
    ? errorMessages[error] ?? `Erreur : ${error}`
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Bloomstreet 29
        </h1>

        {status === "redirecting" && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">
            Redirection vers Google…
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
            {errorMessage}
            {details && (
              <p className="mt-2 text-xs opacity-80 break-all">{details}</p>
            )}
          </div>
        )}

        {/* IMPORTANT : lien GET, pas de form POST */}
        <a
          href="/auth/login"
          className="block w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition text-center"
        >
          Continuer avec Google
        </a>

        <p className="mt-4 text-center text-sm text-gray-500">
          <Link href="/" className="text-blue-600 hover:underline">
            Retour à l&apos;accueil
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Chargement…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

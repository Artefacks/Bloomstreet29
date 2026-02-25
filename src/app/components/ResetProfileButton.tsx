"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResetProfileButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!confirm("Réinitialiser ton profil ? Tu reverras l’écran de choix du personnage au prochain chargement.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/profile/reset", { method: "POST" });
      if (res.ok) {
        router.push("/profile/setup");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleReset}
      disabled={loading}
      className="text-gray-500 hover:text-gray-700 underline text-sm disabled:opacity-50"
    >
      {loading ? "…" : "Réinitialiser (revoir le tuto)"}
    </button>
  );
}

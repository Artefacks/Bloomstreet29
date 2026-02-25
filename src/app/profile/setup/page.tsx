"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function SkipProfileLink() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSkip = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: "Joueur", avatar: null }),
      });
      router.push("/");
      router.refresh();
    } catch {
      router.push("/");
    }
  };

  return (
    <button
      type="button"
      onClick={handleSkip}
      disabled={loading}
      className="text-teal-600 hover:underline disabled:opacity-50"
    >
      {loading ? "…" : "Passer (utiliser mon email)"}
    </button>
  );
}

const AVATARS = [
  { id: "bull", emoji: "🐂", label: "Taureau" },
  { id: "bear", emoji: "🐻", label: "Ours" },
  { id: "fox", emoji: "🦊", label: "Renard" },
  { id: "owl", emoji: "🦉", label: "Hibou" },
  { id: "whale", emoji: "🐋", label: "Baleine" },
  { id: "lion", emoji: "🦁", label: "Lion" },
  { id: "eagle", emoji: "🦅", label: "Aigle" },
  { id: "chart", emoji: "📈", label: "Chart" },
  { id: "diamond", emoji: "💎", label: "Diamant" },
  { id: "rocket", emoji: "🚀", label: "Fusée" },
];

export default function ProfileSetupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<string | null>("fox");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) {
          setDisplayName(data.profile.display_name ?? "");
          setAvatar(data.profile.avatar ?? "fox");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName, avatar }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur");
        setSaving(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Erreur réseau");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-teal-50/30 to-amber-50/40 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          Choisis ton personnage
        </h1>
        <p className="text-slate-600 text-sm mb-6">
          Comment veux-tu apparaître dans les classements ?
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 mb-2">
              Ton pseudo
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: TraderPro, Marie, BullMaster…"
              maxLength={50}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Ton avatar
            </label>
            <div className="grid grid-cols-5 gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAvatar(a.id)}
                  className={`
                    p-3 rounded-xl text-2xl transition-all border-2
                    ${avatar === a.id
                      ? "border-teal-500 bg-teal-50 ring-2 ring-teal-200"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }
                  `}
                  title={a.label}
                >
                  {a.emoji}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || displayName.trim().length < 2}
            className="w-full py-3 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Enregistrement…" : "C&apos;est parti !"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          <SkipProfileLink />
        </p>
      </div>
    </div>
  );
}

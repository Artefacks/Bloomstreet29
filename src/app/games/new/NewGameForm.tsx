"use client";

import Link from "next/link";
import { useState } from "react";

const GAME_MODES = [
  {
    id: "classic",
    name: "Classique",
    emoji: "📈",
    durationLabel: "7 jours",
    durationDays: 7,
    initialCash: 100_000,
    feeBps: 10,
    leverage: 1,
    description: "Partie traditionnelle sur une semaine. Idéal pour apprendre et prendre le temps d'analyser le marché.",
    highlights: ["Prix réalistes", "Ordres limite", "Classement hebdo"],
  },
  {
    id: "blitz",
    name: "Blitz",
    emoji: "⚡",
    durationLabel: "1 heure",
    durationMinutes: 60,
    initialCash: 50_000,
    feeBps: 0,
    leverage: 2,
    description: "Mode éducatif rapide: Tech (volatil), Energy (intermédiaire), Bonds (stable). Parfait en solo ou entre amis.",
    highlights: ["3 classes d'actifs", "Événements 6 min", "Signal partiel", "2× gains & pertes", "0 % frais"],
  },
] as const;

export function NewGameForm({ errorMessage }: { errorMessage: string | null }) {
  const [mode, setMode] = useState<"classic" | "blitz">("classic");
  const [customDays, setCustomDays] = useState(7);
  const [customCash, setCustomCash] = useState(100_000);

  const config = GAME_MODES.find((m) => m.id === mode)!;
  const durationDays = mode === "blitz" ? 0 : customDays;
  const initialCash = mode === "classic" ? customCash : config.initialCash;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-amber-50/40 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Créer une partie
          </h1>
          <p className="text-slate-600">
            Choisis ton mode, invite tes amis avec le code, et bats-les sur le marché.
          </p>
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-xl border border-red-200 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {GAME_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`
                p-5 rounded-xl border-2 text-left transition-all
                ${mode === m.id
                  ? "border-teal-500 bg-teal-50 shadow-md"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                }
              `}
            >
              <span className="text-2xl mb-2 block">{m.emoji}</span>
              <span className="font-semibold text-slate-800">{m.name}</span>
              <span className="text-xs text-slate-500 block mt-0.5">{m.durationLabel}</span>
              <p className="text-xs text-slate-600 mt-2 line-clamp-2">{m.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {m.highlights.map((h) => (
                  <span
                    key={h}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* Config card */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-800 mb-4">
            {mode === "blitz" ? "Paramètres Blitz" : "Personnaliser"}
          </h2>

          {mode === "classic" && (
            <div className="space-y-4 mb-4">
              <div>
                <label htmlFor="durationDays" className="block text-sm font-medium text-slate-700 mb-1">
                  Durée (jours)
                </label>
                <input
                  type="number"
                  id="durationDays"
                  name="durationDays"
                  min={1}
                  max={90}
                  value={customDays}
                  onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value, 10) || 7))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label htmlFor="initialCash" className="block text-sm font-medium text-slate-700 mb-1">
                  Cash initial (CHF)
                </label>
                <input
                  type="number"
                  id="initialCash"
                  name="initialCash"
                  min={1000}
                  step={1000}
                  value={customCash}
                  onChange={(e) => setCustomCash(Math.max(1000, parseFloat(e.target.value) || 100_000))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
          )}

          {mode === "blitz" && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 mb-4">
              <p className="text-sm text-amber-800">
                <strong>⚡ Blitz</strong> : 1h chrono, 50 000 CHF. 3 classes d&apos;actifs (Tech, Energy, Bonds),
                événements toutes les 6 min, signal partiel, prix simulés et levier 2×.
              </p>
            </div>
          )}

          <form method="POST" action="/api/games/create" className="space-y-4">
            <input type="hidden" name="gameMode" value={mode} />
            <input type="hidden" name="durationDays" value={durationDays} />
            <input type="hidden" name="durationMinutes" value={mode === "blitz" ? 60 : 0} />
            <input type="hidden" name="initialCash" value={initialCash} />
            <input type="hidden" name="leverageMultiplier" value={config.leverage} />
            <input type="hidden" name="feeBps" value={config.feeBps} />

            <button
              type="submit"
              className="w-full py-4 rounded-xl font-semibold text-white transition-all
                bg-teal-600 hover:bg-teal-700 active:scale-[0.99]
                shadow-lg shadow-teal-600/25 hover:shadow-xl"
            >
              Créer la partie
            </button>
          </form>
        </div>

        {/* New player tip */}
        <div className="bg-slate-100/80 rounded-xl p-4 mb-6">
          <h3 className="font-medium text-slate-700 text-sm mb-2">Nouveau sur Bloomstreet ?</h3>
          <ul className="text-xs text-slate-600 space-y-1">
            <li>• Tu reçois un <strong>code à 6 caractères</strong> — partage-le pour inviter des amis</li>
            <li>• Achète des actions au prix du marché ou place des ordres limite</li>
            <li>• Le joueur avec le plus de valeur en portefeuille à la fin gagne</li>
          </ul>
        </div>

        <p className="text-center text-sm text-slate-500">
          <Link href="/" className="text-teal-600 hover:underline font-medium">
            ← Retour à l&apos;accueil
          </Link>
        </p>
      </div>
    </div>
  );
}

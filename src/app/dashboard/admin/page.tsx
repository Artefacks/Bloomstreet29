"use client";

import { useEffect, useState } from "react";

type League = {
  id: string;
  name: string;
  displayName: string;
  inviteCode: string;
  status: string;
  startDate: string;
  endDate: string;
  initialCash: number;
  feeBps: number;
  createdAt: string;
};

type Member = {
  userId: string;
  role: string;
  joinedAt: string;
};

type RoomData = {
  league: League;
  members: Member[];
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  active: "En cours",
  completed: "Terminée",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatCash(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export default function AdminPage() {
  const [data, setData] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"idle" | "start" | "finish" | "remove">("idle");
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchRoom = () => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/room", { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 403) {
            setError("Accès réservé aux administrateurs.");
            return null;
          }
          setError("Impossible de charger les informations.");
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json) setData(json);
        setLoading(false);
      })
      .catch(() => {
        setError("Erreur réseau.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRoom();
  }, []);

  const handleStart = () => {
    setAction("start");
    setActionError(null);
    fetch("/api/admin/status/start", { method: "POST", credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setActionError(json.error);
          setAction("idle");
          return;
        }
        setAction("idle");
        fetchRoom();
      })
      .catch(() => {
        setActionError("Erreur réseau.");
        setAction("idle");
      });
  };

  const handleFinish = () => {
    setAction("finish");
    setActionError(null);
    fetch("/api/admin/status/finish", { method: "POST", credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setActionError(json.error);
          setAction("idle");
          return;
        }
        setAction("idle");
        fetchRoom();
      })
      .catch(() => {
        setActionError("Erreur réseau.");
        setAction("idle");
      });
  };

  const handleRemoveMember = (userId: string) => {
    if (!confirm("Retirer ce membre de la compétition ?")) return;
    setAction("remove");
    setActionError(null);
    fetch("/api/admin/members/remove", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setActionError(json.error);
          setAction("idle");
          return;
        }
        setAction("idle");
        fetchRoom();
      })
      .catch(() => {
        setActionError("Erreur réseau.");
        setAction("idle");
      });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-gray-600">Chargement…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-red-600">{error ?? "Aucune donnée."}</p>
        </div>
      </div>
    );
  }

  const { league, members } = data;
  const adminsCount = members.filter((m) => m.role === "admin").length;
  const canRemove = (m: Member) => {
    if (m.role === "admin" && adminsCount <= 1) return false;
    return true;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">Administration</h1>

      {actionError && (
        <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
          {actionError}
        </div>
      )}

      <div className="space-y-6">
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Compétition</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Nom</dt>
              <dd className="font-medium">{league.displayName}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Statut</dt>
              <dd className="font-medium">{STATUS_LABELS[league.status] ?? league.status}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Code d&apos;invitation</dt>
              <dd className="font-mono font-medium">{league.inviteCode}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Début</dt>
              <dd>{formatDate(league.startDate)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Fin</dt>
              <dd>{formatDate(league.endDate)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Capital initial</dt>
              <dd>{formatCash(league.initialCash)}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-3">
            {league.status === "draft" && (
              <button
                type="button"
                onClick={handleStart}
                disabled={action !== "idle"}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {action === "start" ? "Démarrage…" : "Démarrer la compétition"}
              </button>
            )}
            {league.status === "active" && (
              <button
                type="button"
                onClick={handleFinish}
                disabled={action !== "idle"}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {action === "finish" ? "Clôture…" : "Clôturer la compétition"}
              </button>
            )}
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Membres ({members.length})</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">Membre</th>
                  <th className="pb-2 pr-4">Rôle</th>
                  <th className="pb-2 pr-4">Rejoint le</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-gray-700">
                      {m.userId.slice(0, 8)}…
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          m.role === "admin"
                            ? "text-blue-600 font-medium"
                            : "text-gray-600"
                        }
                      >
                        {m.role === "admin" ? "Admin" : "Joueur"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {formatDate(m.joinedAt)}
                    </td>
                    <td className="py-2">
                      {canRemove(m) ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.userId)}
                          disabled={action !== "idle"}
                          className="text-red-600 hover:underline disabled:opacity-50"
                        >
                          Retirer
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          Dernier admin
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

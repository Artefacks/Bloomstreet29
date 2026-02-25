"use client";

import { useState, useEffect } from "react";

export function GameCountdown({ endsAt, gameMode }: { endsAt: string | null; gameMode: "classic" | "blitz" }) {
  const [remaining, setRemaining] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!endsAt) return;

    const update = () => {
      const now = Date.now();
      const end = new Date(endsAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setRemaining("Terminé");
        setFinished(true);
        return;
      }

      const totalSec = Math.floor(diff / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;

      if (gameMode === "blitz" || hours === 0) {
        setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
      } else {
        setRemaining(`${hours}h ${mins}m`);
      }
    };

    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [endsAt, gameMode]);

  if (!remaining) return null;

  return (
    <span className={finished ? "text-slate-400" : gameMode === "blitz" ? "font-mono font-bold text-amber-400 animate-pulse" : ""}>
      {remaining}
    </span>
  );
}

export type BlitzAssetClass = "tech" | "energy" | "bonds";
export type BlitzRole = "insider" | "market_maker" | "investor";
export type BlitzEventType =
  | "good_news"
  | "bad_news"
  | "trend_shift"
  | "flash_crash"
  | "bubble_spike";

export type BlitzEventInfo = {
  type: BlitzEventType;
  title: string;
  description: string;
  techImpact: number;
  energyImpact: number;
  bondsImpact: number;
};

const BLITZ_ASSET_CLASS_MAP: Record<string, BlitzAssetClass> = {
  "BTC.BLITZ": "tech",
  "ETH.BLITZ": "tech",
  "DOGE.BLITZ": "tech",
  "MEME.BLITZ": "tech",
  "MOON.BLITZ": "tech",
  "PEPE.BLITZ": "tech",
  "SHIB.BLITZ": "tech",
  "WOOF.BLITZ": "energy",
  "ROCKET.BLITZ": "energy",
  "DIAMOND.BLITZ": "bonds",
  "YOLO.BLITZ": "tech",
  "LAMBO.BLITZ": "energy",
  "PIZZA.BLITZ": "bonds",
  "NINJA.BLITZ": "tech",
  "LASER.BLITZ": "energy",
  "ZOMBIE.BLITZ": "bonds",
  "UNICORN.BLITZ": "tech",
  "TURBO.BLITZ": "energy",
  "SPACE.BLITZ": "energy",
  "CHAOS.BLITZ": "bonds",
};

const EVENTS: BlitzEventInfo[] = [
  {
    type: "good_news",
    title: "Good News",
    description: "Confiance en hausse, appétit pour le risque.",
    techImpact: 0.016,
    energyImpact: 0.009,
    bondsImpact: -0.004,
  },
  {
    type: "bad_news",
    title: "Bad News",
    description: "Stress de marché, fuite vers les actifs défensifs.",
    techImpact: -0.018,
    energyImpact: -0.011,
    bondsImpact: 0.006,
  },
  {
    type: "trend_shift",
    title: "Trend Shift",
    description: "Rotation sectorielle en cours.",
    techImpact: -0.007,
    energyImpact: 0.012,
    bondsImpact: 0.002,
  },
  {
    type: "flash_crash",
    title: "Flash Crash",
    description: "Vente panique brève, volatilité très élevée.",
    techImpact: -0.028,
    energyImpact: -0.021,
    bondsImpact: -0.006,
  },
  {
    type: "bubble_spike",
    title: "Bubble Spike",
    description: "Rally spéculatif court terme.",
    techImpact: 0.022,
    energyImpact: 0.012,
    bondsImpact: -0.008,
  },
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export function getBlitzRoundState(timestampMs: number, gameStartMs?: number | null) {
  const roundDurationMs = 6 * 60_000;
  // More playable than 45s: keep enough time to read + execute strategy
  const tradeWindowMs = 3 * 60_000;
  const anchor = gameStartMs && Number.isFinite(gameStartMs) ? gameStartMs : 0;
  const elapsedSinceAnchor = Math.max(0, timestampMs - anchor);
  const roundIndex = Math.floor(elapsedSinceAnchor / roundDurationMs);
  const roundStartMs = anchor + roundIndex * roundDurationMs;
  const elapsedMs = timestampMs - roundStartMs;
  const tradeOpen = elapsedMs < tradeWindowMs;
  const tradeRemainingSec = Math.max(0, Math.ceil((tradeWindowMs - elapsedMs) / 1000));
  const roundRemainingSec = Math.max(0, Math.ceil((roundDurationMs - elapsedMs) / 1000));

  return { roundIndex, roundStartMs, tradeOpen, tradeRemainingSec, roundRemainingSec };
}

export function getBlitzAssetClass(symbol: string): BlitzAssetClass {
  return BLITZ_ASSET_CLASS_MAP[symbol] ?? "tech";
}

export function getBlitzAssetClassLabel(assetClass: BlitzAssetClass): string {
  if (assetClass === "tech") return "Tech (volatil)";
  if (assetClass === "energy") return "Energy (moyen)";
  return "Bonds (stable)";
}

export function getBlitzEvent(timestampMs: number): BlitzEventInfo {
  const window6m = Math.floor(timestampMs / (6 * 60_000));
  const idx = hashStr(`blitz:event:${window6m}`) % EVENTS.length;
  return EVENTS[idx];
}

export function getBlitzEventForRound(roundIndex: number): BlitzEventInfo {
  const idx = hashStr(`blitz:event:${roundIndex}`) % EVENTS.length;
  return EVENTS[idx];
}

export function getBlitzSignal(timestampMs: number): string {
  const ev = getBlitzEvent(timestampMs);
  const impacts: Array<{ key: BlitzAssetClass; value: number }> = [
    { key: "tech", value: ev.techImpact },
    { key: "energy", value: ev.energyImpact },
    { key: "bonds", value: ev.bondsImpact },
  ];
  impacts.sort((a, b) => b.value - a.value);
  const best = impacts[0];
  const worst = impacts[2];

  if (best.value > 0.01) {
    return `${getBlitzAssetClassLabel(best.key)} probable hausse`;
  }
  if (worst.value < -0.01) {
    return `${getBlitzAssetClassLabel(worst.key)} sous pression`;
  }
  return "Marché hésitant, privilégie la diversification";
}

export function getBlitzRole(gameId: string, userId: string, playerIds: string[]): BlitzRole {
  const ids = [...playerIds].sort();
  const seed = hashStr(`${gameId}:${userId}:${ids.join(",")}`);
  const roles: BlitzRole[] = ["insider", "market_maker", "investor"];
  return roles[seed % roles.length];
}

export function getRoleDescription(role: BlitzRole): string {
  if (role === "insider") return "Reçoit le signal du prochain tour en avance.";
  if (role === "market_maker") return "Volatilité personnelle +/-10% sur lecture de marché.";
  return "Bonus XP si portefeuille diversifié sur Tech/Energy/Bonds.";
}

export function getInsiderNextSignal(timestampMs: number): string {
  const { roundIndex } = getBlitzRoundState(timestampMs);
  const nextEvent = getBlitzEventForRound(roundIndex + 1);
  const impacts: Array<{ key: BlitzAssetClass; value: number }> = [
    { key: "tech", value: nextEvent.techImpact },
    { key: "energy", value: nextEvent.energyImpact },
    { key: "bonds", value: nextEvent.bondsImpact },
  ];
  impacts.sort((a, b) => b.value - a.value);
  return `Signal avancé: ${getBlitzAssetClassLabel(impacts[0].key)} probable hausse`;
}

export function getBlitzActionHint(timestampMs: number): string {
  const ev = getBlitzEvent(timestampMs);
  const impacts = [
    { key: "tech", value: ev.techImpact },
    { key: "energy", value: ev.energyImpact },
    { key: "bonds", value: ev.bondsImpact },
  ] as Array<{ key: BlitzAssetClass; value: number }>;
  impacts.sort((a, b) => b.value - a.value);

  const longSide = getBlitzAssetClassLabel(impacts[0].key);
  const weakSide = getBlitzAssetClassLabel(impacts[2].key);
  return `Plan simple: surpondère ${longSide}, réduit ${weakSide}.`;
}

export function getDiversificationBonusPct(classCounts: Record<BlitzAssetClass, number>): number {
  const activeClasses = (["tech", "energy", "bonds"] as BlitzAssetClass[]).filter((c) => (classCounts[c] ?? 0) > 0).length;
  if (activeClasses >= 3) return 0.12;
  if (activeClasses === 2) return 0.06;
  return 0;
}

export function getBlitzEventImpact(event: BlitzEventInfo, assetClass: BlitzAssetClass): number {
  if (assetClass === "tech") return event.techImpact;
  if (assetClass === "energy") return event.energyImpact;
  return event.bondsImpact;
}

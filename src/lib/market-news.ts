/**
 * Deterministic market news generator.
 * Only generates news for stocks whose prices are actually moving.
 * Refreshes every 3 minutes for fresh content.
 */

import { getSectorForSymbol, SECTORS, getExchangeForSymbol, isMarketOpen } from "./sectors";

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export type NewsItem = {
  id: string;
  headline: string;
  source: string;
  timestamp: number;
  sentiment: "positive" | "negative" | "neutral";
  symbols: string[];
  sectorId?: string;
};

const SOURCES_EU = ["Reuters", "Financial Times", "Les Echos", "Handelsblatt", "NZZ", "Barron's"];
const SOURCES_US = ["Bloomberg", "WSJ", "CNBC", "MarketWatch", "Barron's"];

function sourcesForSymbol(symbol: string): string[] {
  const ex = getExchangeForSymbol(symbol);
  return ex.suffix === "" ? SOURCES_US : SOURCES_EU;
}

const POSITIVE_HEADLINES = [
  "{name} depasse les attentes des analystes au T4",
  "{name} annonce un partenariat strategique majeur",
  "Hausse de {name} : les investisseurs saluent les resultats",
  "{name} releve ses previsions annuelles",
  "Les ventes de {name} en forte croissance sur le trimestre",
  "{name} lance un programme de rachat d'actions",
  "Rumeur de fusion : {name} en negociation avancee",
  "Les analystes revoient a la hausse leurs objectifs pour {name}",
  "{name} signe un contrat record de plusieurs milliards",
  "{name} : croissance organique superieure aux attentes",
  "Innovation : {name} devoile une technologie disruptive",
  "{name} annonce des dividendes en hausse de 15%",
];

const NEGATIVE_HEADLINES = [
  "{name} : avertissement sur resultats, le titre chute",
  "Scandale chez {name} : enquete reglementaire en cours",
  "{name} annonce un plan de restructuration massif",
  "Les marges de {name} sous pression, inquietude des marches",
  "{name} perd un contrat cle face a la concurrence",
  "Rappel de produit : {name} fait face a une crise",
  "{name} revoit ses previsions a la baisse pour l'exercice",
  "Vente massive sur {name} apres des resultats decevants",
  "{name} : le CEO demissionne, incertitude sur la direction",
  "{name} : perte de parts de marche preoccupante",
  "Regulateurs bloquent le projet d'expansion de {name}",
];

const NEUTRAL_HEADLINES = [
  "{name} publie ses resultats trimestriels en ligne avec le consensus",
  "{name} maintient ses perspectives pour l'annee en cours",
  "{name} confirme son plan d'investissement a moyen terme",
  "Volume d'echanges stable sur {name}",
];

const SECTOR_HEADLINES: Record<string, { positive: string[]; negative: string[] }> = {
  tech: {
    positive: [
      "IA : les investissements explosent, le secteur tech en profite",
      "Cloud computing : la demande depasse toutes les previsions",
      "Semi-conducteurs : la penurie touche a sa fin, rebond attendu",
    ],
    negative: [
      "Regulation tech : Bruxelles durcit le ton sur les geants du numerique",
      "Cybersecurite : une attaque massive frappe le secteur",
      "Tech : les valorisations font craindre une bulle",
    ],
  },
  finance: {
    positive: ["Banques : la remontee des taux booste les marges", "Fintech : les partenariats se multiplient"],
    negative: ["Banques : les provisions pour creances douteuses augmentent", "Crise de confiance dans le secteur bancaire"],
  },
  energy: {
    positive: ["Petrole : l'OPEP reduit la production, les cours grimpent", "Transition energetique : investissements records"],
    negative: ["Petrole : chute des prix apres des inventaires decevants", "Climat : nouvelles reglementations pour le secteur"],
  },
  health: {
    positive: ["Pharma : resultats prometteurs en phase 3", "Sante : les depenses mondiales en hausse structurelle"],
    negative: ["Pharma : echec d'un essai clinique majeur", "Sante : pression politique sur les prix des medicaments"],
  },
  luxury: {
    positive: ["Luxe : la demande chinoise repart en fleche", "Mode : les ventes en ligne explosent"],
    negative: ["Luxe : ralentissement marque en Chine continentale", "Contrefacon : le marche du luxe sous pression"],
  },
  auto: {
    positive: ["Electrique : les ventes de VE depassent les previsions", "Automobile : les carnets de commandes se remplissent"],
    negative: ["Automobile : rappels massifs dans l'industrie", "VE : la guerre des prix mine les marges du secteur"],
  },
};

/**
 * Generate news feed. Only includes stocks that have actually moved.
 * Refreshes every 3 minutes.
 */
export function generateNewsFeed(
  instruments: { symbol: string; name: string | null; price: number | null }[],
  basePrices: Record<string, number>,
  count: number = 8
): NewsItem[] {
  const now = Date.now();
  const windowMin = 3; // new batch every 3 minutes
  const windowId = Math.floor(now / (windowMin * 60_000));

  const news: NewsItem[] = [];

  // Only consider instruments whose price has actually changed
  const active = instruments.filter((i) => {
    if (i.price == null) return false;
    const base = basePrices[i.symbol];
    if (base == null) return false;
    return Math.abs(i.price - base) / base > 0.0001; // moved at least 0.01%
  });

  // Sort by biggest movers
  const movers = active
    .map((i) => ({
      ...i,
      change: ((i.price! - basePrices[i.symbol]) / basePrices[i.symbol]) * 100,
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  // Top movers get news (max 3)
  const topMovers = movers.slice(0, Math.min(3, movers.length));

  for (let i = 0; i < topMovers.length; i++) {
    const mover = topMovers[i];
    const seed = hashStr(`news:${windowId}:mover:${i}:${mover.symbol}`);
    const rng = mulberry32(seed);

    const sector = getSectorForSymbol(mover.symbol);
    const sentiment = mover.change > 0.2 ? "positive" : mover.change < -0.2 ? "negative" : "neutral";

    const templates = sentiment === "positive"
      ? POSITIVE_HEADLINES
      : sentiment === "negative"
        ? NEGATIVE_HEADLINES
        : NEUTRAL_HEADLINES;

    const headline = pick(templates, rng)
      .replace("{name}", mover.name ?? mover.symbol)
      .replace("{symbol}", mover.symbol)
      .replace("{sector}", sector?.name ?? "le marche");

    news.push({
      id: `mv-${windowId}-${i}`,
      headline,
      source: pick(sourcesForSymbol(mover.symbol), rng),
      timestamp: now - Math.floor(rng() * windowMin * 60_000 * 0.8), // max ~2.5 min ago
      sentiment,
      symbols: [mover.symbol],
      sectorId: sector?.id,
    });
  }

  // Sector news — pick a sector that has active stocks
  if (active.length > 0 && news.length < count) {
    const activeSectorIds = [...new Set(active.map((i) => getSectorForSymbol(i.symbol)?.id).filter(Boolean))] as string[];
    if (activeSectorIds.length > 0) {
      const sectorSeed = hashStr(`news:${windowId}:sector`);
      const sectorRng = mulberry32(sectorSeed);
      const sectorId = pick(activeSectorIds, sectorRng);
      const sector = SECTORS.find((s) => s.id === sectorId);
      const sectorHeadlines = SECTOR_HEADLINES[sectorId];
      const isPositive = sectorRng() > 0.5;

      let headline: string;
      if (sectorHeadlines) {
        const pool = isPositive ? sectorHeadlines.positive : sectorHeadlines.negative;
        headline = pick(pool, sectorRng);
      } else if (sector) {
        const templates = isPositive ? POSITIVE_HEADLINES : NEGATIVE_HEADLINES;
        headline = pick(templates, sectorRng).replace("{name}", sector.name).replace("{sector}", sector.name);
      } else {
        headline = "Les marches evoluent dans un contexte incertain";
      }

      news.push({
        id: `sec-${windowId}`,
        headline,
        source: pick(SOURCES_EU, sectorRng),
        timestamp: now - Math.floor(sectorRng() * windowMin * 60_000 * 0.6),
        sentiment: isPositive ? "positive" : "negative",
        symbols: [],
        sectorId,
      });
    }
  }

  // Fill remaining with other active stocks
  if (active.length > 0) {
    const generalSeed = hashStr(`news:${windowId}:fill`);
    const generalRng = mulberry32(generalSeed);
    const used = new Set(news.flatMap((n) => n.symbols));

    const remaining = active.filter((i) => !used.has(i.symbol));
    let idx = 0;
    while (news.length < count && remaining.length > 0 && idx < 20) {
      const inst = pick(remaining, generalRng);
      if (used.has(inst.symbol)) { idx++; continue; }
      used.add(inst.symbol);

      const sector = getSectorForSymbol(inst.symbol);
      const change = ((inst.price! - basePrices[inst.symbol]) / basePrices[inst.symbol]) * 100;
      const sentiment = change > 0.1 ? "positive" : change < -0.1 ? "negative" : "neutral";

      const templates = sentiment === "positive"
        ? POSITIVE_HEADLINES
        : sentiment === "negative"
          ? NEGATIVE_HEADLINES
          : NEUTRAL_HEADLINES;

      const headline = pick(templates, generalRng)
        .replace("{name}", inst.name ?? inst.symbol)
        .replace("{symbol}", inst.symbol)
        .replace("{sector}", sector?.name ?? "le marche");

      news.push({
        id: `fill-${windowId}-${news.length}`,
        headline,
        source: pick(sourcesForSymbol(inst.symbol), generalRng),
        timestamp: now - Math.floor(generalRng() * windowMin * 60_000 * 0.9),
        sentiment,
        symbols: [inst.symbol],
        sectorId: sector?.id,
      });
      idx++;
    }
  }

  // If still no news (nothing has moved yet), show a waiting message
  if (news.length === 0) {
    news.push({
      id: `wait-${windowId}`,
      headline: "Marches calmes — en attente des prochains mouvements",
      source: "Reuters",
      timestamp: now,
      sentiment: "neutral",
      symbols: [],
    });
  }

  return news.sort((a, b) => b.timestamp - a.timestamp).slice(0, count);
}

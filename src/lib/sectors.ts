/**
 * Sector definitions for all 100 instruments.
 * Each instrument belongs to exactly one sector.
 */

export type Sector = {
  id: string;
  name: string;
  emoji: string;
  color: string; // tailwind color for badges/charts
};

export const SECTORS: Sector[] = [
  { id: "tech", name: "Technologie", emoji: "💻", color: "#6366f1" },
  { id: "finance", name: "Finance", emoji: "🏦", color: "#f59e0b" },
  { id: "health", name: "Santé", emoji: "💊", color: "#10b981" },
  { id: "consumer", name: "Consommation", emoji: "🛒", color: "#ec4899" },
  { id: "industry", name: "Industrie", emoji: "🏗️", color: "#8b5cf6" },
  { id: "energy", name: "Énergie", emoji: "⛽", color: "#ef4444" },
  { id: "luxury", name: "Luxe & Mode", emoji: "💎", color: "#d946ef" },
  { id: "auto", name: "Automobile", emoji: "🚗", color: "#0ea5e9" },
  { id: "telecom", name: "Télécoms", emoji: "📡", color: "#14b8a6" },
  { id: "materials", name: "Matériaux", emoji: "🧱", color: "#78716c" },
  { id: "realestate", name: "Immobilier", emoji: "🏠", color: "#a3e635" },
  { id: "insurance", name: "Assurance", emoji: "🛡️", color: "#fbbf24" },
];

const SYMBOL_SECTOR_MAP: Record<string, string> = {
  // ── Tech ──
  "NVDA": "tech", "TSLA": "tech", "GOOG": "tech", "AMD": "tech", "INTC": "tech",
  "CRM": "tech", "ORCL": "tech", "ADBE": "tech", "AVGO": "tech", "QCOM": "tech",
  "SNOW": "tech", "PLTR": "tech", "SAP.DE": "tech", "ASML.AS": "tech",
  "TEMN.SW": "tech", "LOGN.SW": "tech", "TSM": "tech", "NFLX": "tech",
  "NOKIA.HE": "telecom", "ERIC-B.ST": "telecom",

  // ── Finance ──
  "JPM": "finance", "GS": "finance", "BAC": "finance", "MS": "finance",
  "V": "finance", "MA": "finance", "PYPL": "finance",
  "UBSG.SW": "finance", "CSGN.SW": "finance",
  "BNP.PA": "finance", "DBK.DE": "finance",
  "BBVA.MC": "finance", "SAN.MC": "finance", "HSBC": "finance",
  "BRK.B": "finance",

  // ── Insurance ──
  "SREN.SW": "insurance", "ZURN.SW": "insurance", "SLHN.SW": "insurance",
  "ALV.DE": "insurance",

  // ── Health ──
  "JNJ": "health", "PFE": "health", "MRK": "health", "UNH": "health", "LLY": "health",
  "NOVN.SW": "health", "ROG.SW": "health", "ALC.SW": "health",
  "SAN.PA": "health",

  // ── Consumer ──
  "KO": "consumer", "PEP": "consumer", "MCD": "consumer", "SBUX": "consumer",
  "WMT": "consumer", "COST": "consumer", "HD": "consumer", "LOW": "consumer",
  "DIS": "consumer", "UBER": "consumer",
  "NESN.SW": "consumer", "BARN.SW": "consumer", "DKSH.SW": "consumer",
  "GEBN.SW": "consumer",
  "OR.PA": "consumer",

  // ── Luxury & Fashion ──
  "MC.PA": "luxury", "RICN.SW": "luxury", "NKE": "luxury",
  "ADS.DE": "luxury", "RACE": "luxury",

  // ── Industry ──
  "BA": "industry", "CAT": "industry", "GE": "industry",
  "ABBN.SW": "industry", "SGSN.SW": "industry", "SIKA.SW": "industry",
  "VATN.SW": "industry",
  "AIR.PA": "industry", "DG.PA": "industry", "SU.PA": "industry", "CAP.PA": "industry",
  "SIE.DE": "industry",

  // ── Energy ──
  "XOM": "energy", "CVX": "energy", "SLB": "energy",
  "TTE.PA": "energy", "RWE.DE": "energy", "ENI.MI": "energy",

  // ── Automobile ──
  "F": "auto", "GM": "auto",
  "VOW3.DE": "auto", "BMW.DE": "auto", "DAI.DE": "auto",

  // ── Materials / Chemicals ──
  "BAS.DE": "materials", "GIVN.SW": "materials", "CLN.SW": "materials",
  "HOLN.SW": "materials", "LONN.SW": "materials",
  "AI.PA": "materials", "BHP": "materials",

  // ── Real Estate ──
  "PSPN.SW": "realestate", "SPSN.SW": "realestate",
};

export function getSectorForSymbol(symbol: string): Sector | null {
  const sectorId = SYMBOL_SECTOR_MAP[symbol];
  if (!sectorId) return null;
  return SECTORS.find((s) => s.id === sectorId) ?? null;
}

export function getSectorId(symbol: string): string {
  return SYMBOL_SECTOR_MAP[symbol] ?? "other";
}

export function getSymbolsBySector(sectorId: string): string[] {
  return Object.entries(SYMBOL_SECTOR_MAP)
    .filter(([, sid]) => sid === sectorId)
    .map(([sym]) => sym);
}

/**
 * Calculate sector index performance from price data.
 * Returns percentage change from the average base prices.
 */
export function calcSectorIndices(
  prices: Record<string, { price: number | null; prevPrice?: number | null }>
): { sector: Sector; avgPrice: number; change: number; changePct: number; count: number }[] {
  const sectorData: Record<string, { totalPrice: number; totalPrev: number; count: number }> = {};

  for (const [symbol, data] of Object.entries(prices)) {
    const sectorId = SYMBOL_SECTOR_MAP[symbol];
    if (!sectorId || data.price == null) continue;

    if (!sectorData[sectorId]) {
      sectorData[sectorId] = { totalPrice: 0, totalPrev: 0, count: 0 };
    }
    sectorData[sectorId].totalPrice += data.price;
    sectorData[sectorId].totalPrev += data.prevPrice ?? data.price;
    sectorData[sectorId].count += 1;
  }

  return SECTORS.map((sector) => {
    const d = sectorData[sector.id];
    if (!d || d.count === 0) return { sector, avgPrice: 0, change: 0, changePct: 0, count: 0 };
    const avg = d.totalPrice / d.count;
    const avgPrev = d.totalPrev / d.count;
    const change = avg - avgPrev;
    const changePct = avgPrev > 0 ? (change / avgPrev) * 100 : 0;
    return { sector, avgPrice: avg, change, changePct, count: d.count };
  }).filter((s) => s.count > 0);
}

/**
 * Market exchange info with opening hours.
 */
export type Exchange = {
  suffix: string;
  name: string;
  flag: string;
  timezone: string;
  openHour: number;   // local hour
  openMinute: number;
  closeHour: number;
  closeMinute: number;
  weekdays: number[]; // 1=Mon .. 5=Fri
};

export const EXCHANGES: Exchange[] = [
  { suffix: "", name: "NYSE / NASDAQ", flag: "🇺🇸", timezone: "America/New_York", openHour: 9, openMinute: 30, closeHour: 16, closeMinute: 0, weekdays: [1,2,3,4,5] },
  { suffix: ".SW", name: "SIX Swiss", flag: "🇨🇭", timezone: "Europe/Zurich", openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 30, weekdays: [1,2,3,4,5] },
  { suffix: ".PA", name: "Euronext Paris", flag: "🇫🇷", timezone: "Europe/Paris", openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 30, weekdays: [1,2,3,4,5] },
  { suffix: ".DE", name: "XETRA", flag: "🇩🇪", timezone: "Europe/Berlin", openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 30, weekdays: [1,2,3,4,5] },
  { suffix: ".AS", name: "Euronext Amsterdam", flag: "🇳🇱", timezone: "Europe/Amsterdam", openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 30, weekdays: [1,2,3,4,5] },
  { suffix: ".MI", name: "Borsa Italiana", flag: "🇮🇹", timezone: "Europe/Rome", openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 30, weekdays: [1,2,3,4,5] },
  { suffix: ".MC", name: "BME Madrid", flag: "🇪🇸", timezone: "Europe/Madrid", openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 30, weekdays: [1,2,3,4,5] },
  { suffix: ".HE", name: "Nasdaq Helsinki", flag: "🇫🇮", timezone: "Europe/Helsinki", openHour: 10, openMinute: 0, closeHour: 18, closeMinute: 30, weekdays: [1,2,3,4,5] },
  { suffix: ".ST", name: "Nasdaq Stockholm", flag: "🇸🇪", timezone: "Europe/Stockholm", openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 30, weekdays: [1,2,3,4,5] },
];

export function getExchangeForSymbol(symbol: string): Exchange {
  const dotIdx = symbol.lastIndexOf(".");
  if (dotIdx === -1 || symbol === "BRK.B") {
    return EXCHANGES[0]; // US
  }
  const suffix = symbol.substring(dotIdx);
  return EXCHANGES.find((e) => e.suffix === suffix) ?? EXCHANGES[0];
}

/**
 * Check if an exchange is currently open.
 */
export function isMarketOpen(exchange: Exchange): { open: boolean; nextEvent: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: exchange.timezone,
    hour: "numeric", minute: "numeric", hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";

  const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const dayNum = dayMap[weekday] ?? 0;

  const isWeekday = exchange.weekdays.includes(dayNum);
  const timeMinutes = hour * 60 + minute;
  const openMinutes = exchange.openHour * 60 + exchange.openMinute;
  const closeMinutes = exchange.closeHour * 60 + exchange.closeMinute;

  const isOpen = isWeekday && timeMinutes >= openMinutes && timeMinutes < closeMinutes;

  let nextEvent: string;
  if (isOpen) {
    const minsLeft = closeMinutes - timeMinutes;
    const h = Math.floor(minsLeft / 60);
    const m = minsLeft % 60;
    nextEvent = `Ferme dans ${h}h${m.toString().padStart(2, "0")}`;
  } else if (isWeekday && timeMinutes < openMinutes) {
    const minsUntil = openMinutes - timeMinutes;
    const h = Math.floor(minsUntil / 60);
    const m = minsUntil % 60;
    nextEvent = `Ouvre dans ${h}h${m.toString().padStart(2, "0")}`;
  } else {
    nextEvent = `Ouvre lun. ${exchange.openHour}:${exchange.openMinute.toString().padStart(2, "0")}`;
    if (isWeekday && timeMinutes >= closeMinutes) {
      if (dayNum < 5) {
        nextEvent = `Ouvre demain ${exchange.openHour}:${exchange.openMinute.toString().padStart(2, "0")}`;
      }
    }
  }

  return { open: isOpen, nextEvent };
}

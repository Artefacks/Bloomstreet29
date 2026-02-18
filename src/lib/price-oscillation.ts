/**
 * Micro-oscillation déterministe — même formule pour graphique et carnet d'ordre.
 * tick = intervalle de 5 secondes (pour rester synchronisé avec le carnet).
 */
export function tickOscillation(base: number, symbol: string, tick: number): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = ((h << 5) - h + symbol.charCodeAt(i)) | 0;
  const seed = (h ^ tick) >>> 0;
  const r = ((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff * 2 - 1;
  return Math.round(base * (1 + r * 0.0006) * 100) / 100;
}

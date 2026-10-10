/**
 * Atraso do aparelho no Batida: o tempo entre o som sair e a pessoa reagir, somando a tela e o
 * toque. É descontado de cada toque. Padrão 0; quem quiser ajusta de canto (não pergunta antes de
 * cada partida).
 */
const KEY = 'nocap-batida-latency';
export const BATIDA_LATENCY_LIMIT_MS = 250;

export function getBatidaLatency(): number {
  try {
    const n = Number(localStorage.getItem(KEY));
    return Number.isFinite(n)
      ? Math.max(-BATIDA_LATENCY_LIMIT_MS, Math.min(BATIDA_LATENCY_LIMIT_MS, Math.round(n)))
      : 0;
  } catch {
    return 0;
  }
}

export function setBatidaLatency(ms: number) {
  try {
    localStorage.setItem(KEY, String(Math.round(ms)));
  } catch {
    /* sem storage: vale o padrão */
  }
}

/**
 * Atraso estimado a partir de toques feitos no ritmo de uma batida: cada toque cai no instante da
 * batida mais próxima, e a mediana dos desvios é o atraso (mediana: um toque fora da curva não
 * estraga). `null` se não houver toques suficientes.
 */
export function estimateLatency(deviations: readonly number[]): number | null {
  if (deviations.length < 4) return null;
  const sorted = [...deviations].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Math.max(-BATIDA_LATENCY_LIMIT_MS, Math.min(BATIDA_LATENCY_LIMIT_MS, Math.round(median)));
}

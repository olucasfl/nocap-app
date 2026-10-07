/** `8400` → `8,40 s` (duas casas, vírgula decimal). */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2).replace('.', ',')} s`;
}

/** Diferença com sinal: `+0,31 s` (passou) ou `−0,12 s` (parou antes). */
export function formatDiff(ms: number): string {
  const sign = ms > 0 ? '+' : ms < 0 ? '−' : '±';
  return `${sign}${(Math.abs(ms) / 1000).toFixed(2).replace('.', ',')} s`;
}

/** Palavra do carimbo, para a nota da rodada. */
export function verdictWord(score: number): string {
  if (score >= 9.5) return 'cravou';
  if (score >= 8) return 'quase!';
  if (score >= 5) return 'meh';
  return 'errou';
}

/** Os dois toques são a mesma coisa: ignorar o segundo se vier colado no primeiro. */
export const MIN_TAP_GAP_MS = 250;

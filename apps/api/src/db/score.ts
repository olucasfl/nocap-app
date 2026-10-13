/**
 * A maior nota (em décimos) que o servidor guarda. As colunas de nota são `integer` (a migration
 * 0006 alargou o antigo `smallint`, que estourava acima de 3276 pontos do Block's). Este teto é a
 * defesa final: nenhum jogo, atual ou futuro, derruba o salvamento de uma partida por nota alta.
 */
export const SCORE_MAX = 2_000_000_000;

export function clampScore(tenths: number): number {
  if (!Number.isFinite(tenths)) return 0;
  return Math.max(-SCORE_MAX, Math.min(SCORE_MAX, Math.round(tenths)));
}

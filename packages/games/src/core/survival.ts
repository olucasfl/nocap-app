/**
 * Regras do modo Sobrevivência (Cor e Tempo): 3 vidas, uma nota mínima por rodada e o resultado é
 * quantas rodadas a pessoa jogou. Lógica pura, usada pelo app (para jogar) e pelo servidor (para
 * conferir que a partida enviada é uma sobrevivência completa).
 *
 * - Cor: a nota mínima sobe com o avanço (6, 7 na rodada 5, 8 na 10, 9 na 15 e 10 da 20 em
 *   diante) e quem passa por todas as 30 rodadas ganha.
 * - Tempo: nota mínima fixa 6, até 20 rodadas.
 */

export type SurvivalGame = 'color' | 'time';

export const SURVIVAL_LIVES = 3;
/** Limite de rodadas; quem chega aqui "completou" (e é o máximo que o servidor aceita). */
export const SURVIVAL_MAX_ROUNDS: Record<SurvivalGame, number> = { color: 30, time: 20 };

/** Nota mínima para não perder vida na rodada `index` (0 = primeira). */
export function survivalMinScore(game: SurvivalGame, index: number): number {
  if (game === 'time') return 6;
  if (index < 4) return 6; // rodadas 1–4
  if (index < 9) return 7; // 5–9
  if (index < 14) return 8; // 10–14
  if (index < 19) return 9; // 15–19
  return 10; // 20 em diante: só o perfeito
}

/** Na Cor, o tempo para decorar cai a cada rodada: de 3 s até 0,8 s. */
export function survivalShowMs(index: number): number {
  return Math.max(800, 3000 - index * 150);
}

export interface SurvivalState {
  /** Rodadas jogadas até aqui (incluindo a que fez perder a última vida). */
  played: number;
  lives: number;
  /** `lives`: acabaram as vidas; `cap`: chegou ao limite de rodadas; `null`: segue jogando. */
  ended: 'lives' | 'cap' | null;
  /** Por rodada: a nota atingiu o mínimo? */
  passed: boolean[];
}

/** Reproduz a partida a partir das notas, na ordem. Para na rodada em que o jogo termina. */
export function evaluateSurvival(game: SurvivalGame, scores: number[]): SurvivalState {
  const max = SURVIVAL_MAX_ROUNDS[game];
  let lives = SURVIVAL_LIVES;
  const passed: boolean[] = [];
  for (let i = 0; i < scores.length; i++) {
    const ok = scores[i]! >= survivalMinScore(game, i);
    passed.push(ok);
    if (!ok) lives -= 1;
    if (lives <= 0) return { played: i + 1, lives: 0, ended: 'lives', passed };
    if (i + 1 >= max) return { played: i + 1, lives, ended: 'cap', passed };
  }
  return { played: scores.length, lives, ended: null, passed };
}

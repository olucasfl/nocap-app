/**
 * Regras do modo Sobrevivência (Cor e Tempo): 3 vidas, uma nota mínima por rodada e o resultado é
 * quantas rodadas a pessoa jogou. Lógica pura, usada pelo app (para jogar) e pelo servidor (para
 * conferir que a partida enviada é uma sobrevivência completa).
 *
 * - A nota mínima sobe de 6 até 9 de cinco em cinco rodadas (6, 7, 7,5, 8, 8,5 e 9) e quem passa
 *   por todas as 30 rodadas ganha, nos dois jogos. Chega a 9 porque 10 exige acertar quase exato
 *   (a cor, ou o tempo na centésima), o que não dá para cobrar de forma consistente.
 */

export type SurvivalGame = 'color' | 'time';

export const SURVIVAL_LIVES = 3;
/** Limite de rodadas; quem chega aqui "completou" (e é o máximo que o servidor aceita). */
export const SURVIVAL_MAX_ROUNDS: Record<SurvivalGame, number> = { color: 30, time: 30 };

/** Nota mínima para não perder vida na rodada `index` (0 = primeira). */
export function survivalMinScore(_game: SurvivalGame, index: number): number {
  if (index < 5) return 6; // rodadas 1–5
  if (index < 10) return 7; // 6–10
  if (index < 15) return 7.5; // 11–15
  if (index < 20) return 8; // 16–20
  if (index < 25) return 8.5; // 21–25
  return 9; // 26–30
}

/** Na Cor, o tempo para decorar cai devagar a cada rodada: de 3 s até 1 s (na rodada 21). */
export function survivalShowMs(index: number): number {
  return Math.max(1000, 3000 - index * 100);
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

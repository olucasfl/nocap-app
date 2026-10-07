/**
 * Regras do modo Sobrevivência (Cor e Tempo): 3 vidas, uma nota mínima por rodada que sobe com o
 * avanço, e o resultado é quantas rodadas a pessoa jogou. Lógica pura, usada pelo app (para
 * jogar) e pelo servidor (para conferir que a partida enviada é uma sobrevivência completa).
 */

export const SURVIVAL_LIVES = 3;
/** Limite de rodadas; quem chega aqui "completou" (e é o máximo que o servidor aceita). */
export const SURVIVAL_MAX_ROUNDS = 20;

/** Nota mínima para não perder vida: 5 nas rodadas 1–3, 6 nas 4–8 e 7 da 9ª em diante. */
export function survivalMinScore(index: number): number {
  if (index < 3) return 5;
  if (index < 8) return 6;
  return 7;
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
export function evaluateSurvival(scores: number[]): SurvivalState {
  let lives = SURVIVAL_LIVES;
  const passed: boolean[] = [];
  for (let i = 0; i < scores.length; i++) {
    const ok = scores[i]! >= survivalMinScore(i);
    passed.push(ok);
    if (!ok) lives -= 1;
    if (lives <= 0) return { played: i + 1, lives: 0, ended: 'lives', passed };
    if (i + 1 >= SURVIVAL_MAX_ROUNDS) return { played: i + 1, lives, ended: 'cap', passed };
  }
  return { played: scores.length, lives, ended: null, passed };
}

/**
 * O progresso das fases do Word's (Bee, Connect e Classic), guardado no aparelho e na conta (spec 037).
 * As funções são puras e as duas pontas usam as mesmas: o aparelho junta o que tem com o que veio da conta, e o
 * servidor junta o que chegou com o que já estava gravado. Regra de ouro: **nunca perder progresso**, então juntar
 * sempre fica com o que está mais adiantado.
 */

export const PROGRESS_GAMES = ['bee', 'connect', 'classic-c', 'classic-d', 'classic-q'] as const;
export type ProgressGame = (typeof PROGRESS_GAMES)[number];
export const isProgressGame = (g: unknown): g is ProgressGame => PROGRESS_GAMES.includes(g as ProgressGame);

export interface BeeProgressData {
  found: string[];
  closed: boolean;
  at: number;
}
export interface ConnectProgressData {
  guesses: string[][];
  at: number;
  gaveUp?: boolean;
  hint?: number;
}
export interface ClassicProgressData {
  guesses: string[];
  at: number;
  gaveUp?: boolean;
  done?: boolean;
}
export type ProgressData<G extends ProgressGame = ProgressGame> = G extends 'bee'
  ? BeeProgressData
  : G extends 'connect'
    ? ConnectProgressData
    : ClassicProgressData;

/** Os limites do que uma fase pode guardar (o servidor recusa o que passar disso). */
export const PROGRESS_LIMITS = { maxLevel: 5000, maxWords: 3000, maxGuesses: 60, maxWordLength: 40 } as const;

const isWord = (w: unknown): w is string => typeof w === 'string' && w.length > 0 && w.length <= PROGRESS_LIMITS.maxWordLength;
const isStamp = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Confere o formato e devolve só os campos conhecidos; `null` se o dado não presta. */
export function sanitizeProgress(game: ProgressGame, raw: unknown): ProgressData | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const at = isStamp(d.at) ? d.at : 0;
  if (game === 'bee') {
    if (!Array.isArray(d.found) || d.found.length > PROGRESS_LIMITS.maxWords || !d.found.every(isWord)) return null;
    return { found: [...new Set(d.found as string[])], closed: d.closed === true, at };
  }
  if (game === 'connect') {
    const g = d.guesses;
    if (!Array.isArray(g) || g.length > PROGRESS_LIMITS.maxGuesses) return null;
    if (!g.every((row) => Array.isArray(row) && row.length === 4 && row.every(isWord))) return null;
    const out: ConnectProgressData = { guesses: g as string[][], at };
    if (d.gaveUp === true) out.gaveUp = true;
    if (typeof d.hint === 'number' && d.hint >= 1 && d.hint <= 4) out.hint = d.hint;
    return out;
  }
  const g = d.guesses;
  if (!Array.isArray(g) || g.length > PROGRESS_LIMITS.maxGuesses || !g.every(isWord)) return null;
  const out: ClassicProgressData = { guesses: g as string[], at };
  if (d.gaveUp === true) out.gaveUp = true;
  if (d.done === true) out.done = true;
  return out;
}

/** O que "mais adiantado" quer dizer em cada jogo: serve para escolher entre duas versões da mesma fase. */
export function progressScore(game: ProgressGame, p: ProgressData): number {
  if (game === 'bee') return (p as BeeProgressData).found.length;
  return (p as ConnectProgressData | ClassicProgressData).guesses.length;
}

/**
 * Junta duas versões do progresso de uma fase sem perder nada:
 *  - Bee: une as palavras achadas e a fase fica fechada se qualquer uma estiver fechada;
 *  - Connect e Classic: fica a lista de palpites mais longa; desistiu, terminou e dica valem se estiverem em qualquer uma.
 * O carimbo `at` é sempre o mais recente.
 */
export function mergeProgress<G extends ProgressGame>(game: G, a: ProgressData<G>, b: ProgressData<G>): ProgressData<G> {
  const at = Math.max(a.at, b.at);
  if (game === 'bee') {
    const x = a as BeeProgressData;
    const y = b as BeeProgressData;
    return { found: [...new Set([...x.found, ...y.found])], closed: x.closed || y.closed, at } as ProgressData<G>;
  }
  const x = a as ConnectProgressData | ClassicProgressData;
  const y = b as ConnectProgressData | ClassicProgressData;
  const longer = y.guesses.length > x.guesses.length ? y : x;
  const out: Record<string, unknown> = { guesses: longer.guesses, at };
  if (x.gaveUp || y.gaveUp) out.gaveUp = true;
  if (game === 'connect') {
    const hint = (x as ConnectProgressData).hint ?? (y as ConnectProgressData).hint;
    if (hint !== undefined) out.hint = hint;
  } else if ((x as ClassicProgressData).done || (y as ClassicProgressData).done) out.done = true;
  return out as unknown as ProgressData<G>;
}

/** As duas versões são a mesma (não precisa gravar de novo)? */
export const sameProgress = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

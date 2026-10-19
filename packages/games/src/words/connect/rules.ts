import { wordKey } from '../text';

/**
 * Connect Word's (spec 034): regras puras. O servidor guarda os puzzles; o aparelho recebe as 16
 * palavras embaralhadas e, a cada palpite, só o que a regra revela.
 */

export const CONNECT_GROUPS = 4;
export const CONNECT_GROUP_SIZE = 4;

export interface ConnectGroup {
  /** 1 amarelo, 2 verde, 3 azul, 4 roxo. */
  level: 1 | 2 | 3 | 4;
  title: string;
  words: string[];
}

export interface ConnectPuzzle {
  id: string;
  groups: ConnectGroup[];
  /** Palavras que também parecem servir a outro grupo (só existe uma divisão certa). */
  traps?: { word: string; alsoFits: string }[];
  themes?: string[];
  notes?: string;
}

const norm = (w: string) => wordKey(w).replace(/[^a-z]/g, '');

/** Palpite comparável: as 4 palavras, sem acento, em ordem. */
export const guessKey = (words: readonly string[]): string => words.map(norm).sort().join('|');

export type ConnectResult = 'correct' | 'one_away' | 'wrong' | 'repeat';

export interface ConnectState {
  /** Grupos já achados, na ordem em que foram achados. */
  found: ConnectGroup[];
  /** Palavras ainda soltas. */
  left: string[];
  /** Quantos palpites errados (não há vidas: o jogo só conta). */
  errors: number;
  won: boolean;
  /** A pessoa desistiu (as palavras que faltavam são reveladas). */
  gaveUp: boolean;
  /** A fase acabou: achou os 4 grupos ou desistiu. */
  over: boolean;
  /** O resultado de cada palpite, na ordem. */
  results: ConnectResult[];
}

/** A classificação de uma fase terminada: pelos erros de quem concluiu, ou a desistência. */
export interface ConnectClass {
  id: 'perfeito' | 'muito-bom' | 'bom' | 'concluida' | 'desistencia';
  name: string;
}

/** Sem erro é Perfeito; de 1 a 2 Muito bom; de 3 a 5 Bom; mais que isso, Concluída. Desistir é Desistência. */
export function connectClass(won: boolean, errors: number, gaveUp: boolean): ConnectClass {
  if (gaveUp || !won) return { id: 'desistencia', name: 'Desistência' };
  if (errors === 0) return { id: 'perfeito', name: 'Perfeito' };
  if (errors <= 2) return { id: 'muito-bom', name: 'Muito bom' };
  if (errors <= 5) return { id: 'bom', name: 'Bom' };
  return { id: 'concluida', name: 'Concluída' };
}

/**
 * A dica (uma por partida): o nome de um dos grupos que ainda não foram achados. Entrega o conjunto mais
 * fácil que falta (o de menor nível), sem mostrar nenhuma palavra.
 */
export function connectHint(puzzle: ConnectPuzzle, guesses: readonly (readonly string[])[]): ConnectGroup | null {
  const state = playConnect(puzzle, guesses);
  const left = puzzle.groups.filter((g) => !state.found.includes(g));
  return [...left].sort((a, b) => a.level - b.level)[0] ?? null;
}

/** O que um palpite de 4 palavras vale contra os grupos que faltam. */
export function judgeGuess(
  groups: readonly ConnectGroup[],
  guess: readonly string[],
): { result: 'correct'; group: ConnectGroup } | { result: 'one_away' | 'wrong' } {
  const keys = guess.map(norm);
  let best = 0;
  for (const g of groups) {
    const set = new Set(g.words.map(norm));
    const hits = keys.filter((k) => set.has(k)).length;
    if (hits === CONNECT_GROUP_SIZE) return { result: 'correct', group: g };
    best = Math.max(best, hits);
  }
  return { result: best === CONNECT_GROUP_SIZE - 1 ? 'one_away' : 'wrong' };
}

/**
 * Refaz a partida pelos palpites (cada um com 4 palavras). Palpite com palavra que não está solta, ou
 * que não tem 4 palavras diferentes, é erro de quem chama. Repetir um palpite já errado não conta erro.
 * Não há vidas: cada palpite errado soma 1 ao contador e a fase só acaba quando os 4 grupos são achados
 * ou quando a pessoa desiste (`gaveUp`).
 */
export function playConnect(
  puzzle: ConnectPuzzle,
  guesses: readonly (readonly string[])[],
  opts: { gaveUp?: boolean } = {},
): ConnectState {
  const found: ConnectGroup[] = [];
  const results: ConnectResult[] = [];
  const tried = new Set<string>();
  let errors = 0;
  for (const guess of guesses) {
    if (found.length === CONNECT_GROUPS) break;
    const left = puzzle.groups.filter((g) => !found.includes(g));
    const loose = new Set(left.flatMap((g) => g.words.map(norm)));
    const keys = guess.map(norm);
    if (keys.length !== CONNECT_GROUP_SIZE || new Set(keys).size !== CONNECT_GROUP_SIZE || keys.some((k) => !loose.has(k))) {
      throw new Error('Palpite inválido');
    }
    const key = guessKey(guess);
    if (tried.has(key)) {
      results.push('repeat');
      continue;
    }
    const judged = judgeGuess(left, guess);
    results.push(judged.result);
    if (judged.result === 'correct') found.push(judged.group);
    else {
      tried.add(key);
      errors += 1;
    }
  }
  const won = found.length === CONNECT_GROUPS;
  const gaveUp = !!opts.gaveUp && !won;
  const over = won || gaveUp;
  const foundWords = new Set(found.flatMap((g) => g.words.map(norm)));
  return {
    found,
    left: puzzle.groups.flatMap((g) => g.words).filter((w) => !foundWords.has(norm(w))),
    errors,
    won,
    gaveUp,
    over,
    results,
  };
}

/** Quantas divisões em 4 grupos de 4 as palavras permitem, contando as pegadinhas declaradas (até `cap`). */
export function countSolutions(puzzle: ConnectPuzzle, cap = 2): number {
  const fits = puzzle.groups.map((g) => new Set(g.words.map(norm)));
  for (const t of puzzle.traps ?? []) {
    const i = puzzle.groups.findIndex((g) => g.title === t.alsoFits);
    if (i >= 0) fits[i]!.add(norm(t.word));
  }
  const words = puzzle.groups.flatMap((g) => g.words.map(norm));
  const counts = fits.map(() => 0);
  let total = 0;
  const walk = (i: number) => {
    if (total >= cap) return;
    if (i === words.length) {
      if (counts.every((c) => c === CONNECT_GROUP_SIZE)) total += 1;
      return;
    }
    fits.forEach((set, gi) => {
      if (set.has(words[i]!) && counts[gi]! < CONNECT_GROUP_SIZE) {
        counts[gi]! += 1;
        walk(i + 1);
        counts[gi]! -= 1;
      }
    });
  };
  walk(0);
  return total;
}

/** Erros de um puzzle novo (vazio quando passa). Quem chama confere a repetição entre dias. */
export function validateConnectPuzzle(p: ConnectPuzzle): string[] {
  const errors: string[] = [];
  if (p.groups.length !== CONNECT_GROUPS) errors.push('precisa de 4 grupos');
  const levels = p.groups.map((g) => g.level).sort();
  if (levels.join() !== '1,2,3,4') errors.push('precisa de um grupo de cada nível (1 a 4)');
  const all = p.groups.flatMap((g) => g.words);
  if (p.groups.some((g) => g.words.length !== CONNECT_GROUP_SIZE)) errors.push('cada grupo tem 4 palavras');
  if (new Set(all.map(norm)).size !== all.length) errors.push('palavra repetida no puzzle');
  for (const w of all) if ([...w].length > 14) errors.push(`${w}: mais de 14 letras`);
  for (const g of p.groups) {
    const t = norm(g.title);
    for (const w of g.words) {
      if (norm(w).length >= 4 && t.includes(norm(w))) errors.push(`o título de "${g.title}" revela ${w}`);
    }
    if (!g.title.trim()) errors.push('grupo sem título');
  }
  for (const t of p.traps ?? []) {
    if (!all.map(norm).includes(norm(t.word))) errors.push(`pegadinha ${t.word} não está no puzzle`);
    if (!p.groups.some((g) => g.title === t.alsoFits)) errors.push(`pegadinha ${t.word}: grupo ${t.alsoFits} não existe`);
  }
  if (errors.length === 0 && countSolutions(p) !== 1) errors.push('não tem exatamente uma divisão possível');
  return errors;
}

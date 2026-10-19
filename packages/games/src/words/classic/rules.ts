import { isSolved, scoreGuess, type Cell } from '../feedback';
import { wordKey } from '../text';

/**
 * Classic Word's (spec 033): a regra do jogo, pura e determinística. O servidor guarda as respostas e
 * chama estas funções; o aparelho nunca recebe a resposta antes do fim.
 */

/** As palavras têm 5 letras. */
export const CLASSIC_WORD_LENGTH = 5;

/** Os modos livres (o Daily é uma palavra, como o `classic`, com `kind: 'daily'`). */
export type ClassicMode = 'classic' | 'dueto' | 'quarteto';
export const CLASSIC_MODES: readonly ClassicMode[] = ['classic', 'dueto', 'quarteto'];
export const isClassicMode = (m: unknown): m is ClassicMode => CLASSIC_MODES.includes(m as ClassicMode);

export interface ClassicModeInfo {
  /** Quantas palavras ao mesmo tempo. */
  words: number;
  /** Tentativas no total (as mesmas para todos os tabuleiros), como no Termo. */
  tries: number;
}

export const CLASSIC_MODE_INFO: Record<ClassicMode, ClassicModeInfo> = {
  classic: { words: 1, tries: 6 },
  dueto: { words: 2, tries: 7 },
  quarteto: { words: 4, tries: 9 },
};

/** Quantas das últimas palavras já jogadas pela conta não voltam nos modos livres. */
export const CLASSIC_RECENT_WORDS = 60;

export interface ClassicBoard {
  /** As linhas de cores, uma por palpite feito até o tabuleiro ser resolvido (depois ele trava). */
  rows: Cell[][];
  /** O número do palpite (1 a N) que resolveu este tabuleiro, ou `null`. */
  solvedAt: number | null;
}

export interface ClassicState {
  mode: ClassicMode;
  guesses: string[];
  boards: ClassicBoard[];
  /** Tentativas gastas e as que o modo permite. */
  used: number;
  tries: number;
  /** Todos os tabuleiros resolvidos? */
  won: boolean;
  /** Acabou (venceu ou gastou todas as tentativas)? */
  over: boolean;
  /** Nota de 0 a 10 (1 casa); só vale quando `over`. */
  nota: number;
}

/**
 * Nota de uma palavra acertada no palpite `k` de `tries`: `10 x (tries + 1 - k) / tries`.
 * A nota da partida é a média das palavras (palavra não acertada vale 0), com 1 casa decimal.
 */
export function classicNota(solvedAt: readonly (number | null)[], tries: number): number {
  if (solvedAt.length === 0) return 0;
  const total = solvedAt.reduce<number>((sum, k) => (k === null ? sum : sum + (10 * (tries + 1 - k)) / tries), 0);
  return Math.round((total / solvedAt.length) * 10) / 10;
}

/** Nota em décimos de ponto (o formato guardado em `matches`). */
export const classicTenths = (nota: number): number => Math.round(nota * 10);

/**
 * Refaz a partida: as respostas (uma por tabuleiro) e os palpites na ordem dão o estado inteiro. Palpite
 * com tamanho errado é erro de quem chama (o servidor valida antes). Depois que um tabuleiro é resolvido
 * ele trava: os palpites seguintes não entram nele. Depois de `over`, não entra mais palpite nenhum.
 */
export function playClassic(mode: ClassicMode, answers: readonly string[], guesses: readonly string[]): ClassicState {
  const info = CLASSIC_MODE_INFO[mode];
  if (answers.length !== info.words) throw new Error('Quantidade de respostas diferente do modo');
  const boards: ClassicBoard[] = answers.map(() => ({ rows: [], solvedAt: null }));
  const kept: string[] = [];
  for (const guess of guesses) {
    if (kept.length >= info.tries || boards.every((b) => b.solvedAt !== null)) break;
    if ([...wordKey(guess)].length !== CLASSIC_WORD_LENGTH) throw new Error('Palpite com tamanho errado');
    kept.push(guess);
    const number = kept.length;
    boards.forEach((board, i) => {
      if (board.solvedAt !== null) return;
      const row = scoreGuess(answers[i]!, guess);
      board.rows.push(row);
      if (isSolved(row)) board.solvedAt = number;
    });
  }
  const won = boards.every((b) => b.solvedAt !== null);
  const over = won || kept.length >= info.tries;
  return {
    mode,
    guesses: kept,
    boards,
    used: kept.length,
    tries: info.tries,
    won,
    over,
    nota: over ? classicNota(boards.map((b) => b.solvedAt), info.tries) : 0,
  };
}

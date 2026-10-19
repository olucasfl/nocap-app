import { colorKey } from './text';

/** O que uma letra do palpite mostra: lugar certo, existe em outro lugar, ou não existe (mais). */
export type Cell = 'hit' | 'near' | 'miss';

/** Códigos curtos para guardar uma linha de cores numa string (`h`, `n`, `m`). */
const CODE: Record<Cell, string> = { hit: 'h', near: 'n', miss: 'm' };
const DECODE: Record<string, Cell> = { h: 'hit', n: 'near', m: 'miss' };
export const encodePattern = (row: readonly Cell[]): string => row.map((c) => CODE[c]).join('');
export function decodePattern(text: string): Cell[] {
  return [...text].map((ch) => {
    const cell = DECODE[ch];
    if (!cell) throw new Error(`Código de cor inválido: ${ch}`);
    return cell;
  });
}

/**
 * As cores de um palpite contra a resposta (as duas têm a mesma quantidade de letras). Duas passadas:
 * 1) marca os **verdes** e tira essas letras da conta da resposta;
 * 2) marca os **amarelos** só com o que sobrou; o resto fica cinza.
 * Assim uma letra repetida só é pintada tantas vezes quanto aparece na resposta
 * (resposta `amigo`, palpite `mamae`: o 1º `m` amarelo, o 2º `m` cinza).
 * Compara pela chave sem acento (`aviao` e `avião` são a mesma coisa), mas o `ç` é uma letra à parte:
 * `ç` só combina com `ç` (ver `colorKey`).
 */
export function scoreGuess(answer: string, guess: string): Cell[] {
  const a = [...colorKey(answer)];
  const g = [...colorKey(guess)];
  if (a.length !== g.length) throw new Error('Palpite e resposta têm tamanhos diferentes');
  const out: Cell[] = g.map(() => 'miss');
  const left = new Map<string, number>();
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) out[i] = 'hit';
    else left.set(a[i]!, (left.get(a[i]!) ?? 0) + 1);
  }
  for (let i = 0; i < g.length; i++) {
    if (out[i] === 'hit') continue;
    const n = left.get(g[i]!) ?? 0;
    if (n > 0) {
      out[i] = 'near';
      left.set(g[i]!, n - 1);
    }
  }
  return out;
}

/** Acertou? (todas as letras no lugar certo) */
export const isSolved = (row: readonly Cell[]): boolean => row.length > 0 && row.every((c) => c === 'hit');

/**
 * A melhor situação conhecida de cada letra para pintar o teclado: `hit` vence `near`, que vence `miss`.
 * `rows` são as linhas de cores de UM tabuleiro e `guesses` os palpites correspondentes.
 */
export function keyboardState(guesses: readonly string[], rows: readonly (readonly Cell[])[]): Map<string, Cell> {
  const rank: Record<Cell, number> = { miss: 0, near: 1, hit: 2 };
  const state = new Map<string, Cell>();
  guesses.forEach((guess, i) => {
    const row = rows[i];
    if (!row) return;
    [...colorKey(guess)].forEach((letter, j) => {
      const cell = row[j]!;
      const cur = state.get(letter);
      if (!cur || rank[cell] > rank[cur]) state.set(letter, cell);
    });
  });
  return state;
}

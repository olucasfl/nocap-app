import {
  BLOCK_SHAPES,
  BOARD_CELLS,
  BOARD_CLEAR_BONUS,
  FULL_ROW,
  SIZE,
  STREAK_CAP,
  STREAK_DROUGHT,
  linePoints,
  type BlockShape,
} from './constants';

/** O tabuleiro: uma máscara de 8 bits por linha (o bit `c` é a coluna `c`). */
export type Rows = number[];

export const emptyRows = (): Rows => new Array<number>(SIZE).fill(0);

export function popcount(n: number): number {
  let x = n;
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

/** Casas ocupadas. */
export const filledCells = (rows: readonly number[]): number => {
  let n = 0;
  for (const r of rows) n += popcount(r);
  return n;
};

/** A ocupação do tabuleiro de 0 a 1. */
export const fillRatio = (rows: readonly number[]): number => filledCells(rows) / BOARD_CELLS;

/** A peça cabe com o canto de cima à esquerda em (row, col)? */
export function fits(rows: readonly number[], shape: BlockShape, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row + shape.h > SIZE || col + shape.w > SIZE) return false;
  for (let i = 0; i < shape.h; i++) {
    if (((shape.rows[i]! << col) & rows[row + i]!) !== 0) return false;
  }
  return true;
}

/** Cabe em algum lugar do tabuleiro? */
export function fitsAnywhere(rows: readonly number[], shape: BlockShape): boolean {
  for (let r = 0; r + shape.h <= SIZE; r++) {
    for (let c = 0; c + shape.w <= SIZE; c++) if (fits(rows, shape, r, c)) return true;
  }
  return false;
}

/** Uma cópia do tabuleiro com a peça colocada (não confere se cabe). */
export function put(rows: readonly number[], shape: BlockShape, row: number, col: number): Rows {
  const out = rows.slice();
  for (let i = 0; i < shape.h; i++) out[row + i]! |= shape.rows[i]! << col;
  return out;
}

export interface Sweep {
  rows: Rows;
  clearedRows: number[];
  clearedCols: number[];
}

/** Tira as linhas e colunas cheias, todas de uma vez (sem gravidade). */
export function sweep(rows: readonly number[]): Sweep {
  let colsFull = FULL_ROW;
  const clearedRows: number[] = [];
  for (let r = 0; r < SIZE; r++) {
    colsFull &= rows[r]!;
    if (rows[r] === FULL_ROW) clearedRows.push(r);
  }
  const clearedCols: number[] = [];
  for (let c = 0; c < SIZE; c++) if (colsFull & (1 << c)) clearedCols.push(c);
  if (clearedRows.length === 0 && clearedCols.length === 0) {
    return { rows: rows.slice(), clearedRows, clearedCols };
  }
  const out = rows.map((v) => v & ~colsFull);
  for (const r of clearedRows) out[r] = 0;
  return { rows: out, clearedRows, clearedCols };
}

export interface Placed {
  rows: Rows;
  clearedRows: number[];
  clearedCols: number[];
  /** Linhas e colunas limpas nesta jogada. */
  lines: number;
  /** Pontos desta jogada: casas da peça, limpeza vezes a sequência e o bônus do tabuleiro limpo. */
  points: number;
  /** O que a limpeza rendeu (já com a sequência), sem as casas da peça. */
  bonus: number;
  streak: number;
  drought: number;
  boardClear: boolean;
}

/**
 * Uma jogada inteira: coloca, limpa e pontua. A sequência (combo) sobe a cada limpeza e quebra
 * depois de `STREAK_DROUGHT` jogadas seguidas sem limpar. O servidor refaz exatamente isto.
 */
export function applyMove(
  rows: readonly number[],
  shape: BlockShape,
  row: number,
  col: number,
  streak: number,
  drought: number,
): Placed {
  const swept = sweep(put(rows, shape, row, col));
  const lines = swept.clearedRows.length + swept.clearedCols.length;
  let nextStreak = streak;
  let nextDrought = drought;
  let bonus = 0;
  if (lines > 0) {
    nextStreak = streak + 1;
    nextDrought = 0;
    bonus = linePoints(lines) * Math.min(nextStreak, STREAK_CAP);
  } else {
    nextDrought = drought + 1;
    if (nextDrought >= STREAK_DROUGHT) {
      nextStreak = 0;
      nextDrought = 0;
    }
  }
  const boardClear = lines > 0 && filledCells(swept.rows) === 0;
  if (boardClear) bonus += BOARD_CLEAR_BONUS;
  return {
    rows: swept.rows,
    clearedRows: swept.clearedRows,
    clearedCols: swept.clearedCols,
    lines,
    points: shape.size + bonus,
    bonus,
    streak: nextStreak,
    drought: nextDrought,
    boardClear,
  };
}

/** Casas vazias cercadas por casas cheias (ou pela borda): buracos que nenhuma peça tapa bem. */
export function isolatedHoles(rows: readonly number[]): number {
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    const row = rows[r]!;
    const up = r > 0 ? rows[r - 1]! : FULL_ROW;
    const down = r < SIZE - 1 ? rows[r + 1]! : FULL_ROW;
    const left = ((row << 1) | 1) & FULL_ROW;
    const right = (row >> 1) | (1 << (SIZE - 1));
    n += popcount(~row & FULL_ROW & up & down & left & right);
  }
  return n;
}

/** Todas as posições em que uma peça cabe, como [linha, coluna]. */
export function placements(rows: readonly number[], shape: BlockShape): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r + shape.h <= SIZE; r++) {
    for (let c = 0; c + shape.w <= SIZE; c++) if (fits(rows, shape, r, c)) out.push([r, c]);
  }
  return out;
}

export const shapeOf = (id: number): BlockShape => {
  const s = BLOCK_SHAPES[id];
  if (!s) throw new Error(`Peça desconhecida: ${id}`);
  return s;
};

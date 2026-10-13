import {
  BOARD_CLEAR_BONUS,
  MAX_PLANS,
  PRAISE_MARGIN,
  SIZE,
  STREAK_CAP,
  STREAK_DROUGHT,
  linePoints,
  type BlockShape,
} from './constants';
import { shapeOf, type Rows } from './board';

/** Uma jogada: qual das peças da bandeja (0 a 2) e onde fica o canto de cima à esquerda. */
/** Cópia local: nas buscas, ler a constante importada em cada volta do laço custa caro. */
const N = SIZE;

export interface Move {
  slot: number;
  row: number;
  col: number;
}

/** A jogada como número, o formato que viaja para o servidor: `slot x 64 + linha x 8 + coluna`. */
export const encodeMove = (m: Move): number => m.slot * 64 + m.row * 8 + m.col;
export const decodeMove = (n: number): Move => ({
  slot: Math.floor(n / 64),
  row: Math.floor((n % 64) / 8),
  col: n % 8,
});

// --- Núcleo rápido ---------------------------------------------------------------------------
// As buscas testam milhões de posições, então aqui nada aloca: o tabuleiro vive em Int32Array
// reaproveitados, um por nível da busca. A regra é a mesma de `applyMove` (e há teste que confere).

const POP = new Uint8Array(256);
for (let i = 1; i < 256; i++) POP[i] = POP[i >> 1]! + (i & 1);

/** A peça cabe? (sem conferir borda: quem chama já limita as posições) */
function free(cur: Int32Array, shape: BlockShape, r: number, c: number): boolean {
  for (let k = 0; k < shape.h; k++) {
    if (((shape.rows[k]! << c) & cur[r + k]!) !== 0) return false;
  }
  return true;
}

/** Coloca e limpa em `dst`. Devolve quantas linhas e colunas foram limpas. */
function stamp(src: Int32Array, dst: Int32Array, shape: BlockShape, r: number, c: number): number {
  for (let i = 0; i < N; i++) dst[i] = src[i]!;
  for (let k = 0; k < shape.h; k++) dst[r + k]! |= shape.rows[k]! << c;
  let cols = 255;
  let rowsFull = 0;
  let lines = 0;
  for (let i = 0; i < N; i++) {
    const v = dst[i]!;
    cols &= v;
    if (v === 255) {
      rowsFull |= 1 << i;
      lines++;
    }
  }
  if (lines === 0 && cols === 0) return 0;
  lines += POP[cols]!;
  const keep = ~cols & 255;
  for (let i = 0; i < N; i++) dst[i] = (rowsFull >> i) & 1 ? 0 : dst[i]! & keep;
  return lines;
}

const isEmpty = (b: Int32Array): boolean => (b[0]! | b[1]! | b[2]! | b[3]! | b[4]! | b[5]! | b[6]! | b[7]!) === 0;

/** Nota do tabuleiro, em meios-pontos: espaço livre ajuda, buraco isolado atrapalha. */
function quality(b: Int32Array): number {
  let filled = 0;
  let holes = 0;
  for (let r = 0; r < N; r++) {
    const row = b[r]!;
    filled += POP[row]!;
    const up = r > 0 ? b[r - 1]! : 255;
    const down = r < N - 1 ? b[r + 1]! : 255;
    const left = ((row << 1) | 1) & 255;
    const right = (row >> 1) | 128;
    holes += POP[~row & 255 & up & down & left & right]!;
  }
  return 64 - filled - 8 * holes;
}

const toBuf = (rows: readonly number[]): Int32Array => Int32Array.from(rows);

/** Pontos de uma jogada, com a mesma regra de `applyMove`. */
function movePoints(size: number, lines: number, streak: number, boardClear: boolean): number {
  if (lines === 0) return size;
  return size + linePoints(lines) * Math.min(streak + 1, STREAK_CAP) + (boardClear ? BOARD_CLEAR_BONUS : 0);
}

/**
 * Dá para colocar as peças todas, em alguma ordem, limpando pelo menos `minLines` linhas no total?
 * Com `minLines` 0 é só "o trio tem solução". Para no primeiro que acha. O limite de nós corta
 * buscas enormes; o corte é sempre o mesmo, então o servidor chega ao mesmo resultado.
 */
export function hasPlan(
  rows: readonly number[],
  shapes: readonly BlockShape[],
  minLines: number,
  nodeLimit = Number.POSITIVE_INFINITY,
): boolean {
  let nodes = 0;
  const used = shapes.map(() => false);
  const bufs = [toBuf(rows), ...shapes.map(() => new Int32Array(N))];

  function go(depth: number, lines: number): boolean {
    if (depth === shapes.length) return lines >= minLines;
    const cur = bufs[depth]!;
    const next = bufs[depth + 1]!;
    const tried = new Set<number>();
    for (let i = 0; i < shapes.length; i++) {
      if (used[i]) continue;
      const shape = shapes[i]!;
      if (tried.has(shape.id)) continue;
      tried.add(shape.id);
      used[i] = true;
      for (let r = 0; r + shape.h <= N; r++) {
        for (let c = 0; c + shape.w <= N; c++) {
          if (!free(cur, shape, r, c)) continue;
          if (++nodes > nodeLimit) {
            used[i] = false;
            return false;
          }
          const cleared = stamp(cur, next, shape, r, c);
          if (go(depth + 1, lines + cleared)) {
            used[i] = false;
            return true;
          }
        }
      }
      used[i] = false;
    }
    return false;
  }

  return go(0, 0);
}

/**
 * Dá para colocar as peças todas, em alguma ordem, e deixar o tabuleiro INTEIRO vazio? Para no
 * primeiro que acha. O limite de nós corta buscas enormes (sempre no mesmo ponto).
 */
export function clearsBoard(
  rows: readonly number[],
  shapes: readonly BlockShape[],
  nodeLimit = Number.POSITIVE_INFINITY,
): boolean {
  let nodes = 0;
  const used = shapes.map(() => false);
  const bufs = [toBuf(rows), ...shapes.map(() => new Int32Array(N))];

  function go(depth: number): boolean {
    if (depth === shapes.length) return isEmpty(bufs[depth]!);
    const cur = bufs[depth]!;
    const next = bufs[depth + 1]!;
    const tried = new Set<number>();
    for (let i = 0; i < shapes.length; i++) {
      if (used[i]) continue;
      const shape = shapes[i]!;
      if (tried.has(shape.id)) continue;
      tried.add(shape.id);
      used[i] = true;
      for (let r = 0; r + shape.h <= N; r++) {
        for (let c = 0; c + shape.w <= N; c++) {
          if (!free(cur, shape, r, c)) continue;
          if (++nodes > nodeLimit) {
            used[i] = false;
            return false;
          }
          stamp(cur, next, shape, r, c);
          if (go(depth + 1)) {
            used[i] = false;
            return true;
          }
        }
      }
      used[i] = false;
    }
    return false;
  }

  return go(0);
}

/** O que a busca completa descobriu sobre a rodada. */
export interface Analysis {
  /** Alguma ordem e posição coloca as peças todas. */
  solvable: boolean;
  /** Valor da melhor sequência (pontos x 2 + qualidade do tabuleiro). */
  best: number;
  /** Mediana do valor das primeiras jogadas possíveis. */
  median: number;
  /** A melhor sequência passa bem a das jogadas comuns: vale elogio. */
  sweet: boolean;
  /** As sequências que empatam no máximo (até `MAX_PLANS`). */
  plans: Move[][];
}

/**
 * Busca todas as sequências que colocam as peças que restam (as 6 ordens, todas as posições) e
 * guarda as de maior valor. O valor é `2 x pontos + qualidade do tabuleiro final`. Roda só no
 * aparelho (elogio e dica): o servidor não depende disto.
 */
export function analyze(
  rows: readonly number[],
  slots: readonly (number | null)[],
  streak: number,
  drought: number,
): Analysis {
  const order: number[] = [];
  slots.forEach((s, i) => {
    if (s !== null) order.push(i);
  });
  const shapes = order.map((slot) => shapeOf(slots[slot]!));
  const n = order.length;
  const used = order.map(() => false);
  const bufs = [toBuf(rows), ...order.map(() => new Int32Array(N))];
  const seq: Move[] = [];
  const firstValue = new Map<number, number>();
  let best = Number.NEGATIVE_INFINITY;
  let plans: Move[][] = [];

  function go(depth: number, points: number, st: number, dr: number) {
    const cur = bufs[depth]!;
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const shape = shapes[i]!;
      const next = bufs[depth + 1]!;
      used[i] = true;
      for (let r = 0; r + shape.h <= N; r++) {
        for (let c = 0; c + shape.w <= N; c++) {
          if (!free(cur, shape, r, c)) continue;
          const lines = stamp(cur, next, shape, r, c);
          const gained = movePoints(shape.size, lines, st, lines > 0 && isEmpty(next));
          let st2 = st;
          let dr2 = dr;
          if (lines > 0) {
            st2 = st + 1;
            dr2 = 0;
          } else {
            dr2 = dr + 1;
            if (dr2 >= STREAK_DROUGHT) {
              st2 = 0;
              dr2 = 0;
            }
          }
          seq.push({ slot: order[i]!, row: r, col: c });
          if (depth + 1 === n) {
            const value = 2 * (points + gained) + quality(next);
            const key = encodeMove(seq[0]!);
            if (value > (firstValue.get(key) ?? Number.NEGATIVE_INFINITY)) firstValue.set(key, value);
            if (value > best) {
              best = value;
              plans = [seq.slice()];
            } else if (value === best && plans.length < MAX_PLANS) {
              plans.push(seq.slice());
            }
          } else {
            go(depth + 1, points + gained, st2, dr2);
          }
          seq.pop();
        }
      }
      used[i] = false;
    }
  }

  if (n > 0) go(0, 0, streak, drought);
  const values = [...firstValue.values()].sort((a, b) => a - b);
  const median = values.length ? values[Math.floor(values.length / 2)]! : 0;
  const solvable = plans.length > 0;
  return {
    solvable,
    best: solvable ? best : 0,
    median,
    sweet: solvable && (best - median) / 2 >= PRAISE_MARGIN,
    plans,
  };
}

/** Acompanha a rodada: diz se cada jogada ainda bate com uma melhor sequência (joinha e PERFECT). */
export class Coach {
  readonly analysis: Analysis;
  private alive: Move[][];
  private count = 0;
  private onPlan = true;

  constructor(analysis: Analysis) {
    this.analysis = analysis;
    this.alive = analysis.plans;
  }

  /** Quantas jogadas desta rodada já passaram. */
  get played(): number {
    return this.count;
  }

  /** A rodada vale elogio e todas as jogadas até agora seguiram uma melhor sequência. */
  get perfectSoFar(): boolean {
    return this.analysis.sweet && this.onPlan;
  }

  /** Registra a jogada. Verdadeiro quando ela segue uma melhor sequência e a rodada vale elogio. */
  step(m: Move): boolean {
    const i = this.count;
    this.alive = this.alive.filter(
      (p) => p[i]?.slot === m.slot && p[i].row === m.row && p[i].col === m.col,
    );
    this.count++;
    this.onPlan = this.alive.length > 0;
    return this.analysis.sweet && this.onPlan;
  }

  /** A próxima jogada da melhor sequência, se ainda estamos nela. */
  next(): Move | null {
    return this.alive[0]?.[this.count] ?? null;
  }
}

/**
 * A dica: a próxima jogada da melhor sequência. Se a pessoa já saiu dela, busca a melhor a partir
 * do tabuleiro de agora. `null` quando nada cabe.
 */
export function hintFor(
  coach: Coach | null,
  rows: Rows,
  slots: readonly (number | null)[],
  streak: number,
  drought: number,
): Move | null {
  const planned = coach?.next();
  if (planned) return planned;
  const a = analyze(rows, slots, streak, drought);
  return a.plans[0]?.[0] ?? null;
}

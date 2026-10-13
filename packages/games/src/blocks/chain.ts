import { BLOCK_SHAPES, SIZE, type BlockShape } from './constants';
import { POP, free, stamp, toBuf } from './search';

const isEmptyBoard = (b: Int32Array): boolean => (b[0]! | b[1]! | b[2]! | b[3]! | b[4]! | b[5]! | b[6]! | b[7]!) === 0;

/**
 * Geração "em cadeia" das peças (spec 021): em vez de sortear três peças soltas, o jogo simula uma
 * partida boa no tabuleiro de agora e escolhe cada peça para encaixar bem no que a anterior deixou.
 * Assim o trio tem sentido: uma peça completa exatamente aquele vão, a seguinte aproveita a linha
 * que acabou de abrir, e quem joga sempre na melhor posição faz combos. Tudo sai da seed.
 */

const N = SIZE;

/** As regiões de casas vazias coladas entre si (4 vizinhos): o id de cada casa e o tamanho de cada região. */
export function regionsOf(b: Int32Array): { id: Int8Array; size: number[] } {
  const id = new Int8Array(N * N).fill(-1);
  const size: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < N * N; start++) {
    const r0 = Math.floor(start / N);
    const c0 = start % N;
    if (id[start] !== -1 || (b[r0]! >> c0) & 1) continue;
    const rid = size.length;
    let count = 0;
    id[start] = rid;
    stack.push(start);
    while (stack.length) {
      const cur = stack.pop()!;
      count++;
      const r = Math.floor(cur / N);
      const c = cur % N;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
        const k = rr * N + cc;
        if (id[k] !== -1 || (b[rr]! >> cc) & 1) continue;
        id[k] = rid;
        stack.push(k);
      }
    }
    size.push(count);
  }
  return { id, size };
}

/** Casas vazias cercadas por cheias (ou pela borda): buracos que nenhuma peça tapa bem. */
function holesOf(b: Int32Array): number {
  let n = 0;
  for (let r = 0; r < N; r++) {
    const row = b[r]!;
    const up = r > 0 ? b[r - 1]! : 255;
    const down = r < N - 1 ? b[r + 1]! : 255;
    const left = ((row << 1) | 1) & 255;
    const right = (row >> 1) | 128;
    n += POP[~row & 255 & up & down & left & right]!;
  }
  return n;
}

/** Os vãos pequenos (de 1 a 5 casas) do tabuleiro: os cantos que "pedem" uma peça exata. */
export function pockets(b: Int32Array): number {
  const { size } = regionsOf(b);
  return size.filter((s) => s <= 5).length;
}

export interface Placement {
  shape: BlockShape;
  row: number;
  col: number;
  lines: number;
  /** A peça preenche UM vão pequeno inteiro, sem sobrar nem faltar casa. */
  exact: boolean;
  score: number;
  next: Int32Array;
}

/**
 * A melhor posição desta peça neste tabuleiro (ou `null` se não cabe). A nota premia limpar linhas,
 * encaixar colada em peças e nas bordas, e, muito, tapar um vão inteiro; castiga abrir buracos.
 */
export function bestPlacement(
  cur: Int32Array,
  shape: BlockShape,
  regions: { id: Int8Array; size: number[] },
  holesBefore: number,
  rng: () => number,
): Placement | null {
  let best: Placement | null = null;
  const scratch = new Int32Array(N);
  const cellSet = new Set(shape.cells.map(([r, c]) => r * 16 + c));
  for (let r = 0; r + shape.h <= N; r++) {
    for (let c = 0; c + shape.w <= N; c++) {
      if (!free(cur, shape, r, c)) continue;
      // O quanto a peça fica colada (em peças ou na borda), pelo lado de fora dela.
      let contact = 0;
      let rid = -2;
      let sameRegion = true;
      for (const [dr, dc] of shape.cells) {
        const rr = r + dr;
        const cc = c + dc;
        const id = regions.id[rr * N + cc]!;
        if (rid === -2) rid = id;
        else if (rid !== id) sameRegion = false;
        for (const [er, ec] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (cellSet.has((dr + er) * 16 + (dc + ec))) continue;
          const nr = rr + er;
          const nc = cc + ec;
          if (nr < 0 || nc < 0 || nr >= N || nc >= N || (cur[nr]! >> nc) & 1) contact++;
        }
      }
      const lines = stamp(cur, scratch, shape, r, c);
      const exact = sameRegion && rid >= 0 && regions.size[rid] === shape.size && shape.size <= 5;
      const holes = holesOf(scratch) - holesBefore;
      // Deixar o tabuleiro vazio é o melhor de tudo: a cadeia procura esse final.
      const empties = lines > 0 && isEmptyBoard(scratch) ? 90 : 0;
      const score = lines * 40 + contact * 3 - holes * 12 + (exact ? 60 : 0) + empties + rng() * 0.5;
      if (!best || score > best.score) {
        best = { shape, row: r, col: c, lines, exact, score, next: Int32Array.from(scratch) };
      }
    }
  }
  return best;
}

export interface Chain {
  ids: number[];
  /** Linhas que a sequência planejada limpa no total. */
  lines: number;
  /** A sequência planejada deixa o tabuleiro inteiro vazio. */
  empty: boolean;
  /** Quantas das peças taparam um vão pequeno inteiro. */
  exact: number;
}

/**
 * Monta um trio em cadeia: a cada passo escolhe a peça (sorteio pesado pela utilidade dela no
 * tabuleiro de agora), coloca-a na melhor posição e segue com o tabuleiro que sobrou. Por
 * construção, o trio tem solução (a própria sequência simulada). `plug` força que a primeira peça
 * seja uma que tape um vão inteiro, se houver.
 */
export function buildChain(
  rng: () => number,
  rows: readonly number[],
  baseWeights: readonly number[],
  opts: { plug: boolean },
): Chain | null {
  let cur = toBuf(rows);
  const ids: number[] = [];
  let lines = 0;
  let exact = 0;
  for (let step = 0; step < 3; step++) {
    const regions = regionsOf(cur);
    const holes = holesOf(cur);
    const cands: Placement[] = [];
    for (const shape of BLOCK_SHAPES) {
      const p = bestPlacement(cur, shape, regions, holes, rng);
      if (p) cands.push(p);
    }
    if (cands.length === 0) return null;
    let pool = cands;
    if (opts.plug && step === 0) {
      const plugs = cands.filter((p) => p.exact);
      if (plugs.length) pool = plugs;
    }
    // O peso: o da peça (mais comum ou mais rara) vezes o quanto ela ajuda aqui e agora.
    const ws = pool.map((p) => {
      const help = 1 + Math.max(0, p.score) / 14;
      // Peças repetidas são comuns no Block Blast (duas barras de 5, três 3x3): quem já saiu pesa mais.
      const again = ids.includes(p.shape.id) ? 2.2 : 1;
      return baseWeights[p.shape.id]! * help * help * (p.exact ? 4 : 1) * again;
    });
    let total = 0;
    for (const v of ws) total += v;
    let x = rng() * total;
    let pick = pool[pool.length - 1]!;
    for (let i = 0; i < pool.length; i++) {
      x -= ws[i]!;
      if (x < 0) {
        pick = pool[i]!;
        break;
      }
    }
    ids.push(pick.shape.id);
    lines += pick.lines;
    if (pick.exact) exact++;
    cur = pick.next;
  }
  return { ids, lines, exact, empty: isEmptyBoard(cur) };
}

import {
  BLOCK_SHAPES,
  DEAL_ATTEMPTS,
  DEAL_NODE_LIMIT,
  FULL_BOARD,
  SLOTS,
  SWEET_CHANCE,
  SWEET_LINES,
  SWEET_LINES_FULL,
  type BlockShape,
} from './constants';
import { fillRatio, type Rows } from './board';
import { hasPlan } from './search';

/**
 * O peso de cada peça agora: o tabuleiro cheio puxa peças pequenas, o vazio puxa as grandes, e
 * com o passar das rodadas as grandes ficam um pouco mais frequentes (a partida esquenta).
 */
function weights(fill: number, sets: number): number[] {
  const bias = (fill - 0.4) * 2 - Math.min(sets, 60) / 300;
  return BLOCK_SHAPES.map((s) => s.weight * Math.max(0.15, 1 - bias * (s.size - 4) * 0.35));
}

function draw(rng: () => number, w: readonly number[], total: number): number {
  let x = rng() * total;
  for (let i = 0; i < w.length; i++) {
    x -= w[i]!;
    if (x < 0) return i;
  }
  return w.length - 1;
}

/** Um trio de últimos recursos, das peças menores para as maiores, para nunca ficar sem rodada. */
function smallTrio(rows: readonly number[]): number[] {
  const bySize = [...BLOCK_SHAPES].sort((a, b) => a.size - b.size || a.id - b.id);
  const pool = bySize.slice(0, 6);
  for (const a of pool) {
    for (const b of pool) {
      for (const c of pool) {
        if (hasPlan(rows, [a, b, c], 0)) return [a.id, b.id, c.id];
      }
    }
  }
  const dot = bySize[0]!.id;
  return [dot, dot, dot];
}

/**
 * Monta as três peças da rodada (spec 021). Sorteia trios pela seed e fica com um que tenha
 * solução. Em cerca de 60% das rodadas a seed pede uma "jogada secreta": o trio escolhido tem uma
 * sequência que limpa várias linhas. Tudo é determinístico: o servidor monta os mesmos trios.
 */
export function dealSet(rng: () => number, rows: Rows, sets: number): number[] {
  const w = weights(fillRatio(rows), sets);
  let total = 0;
  for (const v of w) total += v;
  const wantSweet = rng() < SWEET_CHANCE;
  const target = fillRatio(rows) > FULL_BOARD ? SWEET_LINES_FULL : SWEET_LINES;
  let fallback: number[] | null = null;
  for (let attempt = 0; attempt < DEAL_ATTEMPTS; attempt++) {
    const ids: number[] = [];
    for (let i = 0; i < SLOTS; i++) ids.push(draw(rng, w, total));
    const shapes: BlockShape[] = ids.map((id) => BLOCK_SHAPES[id]!);
    if (!hasPlan(rows, shapes, 0, DEAL_NODE_LIMIT)) continue;
    if (!wantSweet) return ids;
    fallback ??= ids;
    if (hasPlan(rows, shapes, target, DEAL_NODE_LIMIT)) return ids;
  }
  return fallback ?? smallTrio(rows);
}

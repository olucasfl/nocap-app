import {
  BLOCK_SHAPES,
  DEAL_ATTEMPTS,
  DEAL_NODE_LIMIT,
  FULL_BOARD,
  SIZE,
  SLOTS,
  SWEET_LINES,
  SWEET_LINES_FULL,
  type BlockShape,
} from './constants';
import { fillRatio, filledCells, type Rows } from './board';
import { buildChain, pockets } from './chain';
import { hasPlan, toBuf } from './search';

/**
 * O "tipo" de cada rodada de peças, do mais generoso ao mais apertado:
 * - `plug`: veio a peça EXATA que tapa um vão do tabuleiro (e as outras seguem em cadeia);
 * - `clean`: existe um jeito de colocar as 3 e deixar o tabuleiro INTEIRO limpo;
 * - `great`: dá para limpar várias linhas de uma vez;
 * - `good`: dá para limpar pelo menos uma linha;
 * - `neutral`: as peças se encaixam, mas não limpam nada agora (ajeitam para as próximas).
 */
export type RoundKind = 'plug' | 'clean' | 'great' | 'good' | 'neutral';
const RANK: Record<RoundKind, number> = { clean: 4, plug: 3, great: 2, good: 1, neutral: 0 };

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
 * Sorteia o tipo da rodada. No começo (tabuleiro quase vazio) pode vir de tudo, até a rodada que
 * limpa o tabuleiro inteiro. Depois de uma rodada fraca vem uma recompensa; com o tabuleiro
 * apertado o jogo ajuda mais; e conforme a partida avança as rodadas fracas ficam mais comuns.
 */
export function roundKindWeights(
  canClean: boolean,
  canPlug: boolean,
  fill: number,
  sets: number,
  last: RoundKind | null,
): Record<RoundKind, number> {
  const w: Record<RoundKind, number> = {
    // Ficou um vão no tabuleiro: na maioria das vezes vem a peça exata para ele.
    plug: canPlug ? (fill > 0.4 ? 0.6 : 0.45) : 0,
    clean: canClean ? 0.3 : 0,
    great: 0.26,
    good: 0.26,
    neutral: 0.08 + Math.min(sets, 40) / 300,
  };
  if (last === 'neutral') {
    // "As peças não eram boas, mas agora melhora": a rodada seguinte costuma recompensar.
    w.clean *= 2;
    w.great *= 2.2;
    w.plug *= 1.6;
    w.neutral *= 0.35;
  }
  if (last === 'clean') w.clean *= 0.3;
  if (fill > 0.55) {
    // Tabuleiro apertado: o jogo dá uma saída.
    w.neutral *= 0.4;
    w.good *= 1.5;
    w.great *= 1.5;
  }
  return w;
}

function pickKind(
  rng: () => number,
  canClean: boolean,
  canPlug: boolean,
  fill: number,
  sets: number,
  last: RoundKind | null,
): RoundKind {
  const w = roundKindWeights(canClean, canPlug, fill, sets, last);
  const total = w.plug + w.clean + w.great + w.good + w.neutral;
  let x = rng() * total;
  for (const k of ['plug', 'clean', 'great', 'good', 'neutral'] as const) {
    x -= w[k];
    if (x < 0) return k;
  }
  return 'neutral';
}

/**
 * A linha (ou coluna) que dá para completar para limpar o tabuleiro TODO: aquela que contém todas
 * as casas ocupadas (num tabuleiro vazio, qualquer uma). `null` se as casas ocupadas estão
 * espalhadas demais.
 */
function cleanLine(rows: readonly number[], rng: () => number): { horizontal: boolean; index: number } | null {
  const options: { horizontal: boolean; index: number }[] = [];
  const filledRows = rows.map((r, i) => (r ? i : -1)).filter((i) => i >= 0);
  if (filledRows.length === 0) {
    for (let i = 0; i < SIZE; i++) options.push({ horizontal: true, index: i }, { horizontal: false, index: i });
  } else {
    if (filledRows.length === 1) options.push({ horizontal: true, index: filledRows[0]! });
    // Todas as casas na mesma coluna?
    let colMask = 0;
    for (const r of rows) colMask |= r;
    if ((colMask & (colMask - 1)) === 0) {
      const col = Math.log2(colMask);
      options.push({ horizontal: false, index: col });
    }
  }
  if (options.length === 0) return null;
  return options[Math.floor(rng() * options.length)]!;
}

/**
 * Monta um trio de barras que, colocadas nos buracos de uma linha, a completam e deixam o
 * tabuleiro vazio. Divide os buracos em exatamente 3 barras (de 1 a 5 casas), com cortes sorteados.
 */
function cleanTrio(rows: readonly number[], rng: () => number): number[] | null {
  const line = cleanLine(rows, rng);
  if (!line) return null;
  // Os buracos da linha, como trechos seguidos.
  const cells: boolean[] = [];
  for (let i = 0; i < SIZE; i++) {
    cells.push(line.horizontal ? (rows[line.index]! & (1 << i)) === 0 : (rows[i]! & (1 << line.index)) === 0);
  }
  const parts: number[] = [];
  for (let i = 0; i < SIZE; ) {
    if (!cells[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < SIZE && cells[j]) j++;
    let len = j - i;
    while (len > 5) {
      const cut = 2 + Math.floor(rng() * 2); // 2 ou 3
      parts.push(len - cut > 5 ? 5 : len - cut);
      len -= parts[parts.length - 1]!;
    }
    parts.push(len);
    i = j;
  }
  if (parts.length > 3 || parts.reduce((a, b) => a + b, 0) < 3) return null;
  while (parts.length < 3) {
    const splittable = parts.map((p, i) => (p >= 2 ? i : -1)).filter((i) => i >= 0);
    if (splittable.length === 0) return null;
    const at = splittable[Math.floor(rng() * splittable.length)]!;
    const p = parts[at]!;
    const a = 1 + Math.floor(rng() * (p - 1));
    parts.splice(at, 1, a, p - a);
  }
  const ids: number[] = [];
  for (const len of parts) {
    const shape = BLOCK_SHAPES.find((s) =>
      len === 1 ? s.name === 'ponto' : s.name === `barra${len}` && (line.horizontal ? s.h === 1 : s.w === 1),
    );
    if (!shape) return null;
    ids.push(shape.id);
  }
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  return ids;
}

/**
 * Monta as três peças da rodada (spec 021). Sorteia o tipo da rodada e procura, pela seed, um trio
 * que o cumpra (se não achar, fica com o melhor que achou). Todo trio tem solução. Tudo é
 * determinístico: o servidor monta os mesmos trios.
 */
export function dealSet(
  rng: () => number,
  rows: Rows,
  sets: number,
  last: RoundKind | null = null,
): { ids: number[]; kind: RoundKind } {
  const fill = fillRatio(rows);
  // Rodada que limpa o tabuleiro inteiro: monta-se um trio de barras que completa a linha certa.
  const clean = filledCells(rows) <= SIZE ? cleanTrio(rows, rng) : null;
  const canPlug = pockets(toBuf(rows)) > 0;
  let want = pickKind(rng, clean !== null, canPlug, fill, sets, last);
  const w = weights(fill, sets);
  if (want === 'clean') {
    if (clean && hasPlan(rows, clean.map((id) => BLOCK_SHAPES[id]!), 0, DEAL_NODE_LIMIT)) return { ids: clean, kind: 'clean' };
    want = 'great'; // não deu: cai para a próxima melhor
  }
  // "Várias linhas": 2 já conta (3 ou mais quando o tabuleiro está no meio e dá folga).
  const greatTarget = fill > FULL_BOARD || fill < 0.2 ? SWEET_LINES_FULL : SWEET_LINES - 1 + (sets % 2);

  if (want !== 'neutral') {
    // Trios em cadeia: cada peça encaixa no que a anterior deixou, a partir do tabuleiro de agora.
    let best: { chain: { ids: number[]; lines: number; exact: number; empty: boolean }; rank: number } | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const chain = buildChain(rng, rows, w, { plug: want === 'plug' });
      if (!chain) break;
      const kind: RoundKind = chain.empty
        ? 'clean'
        : want === 'plug' && chain.exact > 0
          ? 'plug'
          : chain.lines >= greatTarget
            ? 'great'
            : chain.lines >= 1
              ? 'good'
              : 'neutral';
      const rank = RANK[kind] + (want === 'plug' && chain.exact > 0 ? 0 : 0);
      if (RANK[kind] >= RANK[want] || (want === 'plug' && chain.exact > 0)) return { ids: shuffle(rng, chain.ids), kind };
      if (!best || rank > best.rank) best = { chain, rank };
    }
    if (best) {
      const k: RoundKind = best.chain.empty ? 'clean' : best.chain.lines >= greatTarget ? 'great' : best.chain.lines >= 1 ? 'good' : 'neutral';
      return { ids: shuffle(rng, best.chain.ids), kind: k };
    }
  }

  // Rodada neutra (ou sem cadeia possível): três peças soltas que se encaixam, sem ajuda.
  let total = 0;
  for (const v of w) total += v;
  for (let attempt = 0; attempt < DEAL_ATTEMPTS; attempt++) {
    const ids: number[] = [];
    for (let i = 0; i < SLOTS; i++) ids.push(draw(rng, w, total));
    const shapes: BlockShape[] = ids.map((id) => BLOCK_SHAPES[id]!);
    if (hasPlan(rows, shapes, 0, DEAL_NODE_LIMIT)) return { ids, kind: 'neutral' };
  }
  return { ids: smallTrio(rows), kind: 'neutral' };
}

/** Embaralha a bandeja (a peça-chave não vem sempre na primeira posição). */
function shuffle(rng: () => number, ids: number[]): number[] {
  const out = ids.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

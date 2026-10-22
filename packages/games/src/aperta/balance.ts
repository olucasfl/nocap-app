// Balanço das Cintilas (spec 040, seção 5.4): a conta que tem que fechar para a árvore completa ser alcançável.
//   T   = custo total dos nós da árvore (a árvore real de `tree.ts`)
//   F   = fontes que acabam: conquistas + álbum + capturas raras e degraus + Estrela dos Proibidos
//   R25 = o que as fontes que repetem dão até o colapso 25 no perfil normal
// Regras: F >= 0,80 x T (a árvore quase toda se alcança só jogando e colecionando) e F + R25 >= 1,10 x T (a árvore
// completa cabe, com folga, até o colapso 25). Os números saem dos dados, nenhum é escrito à mão.

import { dustGoal } from './economy';
import { COLLAPSES_PER_SPARK, EVENT_IDS_NOW, EVENT_IDS_PLANNED, EVENT_FIRST_SPARKS, dustMarks, finiteSparksCeiling } from './sparks';
import { TREE_TOTAL_COST } from './tree';

export const BALANCE_COLLAPSE = 25;
export const BALANCE_MIN_FINITE = 0.8;
export const BALANCE_MIN_TOTAL = 1.1;

export interface SparkBalance {
  T: number;
  F: number;
  R25: number;
  parts: { achievements: number; album: number; rare: number; stars: number; collapseMarks: number; dustMarks: number; events: number };
  finiteOk: boolean;
  totalOk: boolean;
}

/** Poeira total que o perfil normal junta até o colapso `n`: a soma das metas das vidas (cada vida termina ao bater a meta). */
export function dustTotalAtCollapse(n: number): number {
  let sum = 0;
  for (let k = 1; k <= n; k++) sum += dustGoal(k);
  return sum;
}

export function sparkBalance(tree: number = TREE_TOTAL_COST, collapse: number = BALANCE_COLLAPSE): SparkBalance {
  const f = finiteSparksCeiling();
  const collapseMarks = Math.floor(collapse / COLLAPSES_PER_SPARK);
  const dust = dustMarks(dustTotalAtCollapse(collapse));
  const events = (EVENT_IDS_NOW.length + EVENT_IDS_PLANNED.length) * EVENT_FIRST_SPARKS;
  const F = f.total;
  const R25 = collapseMarks + dust + events;
  return {
    T: tree,
    F,
    R25,
    parts: { achievements: f.achievements, album: f.album, rare: f.rare, stars: f.stars, collapseMarks, dustMarks: dust, events },
    finiteOk: F >= BALANCE_MIN_FINITE * tree,
    totalOk: F + R25 >= BALANCE_MIN_TOTAL * tree,
  };
}

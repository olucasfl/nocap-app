// Cintilas (spec 040, seções 5 e 6): a moeda da árvore. O saldo NÃO é um contador que sobe: ele é calculado do que o
// save já guarda (conquistas, álbum, capturas raras, colapsos, poeira total, eventos vistos e níveis dos proibidos),
// mais `sparks.legacy`, que é o que os Fragmentos antigos valiam (migração 1:1). Assim não há como "esquecer" de
// pagar uma fonte nem de pagar duas vezes, e o servidor refaz a mesma conta. Só o gasto (`sparks.spent`) é contador.

import { GRIMOIRES, grimoireById, type Rarity } from './catalog';
import { FORBIDDEN, forbiddenById } from './forbidden';
import { ACHIEVEMENTS, achievementActive, achievementById } from './achievements';
import type { SaveState } from './engine';

/** Cintilas pela 1ª descoberta de cada grimório, por raridade (5.1, fonte 2). */
export const ALBUM_SPARKS: Record<Rarity, number> = { common: 1, rare: 1, epic: 2, legendary: 3, forbidden: 4 };

/** Objetos raros e lendários: a 1ª captura de cada um rende `RARE_FIRST_SPARKS` (5.1, fonte 3). Lendários chegam na etapa 20. */
export const RARE_OBJECT_KINDS: readonly string[] = ['probe', 'golden'];
export const LEGENDARY_OBJECT_KINDS: readonly string[] = [];
export const RARE_FIRST_SPARKS = 3;
/** Degraus de capturas raras totais. */
export const RARE_CAPTURE_STEPS: readonly { at: number; sparks: number }[] = [
  { at: 10, sparks: 2 },
  { at: 50, sparks: 3 },
  { at: 200, sparks: 5 },
  { at: 1000, sparks: 8 },
];

/** Fontes que repetem (5.1, fonte 4): 1 a cada 3 colapsos, 1 por marco de poeira total (x1.000 do anterior) e 1 por evento raro visto. */
export const COLLAPSES_PER_SPARK = 3;
export const DUST_MARK_FIRST = 1e6;
export const DUST_MARK_RATIO = 1e3;
export const EVENT_FIRST_SPARKS = 1;
/** Eventos que existem e os 4 planejados (etapa 20); só os existentes podem aparecer no save. */
export const EVENT_IDS_NOW: readonly string[] = ['meteor-shower', 'solar-storm'];
export const EVENT_IDS_PLANNED: readonly string[] = ['gold-rain', 'alignment', 'energy-tide', 'eclipse'];

/** Estrela dos Proibidos (5.1, fonte 5): o nível 3 e o 5 de cada proibido, uma vez por proibido. */
export const STAR_STEPS: readonly { level: number; sparks: number }[] = [
  { level: 3, sparks: 2 },
  { level: 5, sparks: 4 },
];

/** Marcos de poeira total já passados: 1e6, 1e9, 1e12... */
export function dustMarks(total: number): number {
  let n = 0;
  let mark = DUST_MARK_FIRST;
  while (total >= mark && n < 100) {
    n++;
    mark *= DUST_MARK_RATIO;
  }
  return n;
}

export interface SparkSources {
  achievements: number;
  album: number;
  rareFirst: number;
  rareSteps: number;
  collapseMarks: number;
  dustMarks: number;
  eventFirst: number;
  stars: number;
  /** Fontes que acabam (conquistas, álbum, raros, degraus e estrelas) e as que repetem. */
  finite: number;
  repeating: number;
  total: number;
}

/** Cintilas que o Cofre dos Proibidos dá por nível (gancho da etapa 15: lê `stats.forbiddenBest`). */
export function starSparks(forbiddenBest: Readonly<Record<string, number>>): number {
  let sum = 0;
  for (const [id, level] of Object.entries(forbiddenBest)) {
    if (!forbiddenById(id)) continue;
    for (const step of STAR_STEPS) if (level >= step.level) sum += step.sparks;
  }
  return sum;
}

export function sparkSources(state: SaveState): SparkSources {
  let achievements = 0;
  for (const id of state.achievements) achievements += achievementById(id)?.reward ?? 0;
  let album = 0;
  for (const id of state.album) {
    const g = grimoireById(id);
    if (g) album += ALBUM_SPARKS[g.rarity];
    else if (forbiddenById(id)) album += ALBUM_SPARKS.forbidden;
  }
  const kinds = new Set(state.stats.capturedKinds);
  const rareFirst = [...RARE_OBJECT_KINDS, ...LEGENDARY_OBJECT_KINDS].filter((k) => kinds.has(k)).length * RARE_FIRST_SPARKS;
  const rareSteps = RARE_CAPTURE_STEPS.filter((s) => state.stats.raresCaptured >= s.at).reduce((a, s) => a + s.sparks, 0);
  const collapseMarks = Math.floor(state.collapses / COLLAPSES_PER_SPARK);
  const dust = dustMarks(state.stats.dustTotal);
  const eventFirst = state.stats.eventsSeen.length * EVENT_FIRST_SPARKS;
  const stars = starSparks(state.stats.forbiddenBest);
  const finite = achievements + album + rareFirst + rareSteps + stars;
  const repeating = collapseMarks + dust + eventFirst;
  return { achievements, album, rareFirst, rareSteps, collapseMarks, dustMarks: dust, eventFirst, stars, finite, repeating, total: finite + repeating };
}

/** Tudo que o save já ganhou em Cintilas (migradas dos Fragmentos + fontes). */
export function sparksTotal(state: SaveState): number {
  return state.sparks.legacy + sparkSources(state).total;
}

/** Saldo para gastar na árvore. */
export function sparksAvailable(state: SaveState): number {
  return Math.max(0, sparksTotal(state) - state.sparks.spent);
}

/** F: o que as fontes finitas dão no total do jogo (todos os grimórios do catálogo, todas as conquistas, todos os raros e proibidos). */
export function finiteSparksCeiling(): { achievements: number; album: number; rare: number; stars: number; total: number } {
  const album = GRIMOIRES.reduce((a, g) => a + ALBUM_SPARKS[g.rarity], 0) + FORBIDDEN.length * ALBUM_SPARKS.forbidden;
  const rare = (RARE_OBJECT_KINDS.length + LEGENDARY_OBJECT_KINDS.length) * RARE_FIRST_SPARKS + RARE_CAPTURE_STEPS.reduce((a, s) => a + s.sparks, 0);
  const stars = FORBIDDEN.length * STAR_STEPS.reduce((a, s) => a + s.sparks, 0);
  const achievements = ACHIEVEMENTS.filter((d) => !d.retired).reduce((a, d) => a + d.reward, 0);
  return { achievements, album, rare, stars, total: achievements + album + rare + stars };
}

/**
 * Cintilas que o colapso `n` dá agora (para o modal): o que as fontes passam a valer depois de `collapses + 1`
 * (hoje, a Cintila a cada 3 colapsos e as conquistas de colapso que ficam prontas).
 */
export function sparksOnCollapse(state: SaveState): number {
  const next: SaveState = { ...state, collapses: state.collapses + 1 };
  const have = new Set(state.achievements);
  const ids = ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.group === 'collapses' && achievementActive(a) && a.progress(next) >= a.goal).map((a) => a.id);
  const withAch: SaveState = { ...next, achievements: [...state.achievements, ...ids] };
  return Math.max(0, sparkSources(withAch).total - sparkSources(state).total);
}

// Conquistas do Aperta! (spec 038, seção 5.3). Cada uma é uma linha de dados: meta `goal` e uma função
// pura que lê o progresso do save. O motor chama `awardAchievements` depois de cada ação que muda esses
// números, e o id ganho fica em `save.achievements` (nunca sai, nem se a árvore for refeita).
// Sem recompensa de poder na v1 (decisão 14.16).

import { FAMILIES, RARITIES, TREE, grimoireById } from './catalog';
import { GRIMOIRE_MAX_LEVEL } from './economy';
import type { SaveState } from './engine';

export type AchievementGroup = 'taps' | 'dust' | 'grimoires' | 'objects' | 'combo' | 'collapses' | 'tree' | 'hidden';

export const ACHIEVEMENT_GROUPS: readonly { id: AchievementGroup; name: string }[] = [
  { id: 'taps', name: 'Toques' },
  { id: 'dust', name: 'Poeira' },
  { id: 'grimoires', name: 'Grimórios' },
  { id: 'objects', name: 'Objetos' },
  { id: 'combo', name: 'Combo' },
  { id: 'collapses', name: 'Colapsos' },
  { id: 'tree', name: 'Árvore' },
  { id: 'hidden', name: 'Escondida' },
];

export interface AchievementDef {
  id: string;
  group: AchievementGroup;
  name: string;
  text: string;
  goal: number;
  /** Escondida: aparece como "???" até ser ganha. */
  hidden?: boolean;
  progress: (s: SaveState) => number;
}

const albumOf = (s: SaveState) => s.album.map((id) => grimoireById(id)).filter((g) => g !== undefined);
const planetsFound = (s: SaveState) => albumOf(s).filter((g) => g.family === 'planets').length;
const treeNodes = (s: SaveState) => Object.values(s.tree).reduce((sum, lvl) => sum + lvl, 0);
const fullBranches = (s: SaveState) => TREE.filter((b) => (s.tree[b.id] ?? 0) >= 3).length;

const def = (
  id: string,
  group: AchievementGroup,
  name: string,
  text: string,
  goal: number,
  progress: AchievementDef['progress'],
  hidden = false,
): AchievementDef => ({ id, group, name, text, goal, progress, ...(hidden ? { hidden } : {}) });

const clicks = (s: SaveState) => s.stats.clicks;
const dust = (s: SaveState) => s.stats.dustTotal;
const captured = (s: SaveState) => s.stats.objectsCaptured;
const collapses = (s: SaveState) => s.collapses;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  def('tap-1', 'taps', 'Primeiro toque', 'Aperte o botão pela primeira vez.', 1, clicks),
  def('tap-100', 'taps', 'Cem toques', 'Dê 100 toques no botão.', 100, clicks),
  def('tap-1k', 'taps', 'Mil toques', 'Dê 1.000 toques no botão.', 1_000, clicks),
  def('tap-10k', 'taps', 'Dedo de aço', 'Dê 10.000 toques no botão.', 10_000, clicks),
  def('tap-100k', 'taps', 'Pulso de pulsar', 'Dê 100.000 toques no botão.', 100_000, clicks),

  def('dust-1k', 'dust', 'Poeira de estrela', 'Junte 1 mil de poeira no total.', 1e3, dust),
  def('dust-1m', 'dust', 'Nuvem de poeira', 'Junte 1 milhão de poeira no total.', 1e6, dust),
  def('dust-1b', 'dust', 'Tempestade cósmica', 'Junte 1 bilhão de poeira no total.', 1e9, dust),

  def('grim-10', 'grimoires', 'Colecionador de astros', 'Descubra 10 grimórios.', 10, (s) => s.album.length),
  def('grim-20', 'grimoires', 'Biblioteca estelar', 'Descubra 20 grimórios.', 20, (s) => s.album.length),
  def('grim-all', 'grimoires', 'Atlas completo', 'Descubra os 30 grimórios do começo.', 30, (s) => s.album.length),
  def('grim-planets', 'grimoires', 'Colecionador de planetas', 'Descubra os 7 grimórios de Planetas.', 7, planetsFound),
  def(
    'grim-rarities',
    'grimoires',
    'Um de cada raridade',
    'Descubra um grimório de cada raridade.',
    RARITIES.length,
    (s) => new Set(albumOf(s).map((g) => g.rarity)).size,
  ),
  def('grim-lv5', 'grimoires', 'Brilho crescente', 'Leve um grimório ao nível 5.', 5, (s) => s.stats.bestLevel),
  def('grim-lv10', 'grimoires', 'Nível máximo', `Leve um grimório ao nível ${GRIMOIRE_MAX_LEVEL}.`, GRIMOIRE_MAX_LEVEL, (s) => s.stats.bestLevel),

  def('obj-20', 'objects', 'Caçador de cometas', 'Capture 20 objetos no espaço.', 20, captured),
  def('obj-100', 'objects', 'Rede estelar', 'Capture 100 objetos no espaço.', 100, captured),
  def('obj-500', 'objects', 'Sentinela da Perigeu', 'Capture 500 objetos no espaço.', 500, captured),
  def('obj-sats', 'objects', 'Constelação de satélites', 'Capture 10 satélites em sequência.', 10, (s) => s.stats.satelliteBest),

  def('combo-max', 'combo', 'Ressonância total', 'Chegue ao combo máximo.', 1, (s) => s.stats.comboMaxHits),
  def('combo-30', 'combo', 'Pulso constante', 'Mantenha o combo máximo por 30 segundos.', 30, (s) => Math.floor(s.stats.comboFullBest)),

  def('forbidden', 'collapses', 'Horizonte de eventos', 'Pegue um grimório proibido.', 1, (s) => albumOf(s).filter((g) => g.rarity === 'forbidden').length),
  def('collapse-1', 'collapses', 'Primeira estrela colapsada', 'Colapse a estrela uma vez.', 1, collapses),
  def('collapse-5', 'collapses', 'Cinco estrelas', 'Colapse a estrela 5 vezes.', 5, collapses),
  def('collapse-10', 'collapses', 'Dez colapsos', 'Colapse a estrela 10 vezes.', 10, collapses),
  def('collapse-25', 'collapses', 'Veterana do espaço', 'Colapse a estrela 25 vezes.', 25, collapses),
  def('collapse-50', 'collapses', 'Lenda de Perigeu', 'Colapse a estrela 50 vezes.', 50, collapses),
  def(
    'atlas-families',
    'collapses',
    'Atlas de todas as famílias',
    'Guarde no Atlas uma página de cada família.',
    FAMILIES.length,
    (s) => new Set(s.atlas.pages.map((p) => grimoireById(p.grimoireId)?.family).filter((f) => f !== undefined)).size,
  ),

  def('tree-1', 'tree', 'Primeira habilidade', 'Compre o primeiro nó da árvore.', 1, treeNodes),
  def('tree-branch', 'tree', 'Ramo completo', 'Complete os 3 níveis de um ramo da árvore.', 1, fullBranches),

  def('respec', 'hidden', 'Mudei de ideia', 'Refaça a árvore de habilidades.', 1, (s) => s.stats.respecs, true),
];

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export interface AchievementView {
  def: AchievementDef;
  earned: boolean;
  /** Progresso limitado à meta (uma conquista ganha mostra a meta cheia). */
  value: number;
}

export function achievementViews(state: SaveState): AchievementView[] {
  return ACHIEVEMENTS.map((a) => {
    const earned = state.achievements.includes(a.id);
    const value = earned ? a.goal : Math.min(a.goal, Math.max(0, a.progress(state)));
    return { def: a, earned, value };
  });
}

/** Ids que passaram da meta e ainda não estão no save. */
export function newlyEarned(state: SaveState): string[] {
  const have = new Set(state.achievements);
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.progress(state) >= a.goal).map((a) => a.id);
}

/** Guarda no save as conquistas que acabaram de bater a meta. Devolve o mesmo objeto se não há nada novo. */
export function awardAchievements(state: SaveState): SaveState {
  const ids = newlyEarned(state);
  return ids.length === 0 ? state : { ...state, achievements: [...state.achievements, ...ids] };
}

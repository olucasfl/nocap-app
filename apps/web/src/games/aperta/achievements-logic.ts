import {
  ACHIEVEMENT_GROUPS,
  FEATURE_NAMES,
  achievementSparks,
  achievementViews,
  type AchievementGroup,
  type AchievementView,
  type SaveState,
} from '@nocap/games';
import type { AstroId } from './astros';

const GROUP_ASTRO: Record<AchievementGroup, AstroId> = {
  taps: 'star',
  dust: 'rock',
  grimoires: 'moon',
  objects: 'ice',
  combo: 'venus',
  collapses: 'hole',
  forbidden: 'hole',
  automation: 'saturn',
  luck: 'starb',
  explore: 'jupiter',
  tree: 'nebula',
  gens: 'mars',
  missions: 'titan',
  regions: 'neptune',
  time: 'redgiant',
  hidden: 'galaxy',
};

export interface AchievementRow {
  id: string;
  group: AchievementGroup;
  name: string;
  text: string;
  astro: AstroId;
  earned: boolean;
  /** Escondida e ainda não ganha: a tela mostra "???". */
  secret: boolean;
  /** Depende de conteúdo que ainda não chegou ("em breve"). */
  soon: boolean;
  /** "Precisa de <feature>" para as que estão em breve. */
  soonText: string;
  value: number;
  goal: number;
  /** 0 a 1, para a barra. */
  fraction: number;
  /** Cintilas que a conquista dá. */
  reward: number;
}

export interface AchievementGroupRows {
  id: AchievementGroup;
  name: string;
  rows: AchievementRow[];
}

function row(v: AchievementView): AchievementRow {
  const secret = !!v.def.hidden && !v.earned;
  return {
    id: v.def.id,
    group: v.def.group,
    name: secret ? '???' : v.def.name,
    text: secret ? 'Uma conquista escondida.' : v.def.text,
    astro: secret ? 'lock' : GROUP_ASTRO[v.def.group],
    earned: v.earned,
    secret,
    soon: v.locked && !v.earned,
    soonText: v.locked && v.def.needs ? `Em breve: precisa d${v.def.needs === 'daily-streak' || v.def.needs === 'tree-v2' ? 'a' : 'os'} ${FEATURE_NAMES[v.def.needs]}` : '',
    value: v.value,
    goal: v.def.goal,
    fraction: v.def.goal > 0 ? Math.min(1, v.value / v.def.goal) : 0,
    reward: v.def.reward,
  };
}

/** Minúsculas e sem acento, para a busca achar "Poeira" digitando "poeira" ou "poeíra". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export type AchievementStatus = 'all' | 'todo' | 'earned';

export interface AchievementFilter {
  group: AchievementGroup | 'all';
  query: string;
  status: AchievementStatus;
}

export const NO_FILTER: AchievementFilter = { group: 'all', query: '', status: 'all' };

/** Linhas por família, já filtradas por família, texto e estado. A escondida só aparece pelo nome real depois de ganha. */
export function achievementGroups(state: SaveState, filter: AchievementFilter = NO_FILTER): AchievementGroupRows[] {
  const q = fold(filter.query);
  return ACHIEVEMENT_GROUPS.filter((g) => filter.group === 'all' || filter.group === g.id)
    .map((g) => ({
      id: g.id,
      name: g.name,
      rows: achievementViews(state)
        .filter((v) => v.def.group === g.id)
        .map(row)
        .filter((r) => (filter.status === 'all' ? true : filter.status === 'earned' ? r.earned : !r.earned))
        .filter((r) => q === '' || fold(`${r.name} ${r.text}`).includes(q) || (r.secret && 'escondida'.includes(q))),
    }))
    .filter((g) => g.rows.length > 0);
}

export interface AchievementChip {
  id: AchievementGroup | 'all';
  name: string;
  earned: number;
  total: number;
}

/** Os botões de filtro: "Todas" e uma por família, com N/M de cada. */
export function achievementChips(state: SaveState): AchievementChip[] {
  const views = achievementViews(state);
  return [
    { id: 'all', name: 'Todas', earned: views.filter((v) => v.earned).length, total: views.length },
    ...ACHIEVEMENT_GROUPS.map((g) => {
      const mine = views.filter((v) => v.def.group === g.id);
      return { id: g.id, name: g.name, earned: mine.filter((v) => v.earned).length, total: mine.length };
    }),
  ];
}

export function achievementCounts(state: SaveState): { earned: number; total: number } {
  const views = achievementViews(state);
  return { earned: views.filter((v) => v.earned).length, total: views.length };
}

/** Cintilas das conquistas: já ganhas, as que ainda dá para ganhar agora e as que esperam conteúdo novo. */
export function achievementSparkTotals(state: SaveState): { earned: number; toEarn: number; soon: number } {
  return achievementSparks(state);
}

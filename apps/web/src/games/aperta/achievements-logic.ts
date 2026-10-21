import { ACHIEVEMENT_GROUPS, achievementViews, type AchievementGroup, type AchievementView, type SaveState } from '@nocap/games';
import type { AstroId } from './astros';

const GROUP_ASTRO: Record<AchievementGroup, AstroId> = {
  taps: 'star',
  dust: 'rock',
  grimoires: 'moon',
  objects: 'ice',
  combo: 'venus',
  collapses: 'hole',
  tree: 'nebula',
  hidden: 'galaxy',
};

export interface AchievementRow {
  id: string;
  name: string;
  text: string;
  astro: AstroId;
  earned: boolean;
  /** Escondida e ainda não ganha: a tela mostra "???". */
  secret: boolean;
  value: number;
  goal: number;
  /** 0 a 1, para a barra. */
  fraction: number;
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
    name: secret ? '???' : v.def.name,
    text: secret ? 'Uma conquista escondida.' : v.def.text,
    astro: secret ? 'lock' : GROUP_ASTRO[v.def.group],
    earned: v.earned,
    secret,
    value: v.value,
    goal: v.def.goal,
    fraction: v.def.goal > 0 ? Math.min(1, v.value / v.def.goal) : 0,
  };
}

export function achievementGroups(state: SaveState): AchievementGroupRows[] {
  const views = achievementViews(state);
  return ACHIEVEMENT_GROUPS.map((g) => ({
    id: g.id,
    name: g.name,
    rows: views.filter((v) => v.def.group === g.id).map(row),
  })).filter((g) => g.rows.length > 0);
}

export function achievementCounts(state: SaveState): { earned: number; total: number } {
  const views = achievementViews(state);
  return { earned: views.filter((v) => v.earned).length, total: views.length };
}

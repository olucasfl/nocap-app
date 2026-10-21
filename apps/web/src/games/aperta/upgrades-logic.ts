import {
  COMBO_BONUS_PER_POINT,
  UPGRADES,
  effectiveStats,
  formatDecimal,
  formatNumber,
  nextUpgradeCost,
  upgradeAvailable,
  type EffectiveStats,
  type SaveState,
} from '@nocap/games';
import type { AstroId } from './astros';

/** Um segundo toque na compra dentro disto é ignorado (spec 038, 4.7). */
export const BUY_GUARD_SEC = 0.25;

/** Planeta-ícone de cada melhoria (spec 3.5). */
const UPGRADE_ASTRO: Record<string, AstroId> = {
  pulse: 'star',
  resonance: 'venus',
  reactor: 'betel',
  pleiades: 'starb',
  kepler: 'rock',
  hubble: 'nebula',
  voyager: 'jupiter',
  webb: 'galaxy',
  chandra: 'hole',
  gaia: 'moon',
};

export type UpgradeStatus = 'locked' | 'maxed' | 'affordable' | 'short';

export interface UpgradeRow {
  /** Posição em `UPGRADES`, que é o que o motor recebe em `buyUpgrade`. */
  index: number;
  id: string;
  name: string;
  text: string;
  astro: AstroId;
  level: number;
  max: number;
  status: UpgradeStatus;
  cost: number | null;
  /** Poeira que falta para a próxima compra (0 quando dá). */
  missing: number;
  /** "Poeira por toque: 4 -> 5"; `null` no máximo ou trancada. */
  gain: string | null;
  /** Por que está trancada ("Libera após 3 grimórios"). */
  lockHint: string | null;
}

interface Preview {
  label: string;
  read: (s: EffectiveStats) => string;
}

const seconds = (x: number) => `${formatDecimal(x, 1)} s`;

/** O que cada melhoria muda, lido do próprio `effectiveStats` (a regra continua no motor). */
const PREVIEW: Record<string, Preview> = {
  pulse: { label: 'Poeira por toque', read: (s) => formatNumber(Math.floor(s.dustPerTouch)) },
  resonance: {
    label: 'Janela do combo',
    read: (s) => (s.combo.enabled ? seconds(s.combo.windowSec) : 'sem combo'),
  },
  reactor: { label: 'Energia por toque', read: (s) => formatDecimal(s.energyPerTouch, 3) },
  pleiades: { label: 'Combo máximo', read: (s) => `x${s.combo.max}` },
  kepler: { label: 'Objeto a cada', read: (s) => `${seconds(s.objects.intervalSec)} (até ${s.objects.maxOnField})` },
  hubble: { label: 'Valor dos objetos', read: (s) => `+${formatDecimal((s.objects.valueMult.comet - 1) * 100, 0)}%` },
  voyager: { label: 'Duração do sinal', read: (s) => seconds(s.objects.signalSec) },
  webb: { label: 'Custo das melhorias', read: (s) => `${formatDecimal(s.costFactor * 100, 0)}%` },
  chandra: { label: 'Objeto no campo', read: (s) => seconds(s.objects.lifeSec.comet) },
};

/** O mesmo save com um nível a mais na melhoria, só para comparar os números. */
function withLevelUp(state: SaveState, index: number): SaveState {
  const upgradeLevels = state.run.upgradeLevels.slice();
  upgradeLevels[index] = (upgradeLevels[index] ?? 0) + 1;
  return { ...state, run: { ...state.run, upgradeLevels } };
}

function gainText(state: SaveState, index: number, id: string): string | null {
  const preview = PREVIEW[id];
  if (!preview) return id === 'gaia' ? 'As cartas passam a mostrar o efeito' : null;
  const before = preview.read(effectiveStats(state));
  const after = preview.read(effectiveStats(withLevelUp(state, index)));
  if (id === 'resonance' && (state.run.upgradeLevels[index] ?? 0) === 0) return `Liga o combo: cada toque seguido vale +${COMBO_BONUS_PER_POINT * 100}%`;
  return `${preview.label}: ${before} -> ${after}`;
}

function lockHint(state: SaveState, index: number): string | null {
  const def = UPGRADES[index];
  if (!def) return null;
  if (def.requiresPicks !== undefined && state.run.picks < def.requiresPicks) {
    return `Libera após ${def.requiresPicks} grimórios`;
  }
  if (def.requiresUpgrade) {
    const need = UPGRADES.find((u) => u.id === def.requiresUpgrade?.id);
    return `Compre ${need?.name ?? 'a anterior'} primeiro`;
  }
  return null;
}

/** As linhas da página de Melhorias: só o que o colapso atual já abriu, na ordem do catálogo. */
export function upgradeRows(state: SaveState): UpgradeRow[] {
  const rows: UpgradeRow[] = [];
  UPGRADES.forEach((def, index) => {
    if (def.unlockedAtCollapse > state.collapses) return;
    const level = state.run.upgradeLevels[index] ?? 0;
    const open = upgradeAvailable(state, index);
    const cost = nextUpgradeCost(state, index);
    let status: UpgradeStatus;
    if (!open) status = 'locked';
    else if (cost === null) status = 'maxed';
    else status = state.run.dust >= cost ? 'affordable' : 'short';
    rows.push({
      index,
      id: def.id,
      name: def.name,
      text: def.text,
      astro: UPGRADE_ASTRO[def.id] ?? 'star',
      level,
      max: def.max,
      status,
      cost,
      missing: cost !== null ? Math.max(0, Math.ceil(cost - state.run.dust)) : 0,
      gain: status === 'affordable' || status === 'short' ? gainText(state, index, def.id) : null,
      lockHint: status === 'locked' ? lockHint(state, index) : null,
    });
  });
  return rows;
}

/** Texto do botão de compra: preço, "falta N", "No máximo" ou o cadeado. */
export function buyLabel(row: UpgradeRow): string {
  switch (row.status) {
    case 'maxed':
      return 'No máximo';
    case 'locked':
      return 'Trancada';
    case 'affordable':
      return formatNumber(row.cost ?? 0);
    case 'short':
      return `Falta ${formatNumber(row.missing)}`;
  }
}

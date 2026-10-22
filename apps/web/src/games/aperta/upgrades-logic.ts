import {
  UPGRADES,
  effectiveStats,
  formatDecimal,
  formatNumber,
  nextUpgradeCost,
  upgradeAvailable,
  upgradeLock,
  type UpgradeLock,
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
  pulse: { label: 'Poeira por toque', read: (s) => formatDecimal(s.dustPerTouch, 0) },
  resonance: {
    label: 'Valor de cada ponto de combo',
    read: (s) => (s.combo.enabled ? `+${formatDecimal(s.combo.pointValue, 2)}` : 'sem combo'),
  },
  reactor: { label: 'Energia por toque', read: (s) => formatDecimal(s.energyPerTouch, 2) },
  pleiades: { label: 'Combo máximo', read: (s) => `x${s.combo.max}` },
  kepler: { label: 'Objeto a cada', read: (s) => `${seconds(s.objects.intervalSec)} (até ${s.objects.maxOnField})` },
  hubble: { label: 'Poeira por segundo', read: (s) => formatDecimal(s.dustPerSecond, 0) },
  voyager: { label: 'Duração do sinal', read: (s) => seconds(s.objects.signalSec) },
  webb: { label: 'Poeira por toque', read: (s) => formatDecimal(s.dustPerTouch, 0) },
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
  if (id === 'resonance' && (state.run.upgradeLevels[index] ?? 0) === 0) return 'Liga o combo: cada toque seguido soma 0,2 ao toque';
  return `${preview.label}: ${before} -> ${after}`;
}

/** "Em breve": a condição que falta, em palavras (spec 038, 5.1). */
export function lockText(lock: UpgradeLock): string {
  switch (lock.kind) {
    case 'collapse':
      return `Libera no colapso ${lock.collapse}`;
    case 'requires': {
      const need = UPGRADES.find((u) => u.id === lock.upgrade);
      return `Compre ${need?.name ?? 'a anterior'} primeiro`;
    }
    case 'milestone': {
      const parts: string[] = [];
      if (lock.dust !== null) parts.push(`${formatNumber(lock.dust)} de poeira ganha`);
      if (lock.upgrade) {
        const need = UPGRADES.find((u) => u.id === lock.upgrade?.id);
        parts.push(`${need?.name ?? 'a anterior'} no nível ${lock.upgrade.level}`);
      }
      return `Em breve: libera com ${parts.join(' ou ')}`;
    }
  }
}

function lockHint(state: SaveState, index: number): string | null {
  const lock = upgradeLock(state, index);
  return lock ? lockText(lock) : null;
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

import {
  UPGRADES,
  autoRates,
  batchCost,
  batchLevels,
  effectiveStats,
  formatDecimal,
  formatNumber,
  nextUpgradeCost,
  upgradeLock,
  type EffectiveStats,
  type SaveState,
  type UpgradeKind,
  type UpgradeLock,
} from '@nocap/games';
import type { AstroId } from './astros';

/** Um segundo toque na compra dentro disto é ignorado (spec 038, 4.7). */
export const BUY_GUARD_SEC = 0.25;

/** As duas abas da página de Melhorias (spec 039, seção 6). */
export type UpgradeTab = 'touch' | 'generators';
export const UPGRADE_TABS: readonly { id: UpgradeTab; label: string }[] = [
  { id: 'touch', label: 'Toque' },
  { id: 'generators', label: 'Geradores' },
];

export const tabOf = (kind: UpgradeKind): UpgradeTab => (kind === 'touch' ? 'touch' : 'generators');

/** Planeta-ícone de cada melhoria (spec 3.5). */
const UPGRADE_ASTRO: Record<string, AstroId> = {
  lens: 'star',
  gloves: 'mars',
  trained: 'rock',
  rhythm: 'venus',
  magnet: 'ice',
  hands: 'moon',
  charged: 'betel',
  luck: 'starb',
  cadence: 'redgiant',
  kepler: 'rock',
  voyager: 'jupiter',
  echo: 'nebula',
  lens2: 'star',
  webb: 'galaxy',
  cabin: 'starb',
  chandra: 'hole',
  gaia: 'moon',
  satellite: 'moon',
  probe: 'mercury',
  telescope: 'saturn',
  observatory: 'titan',
  station: 'neptune',
  colony: 'mars',
  fleet: 'jupiter',
  portal: 'hole',
  antenna: 'ice',
  receiver: 'nebula',
  matrix: 'galaxy',
  deepnet: 'hole',
  warmup: 'redgiant',
  network: 'mercury',
  lure: 'ice',
  burst: 'starb',
  scale: 'saturn',
  peak: 'star',
  queue: 'moon',
  convert: 'nebula',
  rotation: 'jupiter',
};

/** Astro-ícone de uma melhoria (cartões e órbitas dos geradores). */
export function upgradeAstro(id: string): AstroId {
  return UPGRADE_ASTRO[id] ?? 'star';
}

export type UpgradeStatus = 'locked' | 'mystery' | 'maxed' | 'affordable' | 'short';

export interface UpgradeRow {
  /** Posição em `UPGRADES`, que é o que o motor recebe em `buyUpgrade`. */
  index: number;
  id: string;
  kind: UpgradeKind;
  tab: UpgradeTab;
  /** "???" enquanto a melhoria está escondida (só o preço aparece). */
  name: string;
  text: string;
  astro: AstroId;
  level: number;
  max: number;
  status: UpgradeStatus;
  cost: number | null;
  /** Poeira que falta para a próxima compra (0 quando dá). */
  missing: number;
  /** "Poeira por toque: 4 -> 5"; `null` no máximo, trancada ou escondida. */
  gain: string | null;
  /** Por que está trancada ("Compre a anterior primeiro"). */
  lockHint: string | null;
  /** Fila de pedidos: níveis que o botão "Completar" compra (os que faltam) e o preço com o desconto, ou `null`. */
  bulkLevels: number;
  bulkCost: number | null;
}

interface Preview {
  label: string;
  read: (s: EffectiveStats) => string;
}

const seconds = (x: number) => `${formatDecimal(x, 1)} s`;
const perTouch: Preview = { label: 'Poeira por toque', read: (s) => formatDecimal(s.dustPerTouch, 0) };
const dustSec: Preview = { label: 'Poeira por segundo', read: (s) => formatDecimal(s.autoDustPerSec, 1) };
const energySec: Preview = { label: 'Energia por segundo', read: (s) => formatDecimal(s.autoEnergyPerSec, 2) };

/** O que cada melhoria muda, lido do próprio `effectiveStats` (a regra continua no motor). */
const PREVIEW: Record<string, Preview> = {
  lens: perTouch,
  gloves: perTouch,
  hands: perTouch,
  echo: perTouch,
  lens2: perTouch,
  webb: perTouch,
  cabin: perTouch,
  cadence: { label: 'Combo máximo', read: (s) => `x${s.combo.max}` },
  charged: { label: 'Energia por toque', read: (s) => formatDecimal(s.energyPerTouch, 2) },
  luck: { label: 'Chance de toque x10', read: (s) => `${formatDecimal(s.crit.chance * 100, 0)}%` },
  kepler: { label: 'Objeto a cada', read: (s) => `${formatDecimal(s.objects.spawnMinSec, 0)} a ${formatDecimal(s.objects.spawnMaxSec, 0)} s` },
  magnet: { label: 'Cada toque encurta a espera', read: (s) => seconds(s.objects.spawnCutPerTouch) },
  voyager: { label: 'Duração do sinal', read: (s) => seconds(s.objects.signalSec) },
  chandra: { label: 'Objeto no campo', read: (s) => seconds(s.objects.lifeSec.comet) },
};

/** Melhorias de toque cujo efeito não mexe num número do `effectiveStats` que valha mostrar antes e depois. */
const PLAIN_GAIN: Record<string, string> = {
  rhythm: 'Combo: tocar de novo em até 1,3 s mantém a sequência, e cada toque seguido soma 0,2 do toque',
  trained: 'A cada 25 toques, o toque rende x5',
  gaia: 'As cartas passam a mostrar o efeito',
};

/** O mesmo save com um nível a mais na melhoria, só para comparar os números. */
function withLevelUp(state: SaveState, index: number): SaveState {
  const upgradeLevels = state.run.upgradeLevels.slice();
  upgradeLevels[index] = (upgradeLevels[index] ?? 0) + 1;
  return { ...state, run: { ...state.run, upgradeLevels } };
}

function gainText(state: SaveState, index: number, id: string): string | null {
  const plain = PLAIN_GAIN[id];
  if (plain) return plain;
  const def = UPGRADES[index];
  const preview = PREVIEW[id] ?? (def?.kind === 'generator' ? dustSec : def?.kind === 'energy' ? energySec : undefined);
  if (!preview) return null;
  const before = preview.read(effectiveStats(state));
  const after = preview.read(effectiveStats(withLevelUp(state, index)));
  return `${preview.label}: ${before} -> ${after}`;
}

/** A condição que falta, em palavras (spec 039, 6). */
export function lockText(lock: UpgradeLock): string {
  switch (lock.kind) {
    case 'collapse':
      return `Libera no colapso ${lock.collapse}`;
    case 'requires': {
      const need = UPGRADES.find((u) => u.id === lock.upgrade);
      return `Compre ${need?.name ?? 'a anterior'} primeiro`;
    }
    case 'shelf':
      return 'Compre as anteriores para ver esta';
    case 'mystery':
      return 'Descubra juntando 70% do preço';
  }
}


/**
 * As linhas da página de Melhorias de uma aba (ou das duas): só o que está na prateleira. As escondidas viram
 * "???" com o preço; as de colapso futuro e as longe demais nem aparecem.
 */
export function upgradeRows(state: SaveState, tab?: UpgradeTab): UpgradeRow[] {
  const rows: UpgradeRow[] = [];
  UPGRADES.forEach((def, index) => {
    if (tab && tabOf(def.kind) !== tab) return;
    const lock = upgradeLock(state, index);
    const level = state.run.upgradeLevels[index] ?? 0;
    // Completa (8/8, ou comprada): vai para a aba Comprados mesmo que já tenha saído da prateleira.
    const complete = level >= def.max;
    if (!complete && (lock?.kind === 'collapse' || lock?.kind === 'shelf')) return;
    const cost = lock?.kind === 'mystery' ? lock.cost : nextUpgradeCost(state, index);
    let status: UpgradeStatus;
    if (complete) status = 'maxed';
    else if (lock?.kind === 'mystery') status = 'mystery';
    else if (lock) status = 'locked';
    else if (cost === null) status = 'maxed';
    else status = state.run.dust >= cost ? 'affordable' : 'short';
    const hidden = status === 'mystery';
    rows.push({
      index,
      id: def.id,
      kind: def.kind,
      tab: tabOf(def.kind),
      name: hidden ? '???' : def.name,
      text: hidden ? 'Ainda não descoberta' : def.text,
      astro: hidden ? 'lock' : (UPGRADE_ASTRO[def.id] ?? 'star'),
      level,
      max: def.max,
      status,
      cost,
      missing: cost !== null ? Math.max(0, Math.ceil(cost - state.run.dust)) : 0,
      gain: status === 'affordable' || status === 'short' ? gainText(state, index, def.id) : null,
      lockHint: (status === 'locked' || status === 'mystery') && lock ? lockText(lock) : null,
      bulkLevels: hidden ? 0 : batchLevels(state, index),
      bulkCost: hidden ? null : batchCost(state, index),
    });
  });
  // Dentro da aba: poeira, energia e melhorias de gerador em blocos, cada um na fila do preço.
  const rank = (k: UpgradeKind): number => (k === 'touch' || k === 'generator' ? 0 : k === 'energy' ? 1 : 2);
  const base = (r: UpgradeRow): number => (UPGRADES[r.index] as { base: number }).base;
  return rows.sort((a, b) => rank(a.kind) - rank(b.kind) || base(a) - base(b) || a.index - b.index);
}

/** Ids das melhorias que já mostram nome (compradas, à venda ou trancadas por exigência). */
export function revealedIds(state: SaveState, tab?: UpgradeTab): string[] {
  return upgradeRows(state, tab)
    .filter((r) => r.status !== 'mystery')
    .map((r) => r.id);
}

/** Quantas coisas há para ver na aba: melhorias à venda agora ou reveladas que a pessoa ainda não viu. */
export function tabBadge(state: SaveState, tab: UpgradeTab, seen: ReadonlySet<string>): number {
  return upgradeRows(state, tab).filter(
    (r) => r.status === 'affordable' || (r.status !== 'mystery' && r.status !== 'maxed' && !seen.has(r.id)),
  ).length;
}

/** Selo do botão Melhorias: a soma do que há para ver nas duas abas. */
export function upgradeBadge(state: SaveState, seen: ReadonlySet<string>): number {
  return UPGRADE_TABS.reduce((sum, t) => sum + tabBadge(state, t.id, seen), 0);
}

/** Texto do botão de compra: preço, "falta N", "Comprada" ou o cadeado. */
export function buyLabel(row: UpgradeRow): string {
  switch (row.status) {
    case 'maxed':
      return row.max === 1 ? 'Comprada' : 'No máximo';
    case 'locked':
      return 'Trancada';
    case 'mystery':
    case 'affordable':
      return formatNumber(row.cost ?? 0);
    case 'short':
      return `Falta ${formatNumber(row.missing)}`;
  }
}

/**
 * Resumo do ganho REAL para o alto da aba Geradores (spec 041, A7): o que cai por segundo de poeira e de energia agora,
 * já com o limite do toque, e quanto os geradores renderiam sem ele (para explicar por que o número não sobe).
 */
export function autoSummary(state: SaveState): { active: string; energy: string; potential: string; capped: boolean } {
  const s = effectiveStats(state);
  const rates = autoRates(state);
  return {
    active: formatRate(rates.dust),
    energy: formatRate(rates.energy),
    potential: formatRate(s.autoDustPerSec),
    capped: s.autoDustPerSec > s.autoDustCap * 1.001,
  };
}

/** "8,8/s" com 1 casa quando é pouco, inteiro quando é muito. */
export function formatRate(perSec: number): string {
  if (!(perSec > 0)) return '0';
  if (perSec < 10) return formatDecimal(perSec, 1);
  return formatNumber(perSec);
}

/** As duas áreas da página: o que dá para comprar e o que já está completo (spec 041, A5). */
export type UpgradeSection = 'buy' | 'owned';
export const isOwnedRow = (r: UpgradeRow): boolean => r.status === 'maxed';

/** Itens completos, na ordem de exibição (toque, poeira, energia, melhorias de gerador), para a aba Comprados. */
export function ownedRows(state: SaveState): UpgradeRow[] {
  return upgradeRows(state).filter(isOwnedRow);
}

/** O que a aba Comprar mostra: tudo que ainda não está completo. */
export function buyRows(state: SaveState, tab: UpgradeTab): UpgradeRow[] {
  return upgradeRows(state, tab).filter((r) => !isOwnedRow(r));
}

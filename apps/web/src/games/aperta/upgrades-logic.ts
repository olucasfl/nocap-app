import {
  UPGRADES,
  autoRates,
  batchCost,
  batchLevels,
  effectiveStats,
  formatDecimal,
  formatNumber,
  nextUpgradeCost,
  nextItemIndex,
  upgradeLock,
  type EffectiveStats,
  type SaveState,
  type UpgradeKind,
  type UpgradeDef,
  type UpgradeLock,
} from '@nocap/games';
import type { AstroId } from './astros';

/** Um segundo toque na compra dentro disto é ignorado (spec 038, 4.7). */
export const BUY_GUARD_SEC = 0.25;

/** As duas áreas da página de Melhorias (spec 043): Itens (compra única, em fila) e Geradores. */
export type UpgradeTab = 'items' | 'generators';
export const UPGRADE_TABS: readonly { id: UpgradeTab; label: string }[] = [
  { id: 'items', label: 'Itens' },
  { id: 'generators', label: 'Geradores' },
];

export const tabOf = (kind: UpgradeKind): UpgradeTab => (kind === 'item' ? 'items' : 'generators');

/** Astro-ícone dos geradores (órbitas em volta do botão e cartões). */
const UPGRADE_ASTRO: Record<string, AstroId> = {
  satellite: 'moon',
  probe: 'mercury',
  telescope: 'saturn',
  observatory: 'titan',
  station: 'neptune',
  colony: 'mars',
  fleet: 'jupiter',
  portal: 'hole',
  cluster: 'galaxy',
  quasar: 'starb',
  web: 'nebula',
  antenna: 'ice',
  receiver: 'nebula',
  matrix: 'galaxy',
  deepnet: 'hole',
  array: 'star',
};

/** Astro-ícone de um gerador. */
export function upgradeAstro(id: string): AstroId {
  return UPGRADE_ASTRO[id] ?? 'star';
}

export type UpgradeStatus = 'locked' | 'maxed' | 'affordable' | 'short';

/** "4,5" ou "12 mil": poucos dígitos quando o número é pequeno. */
export function amount(x: number): string {
  if (!Number.isFinite(x)) return '0';
  if (x < 10) return formatDecimal(x, x < 1 ? 2 : 1);
  return formatNumber(x);
}

/** Uma linha "antes -> depois" do total REAL da pessoa (o item nunca mostra só o "+4"). */
export interface EffectLine {
  label: string;
  before: string;
  after: string;
  /** O item ainda não muda nada (ex.: bônus de gerador sem gerador): a tela explica. */
  idle: boolean;
}

/** O mesmo save com um nível a mais na melhoria, só para comparar os números. */
function withLevelUp(state: SaveState, index: number): SaveState {
  const upgradeLevels = state.run.upgradeLevels.slice();
  upgradeLevels[index] = (upgradeLevels[index] ?? 0) + 1;
  return { ...state, run: { ...state.run, upgradeLevels } };
}

interface Reading {
  label: string;
  read: (s: EffectiveStats) => number;
  unit?: string;
}

const READ_TOUCH: Reading = { label: 'Seu toque', read: (s) => s.dustPerTouch };
const READ_ENERGY: Reading = { label: 'Energia por toque', read: (s) => s.energyPerTouch };
const READ_GEN: Reading = { label: 'Geradores de poeira', read: (s) => s.autoDustPerSec, unit: '/s' };
const READ_ENERGY_GEN: Reading = { label: 'Geradores de energia', read: (s) => s.autoEnergyPerSec, unit: '/s' };

const READING_OF: Record<string, Reading> = {
  touchAdd: READ_TOUCH,
  touchMult: READ_TOUCH,
  energyMult: READ_ENERGY,
  genMult: READ_GEN,
  energyGenMult: READ_ENERGY_GEN,
};

/** O efeito do item no total de quem joga: "Seu toque: 40 -> 80". */
export function effectLine(state: SaveState, index: number): EffectLine | null {
  const def = UPGRADES[index];
  if (!def?.item) return null;
  const reading = READING_OF[def.item.type];
  if (!reading) return null;
  const before = reading.read(effectiveStats(state));
  const after = reading.read(effectiveStats(withLevelUp(state, index)));
  const unit = reading.unit ?? '';
  return { label: reading.label, before: `${amount(before)}${unit}`, after: `${amount(after)}${unit}`, idle: !(after > before) };
}

/** A condição que falta, em palavras. */
export function lockText(lock: UpgradeLock): string {
  switch (lock.kind) {
    case 'collapse':
      return `Libera no colapso ${lock.collapse}`;
    case 'order': {
      const need = UPGRADES.find((u) => u.id === lock.before);
      return `Compre ${need?.name ?? 'o item de cima'} primeiro`;
    }
    case 'shelf':
      return 'Compre os anteriores para ver este';
  }
}

export interface ItemRow {
  index: number;
  id: string;
  name: string;
  text: string;
  era: UpgradeDef['era'];
  effectType: string;
  cost: number;
  missing: number;
  affordable: boolean;
  /** Poeira da pessoa em relação ao preço (0 a 1): enche a barrinha do item em destaque. */
  fill: number;
  line: EffectLine | null;
}

export interface ItemsView {
  /** O próximo item da fila (o único que dá para comprar), ou `null` quando acabou o que há neste colapso. */
  next: ItemRow | null;
  /** Os dois seguintes, esmaecidos: nome, efeito e preço, para dar vontade. */
  upcoming: ItemRow[];
  /** Quantos já foram comprados nesta vida, e quantos há ao todo neste colapso. */
  bought: number;
  total: number;
  /** Itens comprados nesta vida, do mais recente para o mais antigo. */
  owned: ItemRow[];
  /** O primeiro colapso que traz itens novos, quando a fila daqui acabou. */
  moreAt: number | null;
  /** Quantos itens ainda esperam por um colapso (o cartão "mais itens depois"). */
  later: number;
}

function itemRow(state: SaveState, index: number): ItemRow {
  const def = UPGRADES[index] as UpgradeDef;
  const cost = def.base;
  const dust = state.run.dust;
  return {
    index,
    id: def.id,
    name: def.name,
    text: def.text,
    era: def.era,
    effectType: def.item?.type ?? 'touchMult',
    cost,
    missing: Math.max(0, Math.ceil(cost - dust)),
    affordable: dust >= cost,
    fill: Math.max(0, Math.min(1, dust / cost)),
    line: effectLine(state, index),
  };
}

export function itemsView(state: SaveState): ItemsView {
  const items = UPGRADES.map((u, index) => ({ u, index })).filter(({ u }) => u.kind === 'item');
  const here = items.filter(({ u }) => u.unlockedAtCollapse <= state.collapses);
  const nextIdx = nextItemIndex(state);
  const owned = here.filter(({ index }) => (state.run.upgradeLevels[index] ?? 0) > 0);
  const upcoming = here
    .filter(({ index }) => {
      const lock = upgradeLock(state, index);
      return lock?.kind === 'order';
    })
    .slice(0, 2)
    .map(({ index }) => itemRow(state, index));
  const future = items.find(({ u }) => u.unlockedAtCollapse > state.collapses);
  return {
    next: nextIdx === null ? null : itemRow(state, nextIdx),
    upcoming,
    bought: owned.length,
    total: here.length,
    owned: owned.slice().reverse().map(({ index }) => itemRow(state, index)),
    moreAt: nextIdx === null && future ? future.u.unlockedAtCollapse : null,
    later: items.filter(({ u }) => u.unlockedAtCollapse > state.collapses).length,
  };
}

/** "Seus poderes": o que a pessoa tem de verdade agora, para o alto da página. */
export function powers(state: SaveState): { touch: string; energy: string; dustSec: string; energySec: string } {
  const s = effectiveStats(state);
  const rates = autoRates(state);
  return { touch: amount(s.dustPerTouch), energy: amount(s.energyPerTouch), dustSec: formatRate(rates.dust), energySec: formatRate(rates.energy) };
}

/** Quanto tempo o gerador leva para pagar o que custou, em palavras ("cerca de 12 min"); `null` se não rende nada. */
export function paybackText(cost: number, gainPerSec: number): string | null {
  if (!(gainPerSec > 0)) return null;
  const sec = cost / gainPerSec;
  if (sec < 90) return `se paga em ${Math.max(1, Math.round(sec))} s`;
  if (sec < 5400) return `se paga em ${Math.round(sec / 60)} min`;
  return `se paga em ${formatDecimal(sec / 3600, 1)} h`;
}

export interface GeneratorRow {
  index: number;
  id: string;
  kind: UpgradeKind;
  name: string;
  /** "+0,2 poeira por segundo" por nível. */
  text: string;
  astro: AstroId;
  energy: boolean;
  level: number;
  max: number;
  status: UpgradeStatus;
  cost: number | null;
  missing: number;
  /** "Rende agora: 0,4/s -> 0,6/s" (já com os itens). `null` no máximo ou trancado. */
  gain: string | null;
  /** "Rende no total: 2,4/s". */
  total: string | null;
  payback: string | null;
  lockHint: string | null;
  bulkLevels: number;
  bulkCost: number | null;
}

export function generatorRows(state: SaveState): GeneratorRow[] {
  const rows: GeneratorRow[] = [];
  const stats = effectiveStats(state);
  UPGRADES.forEach((def, index) => {
    if (def.kind !== 'generator' && def.kind !== 'energy') return;
    const lock = upgradeLock(state, index);
    const level = state.run.upgradeLevels[index] ?? 0;
    const complete = level >= def.max;
    if (!complete && (lock?.kind === 'collapse' || lock?.kind === 'shelf')) return;
    const cost = nextUpgradeCost(state, index);
    let status: UpgradeStatus;
    if (complete) status = 'maxed';
    else if (lock) status = 'locked';
    else if (cost === null) status = 'maxed';
    else status = state.run.dust >= cost ? 'affordable' : 'short';
    const energy = def.kind === 'energy';
    const read = (s: EffectiveStats): number => (energy ? s.autoEnergyPerSec : s.autoDustPerSec);
    const unit = energy ? 'energia' : 'poeira';
    const now = read(stats);
    const next = read(effectiveStats(withLevelUp(state, index)));
    const shown = status === 'affordable' || status === 'short';
    rows.push({
      index,
      id: def.id,
      kind: def.kind,
      name: def.name,
      text: def.text,
      astro: upgradeAstro(def.id),
      energy,
      level,
      max: def.max,
      status,
      cost,
      missing: cost !== null ? Math.max(0, Math.ceil(cost - state.run.dust)) : 0,
      gain: shown ? `Seus geradores de ${unit}: ${amount(now)}/s -> ${amount(next)}/s` : null,
      total: level > 0 ? `Este gerador rende ${amount(((def.perSec ?? 0) * level * (read(stats) / Math.max(1e-12, rawSum(state, energy)))) )}/s no total` : null,
      payback: shown && cost !== null ? paybackText(cost, next - now) : null,
      lockHint: status === 'locked' && lock ? lockText(lock) : null,
      bulkLevels: batchLevels(state, index),
      bulkCost: batchCost(state, index),
    });
  });
  return rows;
}

/** Soma crua (sem itens) dos geradores do tipo, para repartir o total entre eles. */
function rawSum(state: SaveState, energy: boolean): number {
  return UPGRADES.reduce((sum, def, i) => {
    if (def.kind !== (energy ? 'energy' : 'generator')) return sum;
    return sum + (def.perSec ?? 0) * (state.run.upgradeLevels[i] ?? 0);
  }, 0);
}

/** Tudo que há para ver em Itens: o selo conta o próximo item se já dá para comprar. */
export function tabBadge(state: SaveState, tab: UpgradeTab, seen: ReadonlySet<string>): number {
  if (tab === 'items') {
    const v = itemsView(state);
    return v.next?.affordable ? 1 : 0;
  }
  return generatorRows(state).filter((r) => r.status === 'affordable' || (r.status !== 'maxed' && !seen.has(r.id))).length;
}

/** Selo do botão Melhorias: a soma do que há para ver nas duas abas. */
export function upgradeBadge(state: SaveState, seen: ReadonlySet<string>): number {
  return UPGRADE_TABS.reduce((sum, t) => sum + tabBadge(state, t.id, seen), 0);
}

/** Ids de geradores que já mostram nome (o selo conta os que a pessoa ainda não viu). */
export function revealedIds(state: SaveState): string[] {
  return generatorRows(state).map((r) => r.id);
}

/** "8,8/s" com 1 casa quando é pouco, inteiro quando é muito. */
export function formatRate(perSec: number): string {
  if (!(perSec > 0)) return '0';
  if (perSec < 10) return formatDecimal(perSec, 1);
  return formatNumber(perSec);
}

/** Texto do botão de compra: preço, "falta N" ou "No máximo". */
export function buyLabel(row: { status: UpgradeStatus; cost: number | null; missing: number; max?: number }): string {
  switch (row.status) {
    case 'maxed':
      return 'No máximo';
    case 'locked':
      return 'Trancado';
    case 'affordable':
      return formatNumber(row.cost ?? 0);
    case 'short':
      return `Falta ${formatNumber(row.missing)}`;
  }
}

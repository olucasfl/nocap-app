// Simulador de economia do Aperta! (spec 038, seção 6.5). Usa o PRÓPRIO motor (press, buyUpgrade,
// chooseGrimoire, collapse...) e só decide como um jogador decidiria: quando tocar, o que comprar,
// qual carta pegar. As horas que ele devolve são de jogo aberto, não de relógio de parede.

import { createRng } from '../core/rng';
import { OBJECTS, TREE, UPGRADES, grimoireById, treeNodeId, type ObjectKind } from './catalog';
import { formatDecimal, formatNumber } from './format';
import { targetHours } from './economy';
import {
  buyTreeNode,
  buyUpgrade,
  canCollapse,
  captureObject,
  chooseGrimoire,
  collapse,
  effectiveStats,
  fragmentsAvailable,
  newSave,
  nextUpgradeCost,
  press,
  selectGrimoire,
  tickObjects,
  treeNodeCost,
  type EffectiveStats,
  type SaveState,
} from './engine';

export interface Profile {
  id: 'casual' | 'normal' | 'compulsive';
  name: string;
  /** Toques por segundo enquanto joga (o compulsivo bate o teto de segurar a tecla, 6/s). */
  touchesPerSec: number;
  /** Chance de pegar cada objeto que aparece. */
  captureChance: number;
}

export const PROFILES: Record<Profile['id'], Profile> = {
  casual: { id: 'casual', name: 'Casual', touchesPerSec: 1, captureChance: 0.4 },
  normal: { id: 'normal', name: 'Normal', touchesPerSec: 2.5, captureChance: 0.7 },
  compulsive: { id: 'compulsive', name: 'Compulsivo', touchesPerSec: 6, captureChance: 0.9 },
};

/** Tempo que o jogador gasta lendo as cartas e confirmando (além do bloqueio de 1,6 s). */
const PICK_THINK_SEC = 2.5;
/** Carimbo de "nunca" para o próximo evento: o simulador não os dispara. */
const NO_EVENT = 1e12;
const ENERGY_WEIGHT = 0.5;
const MILESTONE_NAMES = ['1ª melhoria', '1ª escolha', '10 escolhas', '1 mi de poeira', 'Estrela pronta'] as const;

export interface LifeResult {
  /** Colapso que esta vida terminou (1 = primeiro). */
  collapse: number;
  hours: number;
  picks: number;
  dust: number;
  /** Horas desde o início da vida até cada marco (`null` se não chegou). */
  milestones: (number | null)[];
  upgradeLevels: number[];
  stalled: boolean;
}

export interface SimResult {
  profile: Profile['id'];
  seed: string;
  lives: LifeResult[];
  grimoirePicks: Record<string, number>;
  alerts: string[];
}

export interface SimOptions {
  profile: Profile['id'];
  seed: string;
  /** Quantos colapsos simular. */
  collapses: number;
  /** Trava de segurança por vida (horas de jogo). */
  maxHoursPerLife?: number;
  /** Diagnóstico: chamado uma vez por minuto de jogo, com as horas desde o início da vida e o estado. */
  trace?: (hoursInLife: number, state: SaveState) => void;
}

/** Renda estimada por segundo, só para o jogador decidir o que comprar (não é regra do jogo). */
function income(stats: EffectiveStats, profile: Profile, objectKinds: readonly ObjectKind[]): { dust: number; energy: number } {
  const tps = profile.touchesPerSec;
  const full = stats.combo.enabled && 1 / tps <= stats.combo.windowSec;
  const point = full ? 1 + stats.combo.pointValue * stats.combo.max : 1;
  const nth = stats.nth.reduce((acc, r) => acc * (1 + (r.mult - 1) / r.n), 1);
  const base = stats.dustPerTouch + (full ? stats.combo.fullDustAdd : 0);
  const crit = 1 + stats.crit.chance * (stats.crit.mult - 1);
  const perTouch = base * point * (full ? stats.combo.fullMult : 1) * nth * crit;
  const touchEnergy =
    stats.energyPerTouch + (full ? stats.combo.fullEnergyAdd : 0) + stats.nth.reduce((acc, r) => acc + r.energy / r.n, 0);

  let objectDust = 0;
  let objectEnergy = 0;
  if (!stats.objects.disabled) {
    const totalWeight = objectKinds.reduce((sum, k) => sum + weightOf(k), 0);
    // Cada toque encurta a espera (Toque Magnético): T = I / (1 + toques/s * corte).
    const interval = (stats.objects.spawnMinSec + stats.objects.spawnMaxSec) / 2 / (1 + tps * stats.objects.spawnCutPerTouch);
    const rate = (1 / interval) * profile.captureChance;
    for (const k of objectKinds) {
      const share = weightOf(k) / totalWeight;
      const r = stats.objects.reward[k];
      objectDust += rate * share * r.dust * stats.dustPerTouch;
      objectEnergy += rate * share * (r.energy * stats.energyPerTouch + stats.objects.onCaptureEnergyTouches * stats.energyPerTouch);
    }
  }
  return {
    // O simulador toca sem parar, então os geradores rendem no ritmo ativo (com o teto).
    dust: tps * perTouch + objectDust + Math.min(stats.autoDustPerSec, stats.autoDustCap),
    energy: tps * touchEnergy * 1 + objectEnergy + Math.min(stats.autoEnergyPerSec, stats.autoEnergyCap),
  };
}

function weightOf(kind: ObjectKind): number {
  return { comet: 50, 'shooting-star': 25, satellite: 25, asteroid: 20, probe: 8, golden: 0 }[kind];
}

function score(state: SaveState, profile: Profile): number {
  const stats = effectiveStats(state);
  const kinds = OBJECTS.filter((o) => o.unlockedAtCollapse <= state.collapses).map((o) => o.kind);
  const inc = income(stats, profile, kinds);
  return Math.log(inc.dust) + ENERGY_WEIGHT * Math.log(inc.energy) - 0.5 * Math.log(stats.costFactor);
}

/** Valor por tipo de efeito que `score` não enxerga (escolha dupla, troca, poeira inicial). */
function extraValue(id: string): number {
  switch (id) {
    case 'orion-nebula':
      return 0.45;
    case 'titan':
      return 0.02;
    case 'betelgeuse':
      return 0.03;
    case 'crab-nebula':
      return 0.05;
    case 'polaris':
      return 0.02;
    default:
      return 0;
  }
}

function bestOffer(state: SaveState, profile: Profile): string {
  const pending = state.run.pending;
  if (!pending) throw new Error('no pending choice');
  const base = score(state, profile);
  let best = pending.offers[0] as string;
  let bestValue = -Infinity;
  for (const id of pending.offers) {
    const current = state.run.build[id] ?? 0;
    const hypothetical: SaveState = {
      ...state,
      run: { ...state.run, build: { ...state.run.build, [id]: Math.min(10, current + 1) } },
    };
    const value = score(hypothetical, profile) - base + extraValue(id);
    if (value > bestValue) {
      bestValue = value;
      best = id;
    }
  }
  return best;
}

interface Target {
  index: number;
}

/** Melhoria de melhor ganho por poeira; o jogador junta para ela em vez de gastar em qualquer coisa. */
function planUpgrade(state: SaveState, profile: Profile): Target | null {
  const base = score(state, profile);
  let best: Target | null = null;
  let bestRatio = 0;
  UPGRADES.forEach((_, index) => {
    const cost = nextUpgradeCost(state, index);
    if (cost === null) return;
    const levels = state.run.upgradeLevels.slice();
    levels[index] = (levels[index] ?? 0) + 1;
    const gain = score({ ...state, run: { ...state.run, upgradeLevels: levels } }, profile) - base;
    const ratio = gain / cost;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = { index };
    }
  });
  return best;
}

function bestPage(state: SaveState, profile: Profile): string {
  const base = score(state, profile);
  let best = Object.keys(state.run.build)[0] as string;
  let bestValue = -Infinity;
  for (const [id, lvl] of Object.entries(state.run.build)) {
    const hypothetical: SaveState = {
      ...state,
      atlas: { ...state.atlas, pages: [...state.atlas.pages, { grimoireId: id, level: lvl }] },
    };
    const value = score(hypothetical, profile);
    if (value - base > bestValue) {
      bestValue = value - base;
      best = id;
    }
  }
  return best;
}

/** Atlas cheio: a página nova entra no lugar da mais fraca (a que menos pesa no score). */
function replaceIndexFor(state: SaveState, pageId: string): number | undefined {
  const pages = state.atlas.pages;
  if (pages.some((p) => p.grimoireId === pageId) || pages.length < state.atlas.slots) return undefined;
  let weakest = 0;
  for (let i = 1; i < pages.length; i++) if ((pages[i] as { level: number }).level < (pages[weakest] as { level: number }).level) weakest = i;
  return weakest;
}

function spendFragments(state: SaveState, profile: Profile): SaveState {
  let s = state;
  for (;;) {
    const base = score(s, profile);
    let bestId: string | null = null;
    let bestRatio = 0;
    for (const branch of TREE) {
      const next = (s.tree[branch.id] ?? 0) + 1;
      if (next > 3) continue;
      const cost = treeNodeCost(next);
      if (cost > fragmentsAvailable(s)) continue;
      const gain = score({ ...s, tree: { ...s.tree, [branch.id]: next } }, profile) - base;
      if (gain / cost > bestRatio) {
        bestRatio = gain / cost;
        bestId = treeNodeId(branch.id, next);
      }
    }
    if (bestId === null) return s;
    const bought = buyTreeNode(s, bestId);
    if (bought === s) return s;
    s = bought;
  }
}

export function simulate(options: SimOptions): SimResult {
  const profile = PROFILES[options.profile];
  const maxLifeSec = (options.maxHoursPerLife ?? 60) * 3600;
  const rng = createRng(`${options.seed}:sim`);
  const dt = 1 / profile.touchesPerSec;
  const result: SimResult = { profile: options.profile, seed: options.seed, lives: [], grimoirePicks: {}, alerts: [] };

  let state = newSave(options.seed);
  let t = 0;
  let lifeStart = 0;
  let milestones: (number | null)[] = MILESTONE_NAMES.map(() => null);
  const decided = new Map<number, number>();
  let target = planUpgrade(state, profile);

  const mark = (i: number): void => {
    if (milestones[i] === null) milestones[i] = (t - lifeStart) / 3600;
  };

  while (state.collapses < options.collapses) {
    if (state.run.pending) {
      t += PICK_THINK_SEC;
      const id = bestOffer(state, profile);
      state = selectGrimoire(state, id, t);
      state = chooseGrimoire(state, id, t);
      result.grimoirePicks[id] = (result.grimoirePicks[id] ?? 0) + 1;
      target = planUpgrade(state, profile);
      if (state.run.picks >= 1) mark(1);
      if (state.run.picks >= 10) mark(2);
      continue;
    }

    t += dt;
    state = tickObjects(state, t);
    // O simulador calibra a economia sem os eventos (bônus de 15 s, calibrados na etapa 13).
    if (state.run.nextEventAt !== NO_EVENT) state = { ...state, run: { ...state.run, event: null, nextEventAt: NO_EVENT } };
    for (const obj of state.run.objects) {
      if (!decided.has(obj.id)) decided.set(obj.id, rng() < profile.captureChance ? t + 0.5 + rng() * 2.5 : -1);
      const at = decided.get(obj.id) as number;
      if (at >= 0 && t >= at) {
        state = captureObject(state, obj.id, t);
        decided.set(obj.id, -1);
      }
    }
    state = press(state, t);

    while (target) {
      const cost = nextUpgradeCost(state, target.index);
      if (cost === null || state.run.dust < cost) break;
      state = buyUpgrade(state, target.index);
      mark(0);
      target = planUpgrade(state, profile);
    }

    if (state.run.dustLife >= 1e6) mark(3);
    if (options.trace && Math.floor(t / 60) !== Math.floor((t - dt) / 60)) options.trace((t - lifeStart) / 3600, state);

    if (canCollapse(state)) {
      mark(4);
      const k = state.collapses + 1;
      result.lives.push({
        collapse: k,
        hours: (t - lifeStart) / 3600,
        picks: state.run.picks,
        dust: state.run.dustLife,
        milestones,
        upgradeLevels: state.run.upgradeLevels,
        stalled: false,
      });
      const before = state.collapses;
      const page = bestPage(state, profile);
      state = collapse(state, page, replaceIndexFor(state, page));
      if (state.collapses === before) {
        // Sem isto a vida ficava "pronta" para sempre e o laço seguia colapsando no mesmo instante.
        result.alerts.push(`vida ${k} travou (o colapso foi recusado)`);
        break;
      }
      state = spendFragments(state, profile);
      milestones = MILESTONE_NAMES.map(() => null);
      lifeStart = t;
      decided.clear();
      target = planUpgrade(state, profile);
    } else if (t - lifeStart > maxLifeSec) {
      result.lives.push({
        collapse: state.collapses + 1,
        hours: (t - lifeStart) / 3600,
        picks: state.run.picks,
        dust: state.run.dustLife,
        milestones,
        upgradeLevels: state.run.upgradeLevels,
        stalled: true,
      });
      result.alerts.push(`vida ${state.collapses + 1} travou (passou de ${options.maxHoursPerLife ?? 60} h)`);
      break;
    }
  }

  for (const life of result.lives) {
    if (life.dust > 1e15) result.alerts.push(`vida ${life.collapse}: poeira acima de 1e15 (${formatNumber(life.dust)})`);
    if (!Number.isFinite(life.dust) || Number.isNaN(life.hours)) result.alerts.push(`vida ${life.collapse}: valor inválido`);
  }
  for (let i = 1; i < result.lives.length; i++) {
    const prev = result.lives[i - 1] as LifeResult;
    const cur = result.lives[i] as LifeResult;
    if (cur.hours > prev.hours) result.alerts.push(`vida ${cur.collapse} (${formatDecimal(cur.hours, 2)} h) é mais longa que a ${prev.collapse} (${formatDecimal(prev.hours, 2)} h)`);
  }
  const total = Object.values(result.grimoirePicks).reduce((a, b) => a + b, 0);
  for (const [id, n] of Object.entries(result.grimoirePicks)) {
    if (total >= 20 && n / total > 0.2) result.alerts.push(`grimório ${grimoireById(id)?.name ?? id} domina: ${Math.round((100 * n) / total)}% das escolhas`);
  }
  return result;
}

/** Média das horas de cada vida em várias sementes (a sorte dos grimórios mexe ±10% numa semente só). */
export function simulateAverage(profile: Profile['id'], seeds: readonly string[], collapses: number): { hours: number[]; results: SimResult[] } {
  const results = seeds.map((seed) => simulate({ profile, seed, collapses }));
  const hours: number[] = [];
  for (let i = 0; i < collapses; i++) {
    const values = results.map((r) => r.lives[i]?.hours).filter((h): h is number => h !== undefined);
    hours.push(values.reduce((a, b) => a + b, 0) / Math.max(1, values.length));
  }
  return { hours, results };
}

function h(x: number | null): string {
  return x === null ? '-' : `${formatDecimal(x, 2)} h`;
}

/** Tabelas em texto: marcos da 1ª vida por perfil e duração de cada vida contra a meta da seção 6.6. */
export function formatSimReport(results: readonly SimResult[]): string {
  const lines: string[] = [];
  lines.push('Horas de jogo aberto até cada marco (vida 1)');
  lines.push(['Marco', ...results.map((r) => PROFILES[r.profile].name)].join(' | '));
  MILESTONE_NAMES.forEach((name, i) => {
    lines.push([name, ...results.map((r) => h(r.lives[0]?.milestones[i] ?? null))].join(' | '));
  });
  lines.push('');
  lines.push('Duração de cada vida (alvo da tabela 6.6)');
  lines.push(['Colapso', 'Alvo', ...results.map((r) => PROFILES[r.profile].name), 'Desvio (normal)'].join(' | '));
  const maxLives = Math.max(...results.map((r) => r.lives.length));
  for (let i = 0; i < maxLives; i++) {
    const target = targetHours(i + 1);
    const normal = results.find((r) => r.profile === 'normal')?.lives[i];
    const dev = normal ? `${normal.hours >= target ? '+' : ''}${formatDecimal(((normal.hours - target) / target) * 100, 1)}%` : '-';
    lines.push([`${i + 1}º`, h(target), ...results.map((r) => h(r.lives[i]?.hours ?? null)), dev].join(' | '));
  }
  const all = results.flatMap((r) => r.alerts.map((a) => `${PROFILES[r.profile].name}: ${a}`));
  if (all.length > 0) {
    lines.push('');
    lines.push('Alertas');
    lines.push(...all);
  }
  return lines.join('\n');
}

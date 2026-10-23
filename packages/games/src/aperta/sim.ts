// Simulador de economia do Aperta! (spec 038, seção 6.5). Usa o PRÓPRIO motor (press, buyUpgrade,
// chooseGrimoire, collapse...) e só decide como um jogador decidiria: quando tocar, o que comprar,
// qual carta pegar. As horas que ele devolve são de jogo aberto, não de relógio de parede.

import { createRng } from '../core/rng';
import { OBJECTS, UPGRADES, grimoireById, upgradeIndex, type ObjectKind } from './catalog';
import { TREE_NODES, nodeLive } from './tree';
import { TREE_EVENT_IDS } from './tree-fx';
import { skillView, skillsAvailable, tickAutomation, activateSkill } from './skills';
import { formatDecimal, formatNumber } from './format';
import { dustGoal, energyCap, lifeHoursBand } from './economy';
import { generatorsAtLevel, milestoneGoal, milestoneProgress } from './milestone';
import {
  buyNode,
  discardOffer,
  discardsLeft,
  rerollGrimoire,
  rerollsAvailable,
  buyUpgrade,
  canCollapse,
  collapseProgress,
  captureObject,
  chooseGrimoire,
  collapse,
  effectiveStats,
  sparksAvailable,
  newSave,
  nextUpgradeCost,
  vaultOffers,
  press,
  selectGrimoire,
  tickObjects,
  nodeNextCost,
  type EffectiveStats,
  type SaveState,
} from './engine';

export interface Profile {
  id: 'casual' | 'normal' | 'active';
  name: string;
  /** Toques por segundo enquanto joga. */
  touchesPerSec: number;
  /** Chance de pegar cada objeto que aparece. */
  captureChance: number;
  /** Horas de jogo aberto por dia (spec 040): converte as horas de uma vida em dias de calendário. */
  hoursPerDay: number;
}

/** Os três perfis da spec 040: casual 30 min/dia, normal 1 a 2 h/dia (1,5 h) e ativo 4 h/dia. */
export const PROFILES: Record<Profile['id'], Profile> = {
  casual: { id: 'casual', name: 'Casual', touchesPerSec: 1, captureChance: 0.4, hoursPerDay: 0.5 },
  normal: { id: 'normal', name: 'Normal', touchesPerSec: 2.5, captureChance: 0.7, hoursPerDay: 1.5 },
  active: { id: 'active', name: 'Ativo', touchesPerSec: 4, captureChance: 0.85, hoursPerDay: 4 },
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
  /** Dias de calendário no ritmo do perfil (`hours / hoursPerDay`). */
  days: number;
  picks: number;
  dust: number;
  /** Horas desde o início da vida até cada marco (`null` se não chegou). */
  milestones: (number | null)[];
  upgradeLevels: number[];
  stalled: boolean;
  /** Horas desde o início da vida até cada requisito ficar cumprido (poeira, escolhas, marco) e qual era o marco. */
  reqHours: [number | null, number | null, number | null];
  milestoneKind: string;
  /** O que a vida tinha no Cofre quando terminou (id para nível). */
  vault: Record<string, number>;
  /** Nós da árvore comprados quando a vida terminou. */
  treeNodes: number;
}

export interface SimResult {
  profile: Profile['id'];
  seed: string;
  lives: LifeResult[];
  grimoirePicks: Record<string, number>;
  alerts: string[];
}

/** Como o jogador simulado trata a árvore: compra o que dá na ordem de custo, nada, ou já começa com tudo que existe. */
export type TreeMode = 'cost' | 'none' | 'full';

export interface SimOptions {
  tree?: TreeMode;
  /** Calibragem: no modo `full`, só entram os nós para os quais devolve `true` (padrão: todos que existem). */
  treeFilter?: (n: (typeof TREE_NODES)[number]) => boolean;
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
  // Estrela Dourada (a cada ~6,5 min): em média, por captura, ~160 s da renda dos toques e ~120 s da dos geradores
  // (Frenesi x7 por 30 s, Chuva de 5 min e Surto dos geradores). Sem isto o jogador simulado acha que desligar os
  // objetos (Cygnus X-1) não custa nada.
  const autoDust = Math.min(stats.autoDustPerSec, stats.autoDustCap);
  const goldenDust = stats.objects.disabled ? 0 : (profile.captureChance / ((stats.objects.rareMinSec + stats.objects.rareMaxSec) / 2)) * (160 * tps * perTouch + 120 * autoDust);
  return {
    // O simulador toca sem parar, então os geradores rendem no ritmo ativo (com o teto).
    dust: tps * perTouch + objectDust + autoDust + goldenDust,
    energy:
      tps * touchEnergy * 1 +
      objectEnergy +
      Math.min(stats.autoEnergyPerSec, stats.autoEnergyCap) +
      // A poeira dos geradores também enche a barra (como toques, a uma fração da energia do toque).
      (Math.min(stats.autoDustPerSec, stats.autoDustCap) / Math.max(1, stats.dustPerTouch)) * stats.energyPerTouch * 0.25,
  };
}

function weightOf(kind: ObjectKind): number {
  return ({ comet: 50, 'shooting-star': 25, satellite: 25, asteroid: 20, probe: 8, golden: 0 } as Partial<Record<ObjectKind, number>>)[kind] ?? 0;
}

export function score(state: SaveState, profile: Profile): number {
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
    // Cygnus X-1 desliga os objetos: nas vidas que o pegam a Estrela Dourada some e a vida leva 2 a 3x mais. A conta
    // de renda do simulador não enxerga tudo isso, então o jogador simulado o evita (como uma pessoa que já se queimou).
    case 'cygnus-x1':
      return -5;
    default:
      return 0;
  }
}

/** Valor da melhor carta da oferta (o ganho do `score` ao pegá-la). */
function offerValue(state: SaveState, profile: Profile, id: string): number {
  const current = state.run.build[id] ?? 0;
  const hypothetical: SaveState = { ...state, run: { ...state.run, build: { ...state.run.build, [id]: Math.min(10, current + 1) } } };
  return score(hypothetical, profile) - score(state, profile) + extraValue(id);
}

function useLuck(state: SaveState, profile: Profile, t: number): SaveState {
  let s = state;
  // Descarta uma oferta em que nenhuma carta rende de fato.
  if (discardsLeft(s) > 0 && s.run.pending && Math.max(...s.run.pending.offers.map((id) => offerValue(s, profile, id))) < DISCARD_BELOW) {
    s = discardOffer(s, t);
  }
  // Troca a pior carta enquanto houver troca e a pior for fraca.
  for (let guard = 0; guard < 6 && s.run.pending && rerollsAvailable(s) > 0; guard++) {
    const offers = s.run.pending.offers;
    const worst = offers.reduce((a, b) => (offerValue(s, profile, b) < offerValue(s, profile, a) ? b : a));
    if (offerValue(s, profile, worst) >= REROLL_BELOW) break;
    const next = rerollGrimoire(s, worst, t);
    if (next.run.rerollsUsed === s.run.rerollsUsed && next.stats.rerolls === s.stats.rerolls) break;
    s = next;
  }
  return s;
}

// O jogador simulado só troca o que não presta de verdade (quase ninguém joga as trocas no ponto ótimo).
const DISCARD_BELOW = 0.005;
const REROLL_BELOW = 0.005;

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

/** Proibido do Cofre que mais rende entre as 3 opções do colapso (ou `null` quando só sobra o Selo Estelar). */
function bestVault(state: SaveState, profile: Profile): string | null {
  const offers = vaultOffers(state);
  if (offers.length === 0) return null;
  const base = score(state, profile);
  let best = offers[0] as string;
  let bestValue = -Infinity;
  for (const id of offers) {
    const hypothetical: SaveState = { ...state, vault: { ...state.vault, [id]: (state.vault[id] ?? 0) + 1 } };
    const value = score(hypothetical, profile) - base + extraValue(id);
    if (value > bestValue) {
      bestValue = value;
      best = id;
    }
  }
  return best;
}

/**
 * Gasta as Cintilas na árvore. `cost` (padrão): o jogador compra, a cada colapso, o nó implementável mais barato que
 * dá para pagar, na ordem de custo (empate: ordem da árvore); `none`: não compra nada; `full`: a árvore toda já vem
 * comprada (ver `simulate`), então aqui não há o que gastar.
 */
function spendSparks(state: SaveState, mode: TreeMode): SaveState {
  if (mode !== 'cost') return state;
  let s = state;
  for (;;) {
    let bestId: string | null = null;
    let bestCost = Infinity;
    for (const n of TREE_NODES) {
      const cost = nodeNextCost(s, n.id);
      if (cost === null || cost > sparksAvailable(s)) continue;
      if (cost < bestCost) {
        bestCost = cost;
        bestId = n.id;
      }
    }
    if (bestId === null) return s;
    const bought = buyNode(s, bestId);
    if (bought === s) return s;
    s = bought;
  }
}

/**
 * O jogador simulado sabe qual é o marco da vida: passada a metade da meta de poeira, ele corre atrás do que
 * a compra resolve (ligar o combo, subir geradores até o nível pedido). Devolve a melhoria a comprar, ou `null`.
 */
function milestoneUpgrade(state: SaveState): number | null {
  const n = state.collapses + 1;
  if (state.run.dustLife < 0.5 * dustGoal(n)) return null;
  const goal = milestoneGoal(milestoneProgress(n, state.collapses, state.run, effectiveStats(state).objects.disabled).kind, n);
  if (goal.kind === 'combo' && !effectiveStats(state).combo.enabled) {
    const i = upgradeIndex('rhythm');
    return nextUpgradeCost(state, i) === null ? null : i;
  }
  if (goal.kind !== 'generators' || generatorsAtLevel(state.run.upgradeLevels, goal.level) >= goal.target) return null;
  let best: number | null = null;
  UPGRADES.forEach((u, i) => {
    if (u.kind === 'touch' || (state.run.upgradeLevels[i] ?? 0) >= goal.level || nextUpgradeCost(state, i) === null) return;
    if (best === null || (state.run.upgradeLevels[i] ?? 0) > (state.run.upgradeLevels[best] ?? 0)) best = i;
  });
  return best;
}

export function simulate(options: SimOptions): SimResult {
  const profile = PROFILES[options.profile];
  const maxLifeSec = (options.maxHoursPerLife ?? 60) * 3600;
  const rng = createRng(`${options.seed}:sim`);
  const dt = 1 / profile.touchesPerSec;
  const result: SimResult = { profile: options.profile, seed: options.seed, lives: [], grimoirePicks: {}, alerts: [] };

  const treeMode: TreeMode = options.tree ?? 'cost';
  let state = newSave(options.seed);
  if (treeMode === 'full') {
    state = { ...state, tree: Object.fromEntries(TREE_NODES.filter((n) => nodeLive(n) && (options.treeFilter?.(n) ?? true)).map((n) => [n.id, n.maxLevel])) };
  }
  let t = 0;
  let lifeStart = 0;
  let milestones: (number | null)[] = MILESTONE_NAMES.map(() => null);
  const decided = new Map<number, number>();
  let req: [number | null, number | null, number | null] = [null, null, null];
  let target = planUpgrade(state, profile);

  const mark = (i: number): void => {
    if (milestones[i] === null) milestones[i] = (t - lifeStart) / 3600;
  };

  while (state.collapses < options.collapses) {
    if (state.run.pending) {
      t += PICK_THINK_SEC;
      // Rerolls e descartes da árvore (Sorte): o jogador troca a pior carta e joga fora a oferta toda se nada presta.
      state = useLuck(state, profile, t);
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
    // Habilidades e Captura automática da árvore: o jogador simulado usa tudo que está pronto (a Compra automática
    // fica desligada: ele já compra as melhorias do jeito dele).
    state = tickAutomation(state, t);
    for (const def of skillsAvailable(state)) {
      // A Supernova gasta a energia da barra: o jogador só a usa com a barra quase vazia, senão nunca escolhe grimório.
      if (def.id === 'supernova' && state.run.energy > 0.1 * energyCap(state.run.picks)) continue;
      if (skillView(state, def.id, t)?.ready) state = activateSkill(state, def.id, t);
    }
    // O simulador calibra a economia sem os eventos do colapso (bônus de 15 s, calibrados na etapa 13). Os eventos da árvore
    // (Chuva de ouro, Alinhamento, Maré de energia, Eclipse) rodam de verdade quando o nó existe.
    const treeEvents = TREE_EVENT_IDS.some((id) => effectiveStats(state).explore.events[id].chance > 0);
    if (!treeEvents) {
      if (state.run.nextEventAt !== NO_EVENT) state = { ...state, run: { ...state.run, event: null, nextEventAt: NO_EVENT } };
    } else if (state.run.event && !(TREE_EVENT_IDS as readonly string[]).includes(state.run.event.id)) {
      state = { ...state, run: { ...state.run, event: null } };
    }
    for (const obj of state.run.objects) {
      if (!decided.has(obj.id)) decided.set(obj.id, rng() < profile.captureChance ? t + 0.5 + rng() * 2.5 : -1);
      const at = decided.get(obj.id) as number;
      if (at >= 0 && t >= at) {
        state = captureObject(state, obj.id, t);
        decided.set(obj.id, -1);
      }
    }
    state = press(state, t);

    const needed = milestoneUpgrade(state);
    if (needed !== null) target = { index: needed };
    while (target) {
      const cost = nextUpgradeCost(state, target.index);
      if (cost === null || state.run.dust < cost) break;
      state = buyUpgrade(state, target.index);
      mark(0);
      target = planUpgrade(state, profile);
    }

    if (state.run.dustLife >= 1e6) mark(3);
    if (options.trace && Math.floor(t / 60) !== Math.floor((t - dt) / 60)) options.trace((t - lifeStart) / 3600, state);

    {
      const p = collapseProgress(state);
      const at = (t - lifeStart) / 3600;
      if (req[0] === null && p.dust >= p.dustGoal) req[0] = at;
      if (req[1] === null && p.picks >= p.minPicks) req[1] = at;
      if (req[2] === null && p.milestone.done) req[2] = at;
    }
    if (canCollapse(state)) {
      mark(4);
      const k = state.collapses + 1;
      result.lives.push({
        collapse: k,
        hours: (t - lifeStart) / 3600,
        days: (t - lifeStart) / 3600 / profile.hoursPerDay,
        picks: state.run.picks,
        dust: state.run.dustLife,
        milestones,
        upgradeLevels: state.run.upgradeLevels,
        stalled: false,
        reqHours: req,
        milestoneKind: collapseProgress(state).milestone.kind,
        vault: state.vault,
        treeNodes: Object.keys(state.tree).length,
      });
      const before = state.collapses;
      state = collapse(state, bestVault(state, profile));
      if (state.collapses === before) {
        // Sem isto a vida ficava "pronta" para sempre e o laço seguia colapsando no mesmo instante.
        result.alerts.push(`vida ${k} travou (o colapso foi recusado)`);
        break;
      }
      state = spendSparks(state, treeMode);
      milestones = MILESTONE_NAMES.map(() => null);
      req = [null, null, null];
      lifeStart = t;
      decided.clear();
      target = planUpgrade(state, profile);
    } else if (t - lifeStart > maxLifeSec) {
      result.lives.push({
        collapse: state.collapses + 1,
        hours: (t - lifeStart) / 3600,
        days: (t - lifeStart) / 3600 / profile.hoursPerDay,
        picks: state.run.picks,
        dust: state.run.dustLife,
        milestones,
        upgradeLevels: state.run.upgradeLevels,
        stalled: true,
        reqHours: req,
        milestoneKind: collapseProgress(state).milestone.kind,
        vault: state.vault,
        treeNodes: Object.keys(state.tree).length,
      });
      result.alerts.push(`vida ${state.collapses + 1} travou (passou de ${options.maxHoursPerLife ?? 60} h)`);
      break;
    }
  }

  for (const life of result.lives) {
    if (life.dust > 1e290) result.alerts.push(`vida ${life.collapse}: poeira perto do guarda de 1e300 (${formatNumber(life.dust)})`);
    if (!Number.isFinite(life.dust) || Number.isNaN(life.hours)) result.alerts.push(`vida ${life.collapse}: valor inválido`);
  }
  for (let i = 0; i < result.lives.length; i++) {
    const cur = result.lives[i] as LifeResult;
    const band = lifeHoursBand(cur.collapse, i > 0 ? (result.lives[i - 1] as LifeResult).hours : null);
    if (cur.hours < band.min || cur.hours > band.max) {
      result.alerts.push(`vida ${cur.collapse} (${formatDecimal(cur.hours, 2)} h) fora da faixa de ${formatDecimal(band.min, 2)} a ${formatDecimal(band.max, 2)} h`);
    }
  }
  const total = Object.values(result.grimoirePicks).reduce((a, b) => a + b, 0);
  for (const [id, n] of Object.entries(result.grimoirePicks)) {
    if (total >= 20 && n / total > 0.2) result.alerts.push(`grimório ${grimoireById(id)?.name ?? id} domina: ${Math.round((100 * n) / total)}% das escolhas`);
  }
  return result;
}

/** Média das horas de cada vida em várias sementes (a sorte dos grimórios mexe ±10% numa semente só). */
export function simulateAverage(
  profile: Profile['id'],
  seeds: readonly string[],
  collapses: number,
  maxHoursPerLife?: number,
  tree?: TreeMode,
): { hours: number[]; results: SimResult[] } {
  const results = seeds.map((seed) => simulate({ profile, seed, collapses, maxHoursPerLife, tree }));
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

/**
 * Média das horas (e dos dias de calendário) de cada vida por perfil e por semente. A faixa da spec 040 vale para o
 * perfil normal: de 1 a 3 h até o 15º colapso e, depois, no máximo +3% sobre a vida anterior.
 */
export function formatSimReport(results: readonly SimResult[]): string {
  const lines: string[] = [];
  lines.push('Horas de jogo aberto até cada marco (vida 1)');
  lines.push(['Marco', ...results.map((r) => PROFILES[r.profile].name)].join(' | '));
  MILESTONE_NAMES.forEach((name, i) => {
    lines.push([name, ...results.map((r) => h(r.lives[0]?.milestones[i] ?? null))].join(' | '));
  });
  lines.push('');
  lines.push('Duração de cada vida (horas de jogo aberto e dias no ritmo do perfil)');
  lines.push(['Colapso', 'Meta de poeira', ...results.map((r) => `${PROFILES[r.profile].name} (${PROFILES[r.profile].hoursPerDay} h/dia)`), 'Faixa (normal)'].join(' | '));
  const maxLives = Math.max(...results.map((r) => r.lives.length));
  const normal = results.find((r) => r.profile === 'normal');
  for (let i = 0; i < maxLives; i++) {
    const band = lifeHoursBand(i + 1, i > 0 ? (normal?.lives[i - 1]?.hours ?? null) : null);
    const cells = results.map((r) => {
      const life = r.lives[i];
      return life ? `${formatDecimal(life.hours, 2)} h (${formatDecimal(life.days, 1)} d)` : '-';
    });
    lines.push([`${i + 1}º`, formatNumber(dustGoal(i + 1)), ...cells, `${formatDecimal(band.min, 2)} a ${formatDecimal(band.max, 2)} h`].join(' | '));
  }
  const all = results.flatMap((r) => r.alerts.map((a) => `${PROFILES[r.profile].name}: ${a}`));
  if (all.length > 0) {
    lines.push('');
    lines.push('Alertas');
    lines.push(...all);
  }
  return lines.join('\n');
}

/**
 * Tabela em markdown da média de cada vida por perfil (horas de jogo aberto e dias de calendário) contra a faixa
 * da spec 040: é a que vai para a seção 10 da spec. `hours[perfil][k - 1]` é a média da vida `k`.
 */
export function formatAverageTable(hours: Partial<Record<Profile['id'], number[]>>): string {
  const ids = (['casual', 'normal', 'active'] as const).filter((id) => hours[id] !== undefined);
  const lives = Math.max(...ids.map((id) => (hours[id] as number[]).length));
  const lines = [
    ['Colapso', 'Meta de poeira', ...ids.map((id) => `${PROFILES[id].name} (${PROFILES[id].hoursPerDay} h/dia)`), 'Faixa (normal)'].join(' | '),
    ['---', '---', ...ids.map(() => '---'), '---'].join(' | '),
  ];
  const normal = hours.normal;
  for (let k = 1; k <= lives; k++) {
    const band = lifeHoursBand(k, k > 1 && normal ? (normal[k - 2] ?? null) : null);
    const cells = ids.map((id) => {
      const h = (hours[id] as number[])[k - 1];
      return h === undefined ? '-' : `${formatDecimal(h, 2)} h (${formatDecimal(h / PROFILES[id].hoursPerDay, 1)} d)`;
    });
    lines.push([`${k}º`, formatNumber(dustGoal(k)), ...cells, `${formatDecimal(band.min, 2)} a ${formatDecimal(band.max, 2)} h`].join(' | '));
  }
  return lines.map((l) => `| ${l} |`).join('\n');
}

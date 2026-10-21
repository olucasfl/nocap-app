// Motor do Aperta! (spec 038, seções 4, 7 e 8). Funções puras sobre `SaveState`: cada uma devolve
// um estado novo e nunca muta o recebido. O relógio vem de fora (`now`, em segundos de jogo) e só
// avança com o jogo aberto: quem chama não pode passar tempo de aba escondida (seção 7.4).

import { hashSeed } from '../core/rng';
import {
  FAMILIES,
  GRIMOIRES,
  OBJECTS,
  OBJECT_REWARD,
  RARITIES,
  RARITY_WEIGHT,
  REGIONS,
  SET_BONUSES,
  TREE,
  TREE_COSTS,
  UPGRADES,
  grimoireById,
  treeNodeId,
  upgradeIndex,
  type Effect,
  type Family,
  type GrimoireDef,
  type ObjectDef,
  type ObjectKind,
  type Rarity,
  type RegionDef,
  type UpgradeDef,
} from './catalog';
import {
  ATLAS_PAGE_POWER,
  BASE_ENERGY_PER_TOUCH,
  CHANDRA_LIFE_PER_LEVEL_PCT,
  CHOICE_LOCK_SEC,
  COMBO_BASE_MAX,
  COMBO_BASE_WINDOW_SEC,
  COMBO_BONUS_PER_POINT,
  COMBO_HARD_CAP,
  COMBO_WINDOW_PER_LEVEL_SEC,
  GRIMOIRE_MAX_LEVEL,
  HUBBLE_VALUE_PER_LEVEL_PCT,
  KEPLER_SPAWN_PER_LEVEL,
  MAX_NUMBER,
  MAX_STEP_SEC,
  MAX_TOUCHES_PER_SEC,
  OBJECT_BASE_INTERVAL_SEC,
  OBJECT_BASE_MAX,
  REACTOR_STEP,
  VOYAGER_SEC_PER_LEVEL,
  WEBB_COST_PER_LEVEL_PCT,
  atlasSlots,
  clampCostFactor,
  dustGoal,
  energyCap,
  fragmentsFor,
  levelFactor,
  minPicks,
  rarityUnlockPicks,
  respecFee,
  setBonusTier,
  upgradeCost,
} from './economy';

export const SAVE_VERSION = 1;
/** Valor de "nunca tocou": negativo e finito, para o save continuar sendo JSON válido. */
const NEVER = -1e9;

export interface GameObject {
  id: number;
  kind: ObjectKind;
  bornAt: number;
  expiresAt: number;
}

export interface PendingChoice {
  offers: string[];
  openedAt: number;
  /** 1º passo da escolha em dois passos (seção 4.7): marcar a carta; o 2º passo confirma. */
  selected: string | null;
  /** Quantas escolhas ainda faltam nesta barra cheia (2 com a Nebulosa de Órion). */
  picksLeft: number;
  rerollsLeft: number;
}

export interface RunState {
  dust: number;
  /** Poeira ganha na vida (não diminui ao gastar): é o que a meta do colapso mede. */
  dustLife: number;
  energy: number;
  picks: number;
  /** Níveis comprados, na ordem de `UPGRADES`. */
  upgradeLevels: number[];
  /** Grimório -> nível. */
  build: Record<string, number>;
  clicks: number;
  combo: number;
  lastPressAt: number;
  boostUntil: number;
  boostMult: number;
  /** Polaris: o próximo toque depois de capturar um objeto vale mais. */
  afterCapture: boolean;
  objects: GameObject[];
  nextObjectId: number;
  nextSpawnAt: number | null;
  /** Trocas grátis que a Sonda Voyager deixa para a próxima escolha. */
  freeRerolls: number;
  pending: PendingChoice | null;
  rngState: number;
  /** Último ganho de poeira por toque, para o "+N" da tela. */
  lastGain: number;
}

export interface AtlasPage {
  grimoireId: string;
  level: number;
}

export interface SaveState {
  version: number;
  name: string;
  createdAt: number;
  /** Segundos de jogo aberto (não conta aba escondida). */
  playSeconds: number;
  /** Último `now` visto; a diferença para o próximo é o tempo que passou. */
  clock: number;
  tutorial: number | 'done';
  storySeen: boolean;
  run: RunState;
  album: string[];
  atlas: { slots: number; pages: AtlasPage[] };
  collapses: number;
  regionId: string;
  seenUnlocks: string[];
  fragments: { earned: number; spent: number };
  /** Ramo -> nível (0 a 3). */
  tree: Record<string, number>;
  achievements: string[];
  stats: { clicks: number; objectsCaptured: number; picks: number; dustTotal: number };
}

export function clampNum(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x === Infinity) return MAX_NUMBER;
  return Math.min(MAX_NUMBER, Math.max(0, x));
}

// --- Aleatório com semente guardada no save (determinístico e testável) ---

/** mulberry32 sem estado escondido: recebe o estado e devolve [valor em [0,1), próximo estado]. */
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

// --- Estado inicial ---

function freshRun(rngState: number, upgradeCount = UPGRADES.length): RunState {
  return {
    dust: 0,
    dustLife: 0,
    energy: 0,
    picks: 0,
    upgradeLevels: new Array<number>(upgradeCount).fill(0),
    build: {},
    clicks: 0,
    combo: 0,
    lastPressAt: NEVER,
    boostUntil: NEVER,
    boostMult: 1,
    afterCapture: false,
    objects: [],
    nextObjectId: 1,
    nextSpawnAt: null,
    freeRerolls: 0,
    pending: null,
    rngState,
    lastGain: 0,
  };
}

export function newSave(seed: string, createdAt = 0, name = 'Missão Perigeu'): SaveState {
  return {
    version: SAVE_VERSION,
    name,
    createdAt,
    playSeconds: 0,
    clock: 0,
    tutorial: 1,
    storySeen: false,
    run: freshRun(hashSeed(seed)),
    album: [],
    atlas: { slots: atlasSlots(0), pages: [] },
    collapses: 0,
    regionId: (REGIONS[0] as RegionDef).id,
    seenUnlocks: [],
    fragments: { earned: 0, spent: 0 },
    tree: {},
    achievements: [],
    stats: { clicks: 0, objectsCaptured: 0, picks: 0, dustTotal: 0 },
  };
}

// --- Relógio: o jogo parado congela tudo (seção 7.4) ---

/**
 * Avança o relógio até `now`. Um salto maior que `MAX_STEP_SEC` é aba escondida: o tempo não
 * conta como jogado e objetos, boost e combo congelam (os carimbos são empurrados pelo salto).
 * Enquanto uma escolha está aberta o campo também congela, mas o tempo de jogo segue contando.
 */
export function syncClock(state: SaveState, now: number): SaveState {
  const gap = now - state.clock;
  if (!(gap > 0)) return state;
  const hidden = gap > MAX_STEP_SEC;
  const frozen = hidden || state.run.pending !== null;
  const run = frozen ? shiftRun(state.run, gap, hidden) : state.run;
  return {
    ...state,
    clock: now,
    playSeconds: hidden ? state.playSeconds : state.playSeconds + gap,
    run,
  };
}

function shiftRun(run: RunState, gap: number, shiftPending: boolean): RunState {
  return {
    ...run,
    lastPressAt: run.lastPressAt + gap,
    boostUntil: run.boostUntil + gap,
    nextSpawnAt: run.nextSpawnAt === null ? null : run.nextSpawnAt + gap,
    objects: run.objects.map((o) => ({ ...o, bornAt: o.bornAt + gap, expiresAt: o.expiresAt + gap })),
    pending: run.pending && shiftPending ? { ...run.pending, openedAt: run.pending.openedAt + gap } : run.pending,
  };
}

/** Quando a aba volta: o tempo escondido não conta, mesmo que seja curto. */
export function resumeClock(state: SaveState, now: number): SaveState {
  const gap = now - state.clock;
  if (!(gap > 0)) return state;
  return { ...state, clock: now, run: shiftRun(state.run, gap, true) };
}

// --- Números finais (seção 7.3) ---

export interface EffectiveStats {
  pulseLevel: number;
  /** Poeira de um toque sem combo, nth e boost (ainda com decimais). */
  dustPerTouch: number;
  energyPerTouch: number;
  combo: { enabled: boolean; max: number; windowSec: number; fullDustPct: number };
  costFactor: number;
  startDust: number;
  energyStepFactor: number;
  nth: { n: number; mult: number; energyBarPct: number }[];
  objects: {
    disabled: boolean;
    intervalSec: number;
    maxOnField: number;
    lifeSec: Record<ObjectKind, number>;
    valueMult: Record<ObjectKind, number>;
    signalMult: number;
    signalSec: number;
    onCaptureEnergyTouches: number;
    afterCaptureMult: number;
  };
  choice: { cards: number; picks: number; rerolls: number; repeatLevels: number };
  forbiddenUnlockPicks: number | undefined;
}

interface Source {
  effects: readonly Effect[];
  /** Escala dos efeitos de ganho (nível do grimório x poder da página). */
  gain: number;
  /** Escala dos efeitos de preço (só a página reduz; o nível não encarece o preço). */
  price: number;
  /** Fração do poder que vale para efeitos de contagem (que não crescem com o nível). */
  count: number;
  forbidden: boolean;
}

const OBJECT_KINDS = OBJECTS.map((o) => o.kind);

function emptyByKind(value: number): Record<ObjectKind, number> {
  return { comet: value, 'shooting-star': value, satellite: value, asteroid: value, probe: value };
}

const statsCache = new WeakMap<
  number[],
  { build: RunState['build']; pages: AtlasPage[]; tree: SaveState['tree']; collapses: number; stats: EffectiveStats }
>();

/** Junta melhorias, grimórios, Atlas, bônus de conjunto e árvore. Memoizada: o estado é imutável. */
export function effectiveStats(state: SaveState): EffectiveStats {
  const key = state.run.upgradeLevels;
  const hit = statsCache.get(key);
  if (
    hit &&
    hit.build === state.run.build &&
    hit.pages === state.atlas.pages &&
    hit.tree === state.tree &&
    hit.collapses === state.collapses
  ) {
    return hit.stats;
  }
  const stats = computeStats(state);
  statsCache.set(key, {
    build: state.run.build,
    pages: state.atlas.pages,
    tree: state.tree,
    collapses: state.collapses,
    stats,
  });
  return stats;
}

function level(state: SaveState, upgradeId: string): number {
  const i = upgradeIndex(upgradeId);
  return i < 0 ? 0 : (state.run.upgradeLevels[i] ?? 0);
}

function collectSources(state: SaveState): { sources: Source[]; setTiers: Map<Family, number> } {
  const sources: Source[] = [];
  for (const [id, lvl] of Object.entries(state.run.build)) {
    const g = grimoireById(id);
    if (!g) continue;
    sources.push({ effects: g.effects, gain: levelFactor(lvl), price: 1, count: 1, forbidden: g.rarity === 'forbidden' });
  }
  const familyCount = new Map<Family, number>();
  for (const page of state.atlas.pages) {
    const g = grimoireById(page.grimoireId);
    if (!g) continue;
    sources.push({
      effects: g.effects,
      gain: levelFactor(page.level) * ATLAS_PAGE_POWER,
      price: ATLAS_PAGE_POWER,
      count: ATLAS_PAGE_POWER,
      forbidden: g.rarity === 'forbidden',
    });
    familyCount.set(g.family, (familyCount.get(g.family) ?? 0) + 1);
  }
  const setTiers = new Map<Family, number>();
  for (const family of FAMILIES) {
    const tier = setBonusTier(familyCount.get(family) ?? 0);
    if (tier < 0) continue;
    setTiers.set(family, tier);
    sources.push({ effects: [SET_BONUSES[family][tier] as Effect], gain: 1, price: 1, count: 1, forbidden: false });
  }
  for (const branch of TREE) {
    const lvl = Math.min(3, state.tree[branch.id] ?? 0);
    if (lvl > 0) sources.push({ effects: branch.levels[lvl - 1] as Effect[], gain: 1, price: 1, count: 1, forbidden: false });
  }
  return { sources, setTiers };
}

function computeStats(state: SaveState): EffectiveStats {
  const { sources } = collectSources(state);

  // Buracos negros e a árvore reforçam o ganho dos proibidos e cortam o preço deles.
  let forbiddenPower = 0;
  let priceCut = 0;
  let forbiddenUnlock: number | undefined;
  for (const src of sources) {
    for (const e of src.effects) {
      if (e.kind === 'forbiddenPower') {
        forbiddenPower += e.pct;
        priceCut += e.priceCutPct;
      } else if (e.kind === 'forbiddenUnlock') {
        forbiddenUnlock = forbiddenUnlock === undefined ? e.picks : Math.min(forbiddenUnlock, e.picks);
      }
    }
  }
  priceCut = Math.min(90, priceCut);

  const rareOwned = (rarity: Rarity): number =>
    Object.keys(state.run.build).filter((id) => grimoireById(id)?.rarity === rarity).length;

  let dustPct = 0;
  let comboFullPct = 0;
  let dustMult = 1;
  let energyPct = 0;
  let fillPct = 0;
  let spawnPct = 0;
  let maxAdd = 0;
  let satAdd = 0;
  let comboMaxAdd = 0;
  let comboMaxMult = 1;
  let windowPct = 0;
  let windowMult = 1;
  let stepPct = 0;
  let startDustLevels = 0;
  let freePulse = 0;
  let onCapture = 0;
  let afterCaptureMult = 1;
  let disabled = false;
  const costFactors: number[] = [];
  const nth: EffectiveStats['nth'] = [];
  const choice = { cards: 0, picks: 0, rerolls: 0, repeatLevels: 0 };
  const lifeSec = emptyByKind(0);
  const lifeMult = emptyByKind(1);
  const lifePct = emptyByKind(0);
  const effSec = emptyByKind(0);
  const effMult = emptyByKind(1);
  const effPct = emptyByKind(0);
  const valuePct = emptyByKind(0);
  const targets = (t: string): ObjectKind[] => (t === 'all' ? OBJECT_KINDS : OBJECT_KINDS.filter((k) => k === t));

  for (const src of sources) {
    for (const e of src.effects) {
      // Efeito de preço: só a página escala; o bônus dos Buracos negros o corta.
      const s = e.price ? src.price * (1 - priceCut / 100) : src.gain * (src.forbidden ? 1 + forbiddenPower / 100 : 1);
      const m = (mult: number): number => 1 + (mult - 1) * s;
      switch (e.kind) {
        case 'dustPerTouchPct':
          if (e.when === 'comboFull') comboFullPct += e.pct * s;
          else dustPct += e.pct * s;
          break;
        case 'dustMult':
          dustMult *= m(e.mult);
          break;
        case 'energyPerTouchPct':
          energyPct += e.pct * s;
          break;
        case 'energyFillRate':
          fillPct += e.pct * s;
          break;
        case 'everyNthTouch':
          nth.push({ n: e.n, mult: m(e.mult), energyBarPct: (e.energyBarPct ?? 0) * s });
          break;
        case 'objectDuration':
          for (const k of targets(e.target)) {
            if (e.of === 'effect') {
              effSec[k] += (e.sec ?? 0) * s;
              effMult[k] *= m(e.mult ?? 1);
              effPct[k] += (e.pct ?? 0) * s;
            } else {
              lifeSec[k] += (e.sec ?? 0) * s;
              lifeMult[k] *= m(e.mult ?? 1);
              lifePct[k] += (e.pct ?? 0) * s;
            }
          }
          break;
        case 'objectSpawnRate':
          spawnPct += e.pct * s;
          break;
        case 'objectValuePct':
          for (const k of targets(e.target)) valuePct[k] += e.pct * s;
          break;
        case 'objectsDisabled':
          disabled = true;
          break;
        case 'maxObjects':
          maxAdd += Math.floor(e.add * src.count);
          break;
        case 'satelliteMult':
          satAdd += e.add * s;
          break;
        case 'comboMax':
          comboMaxAdd += (e.add ?? 0) * s;
          comboMaxMult *= m(e.mult ?? 1);
          break;
        case 'comboWindow':
          windowPct += (e.pct ?? 0) * s;
          windowMult *= m(e.mult ?? 1);
          break;
        case 'upgradeCostPct':
          costFactors.push(Math.max(0.01, 1 + (e.pct * s) / 100));
          break;
        case 'energyStepPct':
          stepPct += e.pct * s;
          break;
        case 'startDust':
          if (e.upgrade === 'pulse') startDustLevels += e.levels * s;
          break;
        case 'freeUpgradeLevels':
          if (e.upgrade === 'pulse') freePulse += Math.floor(e.levels * src.count);
          break;
        case 'choiceExtra':
          // Efeitos de contagem não crescem com o nível e a página arredonda o poder (60%): Caranguejo e Betelgeuse
          // ficam, mas a escolha dupla de Órion não, porque de graça em toda vida ela dobraria os grimórios.
          choice.rerolls += Math.round((e.reroll ?? 0) * src.count);
          choice.picks += Math.floor((e.picks ?? 0) * src.count);
          choice.repeatLevels += Math.round((e.repeatLevels ?? 0) * src.count);
          choice.cards += Math.round((e.cards ?? 0) * src.count);
          break;
        case 'onCapture':
          onCapture += e.energyTouches * s;
          break;
        case 'afterCaptureMult':
          afterCaptureMult *= m(e.mult);
          break;
        case 'dustPerOwned':
          dustPct += rareOwned(e.rarity) * e.pct * s;
          break;
        case 'dustPerCollapse':
          dustPct += state.collapses * e.pct * s;
          break;
        case 'forbiddenUnlock':
        case 'forbiddenPower':
          break;
      }
    }
  }

  // Melhorias (a Ressonância e a Kepler têm regras próprias; o resto é por nível).
  const pulseBought = level(state, 'pulse');
  const pulseLevel = pulseBought + freePulse;
  const resonance = level(state, 'resonance');
  const reactor = level(state, 'reactor');
  const kepler = level(state, 'kepler');
  const hubble = level(state, 'hubble');
  const voyager = level(state, 'voyager');
  const webb = level(state, 'webb');
  const chandra = level(state, 'chandra');
  const pleiades = level(state, 'pleiades');

  costFactors.push(1 + (webb * WEBB_COST_PER_LEVEL_PCT) / 100);
  const costFactor = clampCostFactor(costFactors.reduce((a, b) => a * b, 1));

  const comboMax = Math.min(COMBO_HARD_CAP, Math.max(0, Math.floor((COMBO_BASE_MAX + pleiades + comboMaxAdd) * comboMaxMult)));
  const windowSec =
    (COMBO_BASE_WINDOW_SEC + COMBO_WINDOW_PER_LEVEL_SEC * Math.max(0, resonance - 1)) *
    (1 + windowPct / 100) *
    windowMult;

  const fillRate = Math.max(0.05, 1 + fillPct / 100);
  const energyPerTouch = (BASE_ENERGY_PER_TOUCH + REACTOR_STEP * reactor) * Math.max(0, 1 + energyPct / 100) * fillRate;
  const dustPerTouch = (1 + pulseLevel) * Math.max(0, 1 + dustPct / 100) * dustMult;

  const life = emptyByKind(0);
  const value = emptyByKind(1);
  for (const def of OBJECTS) {
    const k = def.kind;
    life[k] = Math.max(1, (def.lifeSec + lifeSec[k]) * lifeMult[k] * (1 + (lifePct[k] + CHANDRA_LIFE_PER_LEVEL_PCT * chandra) / 100));
    value[k] = 1 + (valuePct[k] + HUBBLE_VALUE_PER_LEVEL_PCT * hubble) / 100;
  }
  const satBase = OBJECT_REWARD.satelliteMult + satAdd;
  const signalMult = 1 + (satBase - 1) * (value.satellite ?? 1);
  const signalSec = Math.max(1, (OBJECT_REWARD.satelliteSec + VOYAGER_SEC_PER_LEVEL * voyager + effSec.satellite) * effMult.satellite * (1 + effPct.satellite / 100));

  return {
    pulseLevel,
    dustPerTouch,
    energyPerTouch,
    combo: { enabled: resonance > 0, max: comboMax, windowSec, fullDustPct: comboFullPct },
    costFactor,
    startDust: Math.floor(startDustLevels * (UPGRADES[0] as UpgradeDef).base),
    energyStepFactor: Math.max(0.1, 1 + stepPct / 100),
    nth,
    objects: {
      disabled,
      intervalSec: OBJECT_BASE_INTERVAL_SEC / (1 + KEPLER_SPAWN_PER_LEVEL * kepler) / (1 + spawnPct / 100),
      maxOnField: OBJECT_BASE_MAX + (kepler > 0 ? 1 : 0) + maxAdd,
      lifeSec: life,
      valueMult: value,
      signalMult,
      signalSec,
      onCaptureEnergyTouches: onCapture,
      afterCaptureMult,
    },
    choice: {
      cards: 3 + choice.cards,
      picks: 1 + choice.picks,
      rerolls: choice.rerolls,
      repeatLevels: 1 + choice.repeatLevels,
    },
    forbiddenUnlockPicks: forbiddenUnlock,
  };
}

// --- Conteúdo liberado (derivado do colapso, nunca guardado no save) ---

export function unlockedContent(state: SaveState): {
  grimoires: GrimoireDef[];
  upgrades: UpgradeDef[];
  objects: ObjectDef[];
  regions: RegionDef[];
} {
  const c = state.collapses;
  return {
    grimoires: GRIMOIRES.filter((g) => g.unlockedAtCollapse <= c),
    upgrades: UPGRADES.filter((u) => u.unlockedAtCollapse <= c),
    objects: OBJECTS.filter((o) => o.unlockedAtCollapse <= c),
    regions: REGIONS.filter((r) => r.unlockedAtCollapse <= c),
  };
}

/** Região atual: a mais nova já aberta. */
export function regionFor(state: SaveState): RegionDef {
  const open = REGIONS.filter((r) => r.unlockedAtCollapse <= state.collapses);
  return (open[open.length - 1] ?? REGIONS[0]) as RegionDef;
}

// --- Energia e escolha de grimório ---

export function currentEnergyCap(state: SaveState): number {
  return energyCap(state.run.picks, effectiveStats(state).energyStepFactor);
}

/**
 * Sorteia as cartas da próxima escolha: sem repetir na mesma oferta, raridade por peso entre as
 * liberadas pelo nº de escolhas da vida, depois carta uniforme dentro da raridade. Grimório já no
 * nível máximo não aparece. Não muta o estado: devolve as cartas e o estado novo do gerador.
 */
export function drawGrimoires(state: SaveState, exclude: readonly string[] = [], count?: number): { offers: string[]; rngState: number } {
  const stats = effectiveStats(state);
  const want = count ?? stats.choice.cards;
  const open = unlockedContent(state).grimoires.filter((g) => {
    if (exclude.includes(g.id)) return false;
    if ((state.run.build[g.id] ?? 0) >= GRIMOIRE_MAX_LEVEL) return false;
    return state.run.picks >= rarityUnlockPicks(g.rarity, state.collapses, stats.forbiddenUnlockPicks);
  });
  const pool = new Map<Rarity, GrimoireDef[]>();
  for (const g of open) pool.set(g.rarity, [...(pool.get(g.rarity) ?? []), g]);

  let rng = state.run.rngState;
  const offers: string[] = [];
  while (offers.length < want) {
    const rarities = RARITIES.filter((r) => (pool.get(r)?.length ?? 0) > 0);
    if (rarities.length === 0) break;
    const total = rarities.reduce((sum, r) => sum + RARITY_WEIGHT[r], 0);
    let roll: number;
    [roll, rng] = nextRandom(rng);
    let acc = roll * total;
    let rarity = rarities[rarities.length - 1] as Rarity;
    for (const r of rarities) {
      acc -= RARITY_WEIGHT[r];
      if (acc < 0) {
        rarity = r;
        break;
      }
    }
    const cards = pool.get(rarity) as GrimoireDef[];
    let pick: number;
    [pick, rng] = nextRandom(rng);
    const card = cards[Math.min(cards.length - 1, Math.floor(pick * cards.length))] as GrimoireDef;
    offers.push(card.id);
    pool.set(rarity, cards.filter((c) => c.id !== card.id));
  }
  return { offers, rngState: rng };
}

/** Abre a escolha se a barra encheu. Devolve o estado com `pending` e a energia travada no teto. */
function openChoiceIfFull(state: SaveState, now: number): SaveState {
  const run = state.run;
  if (run.pending) return state;
  const stats = effectiveStats(state);
  const cap = energyCap(run.picks, stats.energyStepFactor);
  if (run.energy < cap) return state;
  return openChoice(state, now, stats.choice.picks, stats.choice.rerolls + run.freeRerolls, cap);
}

function openChoice(state: SaveState, now: number, picksLeft: number, rerollsLeft: number, energy: number): SaveState {
  const { offers, rngState } = drawGrimoires(state);
  if (offers.length === 0) {
    // Nada para oferecer (tudo no nível máximo): a barra só zera, sem travar o jogo.
    return { ...state, run: { ...state.run, energy: 0, rngState } };
  }
  return {
    ...state,
    run: {
      ...state.run,
      energy,
      freeRerolls: 0,
      rngState,
      pending: { offers, openedAt: now, selected: null, picksLeft, rerollsLeft },
    },
  };
}

/** Tempo que ainda falta para as cartas destravarem (0 = livres). */
export function choiceLockRemaining(state: SaveState, now: number): number {
  const p = state.run.pending;
  if (!p) return 0;
  return Math.max(0, p.openedAt + CHOICE_LOCK_SEC - now);
}

/** 1º passo: marca uma carta. Ignorado enquanto as cartas estão bloqueadas ou se a carta não foi oferecida. */
export function selectGrimoire(state: SaveState, id: string, now: number): SaveState {
  const s = syncClock(state, now);
  const p = s.run.pending;
  if (!p || !p.offers.includes(id) || choiceLockRemaining(s, now) > 0) return s;
  return { ...s, run: { ...s.run, pending: { ...p, selected: id } } };
}

/**
 * 2º passo: confirma a carta marcada. Proteções (seção 4.7): precisa estar desbloqueada, ter sido
 * oferecida e ter sido marcada antes. Repetida sobe de nível; com a Nebulosa de Órion a barra cheia
 * rende outra oferta antes de zerar.
 */
export function chooseGrimoire(state: SaveState, id: string, now: number): SaveState {
  const s = syncClock(state, now);
  const p = s.run.pending;
  if (!p || p.selected !== id || !p.offers.includes(id) || choiceLockRemaining(s, now) > 0) return s;
  const stats = effectiveStats(s);
  const current = s.run.build[id] ?? 0;
  const nextLevel = current === 0 ? 1 : Math.min(GRIMOIRE_MAX_LEVEL, current + stats.choice.repeatLevels);
  const run: RunState = {
    ...s.run,
    build: { ...s.run.build, [id]: nextLevel },
    picks: s.run.picks + 1,
    pending: null,
  };
  const next: SaveState = {
    ...s,
    run,
    album: s.album.includes(id) ? s.album : [...s.album, id],
    stats: { ...s.stats, picks: s.stats.picks + 1 },
  };
  if (p.picksLeft > 1) {
    const nextStats = effectiveStats(next);
    return openChoice(next, now, p.picksLeft - 1, nextStats.choice.rerolls, run.energy);
  }
  return { ...next, run: { ...next.run, energy: 0 } };
}

/** Betelgeuse e a Sonda Voyager: troca uma das cartas oferecidas por outra que não esteja na oferta. */
export function rerollGrimoire(state: SaveState, id: string, now: number): SaveState {
  const s = syncClock(state, now);
  const p = s.run.pending;
  if (!p || p.rerollsLeft <= 0 || !p.offers.includes(id)) return s;
  const { offers, rngState } = drawGrimoires(s, p.offers, 1);
  const replacement = offers[0];
  if (replacement === undefined) return s;
  return {
    ...s,
    run: {
      ...s.run,
      rngState,
      pending: {
        ...p,
        offers: p.offers.map((o) => (o === id ? replacement : o)),
        selected: p.selected === id ? null : p.selected,
        rerollsLeft: p.rerollsLeft - 1,
      },
    },
  };
}

// --- Toque ---

/**
 * Um toque: poeira, energia e combo. Ignorado com a escolha aberta (seção 4.2) e mais rápido que
 * `MAX_TOUCHES_PER_SEC` (seção 4.1). `poeira = (1 + Pulso) x combo x ...`, para baixo, mínimo 1.
 */
export function press(state: SaveState, now: number): SaveState {
  const s = syncClock(state, now);
  const run = s.run;
  if (run.pending) return s;
  if (now - run.lastPressAt < 1 / MAX_TOUCHES_PER_SEC - 1e-9) return s;

  const stats = effectiveStats(s);
  const clicks = run.clicks + 1;
  const combo = stats.combo.enabled && now - run.lastPressAt <= stats.combo.windowSec ? Math.min(stats.combo.max, run.combo + 1) : 0;

  let value = stats.dustPerTouch * (1 + COMBO_BONUS_PER_POINT * combo);
  if (stats.combo.enabled && combo >= stats.combo.max && stats.combo.fullDustPct > 0) value *= 1 + stats.combo.fullDustPct / 100;
  let barBonusPct = 0;
  for (const rule of stats.nth) {
    if (clicks % rule.n === 0) {
      value *= rule.mult;
      barBonusPct += rule.energyBarPct;
    }
  }
  if (run.afterCapture) value *= stats.objects.afterCaptureMult;
  if (now < run.boostUntil) value *= run.boostMult;
  const gain = clampNum(Math.max(1, Math.floor(clampNum(value))));

  const cap = energyCap(run.picks, stats.energyStepFactor);
  const next: SaveState = {
    ...s,
    run: {
      ...run,
      dust: clampNum(run.dust + gain),
      dustLife: clampNum(run.dustLife + gain),
      energy: clampNum(run.energy + stats.energyPerTouch + (cap * barBonusPct) / 100),
      clicks,
      combo,
      lastPressAt: now,
      afterCapture: false,
      lastGain: gain,
    },
    stats: { ...s.stats, clicks: s.stats.clicks + 1, dustTotal: clampNum(s.stats.dustTotal + gain) },
  };
  return openChoiceIfFull(next, now);
}

// --- Melhorias ---

export function upgradeAvailable(state: SaveState, index: number): boolean {
  const def = UPGRADES[index];
  if (!def) return false;
  if (def.unlockedAtCollapse > state.collapses) return false;
  if (def.requiresPicks !== undefined && state.run.picks < def.requiresPicks) return false;
  if (def.requiresUpgrade && level(state, def.requiresUpgrade.id) < def.requiresUpgrade.level) return false;
  return true;
}

/** Custo da próxima compra, ou `null` se a melhoria está no máximo, trancada ou não existe. */
export function nextUpgradeCost(state: SaveState, index: number): number | null {
  const def = UPGRADES[index];
  if (!def || !upgradeAvailable(state, index)) return null;
  const lvl = state.run.upgradeLevels[index] ?? 0;
  if (lvl >= def.max) return null;
  return upgradeCost(def, lvl, effectiveStats(state).costFactor);
}

export function buyUpgrade(state: SaveState, index: number): SaveState {
  const cost = nextUpgradeCost(state, index);
  if (cost === null || state.run.dust < cost) return state;
  const upgradeLevels = state.run.upgradeLevels.slice();
  upgradeLevels[index] = (upgradeLevels[index] ?? 0) + 1;
  return { ...state, run: { ...state.run, dust: clampNum(state.run.dust - cost), upgradeLevels } };
}

// --- Objetos no espaço ---

function pickObjectKind(state: SaveState, rngState: number): { kind: ObjectKind; rngState: number } {
  const open = unlockedContent(state).objects;
  const total = open.reduce((sum, o) => sum + o.weight, 0);
  const [roll, next] = nextRandom(rngState);
  let acc = roll * total;
  for (const o of open) {
    acc -= o.weight;
    if (acc < 0) return { kind: o.kind, rngState: next };
  }
  return { kind: (open[open.length - 1] as ObjectDef).kind, rngState: next };
}

/** Remove os que expiraram e faz nascer um novo no ritmo da Kepler. Sem objetos em escolha aberta nem com o jogo parado. */
export function tickObjects(state: SaveState, now: number): SaveState {
  const s = syncClock(state, now);
  const run = s.run;
  const alive = run.objects.filter((o) => o.expiresAt > now);
  let next: RunState = alive.length === run.objects.length ? run : { ...run, objects: alive };
  if (run.pending) return next === run ? s : { ...s, run: next };

  const stats = effectiveStats(s);
  if (stats.objects.disabled) return next === run ? s : { ...s, run: next };
  if (next.nextSpawnAt === null) {
    next = { ...next, nextSpawnAt: now + stats.objects.intervalSec };
  } else if (now >= next.nextSpawnAt && next.objects.length < stats.objects.maxOnField) {
    const { kind, rngState } = pickObjectKind(s, next.rngState);
    const object: GameObject = { id: next.nextObjectId, kind, bornAt: now, expiresAt: now + stats.objects.lifeSec[kind] };
    next = {
      ...next,
      objects: [...next.objects, object],
      nextObjectId: next.nextObjectId + 1,
      nextSpawnAt: now + stats.objects.intervalSec,
      rngState,
    };
  }
  return next === run ? s : { ...s, run: next };
}

/** Recompensa que o objeto mostra na etiqueta (poeira e energia já com os bônus). */
export function objectReward(state: SaveState, kind: ObjectKind): { dust: number; energy: number } {
  const stats = effectiveStats(state);
  const value = stats.objects.valueMult[kind];
  const touch = stats.dustPerTouch;
  switch (kind) {
    case 'comet':
      return { dust: Math.max(1, Math.floor(touch * OBJECT_REWARD.cometTouches * value)), energy: 0 };
    case 'shooting-star':
      return { dust: 0, energy: OBJECT_REWARD.starEnergyTouches * stats.energyPerTouch * value };
    case 'asteroid':
      return {
        dust: Math.max(1, Math.floor(touch * OBJECT_REWARD.asteroidTouches * value)),
        energy: OBJECT_REWARD.asteroidEnergyTouches * stats.energyPerTouch * value,
      };
    case 'satellite':
    case 'probe':
      return { dust: 0, energy: 0 };
  }
}

/** Tudo que a etiqueta do objeto promete antes de tocar (a mesma conta de `captureObject`). */
export interface ObjectPreview {
  dust: number;
  energy: number;
  /** "Sinal forte": multiplicador e duração em segundos (satélite); 0 nos demais. */
  boostMult: number;
  boostSec: number;
  freeReroll: boolean;
}

export function objectPreview(state: SaveState, kind: ObjectKind): ObjectPreview {
  const { dust, energy } = objectReward(state, kind);
  const { objects } = effectiveStats(state);
  const signal = kind === 'satellite';
  return {
    dust,
    energy: energy + objects.onCaptureEnergyTouches * effectiveStats(state).energyPerTouch,
    boostMult: signal ? objects.signalMult : 0,
    boostSec: signal ? objects.signalSec : 0,
    freeReroll: kind === 'probe',
  };
}

export function captureObject(state: SaveState, id: number, now: number): SaveState {
  const s = syncClock(state, now);
  const run = s.run;
  if (run.pending) return s;
  const obj = run.objects.find((o) => o.id === id);
  if (!obj || obj.expiresAt <= now) return s;

  const stats = effectiveStats(s);
  const reward = objectReward(s, obj.kind);
  const next: RunState = {
    ...run,
    objects: run.objects.filter((o) => o.id !== id),
    dust: clampNum(run.dust + reward.dust),
    dustLife: clampNum(run.dustLife + reward.dust),
    energy: clampNum(run.energy + reward.energy + stats.objects.onCaptureEnergyTouches * stats.energyPerTouch),
    afterCapture: stats.objects.afterCaptureMult > 1,
  };
  if (obj.kind === 'satellite') {
    next.boostUntil = now + stats.objects.signalSec;
    next.boostMult = stats.objects.signalMult;
  } else if (obj.kind === 'probe') {
    next.freeRerolls = run.freeRerolls + 1;
  }
  const withStats: SaveState = {
    ...s,
    run: next,
    stats: {
      ...s.stats,
      objectsCaptured: s.stats.objectsCaptured + 1,
      dustTotal: clampNum(s.stats.dustTotal + reward.dust),
    },
  };
  return openChoiceIfFull(withStats, now);
}

// --- Colapso, Atlas e árvore ---

export function collapseProgress(state: SaveState): { dust: number; dustGoal: number; picks: number; minPicks: number; ready: boolean } {
  const k = state.collapses + 1;
  const goal = dustGoal(k);
  const min = minPicks(k);
  return {
    dust: state.run.dustLife,
    dustGoal: goal,
    picks: state.run.picks,
    minPicks: min,
    ready: state.run.dustLife >= goal && state.run.picks >= min && state.run.pending === null,
  };
}

export function canCollapse(state: SaveState): boolean {
  return collapseProgress(state).ready;
}

/**
 * Colapsa a estrela: guarda `pageId` (um grimório da vida) no Atlas a 60%, dá Fragmentos e recomeça
 * do zero. Com o Atlas cheio, `replaceIndex` diz qual página sai. Sem as condições, devolve o mesmo estado.
 */
export function collapse(state: SaveState, pageId: string, replaceIndex?: number): SaveState {
  if (!canCollapse(state)) return state;
  const lvl = state.run.build[pageId];
  if (lvl === undefined) return state;

  const k = state.collapses + 1;
  const slots = atlasSlots(k);
  const pages = state.atlas.pages.slice();
  const existing = pages.findIndex((p) => p.grimoireId === pageId);
  if (existing >= 0) {
    pages[existing] = { grimoireId: pageId, level: Math.max((pages[existing] as AtlasPage).level, lvl) };
  } else if (pages.length < slots) {
    pages.push({ grimoireId: pageId, level: lvl });
  } else if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < pages.length) {
    pages[replaceIndex] = { grimoireId: pageId, level: lvl };
  } else {
    return state;
  }

  const gained = fragmentsFor(k, state.run.dustLife);
  const open = REGIONS.filter((r) => r.unlockedAtCollapse <= k);
  const base: SaveState = {
    ...state,
    collapses: k,
    regionId: (open[open.length - 1] as RegionDef).id,
    atlas: { slots, pages },
    fragments: { earned: state.fragments.earned + gained, spent: state.fragments.spent },
    run: freshRun(state.run.rngState),
    // Cada colapso começa uma vida nova com o tutorial concluído (spec 8.1).
    tutorial: 'done',
  };
  // A poeira inicial (Titã) depende do Atlas novo, por isso a vida nova é montada depois dele.
  const startDust = effectiveStats(base).startDust;
  return { ...base, run: { ...base.run, dust: startDust, dustLife: startDust } };
}

export function fragmentsAvailable(state: SaveState): number {
  return Math.max(0, state.fragments.earned - state.fragments.spent);
}

export function treeNodeCost(level: number): number {
  return TREE_COSTS[level - 1] ?? Infinity;
}

/** Compra o nó `branch:nível`. A árvore abre no 1º colapso e cada nível exige o anterior. */
export function buyTreeNode(state: SaveState, nodeId: string): SaveState {
  if (state.collapses < 1) return state;
  const branch = TREE.find((b) => [1, 2, 3].some((l) => treeNodeId(b.id, l) === nodeId));
  if (!branch) return state;
  const target = [1, 2, 3].find((l) => treeNodeId(branch.id, l) === nodeId) as number;
  const current = state.tree[branch.id] ?? 0;
  if (target !== current + 1) return state;
  const cost = treeNodeCost(target);
  if (fragmentsAvailable(state) < cost) return state;
  return {
    ...state,
    tree: { ...state.tree, [branch.id]: target },
    fragments: { earned: state.fragments.earned, spent: state.fragments.spent + cost },
  };
}

/** Refazer a árvore devolve os Fragmentos gastos menos 20% (a taxa fica como gasta). Sem custo de poeira. */
export function respecTree(state: SaveState): SaveState {
  if (state.fragments.spent <= 0 || Object.keys(state.tree).length === 0) return state;
  return { ...state, tree: {}, fragments: { earned: state.fragments.earned, spent: respecFee(state.fragments.spent) } };
}

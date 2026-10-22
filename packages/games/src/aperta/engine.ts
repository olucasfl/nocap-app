// Motor do Aperta! (spec 038, seções 4, 7 e 8). Funções puras sobre `SaveState`: cada uma devolve
// um estado novo e nunca muta o recebido. O relógio vem de fora (`now`, em segundos de jogo) e só
// avança com o jogo aberto: quem chama não pode passar tempo de aba escondida (seção 7.4).

import { hashSeed } from '../core/rng';
import { awardAchievements } from './achievements';
import type { UiState } from './tutorial';
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
import { eventsOpen, mechanicOpen, missionById, MISSIONS, type EventId, type MissionDef } from './content';
import {
  ATLAS_PAGE_POWER,
  BASE_ENERGY_PER_TOUCH,
  CHANDRA_LIFE_PER_LEVEL_SEC,
  CHOICE_LOCK_SEC,
  COMBO_BASE_MAX,
  COMBO_BASE_WINDOW_SEC,
  COMBO_BONUS_PER_POINT,
  COMBO_HARD_CAP,
  EVENT_DURATION_SEC,
  EVENT_INTERVAL_SEC,
  EVENT_JITTER,
  FAVORITE_WEIGHT,
  METEOR_SHOWER_EXTRA_MAX,
  METEOR_SHOWER_INTERVAL_SEC,
  MISSION_FRAGMENTS,
  SOLAR_STORM_ENERGY_MULT,
  GRIMOIRE_MAX_LEVEL,
  HUBBLE_DUST_PER_SEC_PER_LEVEL,
  KEPLER_INTERVAL_PER_LEVEL_SEC,
  MAX_NUMBER,
  MAX_STEP_SEC,
  MAX_TOUCHES_PER_SEC,
  OBJECT_BASE_INTERVAL_SEC,
  OBJECT_BASE_MAX,
  OBJECT_MIN_INTERVAL_SEC,
  REACTOR_STEP,
  RESONANCE_POINT_PER_LEVEL,
  VOYAGER_SEC_PER_LEVEL,
  WEBB_DUST_PER_LEVEL,
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

/** Evento em andamento (Chuva de meteoros, Tempestade solar): termina em `until`. */
export interface ActiveEvent {
  id: EventId;
  until: number;
}

/** Missão da estação da vida atual: `progress` sobe pela métrica da missão. */
export interface MissionState {
  id: string;
  progress: number;
  done: boolean;
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
  /** Desde quando o combo está no máximo sem cair (carimbo do relógio; `NEVER` fora do máximo). */
  comboFullSince: number;
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
  event: ActiveEvent | null;
  /** Quando o próximo evento começa; `null` até o jogo marcar o primeiro. */
  nextEventAt: number | null;
  mission: MissionState | null;
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
  /** O que o tutorial já liberou e mostrou (botões do dock, cartões); ver tutorial.ts. */
  ui: UiState;
  storySeen: boolean;
  run: RunState;
  album: string[];
  atlas: { slots: number; pages: AtlasPage[] };
  collapses: number;
  regionId: string;
  /** Grimório favorito (pesa o dobro no sorteio); só depois de o Favorito abrir, no 2º colapso. */
  favorite: string | null;
  seenUnlocks: string[];
  fragments: { earned: number; spent: number };
  /** Ramo -> nível (0 a 3). */
  tree: Record<string, number>;
  achievements: string[];
  stats: SaveStats;
}

export interface SaveStats {
  clicks: number;
  objectsCaptured: number;
  picks: number;
  dustTotal: number;
  /** Maior nível que um grimório já teve (as conquistas de nível 5 e 10). */
  bestLevel: number;
  /** Toques dados com o combo no máximo. */
  comboMaxHits: number;
  /** Maior tempo seguido, em segundos, com o combo no máximo. */
  comboFullBest: number;
  /** Satélites capturados em sequência agora (outro objeto zera) e o recorde. */
  satelliteStreak: number;
  satelliteBest: number;
  /** Vezes que a árvore foi refeita. */
  respecs: number;
}

export const FRESH_STATS: SaveStats = {
  clicks: 0,
  objectsCaptured: 0,
  picks: 0,
  dustTotal: 0,
  bestLevel: 0,
  comboMaxHits: 0,
  comboFullBest: 0,
  satelliteStreak: 0,
  satelliteBest: 0,
  respecs: 0,
};

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
    comboFullSince: NEVER,
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
    event: null,
    nextEventAt: null,
    mission: null,
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
    ui: { unlocked: [], hints: [] },
    storySeen: false,
    run: freshRun(hashSeed(seed)),
    album: [],
    atlas: { slots: atlasSlots(0), pages: [] },
    collapses: 0,
    regionId: (REGIONS[0] as RegionDef).id,
    favorite: null,
    seenUnlocks: [],
    fragments: { earned: 0, spent: 0 },
    tree: {},
    achievements: [],
    stats: { ...FRESH_STATS },
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
  let run = frozen ? shiftRun(state.run, gap, hidden) : state.run;
  let stats = state.stats;
  if (!frozen) {
    // Ganho passivo (Telescópio Hubble): poeira por segundo de jogo aberto, sem escolha aberta.
    const earn = effectiveStats(state).dustPerSecond * gap;
    if (earn > 0) {
      run = { ...run, dust: clampNum(run.dust + earn), dustLife: clampNum(run.dustLife + earn) };
      stats = { ...stats, dustTotal: clampNum(stats.dustTotal + earn) };
    }
  }
  return {
    ...state,
    clock: now,
    playSeconds: hidden ? state.playSeconds : state.playSeconds + gap,
    run,
    stats,
  };
}

function shiftRun(run: RunState, gap: number, shiftPending: boolean): RunState {
  return {
    ...run,
    lastPressAt: run.lastPressAt + gap,
    comboFullSince: run.comboFullSince + gap,
    boostUntil: run.boostUntil + gap,
    nextSpawnAt: run.nextSpawnAt === null ? null : run.nextSpawnAt + gap,
    nextEventAt: run.nextEventAt === null ? null : run.nextEventAt + gap,
    event: run.event ? { ...run.event, until: run.event.until + gap } : null,
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
  /** Poeira por segundo sem tocar (Telescópio Hubble). */
  dustPerSecond: number;
  energyPerTouch: number;
  combo: {
    enabled: boolean;
    max: number;
    windowSec: number;
    /** Quanto cada ponto de combo soma ao toque (0,2 = +20%; a Ressonância sobe). */
    pointValue: number;
    /** Com o combo no máximo: poeira e energia somadas ao toque e fator da poeira. */
    fullDustAdd: number;
    fullEnergyAdd: number;
    fullMult: number;
  };
  costFactor: number;
  /** Cada melhoria comprada devolve a poeira de tantos toques. */
  buyRefundTouches: number;
  startDust: number;
  energyStepFactor: number;
  /** `energy`: energia somada quando a regra dispara (número, não % da barra). */
  nth: { n: number; mult: number; energy: number }[];
  objects: {
    disabled: boolean;
    intervalSec: number;
    maxOnField: number;
    lifeSec: Record<ObjectKind, number>;
    /** Recompensa de cada objeto em toques: `dust` (poeira de toques) e `energy` (energia de toques). */
    reward: Record<ObjectKind, { dust: number; energy: number }>;
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

  const ownedOf = (rarity: Rarity): number =>
    Object.keys(state.run.build).filter((id) => grimoireById(id)?.rarity === rarity).length;

  let dustPct = 0;
  let dustFlat = 0;
  let dustMult = 1;
  let comboFullDust = 0;
  let comboFullEnergy = 0;
  let comboFullMult = 1;
  let energyPct = 0;
  let energyMult = 1;
  let maxAdd = 0;
  let satAdd = 0;
  let comboMaxAdd = 0;
  let windowPct = 0;
  let windowSecAdd = 0;
  let windowMult = 1;
  let stepPct = 0;
  let startDust = 0;
  let freePulse = 0;
  let refund = 0;
  let onCapture = 0;
  let afterCaptureMult = 1;
  let disabled = false;
  const costFactors: number[] = [];
  const nth: EffectiveStats['nth'] = [];
  const choice = { cards: 0, picks: 0, rerolls: 0, repeatLevels: 0 };
  const lifePct = emptyByKind(0);
  const rewardAdd = emptyByKind(0);
  const targets = (t: string): ObjectKind[] => (t === 'all' ? OBJECT_KINDS : OBJECT_KINDS.filter((k) => k === t));

  for (const src of sources) {
    for (const e of src.effects) {
      // Efeito de preço: só a página escala; o bônus dos Buracos negros o corta.
      const s = e.price ? src.price * (1 - priceCut / 100) : src.gain * (src.forbidden ? 1 + forbiddenPower / 100 : 1);
      const m = (mult: number): number => 1 + (mult - 1) * s;
      switch (e.kind) {
        case 'dustPerTouchPct':
          dustPct += e.pct * s;
          break;
        case 'dustMult':
          dustMult *= m(e.mult);
          break;
        case 'comboFullDust':
          comboFullDust += e.add * s;
          break;
        case 'comboFullEnergy':
          comboFullEnergy += e.add * s;
          break;
        case 'comboFullMult':
          comboFullMult *= m(e.mult);
          break;
        case 'energyPerTouchPct':
          energyPct += e.pct * s;
          break;
        case 'energyMult':
          energyMult *= Math.max(0.05, m(e.mult));
          break;
        case 'everyNthTouch':
          nth.push({ n: e.n, mult: m(e.mult), energy: (e.energy ?? 0) * s });
          break;
        case 'objectDuration':
          for (const k of targets(e.target)) lifePct[k] += e.pct * s;
          break;
        case 'objectReward':
          for (const k of targets(e.target)) rewardAdd[k] += e.add * s;
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
          comboMaxAdd += e.add * s;
          break;
        case 'comboWindow':
          windowPct += (e.pct ?? 0) * s;
          windowSecAdd += (e.sec ?? 0) * s;
          windowMult *= m(e.mult ?? 1);
          break;
        case 'upgradeCostPct':
          costFactors.push(Math.max(0.01, 1 + (e.pct * s) / 100));
          break;
        case 'energyStepPct':
          stepPct += e.pct * s;
          break;
        case 'startDust':
          startDust += e.amount * s;
          break;
        case 'freeUpgradeLevels':
          if (e.upgrade === 'pulse') freePulse += Math.floor(e.levels * src.count);
          break;
        case 'buyRefund':
          refund += e.touches * s;
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
          dustFlat += ownedOf(e.rarity) * e.add * s;
          break;
        case 'dustPerCollapse':
          dustFlat += state.collapses * e.add * s;
          break;
        case 'forbiddenUnlock':
        case 'forbiddenPower':
          break;
      }
    }
  }

  // Melhorias: poder básico contínuo, cada uma no seu domínio (a Ressonância liga o combo).
  const pulseLevel = level(state, 'pulse') + freePulse;
  const resonance = level(state, 'resonance');
  const reactor = level(state, 'reactor');
  const kepler = level(state, 'kepler');
  const hubble = level(state, 'hubble');
  const voyager = level(state, 'voyager');
  const webb = level(state, 'webb');
  const chandra = level(state, 'chandra');
  const pleiades = level(state, 'pleiades');

  const costFactor = clampCostFactor(costFactors.reduce((a, b) => a * b, 1));

  const comboMax = Math.min(COMBO_HARD_CAP, Math.max(0, Math.floor(COMBO_BASE_MAX + pleiades + comboMaxAdd)));
  const windowSec = (COMBO_BASE_WINDOW_SEC + windowSecAdd) * (1 + windowPct / 100) * windowMult;

  const energyPerTouch =
    (BASE_ENERGY_PER_TOUCH + REACTOR_STEP * reactor) * Math.max(0, 1 + energyPct / 100) * energyMult;
  const dustPerTouch =
    (1 + pulseLevel + WEBB_DUST_PER_LEVEL * webb + dustFlat) * Math.max(0, 1 + dustPct / 100) * dustMult;

  const life = emptyByKind(0);
  const reward = {} as Record<ObjectKind, { dust: number; energy: number }>;
  for (const def of OBJECTS) {
    const k = def.kind;
    life[k] = Math.max(1, (def.lifeSec + CHANDRA_LIFE_PER_LEVEL_SEC * chandra) * (1 + lifePct[k] / 100));
    reward[k] = { dust: 0, energy: 0 };
  }
  reward.comet.dust = OBJECT_REWARD.cometTouches + rewardAdd.comet;
  reward.asteroid.dust = OBJECT_REWARD.asteroidTouches + rewardAdd.asteroid;
  reward.asteroid.energy = OBJECT_REWARD.asteroidEnergyTouches;
  reward['shooting-star'].energy = OBJECT_REWARD.starEnergyTouches + rewardAdd['shooting-star'];
  reward.satellite.dust = rewardAdd.satellite;
  const signalMult = OBJECT_REWARD.satelliteMult + satAdd;
  const signalSec = Math.max(1, OBJECT_REWARD.satelliteSec + VOYAGER_SEC_PER_LEVEL * voyager);

  return {
    pulseLevel,
    dustPerTouch,
    dustPerSecond: HUBBLE_DUST_PER_SEC_PER_LEVEL * hubble,
    energyPerTouch,
    combo: {
      enabled: resonance > 0,
      max: comboMax,
      windowSec,
      pointValue: COMBO_BONUS_PER_POINT + RESONANCE_POINT_PER_LEVEL * Math.max(0, resonance - 1),
      fullDustAdd: comboFullDust,
      fullEnergyAdd: comboFullEnergy,
      fullMult: comboFullMult,
    },
    costFactor,
    buyRefundTouches: refund,
    startDust: Math.floor(startDust),
    energyStepFactor: Math.max(0.1, 1 + stepPct / 100),
    nth,
    objects: {
      disabled,
      intervalSec: Math.max(OBJECT_MIN_INTERVAL_SEC, OBJECT_BASE_INTERVAL_SEC - KEPLER_INTERVAL_PER_LEVEL_SEC * kepler),
      maxOnField: OBJECT_BASE_MAX + (kepler > 0 ? 1 : 0) + maxAdd,
      lifeSec: life,
      reward,
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

  const favorite = mechanicOpen('favorite', state.collapses) ? state.favorite : null;
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
    const weight = (c: GrimoireDef) => (c.id === favorite ? FAVORITE_WEIGHT : 1);
    let left = pick * cards.reduce((sum, c) => sum + weight(c), 0);
    let card = cards[cards.length - 1] as GrimoireDef;
    for (const c of cards) {
      left -= weight(c);
      if (left < 0) {
        card = c;
        break;
      }
    }
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
    run: bumpMission(run, 'pick'),
    album: s.album.includes(id) ? s.album : [...s.album, id],
    stats: { ...s.stats, picks: s.stats.picks + 1, bestLevel: Math.max(s.stats.bestLevel, nextLevel) },
  };
  if (p.picksLeft > 1) {
    const nextStats = effectiveStats(next);
    return awardAchievements(openChoice(next, now, p.picksLeft - 1, nextStats.choice.rerolls, run.energy));
  }
  return awardAchievements({ ...next, run: { ...next.run, energy: 0 } });
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
 * `MAX_TOUCHES_PER_SEC` (seção 4.1). `poeira = (1 + Pulso + ...) x combo x ...`, para baixo, mínimo 1:
 * um save novo tem 0 de poeira e o 1º toque dá exatamente 1.
 */
export function press(state: SaveState, now: number): SaveState {
  const s = syncClock(state, now);
  const run = s.run;
  if (run.pending) return s;
  if (now - run.lastPressAt < 1 / MAX_TOUCHES_PER_SEC - 1e-9) return s;

  const stats = effectiveStats(s);
  const clicks = run.clicks + 1;
  const combo = stats.combo.enabled && now - run.lastPressAt <= stats.combo.windowSec ? Math.min(stats.combo.max, run.combo + 1) : 0;

  const full = stats.combo.enabled && stats.combo.max > 0 && combo >= stats.combo.max;
  let value = (stats.dustPerTouch + (full ? stats.combo.fullDustAdd : 0)) * (1 + stats.combo.pointValue * combo);
  if (full) value *= stats.combo.fullMult;
  let bonusEnergy = full ? stats.combo.fullEnergyAdd : 0;
  for (const rule of stats.nth) {
    if (clicks % rule.n === 0) {
      value *= rule.mult;
      bonusEnergy += rule.energy;
    }
  }
  if (run.afterCapture) value *= stats.objects.afterCaptureMult;
  if (now < run.boostUntil) value *= run.boostMult;
  const gain = clampNum(Math.max(1, Math.floor(clampNum(value))));

  const fullSince = full ? (run.comboFullSince > NEVER / 2 ? run.comboFullSince : now) : NEVER;
  const next: SaveState = {
    ...s,
    run: {
      ...run,
      comboFullSince: fullSince,
      dust: clampNum(run.dust + gain),
      dustLife: clampNum(run.dustLife + gain),
      energy: clampNum(run.energy + (stats.energyPerTouch + bonusEnergy) * energyMult(run, now)),
      clicks,
      combo,
      lastPressAt: now,
      afterCapture: false,
      lastGain: gain,
    },
    stats: {
      ...s.stats,
      clicks: s.stats.clicks + 1,
      dustTotal: clampNum(s.stats.dustTotal + gain),
      comboMaxHits: s.stats.comboMaxHits + (full ? 1 : 0),
      comboFullBest: full ? Math.max(s.stats.comboFullBest, now - fullSince) : s.stats.comboFullBest,
    },
  };
  return awardAchievements(openChoiceIfFull({ ...next, run: bumpMission(next.run, 'touch') }, now));
}

// --- Melhorias ---

/** Por que uma melhoria ainda não abriu, ou `null` se já está liberada. */
export type UpgradeLock =
  | { kind: 'collapse'; collapse: number }
  | { kind: 'requires'; upgrade: string; level: number }
  | { kind: 'milestone'; dust: number | null; upgrade: { id: string; level: number } | null };

function milestoneMet(state: SaveState, def: UpgradeDef): boolean {
  const u = def.unlock;
  if (!u) return true;
  // Depois do 1º colapso o jogador já conhece as melhorias: o marco só vale na primeira vida.
  if (state.collapses >= 1) return true;
  if (u.dust !== undefined && state.run.dustLife >= u.dust) return true;
  if (u.upgrade && level(state, u.upgrade.id) >= u.upgrade.level) return true;
  return false;
}

/** O que falta para a melhoria abrir (`null` = liberada). Só depende do estado, nunca do relógio. */
export function upgradeLock(state: SaveState, index: number): UpgradeLock | null {
  const def = UPGRADES[index];
  if (!def) return { kind: 'collapse', collapse: Infinity };
  if (def.unlockedAtCollapse > state.collapses) return { kind: 'collapse', collapse: def.unlockedAtCollapse };
  if (def.requiresUpgrade && level(state, def.requiresUpgrade.id) < def.requiresUpgrade.level) {
    return { kind: 'requires', upgrade: def.requiresUpgrade.id, level: def.requiresUpgrade.level };
  }
  if (!milestoneMet(state, def)) {
    return { kind: 'milestone', dust: def.unlock?.dust ?? null, upgrade: def.unlock?.upgrade ?? null };
  }
  return null;
}

export function upgradeAvailable(state: SaveState, index: number): boolean {
  return upgradeLock(state, index) === null;
}

/** Linha do painel de melhorias: liberada ou "em breve" com a condição (spec 038, 5.1). */
export interface UpgradeUnlockInfo {
  index: number;
  id: string;
  unlocked: boolean;
  /** Ainda não existe nesta fase do jogo (colapso futuro): a tela nem a lista. */
  hidden: boolean;
  lock: UpgradeLock | null;
}

/** Quais melhorias estão liberadas e quais estão em breve (com a condição), na ordem do catálogo. */
export function upgradeUnlocks(state: SaveState): UpgradeUnlockInfo[] {
  return UPGRADES.map((def, index) => {
    const lock = upgradeLock(state, index);
    return { index, id: def.id, unlocked: lock === null, hidden: lock?.kind === 'collapse', lock };
  });
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
  // Ceres e Saturno: a compra devolve a poeira de alguns toques (nunca mais que o preço).
  const refund = Math.min(cost, Math.floor(effectiveStats(state).buyRefundTouches * effectiveStats(state).dustPerTouch));
  return { ...state, run: { ...state.run, dust: clampNum(state.run.dust - cost + refund), upgradeLevels } };
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

// --- Eventos e missões (spec 038, 5.4) ---

/** O evento que está valendo agora, ou `null`. */
export function activeEventId(state: SaveState, now: number): EventId | null {
  const e = state.run.event;
  return e && now < e.until ? e.id : null;
}

function energyMult(run: RunState, now: number): number {
  return run.event?.id === 'solar-storm' && now < run.event.until ? SOLAR_STORM_ENERGY_MULT : 1;
}

/**
 * Sorteio dos eventos e da missão: sai do tempo de jogo e do colapso, não do `rngState` da vida,
 * para não mexer na sequência das cartas (o simulador e os saves antigos seguem iguais).
 */
function sideRoll(now: number, collapses: number, salt: number): number {
  return nextRandom(Math.floor(now * 1000) * 31 + collapses * 7919 + salt)[0];
}

/** Próximo início de evento: o intervalo base com ±`EVENT_JITTER`. */
function nextEventTime(now: number, collapses: number): number {
  return now + EVENT_INTERVAL_SEC * (1 + (sideRoll(now, collapses, 1) * 2 - 1) * EVENT_JITTER);
}

/** Encerra o evento vencido, marca o próximo e, na hora, começa um dos eventos abertos. */
function tickEvents(state: SaveState, run: RunState, now: number): RunState {
  const open = eventsOpen(state.collapses);
  if (open.length === 0) return run;
  let next = run;
  if (next.event && now >= next.event.until) next = { ...next, event: null };
  if (next.nextEventAt === null) return { ...next, nextEventAt: nextEventTime(now, state.collapses) };
  if (next.event === null && now >= next.nextEventAt) {
    const id = open[Math.min(open.length - 1, Math.floor(sideRoll(now, state.collapses, 2) * open.length))] as EventId;
    return {
      ...next,
      event: { id, until: now + EVENT_DURATION_SEC },
      nextEventAt: nextEventTime(now + EVENT_DURATION_SEC, state.collapses),
    };
  }
  return next;
}

/** A missão da vida: sorteada quando a mecânica está aberta e a vida ainda não tem uma. */
function assignMission(state: SaveState, run: RunState): RunState {
  if (run.mission || !mechanicOpen('missions', state.collapses)) return run;
  const roll = sideRoll(state.playSeconds, state.collapses, 3);
  const def = MISSIONS[Math.min(MISSIONS.length - 1, Math.floor(roll * MISSIONS.length))] as MissionDef;
  return { ...run, mission: { id: def.id, progress: 0, done: false } };
}

function bumpMission(run: RunState, metric: MissionDef['metric']): RunState {
  const m = run.mission;
  if (!m || m.done) return run;
  const def = missionById(m.id);
  if (!def || def.metric !== metric) return run;
  const progress = Math.min(def.target, m.progress + 1);
  return { ...run, mission: { id: m.id, progress, done: progress >= def.target } };
}

/** Fragmentos extras que a vida atual rende por ter cumprido a missão da estação. */
export function missionBonus(state: SaveState): number {
  return state.run.mission?.done ? MISSION_FRAGMENTS : 0;
}

/** Os objetos só aparecem depois da primeira melhoria da vida (ou depois do 1º colapso). */
export function objectsOpen(state: SaveState): boolean {
  return state.collapses >= 1 || state.run.upgradeLevels.some((l) => l > 0);
}

/**
 * O primeiro objeto do tutorial (passo 7, "jogo livre", antes de o cartão de objetos ser visto) não some e
 * é o único no campo: a dica fica até a pessoa pegá-lo. O número é `TUTORIAL.FREE` (tutorial.ts não pode ser
 * importado aqui: ele já importa o motor).
 */
export function pinsFirstObject(state: SaveState): boolean {
  return state.tutorial === 7 && !state.ui.hints.includes('objects');
}

/** Remove os que expiraram e faz nascer um novo no ritmo da Kepler. Sem objetos em escolha aberta nem com o jogo parado. */
export function tickObjects(state: SaveState, now: number): SaveState {
  const s = syncClock(state, now);
  const run = s.run;
  const pinned = pinsFirstObject(s);
  const alive = pinned ? run.objects : run.objects.filter((o) => o.expiresAt > now);
  let next: RunState = alive.length === run.objects.length ? run : { ...run, objects: alive };
  if (run.pending) return next === run ? s : { ...s, run: next };

  next = assignMission(s, tickEvents(s, next, now));
  const stats = effectiveStats(s);
  // Nada de objeto antes da 1ª melhoria (spec 038, 4.5): o começo é só toque, melhoria e grimório.
  if (stats.objects.disabled || !objectsOpen(s)) return next === run ? s : { ...s, run: next };
  const shower = next.event?.id === 'meteor-shower' && now < next.event.until;
  const interval = shower ? Math.min(METEOR_SHOWER_INTERVAL_SEC, stats.objects.intervalSec) : stats.objects.intervalSec;
  const room = pinned ? 1 : stats.objects.maxOnField + (shower ? METEOR_SHOWER_EXTRA_MAX : 0);
  if (next.nextSpawnAt === null) {
    next = { ...next, nextSpawnAt: now + interval };
  } else if (shower && next.nextSpawnAt > now + interval) {
    // A chuva começa na hora, sem esperar o intervalo normal que já estava marcado.
    next = { ...next, nextSpawnAt: now };
  } else if (now >= next.nextSpawnAt && next.objects.length < room) {
    const picked = shower ? { kind: 'shooting-star' as const, rngState: next.rngState } : pickObjectKind(s, next.rngState);
    const { kind, rngState } = picked;
    const object: GameObject = { id: next.nextObjectId, kind, bornAt: now, expiresAt: now + stats.objects.lifeSec[kind] };
    next = {
      ...next,
      objects: [...next.objects, object],
      nextObjectId: next.nextObjectId + 1,
      nextSpawnAt: now + interval,
      rngState,
    };
  }
  return next === run ? s : { ...s, run: next };
}

/** Recompensa que o objeto mostra na etiqueta (poeira e energia já com os bônus). */
export function objectReward(state: SaveState, kind: ObjectKind): { dust: number; energy: number } {
  const stats = effectiveStats(state);
  const r = stats.objects.reward[kind];
  return {
    dust: r.dust > 0 ? Math.max(1, Math.floor(stats.dustPerTouch * r.dust)) : 0,
    energy: r.energy * stats.energyPerTouch,
  };
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
  if (!obj || (obj.expiresAt <= now && !pinsFirstObject(s))) return s;

  const stats = effectiveStats(s);
  const reward = objectReward(s, obj.kind);
  const next: RunState = {
    ...run,
    objects: run.objects.filter((o) => o.id !== id),
    dust: clampNum(run.dust + reward.dust),
    dustLife: clampNum(run.dustLife + reward.dust),
    energy: clampNum(run.energy + (reward.energy + stats.objects.onCaptureEnergyTouches * stats.energyPerTouch) * energyMult(run, now)),
    afterCapture: stats.objects.afterCaptureMult > 1,
  };
  if (obj.kind === 'satellite') {
    next.boostUntil = now + stats.objects.signalSec;
    next.boostMult = stats.objects.signalMult;
  } else if (obj.kind === 'probe') {
    next.freeRerolls = run.freeRerolls + 1;
  }
  const satelliteStreak = obj.kind === 'satellite' ? s.stats.satelliteStreak + 1 : 0;
  const withStats: SaveState = {
    ...s,
    run: bumpMission(next, 'capture'),
    stats: {
      ...s.stats,
      objectsCaptured: s.stats.objectsCaptured + 1,
      dustTotal: clampNum(s.stats.dustTotal + reward.dust),
      satelliteStreak,
      satelliteBest: Math.max(s.stats.satelliteBest, satelliteStreak),
    },
  };
  return awardAchievements(openChoiceIfFull(withStats, now));
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

  const gained = fragmentsFor(k, state.run.dustLife) + missionBonus(state);
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
  return awardAchievements({ ...base, run: { ...base.run, dust: startDust, dustLife: startDust } });
}

/** Marca (ou, com `null`, desmarca) o favorito. Só depois de o Favorito abrir e só um grimório já descoberto. */
export function setFavorite(state: SaveState, id: string | null): SaveState {
  if (!mechanicOpen('favorite', state.collapses)) return state;
  if (id !== null) {
    const def = grimoireById(id);
    if (!def || def.unlockedAtCollapse > state.collapses || !state.album.includes(id)) return state;
  }
  return state.favorite === id ? state : { ...state, favorite: id };
}

/** Rever uma região já aberta (spec 5.4, sem custo): só muda o cenário. */
export function setRegion(state: SaveState, regionId: string): SaveState {
  const def = REGIONS.find((r) => r.id === regionId);
  if (!def || def.unlockedAtCollapse > state.collapses || state.regionId === regionId) return state;
  return { ...state, regionId };
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
  return awardAchievements({
    ...state,
    tree: { ...state.tree, [branch.id]: target },
    fragments: { earned: state.fragments.earned, spent: state.fragments.spent + cost },
  });
}

/** Refazer a árvore devolve os Fragmentos gastos menos 20% (a taxa fica como gasta). Sem custo de poeira. */
export function respecTree(state: SaveState): SaveState {
  if (state.fragments.spent <= 0 || Object.keys(state.tree).length === 0) return state;
  return awardAchievements({
    ...state,
    tree: {},
    fragments: { earned: state.fragments.earned, spent: respecFee(state.fragments.spent) },
    stats: { ...state.stats, respecs: state.stats.respecs + 1 },
  });
}

// Motor do Aperta! (spec 038, seções 4, 7 e 8). Funções puras sobre `SaveState`: cada uma devolve
// um estado novo e nunca muta o recebido. O relógio vem de fora (`now`, em segundos de jogo) e só
// avança com o jogo aberto: quem chama não pode passar tempo de aba escondida (seção 7.4).

import { hashSeed } from '../core/rng';
import { awardAchievements } from './achievements';
import type { UiState } from './tutorial';
import {
  GRIMOIRES,
  GRIMOIRE_RARITIES,
  OBJECTS,
  OBJECT_REWARD,
  RARE_EFFECTS,
  RARITY_WEIGHT,
  REGIONS,
  UPGRADES,
  grimoireById,
  upgradeIndex,
  type Effect,
  type GrimoireDef,
  type GrimoireRarity,
  type ObjectDef,
  type ObjectKind,
  LEGENDARY_KINDS,
  LEGENDARY_OBJECTS,
  type Rarity,
  type RareEffect,
  type RegionDef,
  type UpgradeDef,
  type UpgradeKind,
} from './catalog';
import { ASSIGNABLE_MISSIONS, eventsOpen, mechanicOpen, missionById, type EventId, type MissionDef } from './content';
import { MISSION_NEXT_DELAY_SEC, milestoneProgress, type MilestoneProgress } from './milestone';
import { RARE_OBJECT_KINDS, LEGENDARY_OBJECT_KINDS, sparksAvailable } from './sparks';
import { AUTOCLICK_MAX_CPS, skillStats, type SkillStats } from './tree-skills';
import { OBJECT_SLOTS_CAP, PITY_BASE, PITY_MIN, TREE_EVENT_IDS, exploreStats, luckStats, type ExploreStats, type LuckStats, type TreeEventId } from './tree-fx';
import { CONSTELLATION_MIN_NODES, branchesWith, nodeLevelCost, nodeLive, parentsMet, treeNodeById, treeSourceEffects, treeStats, type TreeStats } from './tree';
import { FORBIDDEN_IDS, FORBIDDEN_MAX_LEVEL, SEAL_DUST_PER_TOUCH, VAULT_OFFER_SIZE, forbiddenEffects } from './forbidden';
import {
  BASE_ENERGY_PER_TOUCH,
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
  SOLAR_STORM_ENERGY_MULT,
  GRIMOIRE_MAX_LEVEL,
  MAX_NUMBER,
  MAX_STEP_SEC,
  MAX_TOUCHES_PER_SEC,
  OBJECT_BASE_MAX,
  ACTIVE_WINDOW_SEC,
  AUTO_CAP_SHARE,
  AUTO_ENERGY_SHARE,
  FRENZY_MULT,
  FRENZY_SEC,
  IDLE_FACTOR_MAX,
  NOMINAL_TOUCHES_PER_SEC as NOMINAL_TPS,
  RAIN_SEC,
  RARE_INTERVAL_JITTER,
  RARE_INTERVAL_SEC,
  RARE_LIFE_SEC,
  RARE_MIN_INTERVAL_SEC,
  SURGE_CAP_MULT,
  SURGE_SEC,
  CHANDRA_LIFE_MULT,
  CHARGED_ENERGY,
  CRIT_CHANCE,
  GLOVES_FLAT,
  CRIT_MULT,
  ECHO_SHARE_OF_AUTO,
  BULK_MIN,
  BULK_DISCOUNT,
  BURST_EVERY_SEC,
  BURST_SECS,
  CONVERT_PER_SEC,
  LURE_CAP_SEC,
  LURE_UNITS_PER_SEC,
  NETWORK_PER_PROBE,
  PEAK_MULT,
  PEAK_SEC,
  ROTATION_MULT,
  SCALE_EVERY,
  WARM_AFTER_SEC,
  WARM_MULT,
  WARM_RELEASE_SEC,
  FIRST_OBJECT_DELAY_SEC,
  HANDS_GENERATORS_PER_POINT,
  IDLE_FACTOR,
  KEPLER_SPAWN_FACTOR,
  MAGNET_SEC_PER_TOUCH,
  NOMINAL_TOUCHES_PER_SEC,
  REVEAL_SHARE,
  SHELF_AHEAD,
  SPAWN_FLOOR_MAX_SEC,
  SPAWN_FLOOR_MIN_SEC,
  SPAWN_MAX_SEC,
  SPAWN_MIN_SEC,
  TRAINED_MULT,
  TRAINED_N,
  VOYAGER_SEC,
  clampCostFactor,
  dustGoal,
  energyCap,
  albumHas,
  albumKey,
  levelFactor,
  minPicks,
  offerableAt,
  pickInto,
  rarityRank,
  rarityUnlockPicks,
  upgradeCost,
} from './economy';

/** 3: Cofre dos Proibidos no lugar do Atlas (spec 040, etapa 15). 7: itens e geradores novos, progresso zerado (spec 043). */
export const SAVE_VERSION = 7;
/** Valor de "nunca tocou": negativo e finito, para o save continuar sendo JSON válido. */
const NEVER = -1e9;

export interface GameObject {
  id: number;
  kind: ObjectKind;
  bornAt: number;
  expiresAt: number;
  /** Só na Estrela Dourada: o que ela faz ao ser pega. */
  power?: RareEffect;
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
  /** Carimbo do relógio em que foi cumprida (`NEVER` antes); a próxima missão chega `MISSION_NEXT_DELAY_SEC` depois. */
  doneAt: number;
}

export interface PendingChoice {
  offers: string[];
  /** Raridade com que cada carta oferecida vem (spec 042); `offers` guarda só o grimório. */
  rarities?: Record<string, GrimoireRarity>;
  openedAt: number;
  /** 1º passo da escolha em dois passos (seção 4.7): marcar a carta; o 2º passo confirma. */
  selected: string | null;
  /** Quantas escolhas ainda faltam nesta barra cheia (2 com a Nebulosa de Órion). */
  picksLeft: number;
  rerollsLeft: number;
  /** Trocas já feitas nesta oferta (a "primeira troca grátis" da árvore vale uma por oferta). */
  rerolled?: number;
}

/** Estado de uma habilidade ativa na vida (tempos no relógio do jogo; zeram ao colapsar). */
export interface SkillRun {
  /** Quando volta a ficar pronta (carga cheia). */
  readyAt: number;
  /** Até quando está ligada (Autoclick, Dobra, Lente, Ímã, Piloto); 0 se não dura. */
  activeUntil: number;
  /** Cargas que restam (Pulso e Autoclick podem ter mais de uma). */
  charges: number;
}

/** Compra automática: liga/desliga e o limite de preço (% da poeira por compra). Vale em todas as vidas. */
export interface AutoBuyState {
  on: boolean;
  limit: number;
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
  /** Grimório -> ganho acumulado (o número que escala os efeitos; cada nível vale o passo da raridade em que foi pego). */
  buildGain: Record<string, number>;
  /** Grimório -> maior raridade que já se tem dele (0 comum a 3 lendário). */
  buildRarity: Record<string, number>;
  clicks: number;
  combo: number;
  lastPressAt: number;
  /** Desde quando o combo está no máximo sem cair (carimbo do relógio; `NEVER` fora do máximo). */
  comboFullSince: number;
  boostUntil: number;
  boostMult: number;
  /** Polaris: o próximo toque depois de capturar um objeto vale mais. */
  afterCapture: boolean;
  /** Aquecimento: desde quando a pessoa toca sem parar (`NEVER` parada). */
  warmSince: number;
  /** Hora de pico: os geradores rendem mais até este carimbo. */
  peakUntil: number;
  /** Rajada: quando os geradores soltam os próximos segundos de produção (`null` até a 1ª conta). */
  nextBurstAt: number | null;
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
  /** Quando a próxima Estrela Dourada nasce; `null` até o jogo marcar a primeira. */
  nextRareAt: number | null;
  /** Surto dos geradores (Estrela Dourada): até quando valem cheios e com o teto x3. */
  surgeUntil: number;
  mission: MissionState | null;
  // Contadores da vida que o marco do colapso lê (spec 040, seção 2); zeram no colapso.
  /** Objetos capturados na vida (qualquer tipo). */
  captured: number;
  /** Estrelas Douradas capturadas na vida. */
  rares: number;
  /** Toques seguidos agora com o combo ligado (cada um dentro da janela do anterior) e o melhor da vida. */
  chain: number;
  chainBest: number;
  /** Maior tempo seguido, em segundos, com o combo no máximo, nesta vida. */
  fullBest: number;
  /** Missões da estação cumpridas na vida. */
  missionsDone: number;
  // Contadores da vida que os nós de Sorte e Exploração leem (etapa 20); zeram no colapso.
  /** Trocas de carta e descartes de oferta já gastos da cota da vida. */
  rerollsUsed: number;
  discardsUsed: number;
  /** Capturas desde que o radar zerou (o lendário nasce ao encher). */
  radar: number;
  /** Eventos já começados nesta vida (o "Grande evento" vale para o 1º). */
  eventsStarted: number;
  /** O Destino já foi usado nesta vida. */
  destinyUsed: boolean;
  /** Habilidades ativas usadas na vida e a Compra automática (etapa 19). */
  skills: Record<string, SkillRun>;
  autoBuy: AutoBuyState;
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
  /** Cofre dos Proibidos: proibido -> nível (1 a 5). Todos os que estão aqui ficam ativos (spec 040, seção 3). */
  vault: Record<string, number>;
  /** Selos Estelares: colapsos em que não sobrou proibido para escolher (spec 040, seção 3). */
  seals: number;
  collapses: number;
  regionId: string;
  /** Grimório favorito (pesa o dobro no sorteio); só depois de o Favorito abrir, no 2º colapso. */
  favorite: string | null;
  seenUnlocks: string[];
  /**
   * Cintilas (spec 040, seção 5): `legacy` é o que os Fragmentos antigos valiam (migração 1:1); o resto do saldo vem das
   * fontes que o save já guarda (`sparks.ts`). Só o gasto é um contador.
   */
  sparks: { legacy: number; spent: number };
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
  // Contadores das conquistas ampliadas e das fontes de Cintilas (spec 040, etapa 16); saves antigos entram com 0.
  /** Objetos raros capturados (Estrela Dourada e Sonda) e os tipos de objeto já capturados. */
  raresCaptured: number;
  capturedKinds: string[];
  /** Maior sequência de toques seguidos com o combo ligado, em qualquer vida. */
  chainBest: number;
  missionsDone: number;
  /** Eventos raros já vistos (a 1ª vez de cada um rende Cintila). */
  eventsSeen: string[];
  /** Maior nível de um gerador, compras de melhoria e o máximo de melhorias de toque numa vida. */
  genBest: number;
  upgradesBought: number;
  touchBest: number;
  /** Ofertas de grimório abertas, ofertas com lendário ou proibido, e se a 1ª oferta do jogo já tinha um (0 ou 1). */
  offers: number;
  legendaryOffers: number;
  firstOfferLegendary: number;
  /** Escolhas seguidas de raridade rara ou melhor, o recorde, e trocas de carta. */
  rareStreak: number;
  rareStreakBest: number;
  rerolls: number;
  /** Ofertas abertas desde a última com carta lendária (o pity de lendário da árvore lê isto). */
  sinceLegend: number;
  /** Maior nível já alcançado de cada grimório proibido (a Estrela dos Proibidos lê isto). */
  forbiddenBest: Record<string, number>;
  /** Habilidades da etapa 19 e sequência de dias (ainda não existem): ficam prontas para as conquistas. */
  skillsUsed: string[];
  skillUses: number;
  dayStreakBest: number;
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
  raresCaptured: 0,
  capturedKinds: [],
  chainBest: 0,
  missionsDone: 0,
  eventsSeen: [],
  genBest: 0,
  upgradesBought: 0,
  touchBest: 0,
  offers: 0,
  legendaryOffers: 0,
  firstOfferLegendary: 0,
  rareStreak: 0,
  rareStreakBest: 0,
  rerolls: 0,
  sinceLegend: 0,
  forbiddenBest: {},
  skillsUsed: [],
  skillUses: 0,
  dayStreakBest: 0,
};

/** Contadores zerados, com cópias novas dos que são lista ou mapa. */
export function freshStats(): SaveStats {
  return { ...FRESH_STATS, capturedKinds: [], eventsSeen: [], forbiddenBest: {}, skillsUsed: [] };
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
    buildGain: {},
    buildRarity: {},
    clicks: 0,
    combo: 0,
    lastPressAt: NEVER,
    comboFullSince: NEVER,
    boostUntil: NEVER,
    boostMult: 1,
    afterCapture: false,
    warmSince: NEVER,
    peakUntil: NEVER,
    nextBurstAt: null,
    objects: [],
    nextObjectId: 1,
    nextSpawnAt: null,
    freeRerolls: 0,
    pending: null,
    rngState,
    lastGain: 0,
    event: null,
    nextEventAt: null,
    nextRareAt: null,
    surgeUntil: NEVER,
    mission: null,
    captured: 0,
    rares: 0,
    chain: 0,
    chainBest: 0,
    fullBest: 0,
    missionsDone: 0,
    rerollsUsed: 0,
    discardsUsed: 0,
    radar: 0,
    eventsStarted: 0,
    destinyUsed: false,
    skills: {},
    autoBuy: { on: false, limit: 50 },
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
    ui: { unlocked: [], hints: [], achSeen: 0 },
    storySeen: false,
    run: freshRun(hashSeed(seed)),
    album: [],
    vault: {},
    seals: 0,
    collapses: 0,
    regionId: (REGIONS[0] as RegionDef).id,
    favorite: null,
    seenUnlocks: [],
    sparks: { legacy: 0, spent: 0 },
    tree: {},
    achievements: [],
    stats: freshStats(),
  };
}

// --- Relógio: o jogo parado congela tudo (seção 7.4) ---

/**
 * Avança o relógio até `now`. Um salto maior que `MAX_STEP_SEC` é aba escondida: o tempo não
 * conta como jogado e objetos, boost e combo congelam (os carimbos são empurrados pelo salto).
 * Enquanto uma escolha está aberta o campo também congela, mas o tempo de jogo segue contando.
 */
/** Segundos do intervalo [a, b] em que a habilidade `k` esteve ligada. */
function overlap(k: SkillRun | undefined, a: number, b: number): number {
  if (!k || k.activeUntil <= a) return 0;
  return Math.max(0, Math.min(b, k.activeUntil) - a);
}

/** Toques automáticos do intervalo: o Autoclick (e o Piloto, que o liga) a `cps` toques por segundo, nunca acima do teto. */
function autoclickTouches(run: RunState, sk: SkillStats, a: number, b: number): number {
  const secs = Math.max(overlap(run.skills.autoclick, a, b), overlap(run.skills.autopilot, a, b));
  if (secs <= 0) return 0;
  return Math.min(AUTOCLICK_MAX_CPS, sk.autoclick.cps > 0 ? sk.autoclick.cps : 2) * secs;
}

export function syncClock(state: SaveState, now: number): SaveState {
  const gap = now - state.clock;
  if (!(gap > 0)) return state;
  const hidden = gap > MAX_STEP_SEC;
  const frozen = hidden || state.run.pending !== null;
  let run = frozen ? shiftRun(state.run, gap, hidden) : state.run;
  let stats = state.stats;
  if (!frozen) {
    // Geradores (spec 039): rendem cheio enquanto a pessoa toca e uma fração parada, nunca acima do teto
    // do toque. O teto vale para o ritmo ativo; parado é uma fração dele, então tocar sempre rende mais.
    const rates = autoRates(state);
    const sk = effectiveStats(state);
    // Dobra temporal: o relógio dos geradores anda 2x enquanto dura (só a parte do intervalo em que estava ligada).
    // Decisão do Lucas (23/10/2026): habilidades só poupam toque. Enquanto a pessoa toca (ritmo ativo) o Autoclick e a
    // Dobra não rendem nada a mais; elas valem para quem está parado.
    const touching = state.clock - state.run.lastPressAt <= effectiveStats(state).activeWindowSec;
    const warp = touching ? 0 : overlap(state.run.skills['time-warp'], state.clock, state.clock + gap) / gap;
    const gens = 1 + warp;
    // Autoclick (ou Piloto): toques automáticos até o teto de 6/s, só com o jogo aberto e visível (este ramo nunca roda
    // com a aba escondida: o intervalo escondido é `frozen`). Não contam como toques das conquistas.
    const autoTouches = touching ? 0 : autoclickTouches(state.run, sk.skills, state.clock, state.clock + gap);
    const full = (1 + sk.combo.pointValue * sk.combo.max) * sk.combo.fullMult;
    const autoValue =
      sk.dustPerTouch * (sk.skills.autoclick.combo && sk.combo.enabled ? full : 1) * (state.clock < state.run.boostUntil ? state.run.boostMult : 1);
    const earn = (rates.dust * gens * gap + autoTouches * autoValue) * dustEventMult(state.run, state.clock + gap);
    const energyEarn = (rates.energy * gens * gap + autoTouches * sk.energyPerTouch) * energyMult(state.run, state.clock + gap);
    if (earn > 0 || energyEarn > 0) {
      run = {
        ...run,
        dust: clampNum(run.dust + earn),
        dustLife: clampNum(run.dustLife + earn),
        energy: clampNum(run.energy + energyEarn),
      };
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

/**
 * O que os geradores rendem por segundo agora: poeira e energia, e se estão "tocando" (cheios) ou parados.
 * Uma só conta para o motor (`syncClock`) e para a tela (o número que sobe e as órbitas).
 */
export function autoRates(state: SaveState): { dust: number; energy: number; active: boolean; surge: boolean } {
  const st = effectiveStats(state);
  const run = state.run;
  const surge = state.clock < run.surgeUntil;
  const active = surge || state.clock - run.lastPressAt <= st.activeWindowSec;
  // Sem teto e sem fração parada (spec 043): o que o gerador diz que rende é o que rende. O Surto da Estrela Dourada triplica.
  const mult = surge ? SURGE_CAP_MULT : 1;
  return { dust: st.autoDustPerSec * mult, energy: st.autoEnergyPerSec * mult, active, surge };
}

function shiftRun(run: RunState, gap: number, shiftPending: boolean): RunState {
  return {
    ...run,
    lastPressAt: run.lastPressAt + gap,
    comboFullSince: run.comboFullSince + gap,
    boostUntil: run.boostUntil + gap,
    warmSince: run.warmSince > NEVER / 2 ? run.warmSince + gap : run.warmSince,
    peakUntil: run.peakUntil + gap,
    nextBurstAt: run.nextBurstAt === null ? null : run.nextBurstAt + gap,
    nextSpawnAt: run.nextSpawnAt === null ? null : run.nextSpawnAt + gap,
    nextEventAt: run.nextEventAt === null ? null : run.nextEventAt + gap,
    nextRareAt: run.nextRareAt === null ? null : run.nextRareAt + gap,
    surgeUntil: run.surgeUntil + gap,
    event: run.event ? { ...run.event, until: run.event.until + gap } : null,
    mission: run.mission && run.mission.done ? { ...run.mission, doneAt: run.mission.doneAt + gap } : run.mission,
    objects: run.objects.map((o) => ({ ...o, bornAt: o.bornAt + gap, expiresAt: o.expiresAt + gap })),
    skills: Object.fromEntries(Object.entries(run.skills).map(([id, k]) => [id, { ...k, readyAt: k.readyAt + gap, activeUntil: k.activeUntil > 0 ? k.activeUntil + gap : 0 }])),
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
  /** Poeira de um toque sem combo, nth e boost (ainda com decimais). */
  dustPerTouch: number;
  /** Poeira por segundo dos geradores com o jogador tocando (já com marcos), antes do teto. */
  autoDustPerSec: number;
  /** Energia por segundo dos geradores de energia com o jogador tocando, antes do teto. */
  autoEnergyPerSec: number;
  /** Tetos do ganho automático: fração do que os toques rendem no ritmo normal. */
  autoDustCap: number;
  autoEnergyCap: number;
  /** Chance de um toque render `mult` vezes (determinística por toque). */
  crit: { chance: number; mult: number };
  /** Quanto tempo depois de um toque os geradores contam como "tocando", e que fração rendem parados. */
  activeWindowSec: number;
  idleFactor: number;
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
  /** Números da árvore que o motor lê fora de `Effect` (eco, capa, largada). */
  tree: TreeStats;
  /** Sorte e Exploração da árvore (etapa 20). */
  luck: LuckStats;
  explore: ExploreStats;
  /** Habilidades ativas e automações da árvore (etapa 19). */
  skills: SkillStats;
  /** Melhorias de gerador e Aquecimento (spec 039). */
  perks: { warm: boolean; peak: boolean; burst: boolean; bulkDiscount: number };
  /** Cada melhoria comprada devolve a poeira de tantos toques. */
  buyRefundTouches: number;
  startDust: number;
  energyStepFactor: number;
  /** `energy`: energia somada quando a regra dispara (número, não % da barra). */
  nth: { n: number; mult: number; energy: number }[];
  objects: {
    disabled: boolean;
    /** Janela do próximo objeto comum: nasce num instante entre `spawnMinSec` e `spawnMaxSec` depois do anterior. */
    spawnMinSec: number;
    spawnMaxSec: number;
    /** Cada toque encurta a espera do próximo objeto em tantos segundos. */
    spawnCutPerTouch: number;
    /** Estrela Dourada: janela entre uma e outra (com o corte dos grimórios) e quanto fica no campo. */
    rareMinSec: number;
    rareMaxSec: number;
    rareLifeSec: number;
    maxOnField: number;
    lifeSec: Record<ObjectKind, number>;
    /** Recompensa de cada objeto em toques: `dust` (poeira de toques) e `energy` (energia de toques). */
    reward: Record<ObjectKind, { dust: number; energy: number }>;
    signalMult: number;
    signalSec: number;
    onCaptureEnergyTouches: number;
    afterCaptureMult: number;
  };
  choice: { cards: number; picks: number; rerolls: number; repeatLevels: number; noCommon: boolean; rarityBoost: number; discards: number };
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
  return {
    comet: value,
    'shooting-star': value,
    satellite: value,
    asteroid: value,
    probe: value,
    golden: value,
    'legend-comet': value,
    'legend-pulsar': value,
    'legend-nebula': value,
    'legend-wormhole': value,
  };
}

const statsCache = new WeakMap<
  number[],
  { build: RunState['build']; buildGain: RunState['buildGain']; vault: SaveState['vault']; seals: number; tree: SaveState['tree']; collapses: number; stats: EffectiveStats }
>();

/** Junta melhorias, grimórios, Cofre dos Proibidos e árvore. Memoizada: o estado é imutável. */
export function effectiveStats(state: SaveState): EffectiveStats {
  const key = state.run.upgradeLevels;
  const hit = statsCache.get(key);
  if (
    hit &&
    hit.build === state.run.build &&
    hit.buildGain === state.run.buildGain &&
    hit.vault === state.vault &&
    hit.seals === state.seals &&
    hit.tree === state.tree &&
    hit.collapses === state.collapses
  ) {
    return hit.stats;
  }
  const stats = computeStats(state);
  statsCache.set(key, {
    build: state.run.build,
    buildGain: state.run.buildGain,
    vault: state.vault,
    seals: state.seals,
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

function collectSources(state: SaveState): { sources: Source[] } {
  const sources: Source[] = [];
  for (const [id, lvl] of Object.entries(state.run.build)) {
    const g = grimoireById(id);
    if (!g) continue;
    const gain = state.run.buildGain[id] ?? levelFactor(lvl);
    sources.push({ effects: g.effects, gain, price: 1, count: gain, forbidden: false });
  }
  // Cofre dos Proibidos: todos os que a pessoa tem valem ao mesmo tempo, com os números do nível (já escalados);
  // `forbidden: true` deixa o ramo Horizonte de Eventos da árvore reforçar o ganho e cortar o preço deles.
  for (const [id, lvl] of Object.entries(state.vault)) {
    const effects = forbiddenEffects(id, lvl);
    if (effects.length > 0) sources.push({ effects, gain: 1, price: 1, count: 1, forbidden: true });
  }
  // Árvore (spec 040, seção 6): os nós de poder direto e a força dos proibidos entram como uma fonte só.
  const treeEffects = treeSourceEffects(state.tree);
  if (treeEffects.length > 0) sources.push({ effects: treeEffects, gain: 1, price: 1, count: 1, forbidden: false });
  return { sources };
}

/** Poeira fixa por toque que a árvore soma: Sintonia (por nível de proibido) e Constelação (por ramo com 5 nós). */
function treeFlatDust(state: SaveState, ts: TreeStats): number {
  const vaultLevels = Object.values(state.vault).reduce((a, b) => a + b, 0);
  return ts.attunePerForbiddenLevel * vaultLevels + ts.constellationPerBranch * branchesWith(state.tree, CONSTELLATION_MIN_NODES);
}

function computeStats(state: SaveState): EffectiveStats {
  const { sources } = collectSources(state);

  // Buracos negros e a árvore reforçam o ganho dos proibidos e cortam o preço deles.
  let forbiddenPower = 0;
  let priceCut = 0;
  for (const src of sources) {
    for (const e of src.effects) {
      if (e.kind === 'forbiddenPower') {
        forbiddenPower += e.pct;
        priceCut += e.priceCutPct;
      }
    }
  }
  priceCut = Math.min(90, priceCut);

  const ownedOf = (rarity: Rarity): number =>
    rarity === 'forbidden' ? 0 : Object.keys(state.run.build).filter((id) => (state.run.buildRarity[id] ?? 0) === rarityRank(rarity)).length;

  let dustPct = 0;
  let dustFlat = 0;
  let dustMult = 1;
  let comboFullDust = 0;
  let comboFullEnergy = 0;
  let comboFullMult = 1;
  let energyPct = 0;
  let energyFlat = 0;
  let lifeAdd = 0;
  let energyMult = 1;
  let maxAdd = 0;
  let satAdd = 0;
  let comboMaxAdd = 0;
  let windowPct = 0;
  let windowSecAdd = 0;
  let windowMult = 1;
  let stepPct = 0;
  let startDust = 0;
  let freeSat = 0;
  let genPct = 0;
  let energyGenPct = 0;
  let activeWindowAdd = 0;
  let idleAdd = 0;
  let spawnCutSec = 0;
  let rareCutSec = 0;
  let rareLifeAdd = 0;
  let refund = 0;
  let onCapture = 0;
  let afterCaptureMult = 1;
  let disabled = false;
  const costFactors: number[] = [];
  const nth: EffectiveStats['nth'] = [];
  const choice = { cards: 0, picks: 0, rerolls: 0, repeatLevels: 0, noCommon: false, rarityBoost: 0, discards: 0 };
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
        case 'dustFlat':
          dustFlat += e.add * s;
          break;
        case 'energyFlat':
          energyFlat += e.add * s;
          break;
        case 'energyPerCollapse':
          energyFlat += state.collapses * e.add * s;
          break;
        case 'objectLife':
          lifeAdd += e.sec * s;
          break;
        case 'fieldSlots':
          maxAdd += Math.min(3, Math.floor(e.add * src.count));
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
        case 'noCommon':
          choice.noCommon = true;
          break;
        case 'rarityBoost':
          choice.rarityBoost += e.add * s;
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
          if (e.upgrade === 'satellite') freeSat += Math.floor(e.levels * src.count);
          break;
        case 'buyRefund':
          refund += e.touches * s;
          break;
        case 'choiceExtra':
          // Efeitos de contagem não crescem com o nível e a página arredonda o poder (60%): Caranguejo e Betelgeuse
          // ficam, mas a escolha dupla de Órion não, porque de graça em toda vida ela dobraria os grimórios.
          // Com a raridade (spec 042) a contagem cresce; os tetos impedem que um Lendário vire 4 trocas ou 5 cartas de graça.
          choice.rerolls += Math.min(4, Math.round((e.reroll ?? 0) * src.count));
          choice.picks += Math.floor((e.picks ?? 0) * src.count);
          choice.repeatLevels += Math.round((e.repeatLevels ?? 0) * src.count);
          choice.cards += Math.min(2, Math.round((e.cards ?? 0) * src.count));
          choice.discards += Math.min(2, Math.round((e.discard ?? 0) * src.count));
          break;
        case 'onCapture':
          onCapture += e.energyTouches * s;
          break;
        case 'afterCaptureMult':
          afterCaptureMult *= m(e.mult);
          break;
        case 'dustPerGrimoire':
          dustFlat += Object.keys(state.run.build).length * e.add * s;
          break;
        case 'dustPerOwned':
          dustFlat += ownedOf(e.rarity) * e.add * s;
          break;
        case 'dustPerCollapse':
          dustFlat += state.collapses * e.add * s;
          break;
        case 'generatorPct':
          genPct += e.pct * s;
          break;
        case 'energyGenPct':
          energyGenPct += e.pct * s;
          break;
        case 'activeWindow':
          activeWindowAdd += e.sec * s;
          break;
        case 'idleFloor':
          idleAdd += e.add * s;
          break;
        case 'spawnCut':
          spawnCutSec += e.sec * s;
          break;
        case 'rareCut':
          rareCutSec += e.sec * s;
          break;
        case 'rareLife':
          rareLifeAdd += e.sec * s;
          break;
        case 'forbiddenPower':
          break;
      }
    }
  }

  // Itens (spec 043): só 5 efeitos simples. Todos os comprados valem ao mesmo tempo.
  let itemTouchAdd = 0;
  let itemTouchMult = 1;
  let itemEnergyMult = 1;
  let itemGenMult = 1;
  let itemEnergyGenMult = 1;
  for (const def of UPGRADES) {
    if (def.kind !== 'item' || !def.item || level(state, def.id) <= 0) continue;
    switch (def.item.type) {
      case 'touchAdd':
        itemTouchAdd += def.item.value;
        break;
      case 'touchMult':
        itemTouchMult *= def.item.value;
        break;
      case 'energyMult':
        itemEnergyMult *= def.item.value;
        break;
      case 'genMult':
        itemGenMult *= def.item.value;
        break;
      case 'energyGenMult':
        itemEnergyGenMult *= def.item.value;
        break;
    }
  }

  // Geradores de poeira e de energia: sem teto, sem condição. O que a tela mostra é o que rende.
  let autoDust = 0;
  let autoEnergyTouches = 0;
  for (const def of UPGRADES) {
    if (def.kind !== 'generator' && def.kind !== 'energy') continue;
    const n = level(state, def.id) + (def.id === 'satellite' ? freeSat : 0);
    if (n <= 0) continue;
    const rate = (def.perSec ?? 0) * n;
    if (def.kind === 'generator') autoDust += rate;
    else autoEnergyTouches += rate;
  }

  const costFactor = clampCostFactor(costFactors.reduce((a, b) => a * b, 1));
  const ts = treeStats(state.tree);
  const luck = luckStats(state.tree);
  const explore = exploreStats(state.tree);

  // O combo saiu do jogo (spec 043): nenhum item o liga, então ele fica desligado. O código segue dormente.
  const comboMax = Math.min(COMBO_HARD_CAP, Math.max(0, Math.floor(COMBO_BASE_MAX + comboMaxAdd)));
  const windowSec = (COMBO_BASE_WINDOW_SEC + windowSecAdd) * (1 + windowPct / 100) * windowMult;

  // Selo Estelar: poeira fixa por toque, por selo (spec 040, seção 3).
  const flat = itemTouchAdd + dustFlat + state.seals * SEAL_DUST_PER_TOUCH + treeFlatDust(state, ts);
  const dustPerTouch = (1 + flat) * itemTouchMult * Math.max(0, 1 + dustPct / 100) * dustMult;

  const energyPerTouch = (BASE_ENERGY_PER_TOUCH + energyFlat) * itemEnergyMult * Math.max(0, 1 + energyPct / 100) * energyMult;

  const spawnFactor = 1;
  const spawnCut = Math.max(0, spawnCutSec);
  const rareCut = Math.max(0, rareCutSec + luck.goldCutSec);
  const autoMult = Math.max(0, 1 + genPct / 100) * itemGenMult;
  const energyGenMult = Math.max(0, 1 + energyGenPct / 100) * itemEnergyGenMult;

  const life = emptyByKind(0);
  const reward = {} as Record<ObjectKind, { dust: number; energy: number }>;
  for (const def of OBJECTS) {
    const k = def.kind;
    life[k] = Math.max(1, (def.lifeSec + lifeAdd) * (1 + lifePct[k] / 100));
    reward[k] = { dust: 0, energy: 0 };
  }
  // A Estrela Dourada não tem recompensa fixa: o efeito dela vem de `GameObject.power` (ver `objectPreview`).
  life.golden = RARE_LIFE_SEC + Math.max(0, rareLifeAdd);
  reward.golden = { dust: 0, energy: 0 };
  // Lendários (etapa 20): só nascem pelo Radar ou por evento; a vida e a recompensa vêm do catálogo.
  for (const def of LEGENDARY_OBJECTS) {
    life[def.kind] = def.lifeSec;
    reward[def.kind] = { dust: def.dustTouches * explore.legendRewardMult, energy: def.energyTouches * explore.legendRewardMult };
  }
  reward.comet.dust = OBJECT_REWARD.cometTouches + rewardAdd.comet;
  reward.asteroid.dust = OBJECT_REWARD.asteroidTouches + rewardAdd.asteroid;
  reward.asteroid.energy = OBJECT_REWARD.asteroidEnergyTouches;
  reward['shooting-star'].energy = OBJECT_REWARD.starEnergyTouches + rewardAdd['shooting-star'];
  reward.satellite.dust = rewardAdd.satellite;
  const signalMult = OBJECT_REWARD.satelliteMult + satAdd;
  const signalSec = Math.max(1, OBJECT_REWARD.satelliteSec);

  return {
    dustPerTouch,
    autoDustPerSec: autoDust * autoMult,
    autoEnergyPerSec: autoEnergyTouches * energyPerTouch * energyGenMult,
    autoDustCap: Infinity,
    autoEnergyCap: Infinity,
    crit: { chance: 0, mult: 1 },
    activeWindowSec: ACTIVE_WINDOW_SEC + activeWindowAdd,
    idleFactor: Math.min(IDLE_FACTOR_MAX, IDLE_FACTOR + Math.max(0, idleAdd)),
    energyPerTouch,
    combo: {
      enabled: false,
      max: comboMax,
      windowSec,
      pointValue: COMBO_BONUS_PER_POINT,
      fullDustAdd: comboFullDust,
      fullEnergyAdd: comboFullEnergy,
      fullMult: comboFullMult,
    },
    costFactor,
    tree: ts,
    luck,
    explore,
    skills: skillStats(state.tree),
    perks: { warm: false, peak: false, burst: false, bulkDiscount: 0 },
    buyRefundTouches: refund,
    startDust: Math.floor(startDust),
    energyStepFactor: Math.max(0.1, 1 + stepPct / 100),
    nth,
    objects: {
      disabled,
      spawnMinSec: Math.max(SPAWN_FLOOR_MIN_SEC, SPAWN_MIN_SEC * spawnFactor - spawnCut),
      spawnMaxSec: Math.max(SPAWN_FLOOR_MAX_SEC, SPAWN_MAX_SEC * spawnFactor - spawnCut),
      spawnCutPerTouch: 0,
      rareMinSec: Math.max(RARE_MIN_INTERVAL_SEC, RARE_INTERVAL_SEC * (1 - RARE_INTERVAL_JITTER) - rareCut),
      rareMaxSec: Math.max(RARE_MIN_INTERVAL_SEC, RARE_INTERVAL_SEC * (1 + RARE_INTERVAL_JITTER) - rareCut),
      rareLifeSec: RARE_LIFE_SEC + Math.max(0, rareLifeAdd),
      maxOnField: explore.objectSlots > 0 ? Math.min(OBJECT_SLOTS_CAP, OBJECT_BASE_MAX + maxAdd + explore.objectSlots) : OBJECT_BASE_MAX + maxAdd,
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
      noCommon: choice.noCommon,
      rarityBoost: choice.rarityBoost,
      discards: choice.discards,
    },
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
const OBJECT_EFFECTS = new Set<Effect['kind']>([
  'objectLife',
  'fieldSlots',
  'objectReward',
  'objectDuration',
  'satelliteMult',
  'onCapture',
  'afterCaptureMult',
  'maxObjects',
  'spawnCut',
  'rareCut',
  'rareLife',
]);

/**
 * O grimório faz algo AGORA com o que a pessoa tem? Um grimório de combo sem o Ritmo Firme, de geradores sem
 * nenhum gerador ou de objetos antes de os objetos abrirem não rende nada, então a escolha não o oferece
 * (spec 039, seção 7). Basta um efeito útil; os efeitos "de preço" dos proibidos não contam.
 */
export function grimoireUseful(state: SaveState, g: GrimoireDef): boolean {
  const objects = objectsOpen(state);
  const useful = (e: Effect): boolean => {
    if (OBJECT_EFFECTS.has(e.kind)) {
      if (!objects) return false;
      if (e.kind === 'objectReward' && e.target !== 'all') {
        const def = OBJECTS.find((o) => o.kind === e.target);
        return def !== undefined && def.unlockedAtCollapse <= state.collapses;
      }
      return true;
    }
    return true;
  };
  return g.effects.some((e) => !e.price && useful(e));
}

/** As raridades em que o grimório pode sair agora: já liberadas pelas escolhas e que ainda cabem no teto e na regra "nunca menor". */
function offerableRarities(state: SaveState, g: GrimoireDef): GrimoireRarity[] {
  return GRIMOIRE_RARITIES.filter((r) => state.run.picks >= rarityUnlockPicks(r, state.collapses) && offerableAt(state.run, g.id, r));
}

/** As cartas que podem sair agora: abertas, com alguma raridade possível e fora de `exclude`. */
function offerCandidates(state: SaveState, exclude: readonly string[]): GrimoireDef[] {
  return unlockedContent(state).grimoires.filter((g) => !exclude.includes(g.id) && offerableRarities(state, g).length > 0);
}

export interface Draw {
  offers: string[];
  rarities: Record<string, GrimoireRarity>;
  rngState: number;
}

export function drawGrimoires(state: SaveState, exclude: readonly string[] = [], count?: number): Draw {
  const stats = effectiveStats(state);
  // Eclipse (evento da árvore): cada oferta traz uma carta extra enquanto dura.
  // 4ª carta (árvore): vale em toda 6ª oferta de grimórios (e sempre no Cofre); o Eclipse soma uma carta enquanto dura.
  const fourth = stats.luck.fourthCard && (state.stats.offers + 1) % FOURTH_CARD_EVERY === 0 ? 1 : 0;
  const want = count ?? stats.choice.cards + fourth + (activeEventId(state, state.clock) === 'eclipse' ? 1 : 0);
  const candidates = offerCandidates(state, exclude);
  // Só o que rende agora; se faltar carta para a escolha, completa com o resto (nunca abre vazia).
  const usable = candidates.filter((g) => grimoireUseful(state, g));
  let open = usable.length >= want ? usable : [...usable, ...candidates.filter((g) => !usable.includes(g))];

  const favorite = mechanicOpen('favorite', state.collapses) ? state.favorite : null;
  // Sorte (árvore): pesos somados em PONTOS à tabela 100/24/9/3, e cada raro seguido pesa mais no próximo.
  const luck = stats.luck;
  const streakBonus = luck.rareStreak ? Math.min(RARE_STREAK_CAP, state.stats.rareStreak) * RARE_STREAK_STEP : 0;
  const weightOf = (r: Rarity): number =>
    RARITY_WEIGHT[r] +
    (r === 'epic' || r === 'legendary' ? stats.choice.rarityBoost : 0) +
    (r === 'rare' ? luck.rareWeight + streakBonus : r === 'epic' ? luck.epicWeight : r === 'legendary' ? luck.legendWeight : 0);
  let rng = state.run.rngState;
  const offers: string[] = [];
  const rarities: Record<string, GrimoireRarity> = {};
  while (offers.length < want && open.length > 0) {
    // Primeiro o grimório (a raridade não muda a chance de um grimório aparecer), depois a raridade dele.
    const weight = (c: GrimoireDef) => (c.id === favorite ? FAVORITE_WEIGHT : 1);
    let pick: number;
    [pick, rng] = nextRandom(rng);
    let left = pick * open.reduce((sum, c) => sum + weight(c), 0);
    let card = open[open.length - 1] as GrimoireDef;
    for (const c of open) {
      left -= weight(c);
      if (left < 0) {
        card = c;
        break;
      }
    }
    let options = offerableRarities(state, card);
    if (stats.choice.noCommon && options.some((r) => r !== 'common')) options = options.filter((r) => r !== 'common');
    const total = options.reduce((sum, r) => sum + weightOf(r), 0);
    let roll: number;
    [roll, rng] = nextRandom(rng);
    let acc = roll * total;
    let rarity = options[options.length - 1] as GrimoireRarity;
    for (const r of options) {
      acc -= weightOf(r);
      if (acc < 0) {
        rarity = r;
        break;
      }
    }
    offers.push(card.id);
    rarities[card.id] = rarity;
    open = open.filter((c) => c.id !== card.id);
  }
  return { offers, rarities, rngState: rng };
}

export const FOURTH_CARD_EVERY = 6;

const RARE_STREAK_CAP = 6;
const RARE_STREAK_STEP = 0.25;

/**
 * Garante que a oferta tenha uma carta de raridade `min` ou melhor (pity, Garantia, Fortuna e Destino da árvore):
 * sobe a raridade da carta mais comum da oferta; se ela não puder, tenta as outras. Raridade que a vida ainda não
 * liberou nunca é forçada. Sem candidata, a oferta fica como está.
 */
function ensureRarity(state: SaveState, draw: Draw, min: GrimoireRarity): Draw {
  const rank = (r: GrimoireRarity): number => rarityRank(r);
  const { offers, rarities } = draw;
  if (offers.some((o) => rank(rarities[o] as GrimoireRarity) >= rank(min))) return draw;
  const byWorst = [...offers].sort((a, b) => rank(rarities[a] as GrimoireRarity) - rank(rarities[b] as GrimoireRarity));
  for (const id of byWorst) {
    const def = grimoireById(id);
    if (!def) continue;
    const options = offerableRarities(state, def).filter((r) => rank(r) >= rank(min));
    if (options.length > 0) return { ...draw, rarities: { ...rarities, [id]: options[0] as GrimoireRarity } };
  }
  return draw;
}

/** Ofertas que faltam para o lendário garantido do pity (0 = a próxima oferta traz), ou `null` sem o nó. */
export function pityLeft(state: SaveState): number | null {
  const luck = effectiveStats(state).luck;
  if (!luck.pityOn) return null;
  return Math.max(0, Math.max(PITY_MIN, PITY_BASE - luck.pityCut) - state.stats.sinceLegend - 1);
}

/** O mesmo save com o grimório `id` pego na raridade `rarity` (a da carta oferecida), só para comparar números. */
export function withPick(state: SaveState, id: string, rarity: GrimoireRarity = 'common'): SaveState {
  return { ...state, run: { ...state.run, ...pickInto(state.run, id, rarity) } };
}

/** Raridade com que a carta `id` está sendo oferecida na escolha aberta (comum se não houver). */
export function offeredRarity(state: SaveState, id: string): GrimoireRarity {
  return state.run.pending?.rarities?.[id] ?? 'common';
}

/** Abre a escolha se a barra encheu. Devolve o estado com `pending` e a energia travada no teto. */
function openChoiceIfFull(state: SaveState, now: number): SaveState {
  const run = state.run;
  if (run.pending) return state;
  const stats = effectiveStats(state);
  const cap = energyCap(run.picks, stats.energyStepFactor);
  if (run.energy < cap) return state;
  return openChoice(state, now, stats.choice.picks, stats.choice.rerolls + run.freeRerolls, cap, true);
}

/**
 * `fresh`: a barra encheu agora (e não é a 2ª escolha da mesma barra). Só aí valem a Mão cheia e as Duas escolhas
 * da árvore, e a Garantia, o pity, a Fortuna e o Destino mexem na oferta.
 */
function openChoice(state: SaveState, now: number, picksLeft: number, rerollsLeft: number, energy: number, fresh = false): SaveState {
  const stats = effectiveStats(state);
  const luck = stats.luck;
  let drawn = drawGrimoires(state);
  const rngState = drawn.rngState;
  const n = state.stats.offers + 1;
  let destinyUsed = state.run.destinyUsed;
  if (fresh && drawn.offers.length > 0) {
    const pity = luck.pityOn && state.stats.sinceLegend + 1 >= Math.max(PITY_MIN, PITY_BASE - luck.pityCut);
    if (pity || (luck.legendEvery > 0 && n % luck.legendEvery === 0)) drawn = ensureRarity(state, drawn, 'legendary');
    if (luck.epicEvery > 0 && n % luck.epicEvery === 0) drawn = ensureRarity(state, drawn, 'epic');
    // Destino: uma vez por vida (depois das 3 primeiras escolhas) a oferta traz pelo menos uma carta rara ou melhor.
    if (luck.destiny && !destinyUsed && state.run.picks >= DESTINY_FROM_PICKS) {
      drawn = ensureRarity(state, drawn, 'rare');
      destinyUsed = true;
    }
  }
  const { offers, rarities } = drawn;
  if (offers.length === 0) {
    // Nada para oferecer (tudo no nível máximo): a barra só zera, sem travar o jogo.
    return { ...state, run: { ...state.run, energy: 0, rngState } };
  }
  const legendary = offers.some((o) => rarities[o] === 'legendary');
  const topLegend = legendary;
  const extraPick = fresh && ((luck.handFull && state.run.picks === 0) || (luck.doublePickEvery > 0 && n % luck.doublePickEvery === 0));
  return awardAchievements({
    ...state,
    run: {
      ...state.run,
      energy,
      freeRerolls: 0,
      rngState,
      destinyUsed,
      pending: { offers, rarities, openedAt: now, selected: null, picksLeft: picksLeft + (extraPick ? 1 : 0), rerollsLeft, rerolled: 0 },
    },
    stats: {
      ...state.stats,
      offers: state.stats.offers + 1,
      sinceLegend: topLegend ? 0 : state.stats.sinceLegend + 1,
      legendaryOffers: state.stats.legendaryOffers + (legendary ? 1 : 0),
      firstOfferLegendary: state.stats.firstOfferLegendary || (state.stats.offers === 0 && legendary ? 1 : 0),
    },
  });
}

const DESTINY_FROM_PICKS = 8;

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
  const rarity: GrimoireRarity = p.rarities?.[id] ?? 'common';
  // Repetir em dobro (árvore): a cada N escolhas a repetição sobe 1 nível a mais.
  const bonus = stats.luck.repeatEvery > 0 && (s.run.picks + 1) % stats.luck.repeatEvery === 0 ? 1 : 0;
  const book = pickInto(s.run, id, rarity, current === 0 ? 1 : stats.choice.repeatLevels + bonus);
  const nextLevel = book.build[id] ?? current;
  const run: RunState = {
    ...s.run,
    ...book,
    picks: s.run.picks + 1,
    pending: null,
  };
  const streak = rarity !== 'common' ? s.stats.rareStreak + 1 : 0;
  const forbiddenBest = s.stats.forbiddenBest;
  const next: SaveState = bumpMissionState(
    {
      ...s,
      run,
      album: s.album.includes(albumKey(id, rarity)) ? s.album : [...s.album, albumKey(id, rarity)],
      stats: {
        ...s.stats,
        picks: s.stats.picks + 1,
        bestLevel: Math.max(s.stats.bestLevel, nextLevel),
        rareStreak: streak,
        rareStreakBest: Math.max(s.stats.rareStreakBest, streak),
        forbiddenBest,
      },
    },
    'pick',
    now,
  );
  if (p.picksLeft > 1) {
    const nextStats = effectiveStats(next);
    return awardAchievements(openChoice(next, now, p.picksLeft - 1, nextStats.choice.rerolls, run.energy));
  }
  return awardAchievements({ ...next, run: { ...next.run, energy: 0 } });
}

/** Trocas que ainda dá para fazer nesta oferta: as da oferta e o que resta da cota da vida. */
export function rerollsAvailable(state: SaveState): number {
  const p = state.run.pending;
  if (!p) return 0;
  const luck = effectiveStats(state).luck;
  return p.rerollsLeft + Math.max(0, luck.rerolls - state.run.rerollsUsed);
}

/** Descartes de oferta que ainda restam na vida (Segunda chance da árvore). */
export function discardsLeft(state: SaveState): number {
  const stats = effectiveStats(state);
  return Math.max(0, stats.luck.discards + stats.choice.discards - state.run.discardsUsed);
}

/**
 * Betelgeuse, a Sonda Voyager e os Rerolls da árvore: troca uma das cartas oferecidas por outra que não esteja na oferta.
 * Ordem do gasto: as trocas da própria oferta e, por último, a cota da vida.
 */
export function rerollGrimoire(state: SaveState, id: string, now: number): SaveState {
  const s = syncClock(state, now);
  const p = s.run.pending;
  if (!p || !p.offers.includes(id) || rerollsAvailable(s) <= 0) return s;
  const drawn = drawGrimoires(s, p.offers, 1);
  const { offers, rngState } = drawn;
  const replacement = offers[0];
  if (replacement === undefined) return s;
  const fromOffer = p.rerollsLeft > 0;
  const fromBank = !fromOffer;
  return awardAchievements({
    ...s,
    run: {
      ...s.run,
      rngState,
      rerollsUsed: s.run.rerollsUsed + (fromBank ? 1 : 0),
      pending: {
        ...p,
        offers: p.offers.map((o) => (o === id ? replacement : o)),
        rarities: { ...Object.fromEntries(Object.entries(p.rarities ?? {}).filter(([k]) => k !== id)), [replacement]: drawn.rarities[replacement] as GrimoireRarity },
        selected: p.selected === id ? null : p.selected,
        rerollsLeft: p.rerollsLeft - (fromOffer ? 1 : 0),
        rerolled: (p.rerolled ?? 0) + 1,
      },
    },
    stats: { ...s.stats, rerolls: s.stats.rerolls + 1 },
  });
}

/** Segunda chance (árvore): joga fora a oferta inteira e sorteia outra, sem contar como oferta nova. */
export function discardOffer(state: SaveState, now: number): SaveState {
  const s = syncClock(state, now);
  const p = s.run.pending;
  if (!p || discardsLeft(s) <= 0 || choiceLockRemaining(s, now) > 0) return s;
  const { offers, rarities, rngState } = drawGrimoires(s, p.offers);
  if (offers.length === 0) return s;
  return {
    ...s,
    run: {
      ...s.run,
      rngState,
      discardsUsed: s.run.discardsUsed + 1,
      pending: { ...p, offers, rarities, selected: null, openedAt: now },
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
  // Alinhamento (evento da árvore): o combo não cai enquanto dura.
  const kept = stats.combo.enabled && (now - run.lastPressAt <= stats.combo.windowSec || (eventOn(run, now, 'alignment') && run.combo > 0));
  const combo = kept ? Math.min(stats.combo.max, run.combo + 1) : 0;

  const full = stats.combo.enabled && stats.combo.max > 0 && combo >= stats.combo.max;
  // Aquecimento: tocando sem parar há `WARM_AFTER_SEC`, o toque rende mais; soltar por `WARM_RELEASE_SEC` zera.
  const warmSince = now - run.lastPressAt > WARM_RELEASE_SEC || run.warmSince < NEVER / 2 ? now : run.warmSince;
  const warm = stats.perks.warm && now - warmSince >= WARM_AFTER_SEC;
  let value = (stats.dustPerTouch + (full ? stats.combo.fullDustAdd : 0)) * (1 + stats.combo.pointValue * combo) * (warm ? WARM_MULT : 1);
  if (full) value *= stats.combo.fullMult;
  let bonusEnergy = full ? stats.combo.fullEnergyAdd : 0;
  for (const rule of stats.nth) {
    if (clicks % rule.n === 0) {
      value *= rule.mult;
      bonusEnergy += rule.energy;
    }
  }
  // Eco do colapso: os primeiros toques da vida nova rendem várias vezes mais.
  if (clicks <= stats.tree.echoTouches) value *= stats.tree.echoMult;
  if (run.afterCapture) value *= stats.objects.afterCaptureMult;
  if (now < run.boostUntil) value *= run.boostMult;
  // Toque de Sorte: sorteio por toque derivado do contador, para não mexer no `rngState` das cartas.
  if (stats.crit.chance > 0 && nextRandom((run.rngState + Math.imul(clicks, 0x9e3779b1)) | 0)[0] < stats.crit.chance) {
    value *= stats.crit.mult;
  }
  value *= dustEventMult(run, now);
  const gain = clampNum(Math.max(1, Math.floor(clampNum(value))));

  const fullSince = full ? (run.comboFullSince > NEVER / 2 ? run.comboFullSince : now) : NEVER;
  // Sequência do combo (marco da vida): sem teto no nível, ao contrário de `combo`, que para no máximo.
  const chain = stats.combo.enabled ? (kept ? run.chain + 1 : 1) : 0;
  const next: SaveState = {
    ...s,
    run: {
      ...run,
      comboFullSince: fullSince,
      chain: Math.min(chain, 1e6),
      chainBest: Math.max(run.chainBest, Math.min(chain, 1e6)),
      fullBest: full ? Math.max(run.fullBest, now - fullSince) : run.fullBest,
      dust: clampNum(run.dust + gain),
      dustLife: clampNum(run.dustLife + gain),
      energy: clampNum(run.energy + (stats.energyPerTouch + bonusEnergy) * energyMult(run, now)),
      clicks,
      combo,
      lastPressAt: now,
      warmSince,
      afterCapture: false,
      lastGain: gain,
      nextSpawnAt:
        run.nextSpawnAt !== null && stats.objects.spawnCutPerTouch > 0
          ? Math.max(now, run.nextSpawnAt - stats.objects.spawnCutPerTouch)
          : run.nextSpawnAt,
    },
    stats: {
      ...s.stats,
      clicks: s.stats.clicks + 1,
      dustTotal: clampNum(s.stats.dustTotal + gain),
      comboMaxHits: s.stats.comboMaxHits + (full ? 1 : 0),
      comboFullBest: full ? Math.max(s.stats.comboFullBest, now - fullSince) : s.stats.comboFullBest,
      chainBest: Math.max(s.stats.chainBest, Math.min(chain, 1e6)),
    },
  };
  return awardAchievements(openChoiceIfFull(bumpMissionState(next, 'touch', now), now));
}

// --- Melhorias ---

/** Por que um item ou gerador não está à venda, ou `null` se está. */
export type UpgradeLock =
  | { kind: 'collapse'; collapse: number }
  /** Já aparece na prateleira (nome, efeito e preço), mas falta comprar o item de antes: a escada é na ordem. */
  | { kind: 'order'; before: string }
  /** Ainda não chegou à prateleira: faltam comprar os itens de antes. */
  | { kind: 'shelf' };

/** Quantos itens a prateleira mostra à frente do próximo (o objetivo que dá vontade de chegar lá). */
export const ITEM_PREVIEW_AHEAD = 2;

/** Os itens (ou geradores) do tipo que já existem neste colapso, na ordem do preço. */
function shelfOf(state: SaveState, kind: UpgradeKind): number[] {
  const out: number[] = [];
  UPGRADES.forEach((d, i) => {
    if (d.kind === kind && d.unlockedAtCollapse <= state.collapses) out.push(i);
  });
  return out.sort((a, b) => (UPGRADES[a] as UpgradeDef).base - (UPGRADES[b] as UpgradeDef).base || a - b);
}

/** O próximo item a comprar (o primeiro da escada que ainda não foi comprado), ou `null` se a escada acabou. */
export function nextItemIndex(state: SaveState): number | null {
  const same = shelfOf(state, 'item');
  const next = same.find((i) => (state.run.upgradeLevels[i] ?? 0) <= 0);
  return next ?? null;
}

/**
 * O que a prateleira mostra: os itens comprados, o próximo e os `ITEM_PREVIEW_AHEAD` seguintes (esmaecidos). Nos
 * geradores, só o primeiro que ainda não está completo (mais os completos).
 */
export function upgradeOnShelf(state: SaveState, index: number): boolean {
  const def = UPGRADES[index];
  if (!def) return false;
  const same = shelfOf(state, def.kind);
  const pos = same.indexOf(index);
  if (pos < 0) return false;
  if (def.kind === 'generator' || def.kind === 'energy') {
    const firstOpen = same.find((i) => (state.run.upgradeLevels[i] ?? 0) < (UPGRADES[i] as UpgradeDef).max);
    // Os completos continuam na prateleira (aba Comprados); um gerador comprado fora da ordem não é válido.
    return index === firstOpen || (state.run.upgradeLevels[index] ?? 0) >= def.max;
  }
  if ((state.run.upgradeLevels[index] ?? 0) > 0) return true;
  const next = nextItemIndex(state);
  if (next === null) return false;
  return pos <= same.indexOf(next) + ITEM_PREVIEW_AHEAD;
}

/** O que falta para o item ou gerador ser comprado (`null` = à venda). Só depende do estado, nunca do relógio. */
export function upgradeLock(state: SaveState, index: number): UpgradeLock | null {
  const def = UPGRADES[index];
  if (!def) return { kind: 'collapse', collapse: Infinity };
  if (def.unlockedAtCollapse > state.collapses) return { kind: 'collapse', collapse: def.unlockedAtCollapse };
  if (!upgradeOnShelf(state, index)) return { kind: 'shelf' };
  if (def.kind === 'item' && (state.run.upgradeLevels[index] ?? 0) <= 0) {
    const next = nextItemIndex(state);
    if (next !== null && next !== index) return { kind: 'order', before: (UPGRADES[next] as UpgradeDef).id };
  }
  return null;
}

export function upgradeAvailable(state: SaveState, index: number): boolean {
  return upgradeLock(state, index) === null;
}

/** Linha do painel de melhorias: à venda, escondida ("???") ou fora da prateleira. */
export interface UpgradeUnlockInfo {
  index: number;
  id: string;
  unlocked: boolean;
  /** Fora da prateleira (colapso futuro ou ainda longe): a tela nem a lista. */
  hidden: boolean;
  lock: UpgradeLock | null;
}

export function upgradeUnlocks(state: SaveState): UpgradeUnlockInfo[] {
  return UPGRADES.map((def, index) => {
    const lock = upgradeLock(state, index);
    return { index, id: def.id, unlocked: lock === null, hidden: lock?.kind === 'collapse' || lock?.kind === 'shelf', lock };
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

/**
 * Completar: compra de uma vez todos os níveis que faltam do gerador (no mínimo 2). Se não der para pagar tudo, não compra nada.
 */
export function buyUpgradeBatch(state: SaveState, index: number): SaveState {
  const total = batchCost(state, index);
  if (total === null || state.run.dust < total) return state;
  const def = UPGRADES[index] as UpgradeDef;
  const lvl = state.run.upgradeLevels[index] ?? 0;
  const take = def.max - lvl;
  const upgradeLevels = state.run.upgradeLevels.slice();
  upgradeLevels[index] = def.max;
  return awardAchievements({
    ...state,
    run: { ...state.run, dust: clampNum(state.run.dust - total), upgradeLevels },
    stats: {
      ...state.stats,
      upgradesBought: state.stats.upgradesBought + take,
      genBest: Math.max(state.stats.genBest, upgradeLevels[index] ?? 0),
    },
  });
}

/** Níveis que o lote compra (os que faltam), ou 0 se não há lote. */
export function batchLevels(state: SaveState, index: number): number {
  const def = UPGRADES[index];
  if (!def || (def.kind !== 'generator' && def.kind !== 'energy')) return 0;
  if (!upgradeAvailable(state, index)) return 0;
  const left = def.max - (state.run.upgradeLevels[index] ?? 0);
  return left >= BULK_MIN ? left : 0;
}

/** Custo do lote (a soma dos níveis que faltam), ou `null` se não há lote. */
export function batchCost(state: SaveState, index: number): number | null {
  const take = batchLevels(state, index);
  if (take === 0) return null;
  const def = UPGRADES[index] as UpgradeDef;
  const lvl = state.run.upgradeLevels[index] ?? 0;
  const factor = effectiveStats(state).costFactor;
  let total = 0;
  for (let k = 0; k < take; k++) total += upgradeCost(def, lvl + k, factor);
  return total;
}

export function buyUpgrade(state: SaveState, index: number): SaveState {
  const cost = nextUpgradeCost(state, index);
  if (cost === null || state.run.dust < cost) return state;
  const upgradeLevels = state.run.upgradeLevels.slice();
  upgradeLevels[index] = (upgradeLevels[index] ?? 0) + 1;
  // Ceres e Saturno: a compra devolve a poeira de alguns toques (nunca mais que o preço).
  const refund = Math.min(cost, Math.floor(effectiveStats(state).buyRefundTouches * effectiveStats(state).dustPerTouch));
  const def = UPGRADES[index] as UpgradeDef;
  const touchOwned = UPGRADES.reduce((n, u, i) => n + (u.kind === 'item' && (upgradeLevels[i] ?? 0) > 0 ? 1 : 0), 0);
  return awardAchievements({
    ...state,
    run: { ...state.run, dust: clampNum(state.run.dust - cost + refund), upgradeLevels },
    stats: {
      ...state.stats,
      upgradesBought: state.stats.upgradesBought + 1,
      genBest: def.kind === 'item' ? state.stats.genBest : Math.max(state.stats.genBest, upgradeLevels[index] ?? 0),
      touchBest: Math.max(state.stats.touchBest, touchOwned),
    },
  });
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

const RADAR_KEEP_SHARE = 0.25;

export function isLegendary(kind: ObjectKind): boolean {
  return (LEGENDARY_KINDS as readonly string[]).includes(kind);
}

/** O lendário que nasce: prefere um que a pessoa ainda não capturou (as conquistas pedem todos). */
function pickLegendary(state: SaveState, roll: number): ObjectKind {
  const fresh = LEGENDARY_KINDS.filter((k) => !state.stats.capturedKinds.includes(k));
  const from = fresh.length > 0 ? fresh : LEGENDARY_KINDS;
  return from[Math.min(from.length - 1, Math.floor(roll * from.length))] as ObjectKind;
}

// --- Eventos e missões (spec 038, 5.4) ---

/** O evento que está valendo agora, ou `null`. */
export function activeEventId(state: SaveState, now: number): EventId | null {
  const e = state.run.event;
  return e && now < e.until ? e.id : null;
}

function eventOn(run: RunState, now: number, id: string): boolean {
  return run.event?.id === id && now < run.event.until;
}

function energyMult(run: RunState, now: number): number {
  return (eventOn(run, now, 'solar-storm') ? SOLAR_STORM_ENERGY_MULT : 1) * (eventOn(run, now, 'energy-tide') ? EVENT_DOUBLE : 1);
}

/** Chuva de ouro: todo ganho de poeira vale o dobro. */
function dustEventMult(run: RunState, now: number): number {
  return eventOn(run, now, 'gold-rain') ? EVENT_DOUBLE : 1;
}

const EVENT_DOUBLE = 2;

/**
 * Sorteio dos eventos e da missão: sai do tempo de jogo e do colapso, não do `rngState` da vida,
 * para não mexer na sequência das cartas (o simulador e os saves antigos seguem iguais).
 */
function sideRoll(now: number, collapses: number, salt: number): number {
  return nextRandom(Math.floor(now * 1000) * 31 + collapses * 7919 + salt)[0];
}

/** Próximo início de evento: o intervalo base com ±`EVENT_JITTER`, encurtado pelos Eventos frequentes da árvore. */
function nextEventTime(now: number, collapses: number, freq = 0): number {
  return now + EVENT_INTERVAL_SEC * (1 + (sideRoll(now, collapses, 1) * 2 - 1) * EVENT_JITTER) * (1 - Math.min(0.6, freq));
}

/** Duração de um evento que começa agora (o 1º da vida vale mais com o Grande evento). */
export function eventDuration(state: SaveState, id: EventId, first: boolean): number {
  const ex = effectiveStats(state).explore;
  const treeId = (TREE_EVENT_IDS as readonly string[]).includes(id) ? (id as TreeEventId) : null;
  const base = treeId ? ex.events[treeId].sec : EVENT_DURATION_SEC + ex.eventDurationAdd;
  return base * (first ? ex.grandMult : 1);
}

/**
 * Encerra o evento vencido, marca o próximo e, na hora, começa um evento. Os eventos da árvore (Chuva de ouro,
 * Alinhamento, Maré de energia e Eclipse) entram no sorteio com a chance do nó; o resto vai para os eventos do colapso.
 */
function tickEvents(state: SaveState, run: RunState, now: number): RunState {
  const open = eventsOpen(state.collapses);
  const ex = effectiveStats(state).explore;
  const treeEvents = TREE_EVENT_IDS.filter((id) => ex.events[id].chance > 0);
  if (open.length === 0 && treeEvents.length === 0) return run;
  let next = run;
  if (next.event && now >= next.event.until) next = { ...next, event: null };
  if (next.nextEventAt === null) return { ...next, nextEventAt: nextEventTime(now, state.collapses, ex.eventFreq) };
  if (next.event === null && now >= next.nextEventAt) {
    const total = treeEvents.reduce((sum, id) => sum + ex.events[id].chance, 0);
    const roll = sideRoll(now, state.collapses, 2);
    let chosen: EventId | null = null;
    let acc = 0;
    for (const id of treeEvents) {
      acc += ex.events[id].chance;
      if (roll * Math.max(100, total) < acc) {
        chosen = id;
        break;
      }
    }
    if (chosen === null && open.length > 0) {
      const baseRoll = treeEvents.length === 0 ? roll : sideRoll(now, state.collapses, 4);
      chosen = open[Math.min(open.length - 1, Math.floor(baseRoll * open.length))] as EventId;
    }
    if (chosen === null) return { ...next, nextEventAt: nextEventTime(now, state.collapses, ex.eventFreq) };
    const dur = eventDuration(state, chosen, next.eventsStarted === 0);
    return {
      ...next,
      event: { id: chosen, until: now + dur },
      eventsStarted: next.eventsStarted + 1,
      nextEventAt: nextEventTime(now + dur, state.collapses, ex.eventFreq),
    };
  }
  return next;
}

/**
 * A missão da estação: sorteada quando a mecânica está aberta e a vida ainda não tem uma. Cumprida a missão, a
 * próxima chega `MISSION_NEXT_DELAY_SEC` depois (o marco "missões da estação" pede várias na mesma vida).
 */
function assignMission(state: SaveState, run: RunState, now: number): RunState {
  if (!mechanicOpen('missions', state.collapses)) return run;
  const cur = run.mission;
  if (cur && !(cur.done && now >= cur.doneAt + MISSION_NEXT_DELAY_SEC)) return run;
  const roll = sideRoll(state.playSeconds, state.collapses, 3 + run.missionsDone * 11);
  let index = Math.min(ASSIGNABLE_MISSIONS.length - 1, Math.floor(roll * ASSIGNABLE_MISSIONS.length));
  // Nunca a mesma missão duas vezes seguidas.
  if (cur && (ASSIGNABLE_MISSIONS[index] as MissionDef).id === cur.id) index = (index + 1) % ASSIGNABLE_MISSIONS.length;
  const def = ASSIGNABLE_MISSIONS[index] as MissionDef;
  return { ...run, mission: { id: def.id, progress: 0, done: false, doneAt: NEVER } };
}

function bumpMission(run: RunState, metric: MissionDef['metric'], now: number): RunState {
  const m = run.mission;
  if (!m || m.done) return run;
  const def = missionById(m.id);
  if (!def || def.metric !== metric) return run;
  const progress = Math.min(def.target, m.progress + 1);
  const done = progress >= def.target;
  return {
    ...run,
    mission: { id: m.id, progress, done, doneAt: done ? now : NEVER },
    missionsDone: run.missionsDone + (done ? 1 : 0),
  };
}

/** `bumpMission` no estado inteiro: a missão cumprida também entra no total da conta (conquistas). */
function bumpMissionState(state: SaveState, metric: MissionDef['metric'], now: number): SaveState {
  const run = bumpMission(state.run, metric, now);
  if (run === state.run) return state;
  const done = run.missionsDone - state.run.missionsDone;
  return { ...state, run, stats: done > 0 ? { ...state.stats, missionsDone: state.stats.missionsDone + done } : state.stats };
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
function tickObjectsCore(state: SaveState, now: number): SaveState {
  const s = syncClock(state, now);
  const run = s.run;
  const pinned = pinsFirstObject(s);
  const alive = pinned ? run.objects : run.objects.filter((o) => o.expiresAt > now);
  let next: RunState = alive.length === run.objects.length ? run : { ...run, objects: alive };
  if (run.pending) return next === run ? s : { ...s, run: next };

  const afterEvents = tickEvents(s, next, now);
  const eventStarted = afterEvents.event !== null && next.event === null;
  next = assignMission(s, afterEvents, now);
  const stats = effectiveStats(s);
  // Nada de objeto antes da 1ª melhoria (spec 038, 4.5): o começo é só toque, melhoria e grimório.
  if (stats.objects.disabled || !objectsOpen(s)) return next === run ? s : { ...s, run: next };
  // Lendários (etapa 20): só com o Radar da árvore, e só depois do tutorial. Nascem quando o contador de capturas
  // enche, ou no começo da Chuva de ouro e do Eclipse.
  const ex = stats.explore;
  if (ex.radarOn && s.tutorial === 'done') {
    const onField = next.objects.filter((o) => isLegendary(o.kind)).length;
    const full = next.radar >= ex.radarThreshold;
    const byEvent = eventStarted && (next.event?.id === 'gold-rain' || next.event?.id === 'eclipse');
    if ((full || byEvent) && onField < ex.legendMax) {
      const roll = nextRandom((next.rngState + Math.imul(next.nextObjectId + 5, 0xc2b2ae35)) | 0)[0];
      const kind = pickLegendary(s, roll);
      next = {
        ...next,
        objects: [...next.objects, { id: next.nextObjectId, kind, bornAt: now, expiresAt: now + stats.objects.lifeSec[kind] }],
        nextObjectId: next.nextObjectId + 1,
        radar: full ? (ex.radarKeep ? Math.ceil(ex.radarThreshold * RADAR_KEEP_SHARE) : 0) : next.radar,
      };
    }
  }
  // Estrela Dourada (spec 039, seção 8): bem mais rara que os comuns, só fora do tutorial e com o jogo aberto.
  if (s.tutorial === 'done') {
    const rareRoll = (salt: number) => nextRandom((next.rngState + Math.imul(next.nextObjectId + salt, 0x85ebca6b)) | 0)[0];
    const rareGap = () => stats.objects.rareMinSec + (stats.objects.rareMaxSec - stats.objects.rareMinSec) * rareRoll(7);
    if (next.nextRareAt === null) {
      next = { ...next, nextRareAt: now + rareGap() };
    } else if (now >= next.nextRareAt && !next.objects.some((o) => o.kind === 'golden')) {
      const power = RARE_EFFECTS[Math.floor(rareRoll(13) * RARE_EFFECTS.length)] as RareEffect;
      const golden: GameObject = { id: next.nextObjectId, kind: 'golden', bornAt: now, expiresAt: now + stats.objects.lifeSec.golden, power };
      next = { ...next, objects: [...next.objects, golden], nextObjectId: next.nextObjectId + 1, nextRareAt: now + rareGap() };
    }
  }
  const shower = next.event?.id === 'meteor-shower' && now < next.event.until;
  // Janela do próximo objeto comum (spec 039, seção 8); o 1º do tutorial vem logo. O sorteio da janela não
  // usa o `rngState` das cartas, só um derivado dele e do número do objeto.
  const roll = nextRandom((next.rngState + Math.imul(next.nextObjectId + 1, 0x9e3779b1)) | 0)[0];
  const window = pinned ? FIRST_OBJECT_DELAY_SEC : stats.objects.spawnMinSec + (stats.objects.spawnMaxSec - stats.objects.spawnMinSec) * roll;
  const interval = shower ? Math.min(METEOR_SHOWER_INTERVAL_SEC, window) : window;
  const room = pinned ? 1 : stats.objects.maxOnField + (shower ? METEOR_SHOWER_EXTRA_MAX : 0);
  if (next.nextSpawnAt === null) {
    next = { ...next, nextSpawnAt: now + interval };
  } else if (shower && next.nextSpawnAt > now + interval) {
    // A chuva começa na hora, sem esperar o intervalo normal que já estava marcado.
    next = { ...next, nextSpawnAt: now };
  } else if (now >= next.nextSpawnAt && next.objects.filter((o) => o.kind !== 'golden' && !isLegendary(o.kind)).length < room) {
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

/** Passa o tempo, faz nascer objetos e abre a escolha se os geradores de energia encheram a barra. */
export function tickObjects(state: SaveState, now: number): SaveState {
  const next = openChoiceIfFull(tickObjectsCore(state, now), now);
  // Primeira vez que cada evento raro aparece: vira Cintila e conquista (spec 040, 5.1).
  const ev = next.run.event?.id;
  if (ev && !next.stats.eventsSeen.includes(ev)) {
    return awardAchievements({ ...next, stats: { ...next.stats, eventsSeen: [...next.stats.eventsSeen, ev] } });
  }
  return next;
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
  /** Estrela Dourada: o "sinal" é um Frenesi (toque x7), e o Surto dura `surgeSec` (0 nos demais). */
  frenzy: boolean;
  surgeSec: number;
  freeReroll: boolean;
  /** Buraco de minhoca (lendário): enche a barra de energia na hora. */
  fillsBar?: boolean;
}

/** Poeira da Chuva da Estrela Dourada: 5 min do ritmo normal (toque e geradores, já com o teto). */
function rainAmount(stats: EffectiveStats): number {
  const perSec = stats.dustPerTouch * NOMINAL_TPS + Math.min(stats.autoDustPerSec, stats.autoDustCap);
  return Math.max(1, Math.floor(perSec * RAIN_SEC));
}

export function objectPreview(state: SaveState, kind: ObjectKind, power?: RareEffect): ObjectPreview {
  const { dust, energy } = objectReward(state, kind);
  const all = effectiveStats(state);
  const { objects } = all;
  const signal = kind === 'satellite';
  const rare = kind === 'golden';
  const legend = LEGENDARY_OBJECTS.find((d) => d.kind === kind);
  return {
    dust: rare && power === 'rain' ? Math.floor(rainAmount(all) * all.luck.goldenMult) : dust,
    energy: energy + objects.onCaptureEnergyTouches * all.energyPerTouch,
    boostMult: signal ? objects.signalMult : rare && power === 'frenzy' ? FRENZY_MULT : (legend?.boostMult ?? 0),
    boostSec: signal ? objects.signalSec : rare && power === 'frenzy' ? FRENZY_SEC * all.luck.goldenMult : (legend?.boostSec ?? 0),
    frenzy: rare && power === 'frenzy',
    surgeSec: rare && power === 'surge' ? SURGE_SEC * all.luck.goldenMult : 0,
    freeReroll: kind === 'probe' || legend?.fillsBar === true,
    fillsBar: legend?.fillsBar === true,
  };
}

export function captureObject(state: SaveState, id: number, now: number): SaveState {
  const s = syncClock(state, now);
  const run = s.run;
  if (run.pending) return s;
  const obj = run.objects.find((o) => o.id === id);
  if (!obj || (obj.expiresAt <= now && !pinsFirstObject(s))) return s;

  const stats = effectiveStats(s);
  const base = objectReward(s, obj.kind);
  // Chuva de ouro: todo ganho de poeira vale o dobro, inclusive o dos objetos.
  const reward = { dust: base.dust * dustEventMult(run, now), energy: base.energy };
  const legend = LEGENDARY_OBJECTS.find((d) => d.kind === obj.kind);
  let rainDust = 0;
  const next: RunState = {
    ...run,
    objects: run.objects.filter((o) => o.id !== id),
    // O radar de lendários conta as capturas de objetos comuns e raros (o lendário em si não conta).
    radar: legend ? run.radar : run.radar + 1,
    dust: clampNum(run.dust + reward.dust),
    dustLife: clampNum(run.dustLife + reward.dust),
    energy: clampNum(run.energy + (reward.energy + stats.objects.onCaptureEnergyTouches * stats.energyPerTouch) * energyMult(run, now)),
    afterCapture: stats.objects.afterCaptureMult > 1,
    peakUntil: stats.perks.peak ? now + PEAK_SEC : run.peakUntil,
  };
  if (obj.kind === 'satellite') {
    next.boostUntil = now + stats.objects.signalSec;
    next.boostMult = stats.objects.signalMult;
  } else if (obj.kind === 'probe') {
    next.freeRerolls = run.freeRerolls + 1;
  } else if (legend) {
    if (legend.boostMult && legend.boostSec) {
      next.boostUntil = Math.max(next.boostUntil, now + legend.boostSec);
      next.boostMult = Math.max(next.boostMult, legend.boostMult);
    }
    if (legend.fillsBar) {
      next.energy = energyCap(run.picks, stats.energyStepFactor);
      next.freeRerolls = run.freeRerolls + 1;
    }
  } else if (obj.kind === 'golden') {
    if (obj.power === 'frenzy') {
      next.boostUntil = Math.max(next.boostUntil, now + FRENZY_SEC * stats.luck.goldenMult);
      next.boostMult = Math.max(next.boostMult, FRENZY_MULT);
    } else if (obj.power === 'surge') {
      next.surgeUntil = now + SURGE_SEC * stats.luck.goldenMult;
    } else if (obj.power === 'rain') {
      const rain = Math.floor(rainAmount(stats) * stats.luck.goldenMult * dustEventMult(run, now));
      next.dust = clampNum(next.dust + rain);
      next.dustLife = clampNum(next.dustLife + rain);
      rainDust = rain;
    }
  }
  const satelliteStreak = obj.kind === 'satellite' ? s.stats.satelliteStreak + 1 : 0;
  const rareKind = RARE_OBJECT_KINDS.includes(obj.kind) || LEGENDARY_OBJECT_KINDS.includes(obj.kind);
  const withStats: SaveState = {
    ...s,
    run: { ...next, captured: run.captured + 1, rares: run.rares + (obj.kind === 'golden' ? 1 : 0) },
    stats: {
      ...s.stats,
      raresCaptured: s.stats.raresCaptured + (rareKind ? 1 : 0),
      capturedKinds: s.stats.capturedKinds.includes(obj.kind) ? s.stats.capturedKinds : [...s.stats.capturedKinds, obj.kind],
      objectsCaptured: s.stats.objectsCaptured + 1,
      dustTotal: clampNum(s.stats.dustTotal + reward.dust + rainDust),
      satelliteStreak,
      satelliteBest: Math.max(s.stats.satelliteBest, satelliteStreak),
    },
  };
  return awardAchievements(openChoiceIfFull(bumpMissionState(withStats, 'capture', now), now));
}

// --- Colapso, Atlas e árvore ---

export interface CollapseProgress {
  /** Colapso que esta vida termina (1 = primeiro). */
  next: number;
  dust: number;
  dustGoal: number;
  picks: number;
  minPicks: number;
  /** O marco da vida (terceiro requisito). */
  milestone: MilestoneProgress;
  ready: boolean;
}

/** Os três requisitos do colapso `n` (spec 040, seção 2): poeira da vida, escolhas e o marco que gira. */
export function collapseProgress(state: SaveState): CollapseProgress {
  const k = state.collapses + 1;
  const goal = dustGoal(k);
  const min = minPicks(k);
  const run = state.run;
  const milestone = milestoneProgress(k, state.collapses, run, effectiveStats(state).objects.disabled);
  return {
    next: k,
    dust: run.dustLife,
    dustGoal: goal,
    picks: run.picks,
    minPicks: min,
    milestone,
    ready: run.dustLife >= goal && run.picks >= min && milestone.done && run.pending === null,
  };
}

export function canCollapse(state: SaveState): boolean {
  return collapseProgress(state).ready;
}

/**
 * As opções do Cofre no colapso atual: até `VAULT_OFFER_SIZE` proibidos distintos entre os que ainda não estão no nível 5
 * (spec 040, seção 3). Sai da semente da vida (`rngState`), então é a mesma enquanto a vida não muda; com menos de 3
 * elegíveis, só os que sobram; com nenhum, a lista é vazia e o colapso dá um Selo Estelar.
 */
export function vaultOffers(state: SaveState): string[] {
  const eligible = FORBIDDEN_IDS.filter((id) => (state.vault[id] ?? 0) < FORBIDDEN_MAX_LEVEL);
  // A 4ª carta da árvore vale também na oferta do Cofre, a cada 4 colapsos.
  const size = VAULT_OFFER_SIZE + (effectiveStats(state).luck.fourthCard && (state.collapses + 1) % 4 === 0 ? 1 : 0);
  if (eligible.length <= size) return eligible.slice();
  const pool = eligible.slice();
  const out: string[] = [];
  let rng = state.run.rngState ^ Math.imul(state.collapses + 1, 0x9e3779b1);
  while (out.length < size) {
    let roll: number;
    [roll, rng] = nextRandom(rng);
    out.push(pool.splice(Math.floor(roll * pool.length), 1)[0] as string);
  }
  return out;
}

/**
 * Colapsa a estrela e recomeça do zero. `choice` é um dos proibidos de `vaultOffers` (um que a pessoa já tem sobe 1
 * nível; um novo entra no nível 1); sem opções (todos no nível 5) o colapso dá um Selo Estelar e `choice` é `null`.
 * Sem `choice`, vale a primeira opção (ou o selo). Sem as condições, ou com uma escolha fora das opções, devolve o mesmo estado.
 */
export function collapse(state: SaveState, choice?: string | null): SaveState {
  if (!canCollapse(state)) return state;
  const offers = vaultOffers(state);
  const picked = choice === undefined ? (offers[0] ?? null) : choice;
  if (offers.length === 0 ? picked !== null : picked === null || !offers.includes(picked)) return state;

  const k = state.collapses + 1;
  const vault = picked === null ? state.vault : { ...state.vault, [picked]: (state.vault[picked] ?? 0) + 1 };
  const level = picked === null ? 0 : (vault[picked] as number);
  const stats =
    picked === null
      ? state.stats
      : { ...state.stats, forbiddenBest: { ...state.stats.forbiddenBest, [picked]: Math.max(state.stats.forbiddenBest[picked] ?? 0, level) } };
  const open = REGIONS.filter((r) => r.unlockedAtCollapse <= k);
  const base: SaveState = {
    ...state,
    collapses: k,
    regionId: (open[open.length - 1] as RegionDef).id,
    vault,
    seals: state.seals + (picked === null ? 1 : 0),
    album: picked !== null && !state.album.includes(picked) ? [...state.album, picked] : state.album,
    stats,
    run: { ...freshRun(state.run.rngState), autoBuy: state.run.autoBuy },
    // Cada colapso começa uma vida nova com o tutorial concluído (spec 8.1).
    tutorial: 'done',
  };
  // A poeira inicial (Holmberg 15A, Titã) depende do Cofre novo, por isso a vida nova é montada depois dele.
  // Cartas de capa (árvore): o favorito comum já começa a vida no nível que o nó dá, sem gastar escolha.
  const ts = treeStats(state.tree);
  const fav = state.favorite !== null ? grimoireById(state.favorite) : undefined;
  const covered = ts.coverLevel > 0 && fav && base.album.includes(albumKey(fav.id, 'common'));
  const book = covered ? pickInto(base.run, fav.id, 'common', Math.min(GRIMOIRE_MAX_LEVEL, ts.coverLevel)) : null;
  const seeded: SaveState = { ...base, run: { ...base.run, ...(book ?? {}) } };
  const fx = effectiveStats(seeded);
  // Largada (árvore): a vida começa com um pouco de energia, sempre abaixo de encher a barra.
  const energy = Math.min(fx.tree.warmStartTouches * fx.energyPerTouch, energyCap(0, fx.energyStepFactor) * 0.9);
  return awardAchievements({ ...seeded, run: { ...seeded.run, energy, dust: fx.startDust, dustLife: fx.startDust } });
}

/** Marca (ou, com `null`, desmarca) o favorito. Só depois de o Favorito abrir e só um grimório já descoberto. */
export function setFavorite(state: SaveState, id: string | null): SaveState {
  if (!mechanicOpen('favorite', state.collapses)) return state;
  if (id !== null) {
    const def = grimoireById(id);
    if (!def || def.unlockedAtCollapse > state.collapses || !albumHas(state.album, id)) return state;
  }
  return state.favorite === id ? state : { ...state, favorite: id };
}

/** Rever uma região já aberta (spec 5.4, sem custo): só muda o cenário. */
export function setRegion(state: SaveState, regionId: string): SaveState {
  const def = REGIONS.find((r) => r.id === regionId);
  if (!def || def.unlockedAtCollapse > state.collapses || state.regionId === regionId) return state;
  return { ...state, regionId };
}

export { sparksAvailable };

/** Custo de comprar o próximo nível do nó, ou `null` se não pode (fechado, no máximo, sem pai, sem a árvore aberta). */
export function nodeNextCost(state: SaveState, nodeId: string): number | null {
  if (state.collapses < 1) return null;
  const n = treeNodeById(nodeId);
  if (!n || !nodeLive(n)) return null;
  const lvl = state.tree[nodeId] ?? 0;
  if (lvl >= n.maxLevel || !parentsMet(state.tree, n)) return null;
  return nodeLevelCost(n);
}

/** Compra 1 nível do nó: confere a árvore aberta (1º colapso), a mecânica, os pré-requisitos, o nível máximo e as Cintilas. */
export function buyNode(state: SaveState, nodeId: string): SaveState {
  const cost = nodeNextCost(state, nodeId);
  if (cost === null || sparksAvailable(state) < cost) return state;
  return awardAchievements({
    ...state,
    tree: { ...state.tree, [nodeId]: (state.tree[nodeId] ?? 0) + 1 },
    sparks: { legacy: state.sparks.legacy, spent: state.sparks.spent + cost },
  });
}

/** Compat com a tela atual: o id do nó é o mesmo. */
export const buyTreeNode = buyNode;

/** Só dá para refazer fora de uma vida em andamento: na tela de colapso (estrela pronta) ou com a vida ainda zerada. */
export function canRespec(state: SaveState): boolean {
  if (Object.keys(state.tree).length === 0) return false;
  const r = state.run;
  return canCollapse(state) || (r.clicks === 0 && r.picks === 0 && r.pending === null);
}

/** Refazer a árvore devolve 100% das Cintilas gastas, sem custo (spec 040, 5.3): a moeda é finita e dá para testar builds. */
export function respecTree(state: SaveState): SaveState {
  if (!canRespec(state)) return state;
  return awardAchievements({
    ...state,
    tree: {},
    sparks: { legacy: state.sparks.legacy, spent: 0 },
    stats: { ...state.stats, respecs: state.stats.respecs + 1 },
  });
}

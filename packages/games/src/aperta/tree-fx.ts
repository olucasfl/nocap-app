// Efeitos da árvore que o jogo lê nas etapas de Sorte e Exploração (spec 040, etapa 20). Ficam fora de `tree.ts` para o
// grafo e a lista de nós não mudarem: aqui só se lê o que está comprado e se junta em números.

import { nodeLive, nodeParam, treeNodeById, type TreeNodeDef } from './tree';

type Tree = Readonly<Record<string, number>>;

/** Os eventos que a árvore libera, com o nó que os abre e os nós que alongam a duração. */
export const TREE_EVENT_IDS = ['gold-rain', 'alignment', 'energy-tide', 'eclipse'] as const;
export type TreeEventId = (typeof TREE_EVENT_IDS)[number];

const EVENT_NODE: Record<TreeEventId, { kind: string; long: string }> = {
  'gold-rain': { kind: 'eventGoldRain', long: 'goldRainLong' },
  alignment: { kind: 'eventAlign', long: 'alignLong' },
  'energy-tide': { kind: 'eventTide', long: 'tideLong' },
  eclipse: { kind: 'eventEclipse', long: 'eclipseLong' },
};

export interface LuckStats {
  /** Trocas de uma carta por vida e descartes de oferta por vida. */
  rerolls: number;
  discards: number;
  /** Pesos somados ao sorteio, em pontos (a base é 100/24/9/3). */
  rareWeight: number;
  epicWeight: number;
  legendWeight: number;
  /** Pity de lendário ligado e quantas ofertas ele tira da espera. */
  pityOn: boolean;
  pityCut: number;
  /** A cada N ofertas uma é pelo menos épica / lendária (0 = desligado). */
  epicEvery: number;
  legendEvery: number;
  fourthCard: boolean;
  /** A cada N escolhas, repetir um grimório sobe 1 nível extra (0 = desligado). */
  repeatEvery: number;
  handFull: boolean;
  /** A cada N ofertas escolhe-se 2 cartas (0 = desligado). */
  doublePickEvery: number;
  rareStreak: boolean;
  destiny: boolean;
  goldenMult: number;
  /** Segundos tirados da espera da Estrela Dourada. */
  goldCutSec: number;
}

export interface EventSetup {
  /** Pontos de chance de um sorteio de evento cair neste (0 = o evento não está liberado). */
  chance: number;
  /** Duração em segundos, já com os nós de duração. */
  sec: number;
}

export interface ExploreStats {
  radarOn: boolean;
  /** Capturas para encher o radar. */
  radarThreshold: number;
  radarKeep: boolean;
  legendMax: number;
  legendRewardMult: number;
  objectSlots: number;
  events: Record<TreeEventId, EventSetup>;
  /** Fração a menos de espera entre eventos (0,2 = 20%). */
  eventFreq: number;
  eventDurationAdd: number;
  /** O 1º evento de cada vida dura x vezes mais. */
  grandMult: number;
  starMap: number;
  mapDetail: boolean;
  mapLive: boolean;
  horizon: boolean;
}

export const PITY_BASE = 50;
export const PITY_MIN = 10;
export const RADAR_MIN = 25;
export const OBJECT_SLOTS_CAP = 6;

function owned(tree: Tree): { n: TreeNodeDef; lvl: number }[] {
  const out: { n: TreeNodeDef; lvl: number }[] = [];
  for (const [id, lvl] of Object.entries(tree)) {
    const n = treeNodeById(id);
    if (n && lvl >= 1 && nodeLive(n)) out.push({ n, lvl });
  }
  return out;
}

const minPositive = (cur: number, v: number): number => (v > 0 && (cur === 0 || v < cur) ? v : cur);

export function luckStats(tree: Tree): LuckStats {
  const s: LuckStats = {
    rerolls: 0,
    discards: 0,
    rareWeight: 0,
    epicWeight: 0,
    legendWeight: 0,
    pityOn: false,
    pityCut: 0,
    epicEvery: 0,
    legendEvery: 0,
    fourthCard: false,
    repeatEvery: 0,
    handFull: false,
    doublePickEvery: 0,
    rareStreak: false,
    destiny: false,
    goldenMult: 1,
    goldCutSec: 0,
  };
  for (const { n, lvl } of owned(tree)) {
    const p = (key: string): number => nodeParam(n, key, lvl);
    switch (n.effect.kind) {
      case 'rerolls':
        s.rerolls += p('n');
        break;
      case 'secondChance':
        s.discards += p('n');
        break;
      case 'rareWeight':
        s.rareWeight += p('add');
        break;
      case 'epicWeight':
        s.epicWeight += p('add');
        break;
      case 'legendWeight':
        s.legendWeight += p('add');
        break;
      case 'premiumWeight':
        s.epicWeight += p('add');
        s.legendWeight += p('add');
        break;
      case 'pity':
        s.pityOn = true;
        s.pityCut += p('cut');
        break;
      case 'guarantee':
        s.epicEvery = minPositive(s.epicEvery, p('every'));
        break;
      case 'legendEvery':
        s.legendEvery = minPositive(s.legendEvery, p('every'));
        break;
      case 'fourthCard':
        s.fourthCard = true;
        break;
      case 'repeatBonus':
        s.repeatEvery = minPositive(s.repeatEvery, p('every'));
        break;
      case 'handFull':
        s.handFull = true;
        break;
      case 'doublePick':
        s.doublePickEvery = minPositive(s.doublePickEvery, p('every'));
        break;
      case 'rareStreak':
        s.rareStreak = true;
        break;
      case 'destiny':
        s.destiny = true;
        break;
      case 'goldenBoost':
        s.goldenMult *= p('mult');
        break;
      case 'goldCut':
        s.goldCutSec += p('sec');
        break;
      default:
    }
  }
  return s;
}

export function exploreStats(tree: Tree): ExploreStats {
  const events = Object.fromEntries(TREE_EVENT_IDS.map((id) => [id, { chance: 0, sec: 0 }])) as Record<TreeEventId, EventSetup>;
  const s: ExploreStats = {
    radarOn: false,
    radarThreshold: 0,
    radarKeep: false,
    legendMax: 1,
    legendRewardMult: 1,
    objectSlots: 0,
    events,
    eventFreq: 0,
    eventDurationAdd: 0,
    grandMult: 1,
    starMap: 0,
    mapDetail: false,
    mapLive: false,
    horizon: false,
  };
  let radarBase = 0;
  let radarCut = 0;
  const longs: Record<string, number> = {};
  for (const { n, lvl } of owned(tree)) {
    const p = (key: string): number => nodeParam(n, key, lvl);
    const k = n.effect.kind;
    const ev = TREE_EVENT_IDS.find((id) => EVENT_NODE[id].kind === k);
    if (ev) {
      events[ev].chance = p('chance');
      events[ev].sec = p('sec');
      continue;
    }
    const longOf = TREE_EVENT_IDS.find((id) => EVENT_NODE[id].long === k);
    if (longOf) {
      longs[longOf] = (longs[longOf] ?? 0) + p('sec');
      continue;
    }
    switch (k) {
      case 'radar':
        s.radarOn = true;
        radarBase = p('captures');
        break;
      case 'radarFast':
        radarCut += p('captures');
        break;
      case 'radarKeep':
        s.radarKeep = true;
        break;
      case 'legendMax':
        s.legendMax = Math.max(s.legendMax, p('n'));
        break;
      case 'legendReward':
        s.legendRewardMult *= p('mult');
        break;
      case 'objectSlots':
        s.objectSlots += p('add');
        break;
      case 'eventChance':
        s.eventFreq += p('pct') / 100;
        break;
      case 'eventDuration':
        s.eventDurationAdd += p('sec');
        break;
      case 'eventGrand':
        s.grandMult = Math.max(s.grandMult, p('mult'));
        break;
      case 'starMap':
        s.starMap = Math.max(s.starMap, lvl);
        break;
      case 'starMapDetail':
        s.mapDetail = true;
        break;
      case 'starMapLive':
        s.mapLive = true;
        break;
      case 'horizon':
        s.horizon = true;
        break;
      default:
    }
  }
  s.radarThreshold = s.radarOn ? Math.max(RADAR_MIN, radarBase - radarCut) : 0;
  for (const id of TREE_EVENT_IDS) {
    if (events[id].chance > 0) events[id].sec += (longs[id] ?? 0) + s.eventDurationAdd;
  }
  return s;
}

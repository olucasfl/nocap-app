import {
  ATLAS_SLOT_COLLAPSES,
  COMBO_BONUS_PER_POINT,
  FAMILIES,
  FAMILY_NAMES,
  GRIMOIRES,
  SET_BONUS_THRESHOLDS,
  atlasSlots,
  collapseProgress,
  formatDecimal,
  formatDuration,
  formatNumber,
  type CollapseProgress,
  type GrimoireCategory,
  type ObjectKind,
  type ObjectPreview,
  UPGRADES,
  currentEnergyCap,
  effectiveStats,
  sparksOnCollapse,
  nextUpgradeCost,
  setBonusTier,
  unlockedContent,
  type Family,
  type SaveState,
} from '@nocap/games';
import type { AstroId } from './astros';
import type { Rarity as ArtRarity } from './rarity';
import { SPACE_OBJECT_LABEL, type SpaceObjectKind } from './SpaceObject';

/** Segurar Espaço/Enter repete no máximo isto por segundo (spec 038, 4.1 e decisão 14.20). */
export const HOLD_TOUCHES_PER_SEC = 6;
/** A partir daqui a barra de energia brilha (spec 3.4). */
export const ENERGY_HOT_FROM = 0.85;
/** Quanto tempo a faixa de aviso fica na tela. */
export const NOTICE_MS = 2300;

export type PageName = 'upgrades' | 'grimoires' | 'achievements' | 'tree';

/** Tocar de novo no mesmo botão da dock fecha a página (spec 3.4). */
export function togglePage(current: PageName | null, target: PageName): PageName | null {
  return current === target ? null : target;
}

/**
 * Limitador da repetição por tecla: o primeiro toque sempre vale; o sistema repete a ~30/s, então
 * as repetições só passam se já deu `1000 / HOLD_TOUCHES_PER_SEC` ms desde o último toque aceito.
 */
export function createHoldLimiter(perSec = HOLD_TOUCHES_PER_SEC) {
  const gap = 1000 / perSec;
  let last = -Infinity;
  return {
    allow(repeat: boolean, nowMs: number): boolean {
      if (repeat && nowMs - last < gap - 1e-6) return false;
      last = nowMs;
      return true;
    },
  };
}

export interface EnergyView {
  /** 0 a 1. */
  fill: number;
  hot: boolean;
  /** "12/60": inteiros, como no mockup. */
  label: string;
  value: number;
  cap: number;
}

export function energyView(state: SaveState): EnergyView {
  const cap = Math.max(1, Math.round(currentEnergyCap(state)));
  const value = Math.min(cap, Math.floor(state.run.energy));
  const fill = Math.min(1, Math.max(0, state.run.energy / cap));
  return { fill, hot: fill >= ENERGY_HOT_FROM, label: `${value}/${cap}`, value, cap };
}

/** Quantas melhorias dão para comprar agora (selo do botão Melhorias). */
export function affordableCount(state: SaveState): number {
  let n = 0;
  for (let i = 0; i < UPGRADES.length; i++) {
    const cost = nextUpgradeCost(state, i);
    if (cost !== null && state.run.dust >= cost) n += 1;
  }
  return n;
}

export interface ComboView {
  /** Pontos de combo vivos (0 = sem combo na tela). */
  points: number;
  /** Multiplicador mostrado: 1 + 20% por ponto. */
  mult: number;
}

/**
 * O combo só existe depois da Ressonância de Vênus e some quando a janela passa sem toque
 * (o motor só zera no toque seguinte; a tela não pode esperar por ele).
 */
export function comboView(state: SaveState, now: number): ComboView {
  const combo = effectiveStats(state).combo;
  const alive = combo.enabled && state.run.combo > 0 && now - state.run.lastPressAt <= combo.windowSec;
  const points = alive ? state.run.combo : 0;
  return { points, mult: 1 + COMBO_BONUS_PER_POINT * points };
}

const RARITY_ART: Record<string, ArtRarity> = {
  common: 'comum',
  rare: 'raro',
  epic: 'epico',
  legendary: 'lendario',
  forbidden: 'proibido',
};

/** Raridade do motor (inglês) para a do kit de arte (pt-BR). */
export function artRarity(rarity: string): ArtRarity {
  return RARITY_ART[rarity] ?? 'comum';
}

const GRIMOIRE_ASTRO: Record<string, AstroId> = {
  moon: 'moon',
  mercury: 'mercury',
  venus: 'venus',
  mars: 'mars',
  ceres: 'rock',
  phobos: 'rock',
  io: 'venus',
  vesta: 'rock',
  halley: 'ice',
  uranus: 'ice',
  europa: 'ice',
  titan: 'titan',
  jupiter: 'jupiter',
  saturn: 'saturn',
  neptune: 'neptune',
  ganymede: 'moon',
  pluto: 'ice',
  triton: 'ice',
  sirius: 'star',
  vega: 'starb',
  betelgeuse: 'betel',
  polaris: 'star',
  antares: 'redgiant',
  'crab-nebula': 'nebula',
  'orion-nebula': 'nebula',
  'milky-way': 'galaxy',
  andromeda: 'galaxy',
  'sagittarius-a': 'hole',
  'cygnus-x1': 'hole',
  m87: 'hole',
};

const FAMILY_ASTRO: Record<Family, AstroId> = {
  planets: 'mars',
  moons: 'moon',
  'small-bodies': 'rock',
  stars: 'star',
  nebulae: 'nebula',
  'black-holes': 'hole',
};

/** Medalha de um grimório do catálogo; os do catálogo futuro caem na medalha da família. */
export function astroFor(id: string, family: Family): AstroId {
  return GRIMOIRE_ASTRO[id] ?? FAMILY_ASTRO[family];
}

/** Toques ignorados nos primeiros ms depois de abrir um modal: o dedo ainda estava no botão (spec 4.7). */
export const MODAL_OPEN_GUARD_MS = 300;

export interface AlbumEntry {
  id: string;
  name: string;
  text: string;
  family: Family;
  /** O que o grimório ajuda (toque, objetos, geradores, energia e sorte). */
  category: GrimoireCategory;
  rarity: ArtRarity;
  /** Já descoberto neste save (o álbum guarda para sempre, a vida não). */
  discovered: boolean;
  /** Nível na vida atual (0 = ainda não pego nesta vida). */
  level: number;
  /** É o favorito do sorteio (spec 5.4, colapso 2). */
  favorite: boolean;
}

export interface AlbumView {
  entries: AlbumEntry[];
  discovered: number;
  total: number;
}

/**
 * Álbum da página de Grimórios: só os grimórios já liberados pelos colapsos, na ordem do catálogo.
 * Os não descobertos viram "???": o nome e o efeito só saem do catálogo depois da primeira escolha.
 */
export function albumView(state: SaveState): AlbumView {
  const open = unlockedContent(state).grimoires;
  const entries = open.map((g): AlbumEntry => {
    const discovered = state.album.includes(g.id);
    return {
      id: g.id,
      name: discovered ? g.name : '???',
      text: discovered ? g.text : 'Ainda escondido no espaço',
      family: g.family,
      category: g.category,
      rarity: artRarity(g.rarity),
      discovered,
      level: state.run.build[g.id] ?? 0,
      favorite: state.favorite === g.id,
    };
  });
  return { entries, discovered: entries.filter((e) => e.discovered).length, total: entries.length };
}

/** Verdadeiro enquanto o modal acabou de abrir e o toque ainda deve ser ignorado. */
export function modalGuarded(openedAtMs: number, nowMs: number): boolean {
  return nowMs - openedAtMs < MODAL_OPEN_GUARD_MS;
}

// --- Objetos no espaço (spec 038, 4.5) ---

const OBJECT_ART: Record<ObjectKind, SpaceObjectKind> = {
  comet: 'comet',
  'shooting-star': 'meteor',
  satellite: 'satellite',
  asteroid: 'asteroid',
  probe: 'probe',
  golden: 'golden',
};

/** O motor chama de `shooting-star`; o kit de arte, de `meteor`. */
export function objectArt(kind: ObjectKind): SpaceObjectKind {
  return OBJECT_ART[kind];
}

export function objectName(kind: ObjectKind): string {
  return SPACE_OBJECT_LABEL[OBJECT_ART[kind]];
}

/** "+120 poeira", "+2 energia", "Sinal forte x2 por 8 s": o que o objeto entrega (etiqueta e aviso). */
export function rewardText(p: ObjectPreview): string {
  const parts: string[] = [];
  if (p.dust > 0) parts.push(`+${formatNumber(p.dust)} poeira`);
  if (p.energy > 0) parts.push(`+${formatDecimal(p.energy, 1)} energia`);
  if (p.boostMult > 0) parts.push(`${p.frenzy ? 'Frenesi' : 'Sinal forte'} x${formatDecimal(p.boostMult, 1)} por ${Math.round(p.boostSec)} s`);
  if (p.surgeSec > 0) parts.push(`Geradores a todo vapor por ${Math.round(p.surgeSec)} s`);
  if (p.freeReroll) parts.push('1 troca grátis');
  return parts.join(' e ');
}

/** Texto curto que sobe do lugar da captura (cabe na faixa do campo no celular). */
export function floatText(p: ObjectPreview): string {
  return rewardText(p).replace(/ por \d+ s/, '');
}

/** "Cometa capturado", "Estrela cadente capturada". */
export function capturedTitle(kind: ObjectKind): string {
  return `${objectName(kind)} ${kind === 'shooting-star' || kind === 'golden' ? 'capturada' : 'capturado'}`;
}

export interface ObjectSlot {
  /** Posição no campo, em %. */
  x: number;
  y: number;
  /** Deriva lenta (px) e o tempo de um vai e vem (s). */
  dx: number;
  dy: number;
  drift: number;
}

/** Vagas do campo: 0 cima/esquerda, 1 baixo/direita, 2 cima/direita, 3 baixo/esquerda; 4 a 7 repetem as quatro na fileira de dentro. */
export const OBJECT_LANES = 8;

/**
 * Onde o objeto flutua, derivado do id e da vaga (sem sorteio na tela, sem mexer no rng do save). As quatro
 * primeiras vagas ficam uma em cada canto, longe do botão central: nenhum objeto cobre outro nem encavala a
 * etiqueta da recompensa. A 5ª a 8ª usam a fileira de dentro, mais perto do botão. A faixa de baixo para em
 * 80% da altura do campo para a etiqueta (até 3 linhas) não ir parar embaixo do dock.
 */
export function objectSlot(id: number, lane: number = id % 4): ObjectSlot {
  const h = (id * 2654435761) >>> 0;
  const corner = lane % 4;
  const top = corner === 0 || corner === 2;
  const left = corner === 0 || corner === 3;
  const inner = lane >= 4 ? 1 : 0;
  const jitter = (h >>> 8) % 4;
  return {
    x: (left ? 21 : 73) + (h % 7),
    y: top ? 9 + jitter + inner * 12 : 80 - jitter - inner * 12,
    dx: ((h >>> 12) % 31) - 15,
    dy: ((h >>> 17) % 21) - 10,
    drift: 3 + ((h >>> 21) % 3),
  };
}

/** A primeira vaga livre a partir da preferida (id mod 4); com as quatro de fora tomadas, as de dentro. */
export function objectLane(id: number, taken: readonly number[]): number {
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 4; i++) {
      const lane = ((id + i) % 4) + row * 4;
      if (!taken.includes(lane)) return lane;
    }
  }
  return id % OBJECT_LANES;
}

/**
 * Quem está em qual vaga. Um objeto guarda a vaga em que nasceu até sumir (não pula quando outro some), e um
 * novo pega uma vaga livre em vez de cair em cima de um que já está no campo.
 */
export interface LaneBook {
  /** Chamado a cada render com os objetos presentes: solta as vagas dos que sumiram e dá vaga aos novos. */
  sync(ids: readonly number[]): void;
  slot(id: number): ObjectSlot;
}

export function createLaneBook(): LaneBook {
  const lanes = new Map<number, number>();
  return {
    sync(ids) {
      for (const id of [...lanes.keys()]) if (!ids.includes(id)) lanes.delete(id);
      for (const id of [...ids].sort((a, b) => a - b)) {
        if (!lanes.has(id)) lanes.set(id, objectLane(id, [...lanes.values()]));
      }
    },
    slot: (id) => objectSlot(id, lanes.get(id)),
  };
}

export interface SignalView {
  mult: number;
  /** Segundos que faltam. */
  remaining: number;
}

/** O chip "Sinal forte" do HUD: só existe enquanto o boost do satélite corre. */
export function signalView(state: SaveState, now: number): SignalView | null {
  const { boostUntil, boostMult } = state.run;
  return boostMult > 1 && now < boostUntil ? { mult: boostMult, remaining: boostUntil - now } : null;
}

// --- Colapso e Atlas Eterno (spec 038, seções 8.1 e 8.2) ---

/** Texto do bônus de conjunto de cada família e nível (0, 1, 2 = com 2, 3 e 4+ páginas). */
const SET_BONUS_TEXT: Record<Family, [string, string, string]> = {
  planets: ['+5% de poeira por toque', '+12% de poeira por toque', '+25% de poeira por toque'],
  moons: ['+5% de energia por toque', '+12% de energia por toque', '+25% de energia por toque'],
  'small-bodies': ['+10% de duração dos objetos', '+20% de duração dos objetos', '+35% de duração dos objetos'],
  stars: ['+1 de combo máximo', '+2 de combo máximo', '+3 de combo máximo'],
  nebulae: ['-3% no custo das melhorias', '-6% no custo das melhorias', '-10% no custo das melhorias'],
  'black-holes': [
    '+20% de poder dos proibidos e 25% mais baratos',
    '+40% de poder dos proibidos e 50% mais baratos',
    '+80% de poder dos proibidos e 75% mais baratos',
  ],
};

export interface AtlasPageView {
  id: string;
  name: string;
  family: Family;
  familyName: string;
  level: number;
  astro: AstroId;
}

export interface SetBonusView {
  family: Family;
  familyName: string;
  count: number;
  /** -1 = sem bônus ainda. */
  tier: number;
  /** Bônus ativo, ou `null`. */
  active: string | null;
  /** Quantas páginas faltam para o próximo nível, ou `null` no máximo. */
  missing: number | null;
  next: string | null;
}

export interface AtlasView {
  slots: number;
  pages: AtlasPageView[];
  /** Só as famílias com páginas, mais as que já têm bônus. */
  bonuses: SetBonusView[];
  /** Próximo colapso que dá um espaço novo, ou `null` no máximo. */
  nextSlotAt: number | null;
}

/** O Atlas como a página mostra: espaços, família de cada página e bônus de conjunto (ativos e a conquistar). */
export function atlasView(state: SaveState): AtlasView {
  const pages: AtlasPageView[] = [];
  for (const p of state.atlas.pages) {
    const def = GRIMOIRES.find((g) => g.id === p.grimoireId);
    if (!def) continue;
    pages.push({
      id: def.id,
      name: def.name,
      family: def.family,
      familyName: FAMILY_NAMES[def.family],
      level: p.level,
      astro: astroFor(def.id, def.family),
    });
  }
  const bonuses = FAMILIES.map((family): SetBonusView => {
    const count = pages.filter((p) => p.family === family).length;
    const tier = setBonusTier(count);
    const nextIdx = tier + 1;
    const nextNeed = SET_BONUS_THRESHOLDS[nextIdx];
    return {
      family,
      familyName: FAMILY_NAMES[family],
      count,
      tier,
      active: tier >= 0 ? SET_BONUS_TEXT[family][tier]! : null,
      missing: nextNeed === undefined ? null : nextNeed - count,
      next: nextNeed === undefined ? null : SET_BONUS_TEXT[family][nextIdx]!,
    };
  });
  const nextSlotAt = ATLAS_SLOT_COLLAPSES.find((c) => c > state.collapses) ?? null;
  return { slots: state.atlas.slots, pages, bonuses, nextSlotAt };
}

/** Um dos três requisitos do colapso (spec 040, seção 2), com a barra pronta para a tela. */
export interface RequirementView {
  id: 'dust' | 'picks' | 'milestone';
  label: string;
  /** "4,2 mi de 6 mi": o que a pessoa tem e o que precisa. */
  text: string;
  /** 0 a 1. */
  fill: number;
  done: boolean;
  /** "faltam 3 escolhas" etc., só quando não está cumprido. */
  missing: string;
}

export interface CollapseView {
  ready: boolean;
  /** Número do colapso que esta vida termina (1 = primeiro). */
  next: number;
  /** Fração da meta de poeira, 0 a 1. */
  dustFill: number;
  dustMissing: number;
  picksMissing: number;
  /** Poeira, escolhas e marco da vida, nesta ordem, cada um com a sua barra. */
  requirements: RequirementView[];
  /** "Falta N de poeira", "Faltam N escolhas" ou os dois, para o botão desabilitado. */
  hint: string;
  /** Cintilas que o colapso dá agora (as fontes novas que ele abre: marco de colapsos e conquistas). */
  sparks: number;
  /** Escolha de grimório aberta: o colapso espera ela. */
  waitingChoice: boolean;
}

/** "a, b e c". */
const joinList = (items: string[]) => (items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`);

const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;

/** Nome e texto da barra do marco da vida, por tipo (o tipo gira a cada colapso). */
export function milestoneView(m: CollapseProgress['milestone']): RequirementView {
  const value = m.kind === 'comboFull' ? formatDuration(m.value) : formatNumber(m.value);
  const target = m.kind === 'comboFull' ? formatDuration(m.target) : formatNumber(m.target);
  const left = m.target - m.value;
  const base = { id: 'milestone' as const, text: `${value} de ${target}`, fill: m.fill, done: m.done };
  switch (m.kind) {
    case 'capture':
      return { ...base, label: 'Objetos capturados', missing: m.done ? '' : plural(left, 'objeto', 'objetos') };
    case 'combo':
      return { ...base, label: 'Combo: toques seguidos', missing: m.done ? '' : plural(left, 'toque seguido', 'toques seguidos') };
    case 'generators':
      return {
        ...base,
        label: `Geradores no nível ${m.level}`,
        missing: m.done ? '' : plural(left, 'gerador no nível', 'geradores no nível') + ` ${m.level}`,
      };
    case 'missions':
      return { ...base, label: 'Missões da estação', missing: m.done ? '' : plural(left, 'missão', 'missões') };
    case 'rares':
      return { ...base, label: 'Estrelas Douradas capturadas', missing: m.done ? '' : plural(left, 'Estrela Dourada', 'Estrelas Douradas') };
    case 'comboFull':
      return { ...base, label: 'Combo cheio sem parar', missing: m.done ? '' : `${formatDuration(left)} de combo cheio` };
  }
}

export function collapseView(state: SaveState): CollapseView {
  const p = collapseProgress(state);
  const dustMissing = Math.max(0, p.dustGoal - p.dust);
  const picksMissing = Math.max(0, p.minPicks - p.picks);
  const milestone = milestoneView(p.milestone);
  const requirements: RequirementView[] = [
    {
      id: 'dust',
      label: 'Poeira da vida',
      text: `${formatNumber(Math.min(p.dust, p.dustGoal))} de ${formatNumber(p.dustGoal)}`,
      fill: p.dustGoal > 0 ? Math.min(1, p.dust / p.dustGoal) : 0,
      done: dustMissing === 0,
      missing: dustMissing > 0 ? `${formatNumber(dustMissing)} de poeira` : '',
    },
    {
      id: 'picks',
      label: 'Escolhas de grimório',
      text: `${Math.min(p.picks, p.minPicks)} de ${p.minPicks}`,
      fill: p.minPicks > 0 ? Math.min(1, p.picks / p.minPicks) : 1,
      done: picksMissing === 0,
      missing: picksMissing > 0 ? plural(picksMissing, 'escolha', 'escolhas') : '',
    },
    milestone,
  ];
  const parts = requirements.filter((r) => !r.done).map((r) => r.missing);
  const waitingChoice = state.run.pending !== null && parts.length === 0;
  return {
    ready: p.ready,
    next: p.next,
    dustFill: requirements[0]!.fill,
    dustMissing,
    picksMissing,
    requirements,
    hint: waitingChoice ? 'Termine a escolha de grimório' : parts.length ? `Falta ${joinList(parts)} para a estrela colapsar` : '',
    sparks: sparksOnCollapse(state),
    waitingChoice,
  };
}

export interface CollapseCandidate {
  id: string;
  name: string;
  family: Family;
  familyName: string;
  level: number;
  astro: AstroId;
  /** Já tem página no Atlas: a página só sobe de nível, sem gastar espaço. */
  inAtlas: boolean;
}

/** Os grimórios da vida que podem virar página, do maior nível para o menor. */
export function collapseCandidates(state: SaveState): CollapseCandidate[] {
  return Object.entries(state.run.build)
    .map(([id, level]): CollapseCandidate | null => {
      const def = GRIMOIRES.find((g) => g.id === id);
      if (!def) return null;
      return {
        id,
        name: def.name,
        family: def.family,
        familyName: FAMILY_NAMES[def.family],
        level,
        astro: astroFor(id, def.family),
        inAtlas: state.atlas.pages.some((p) => p.grimoireId === id),
      };
    })
    .filter((c): c is CollapseCandidate => c !== null)
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'pt-BR'));
}

/** O Atlas está cheio e a página escolhida é nova: a pessoa precisa dizer qual página sai. */
export function needsReplacement(state: SaveState, pageId: string | null): boolean {
  if (pageId === null) return false;
  return !state.atlas.pages.some((p) => p.grimoireId === pageId) && state.atlas.pages.length >= atlasSlots(state.collapses + 1);
}

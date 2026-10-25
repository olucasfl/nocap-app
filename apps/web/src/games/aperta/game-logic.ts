import {
  COMBO_BONUS_PER_POINT,
  FORBIDDEN,
  FORBIDDEN_MAX_LEVEL,
  GRIMOIRE_RARITIES,
  albumVersions,
  vaultOffers,
  collapseProgress,
  formatDecimal,
  formatDuration,
  formatNumber,
  type CollapseProgress,
  type GrimoireCategory,
  type GrimoireRarity,
  type ObjectKind,
  type ObjectPreview,
  UPGRADES,
  currentEnergyCap,
  effectiveStats,
  sparksOnCollapse,
  nextUpgradeCost,
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

export type PageName = 'upgrades' | 'grimoires' | 'achievements' | 'tree' | 'vault';

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
  capella: 'starb',
  proxima: 'betel',
  cassiopeia: 'galaxy',
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
};

/** Medalha de um grimório do catálogo; os do catálogo futuro caem na medalha da família. */
export function astroFor(id: string, family: Family): AstroId {
  return GRIMOIRE_ASTRO[id] ?? FAMILY_ASTRO[family];
}

/** Toques ignorados nos primeiros ms depois de abrir um modal: o dedo ainda estava no botão (spec 4.7). */
export const MODAL_OPEN_GUARD_MS = 300;

/** Um dos 4 espaços de um grimório no livro: a versão (raridade) e se já foi descoberta. */
export interface AlbumSlot {
  rarity: ArtRarity;
  label: string;
  found: boolean;
}

export interface AlbumEntry {
  id: string;
  name: string;
  text: string;
  family: Family;
  /** O que o grimório ajuda (toque, objetos, energia e sorte). */
  category: GrimoireCategory;
  /** A maior raridade já descoberta (a cor do livro); `comum` enquanto escondido. */
  rarity: ArtRarity;
  /** Pelo menos uma versão descoberta (o livro guarda para sempre, a vida não). */
  discovered: boolean;
  /** Os 4 espaços (Comum, Raro, Épico, Lendário). */
  slots: AlbumSlot[];
  /** Versões descobertas (0 a 4). */
  found: number;
  /** Nível na vida atual (0 = ainda não pego nesta vida). */
  level: number;
  /** É o favorito do sorteio (spec 5.4, colapso 2). */
  favorite: boolean;
}

export interface AlbumView {
  entries: AlbumEntry[];
  /** Versões descobertas e total de versões (4 por grimório aberto). */
  discovered: number;
  total: number;
}

/**
 * Livro da página de Grimórios (spec 042): um grimório por astro, só os liberados pelos colapsos, com 4 espaços
 * (uma versão por raridade) que ficam "???" até a versão ser pega pela primeira vez.
 */
export function albumView(state: SaveState): AlbumView {
  const open = unlockedContent(state).grimoires;
  const entries = open.map((g): AlbumEntry => {
    const versions = albumVersions(state.album, g.id);
    const slots = GRIMOIRE_RARITIES.map((r): AlbumSlot => ({ rarity: artRarity(r), label: RARITY_LABEL_PT[r], found: versions.includes(r) }));
    const top = versions.length > 0 ? (versions[versions.length - 1] as string) : 'common';
    const discovered = versions.length > 0;
    return {
      id: g.id,
      name: discovered ? g.name : '???',
      text: discovered ? g.text : 'Ainda escondido no espaço',
      family: g.family,
      category: g.category,
      rarity: artRarity(top),
      discovered,
      slots,
      found: versions.length,
      level: state.run.build[g.id] ?? 0,
      favorite: state.favorite === g.id,
    };
  });
  return { entries, discovered: entries.reduce((n, e) => n + e.found, 0), total: entries.length * GRIMOIRE_RARITIES.length };
}

const RARITY_LABEL_PT: Record<GrimoireRarity, string> = { common: 'Comum', rare: 'Raro', epic: 'Épico', legendary: 'Lendário' };

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
  'legend-comet': 'legend-comet',
  'legend-pulsar': 'legend-pulsar',
  'legend-nebula': 'legend-nebula',
  'legend-wormhole': 'legend-wormhole',
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
  if (p.fillsBar) parts.push('Enche a barra de energia');
  if (p.freeReroll) parts.push('1 troca grátis');
  return parts.join(' e ');
}

/** Texto curto que sobe do lugar da captura (cabe na faixa do campo no celular). */
export function floatText(p: ObjectPreview): string {
  return rewardText(p).replace(/ por \d+ s/, '');
}

/** "Cometa capturado", "Estrela cadente capturada". */
export function capturedTitle(kind: ObjectKind): string {
  return `${objectName(kind)} ${kind === 'shooting-star' || kind === 'golden' || kind === 'legend-nebula' ? 'capturada' : 'capturado'}`;
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

// --- Colapso e Cofre dos Proibidos (spec 040, seção 3) ---

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

/**
 * Botão de meta do HUD (minimalista): só o que falta, a poeira primeiro. `null` quando a estrela está pronta (o botão vira
 * "Colapsar"). Ex.: "faltam 684 mi", "faltam 2 escolhas", "termine a escolha".
 */
export function goalMissing(view: CollapseView): string | null {
  if (view.ready) return null;
  if (view.waitingChoice) return 'termine a escolha';
  const pending = view.requirements.find((r) => !r.done);
  if (!pending) return 'quase lá';
  return pending.id === 'dust' ? `faltam ${formatNumber(view.dustMissing)}` : `faltam ${pending.missing}`;
}

/** Um proibido como carta do colapso ou casa do Cofre. */
export interface VaultCardView {
  id: string;
  name: string;
  /** Nível guardado agora (0 = ainda não tem). */
  level: number;
  /** Nível depois de escolher este. */
  nextLevel: number;
  bonus: string;
  price: string;
  /** Texto do selo, ou `null` se ainda não está no nível 5. */
  seal: string | null;
  /** O próximo nível é o 5: o selo passa a valer. */
  sealsNext: boolean;
}

function vaultCard(id: string, level: number): VaultCardView {
  const def = FORBIDDEN.find((f) => f.id === id)!;
  const next = Math.min(FORBIDDEN_MAX_LEVEL, level + 1);
  return {
    id,
    name: def.name,
    level,
    nextLevel: next,
    bonus: def.bonus(next),
    price: def.price(next),
    seal: level >= FORBIDDEN_MAX_LEVEL || next === FORBIDDEN_MAX_LEVEL ? def.sealText : null,
    sealsNext: next === FORBIDDEN_MAX_LEVEL && level < FORBIDDEN_MAX_LEVEL,
  };
}

/** As (até) 3 cartas do colapso, com o nível de hoje e o de depois. Vazio = Selo Estelar. */
export function collapseCards(state: SaveState): VaultCardView[] {
  return vaultOffers(state).map((id) => vaultCard(id, state.vault[id] ?? 0));
}

/** A página do Cofre: 10 casas, cada uma com o nível atual (o texto é o do nível guardado, ou do nível 1 se vazia). */
export function vaultSlots(state: SaveState): (VaultCardView & { owned: boolean; text: string })[] {
  return FORBIDDEN.map((def) => {
    const level = state.vault[def.id] ?? 0;
    const shown = Math.max(1, level);
    return {
      ...vaultCard(def.id, level),
      owned: level > 0,
      text: def.bonus(shown),
      price: def.price(shown),
      seal: level >= FORBIDDEN_MAX_LEVEL ? def.sealText : null,
    };
  });
}

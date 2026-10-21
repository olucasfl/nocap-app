import {
  COMBO_BONUS_PER_POINT,
  UPGRADES,
  currentEnergyCap,
  effectiveStats,
  nextUpgradeCost,
  unlockedContent,
  type Family,
  type SaveState,
} from '@nocap/games';
import type { AstroId } from './astros';
import type { Rarity as ArtRarity } from './rarity';

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
  rarity: ArtRarity;
  /** Já descoberto neste save (o álbum guarda para sempre, a vida não). */
  discovered: boolean;
  /** Nível na vida atual (0 = ainda não pego nesta vida). */
  level: number;
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
      rarity: artRarity(g.rarity),
      discovered,
      level: state.run.build[g.id] ?? 0,
    };
  });
  return { entries, discovered: entries.filter((e) => e.discovered).length, total: entries.length };
}

/** Verdadeiro enquanto o modal acabou de abrir e o toque ainda deve ser ignorado. */
export function modalGuarded(openedAtMs: number, nowMs: number): boolean {
  return nowMs - openedAtMs < MODAL_OPEN_GUARD_MS;
}

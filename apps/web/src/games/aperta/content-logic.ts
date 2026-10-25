import {
  EVENT_NAMES,
  EVENT_TEXT,
  activeEventId,
  effectiveStats,
  formatDecimal,
  formatNumber,
  mechanicOpen,
  missionById,
  newContentAt,
  unlockedContent,
  withPick,
  type ContentKind,
  type EffectiveStats,
  type EventId,
  type GrimoireRarity,
  type NewContentItem,
  type SaveState,
} from '@nocap/games';
import { REGION_ART, type RegionArt } from './regions';

// --- Faixa "Novo no espaço" (spec 038, 5.4) ---

export const CONTENT_KIND_LABEL: Record<ContentKind, string> = {
  region: 'Região',
  grimoire: 'Grimório',
  upgrade: 'Melhoria',
  object: 'Objeto',
  mechanic: 'Mecânica',
  event: 'Evento',
};

export interface NewInSpaceView {
  /** Chave guardada em `seenUnlocks` quando a pessoa dispensa a faixa. */
  key: string;
  collapse: number;
  items: NewContentItem[];
}

export function newInSpaceKey(collapse: number): string {
  return `collapse:${collapse}`;
}

/** O que o último colapso trouxe, enquanto a pessoa não dispensou a faixa. Sem novidade, `null`. */
export function newInSpaceView(state: SaveState): NewInSpaceView | null {
  const k = state.collapses;
  if (k < 1 || state.tutorial !== 'done') return null;
  const key = newInSpaceKey(k);
  if (state.seenUnlocks.includes(key)) return null;
  const items = newContentAt(k);
  return items.length > 0 ? { key, collapse: k, items } : null;
}

// --- Menu de regiões ---

export interface RegionMenuItem {
  art: RegionArt;
  current: boolean;
}

/** As regiões já abertas, na ordem da viagem. Só vale ter menu quando há mais de uma. */
export function regionMenuItems(state: SaveState): RegionMenuItem[] {
  const open = new Set(unlockedContent(state).regions.map((r) => r.id));
  return REGION_ART.filter((a) => open.has(a.id)).map((art) => ({ art, current: art.id === state.regionId }));
}

// --- Missão da estação e eventos ---

export interface MissionView {
  text: string;
  progress: number;
  target: number;
  done: boolean;
}

export function missionView(state: SaveState): MissionView | null {
  const m = state.run.mission;
  const def = m && missionById(m.id);
  if (!m || !def) return null;
  return { text: def.text, progress: m.progress, target: def.target, done: m.done };
}

export interface EventView {
  id: EventId;
  name: string;
  text: string;
  /** Segundos que faltam: só alimenta a duração da barra do chip (CSS), nunca é mostrado como número. */
  remaining: number;
}

export interface RadarView {
  captures: number;
  threshold: number;
  /** 0 a 1: quanto do radar já encheu. */
  fill: number;
}

/** Radar de lendários da árvore: `null` sem o nó. */
export function radarView(state: SaveState): RadarView | null {
  const ex = effectiveStats(state).explore;
  if (!ex.radarOn) return null;
  return { captures: state.run.radar, threshold: ex.radarThreshold, fill: Math.min(1, state.run.radar / ex.radarThreshold) };
}

/** Evento em andamento. Sem contagem na tela: só o nome e o que ele faz. */
export function eventView(state: SaveState, now: number): EventView | null {
  const id = activeEventId(state, now);
  return id && state.run.event ? { id, name: EVENT_NAMES[id], text: EVENT_TEXT[id], remaining: Math.max(0, state.run.event.until - now) } : null;
}

// --- Favorito ---

export function favoriteOpen(state: SaveState): boolean {
  return mechanicOpen('favorite', state.collapses);
}

// --- O que a carta muda nos números da vida ---

interface StatLine {
  label: string;
  read: (s: EffectiveStats) => number;
  show: (v: number) => string;
}

const pct = (v: number) => `${formatDecimal(v * 100, 0)}%`;
const secs = (v: number) => `${formatDecimal(v, 1)} s`;

const touches = (v: number) => `${formatDecimal(v, v % 1 === 0 ? 0 : 1)} toques`;

const STAT_LINES: StatLine[] = [
  { label: 'Seu toque', read: (s) => s.dustPerTouch, show: (v) => (v >= 100 ? formatNumber(Math.floor(v)) : formatDecimal(v, 1)) },
  { label: 'Energia por toque', read: (s) => s.energyPerTouch, show: (v) => formatDecimal(v, 2) },
  { label: 'Energia até o próximo grimório', read: (s) => s.energyStepFactor, show: pct },
  { label: 'Trocas de carta por escolha', read: (s) => s.choice.rerolls, show: (v) => formatDecimal(v, 0) },
  { label: 'Descartes por escolha', read: (s) => s.choice.discards, show: (v) => formatDecimal(v, 0) },
  { label: 'Cartas por escolha', read: (s) => s.choice.cards, show: (v) => formatDecimal(v, 0) },
  { label: 'Peso das cartas épicas e lendárias', read: (s) => s.choice.rarityBoost, show: (v) => `+${formatDecimal(v, 0)}` },
  { label: 'Devolução ao comprar', read: (s) => s.buyRefundTouches, show: touches },
  { label: 'Poeira inicial', read: (s) => s.startDust, show: (v) => formatNumber(v) },
  { label: 'Custo dos itens', read: (s) => s.costFactor, show: pct },
  { label: 'Cometa', read: (s) => s.objects.reward.comet.dust, show: touches },
  { label: 'Estrela cadente', read: (s) => s.objects.reward['shooting-star'].energy, show: touches },
  { label: 'Satélite (poeira)', read: (s) => s.objects.reward.satellite.dust, show: touches },
  { label: 'Espera pelo próximo objeto', read: (s) => s.objects.spawnMaxSec, show: secs },
  { label: 'Tempo do objeto na tela', read: (s) => s.objects.lifeSec.comet, show: secs },
  { label: 'Objetos ao mesmo tempo', read: (s) => s.objects.maxOnField, show: (v) => formatDecimal(v, 0) },
  { label: 'Energia ao capturar', read: (s) => s.objects.onCaptureEnergyTouches, show: touches },
  { label: 'Toque depois de capturar', read: (s) => s.objects.afterCaptureMult, show: (v) => `x${formatDecimal(v, 1)}` },
];

/**
 * "Poeira por toque: 12 -> 14": o que mudaria na vida atual se a carta fosse escolhida (até 2 linhas).
 * Efeitos que não aparecem nesses números (toque especial, captura) devolvem `null`.
 */
export function cardGain(state: SaveState, id: string, rarity: GrimoireRarity = 'common'): string | null {
  const before = effectiveStats(state);
  const after = effectiveStats(withPick(state, id, rarity));
  const lines: string[] = [];
  for (const line of STAT_LINES) {
    const a = line.read(before);
    const b = line.read(after);
    if (Math.abs(a - b) > 1e-9) lines.push(`${line.label}: ${line.show(a)} -> ${line.show(b)}`);
    if (lines.length === 2) break;
  }
  // Toque especial ("a cada 15 toques"): não está nas linhas acima, então compara regra por regra.
  const was = new Map(before.nth.map((r) => [r.n, r]));
  for (const r of after.nth) {
    if (lines.length >= 2) break;
    const old = was.get(r.n);
    const m0 = old?.mult ?? 1;
    const e0 = old?.energy ?? 0;
    if (Math.abs(m0 - r.mult) > 1e-9 && r.mult > 1) lines.push(`A cada ${r.n} toques, poeira: x${formatDecimal(m0, 1)} -> x${formatDecimal(r.mult, 1)}`);
    else if (Math.abs(e0 - r.energy) > 1e-9) lines.push(`A cada ${r.n} toques, energia: +${formatDecimal(e0, 1)} -> +${formatDecimal(r.energy, 1)}`);
  }
  return lines.length > 0 ? lines.slice(0, 2).join(' · ') : null;
}

/** O que cada carta oferecida faz nos números da vida atual ("Seu toque: 12 -> 14"). */
export function cardPreviews(state: SaveState, offers: readonly string[], rarities: Readonly<Record<string, GrimoireRarity>> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of offers) {
    const gain = cardGain(state, id, rarities[id] ?? 'common');
    if (gain) out[id] = gain;
  }
  return out;
}

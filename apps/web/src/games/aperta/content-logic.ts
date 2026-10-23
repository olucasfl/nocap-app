import {
  EVENT_NAMES,
  EVENT_TEXT,
  UPGRADES,
  activeEventId,
  effectiveStats,
  formatDecimal,
  formatNumber,
  mechanicOpen,
  missionById,
  newContentAt,
  unlockedContent,
  type ContentKind,
  type EffectiveStats,
  type EventId,
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

// --- Observatório Gaia: a carta mostra o efeito já com os números da vida ---

export function gaiaActive(state: SaveState): boolean {
  const i = UPGRADES.findIndex((u) => u.id === 'gaia');
  return i >= 0 && (state.run.upgradeLevels[i] ?? 0) > 0;
}

interface StatLine {
  label: string;
  read: (s: EffectiveStats) => number;
  show: (v: number) => string;
}

const pct = (v: number) => `${formatDecimal(v * 100, 0)}%`;
const secs = (v: number) => `${formatDecimal(v, 1)} s`;

const touches = (v: number) => `${formatDecimal(v, v % 1 === 0 ? 0 : 1)} toques`;

const STAT_LINES: StatLine[] = [
  { label: 'Poeira por toque', read: (s) => s.dustPerTouch, show: (v) => (v >= 100 ? formatNumber(Math.floor(v)) : formatDecimal(v, 1)) },
  { label: 'Poeira por toque no combo máximo', read: (s) => s.combo.fullDustAdd, show: (v) => `+${formatDecimal(v, 2)}` },
  { label: 'Energia por toque', read: (s) => s.energyPerTouch, show: (v) => formatDecimal(v, 2) },
  { label: 'Energia por toque no combo máximo', read: (s) => s.combo.fullEnergyAdd, show: (v) => `+${formatDecimal(v, 2)}` },
  { label: 'Janela do combo', read: (s) => s.combo.windowSec, show: secs },
  { label: 'Custo das melhorias', read: (s) => s.costFactor, show: pct },
  { label: 'Cometa', read: (s) => s.objects.reward.comet.dust, show: touches },
  { label: 'Estrela cadente', read: (s) => s.objects.reward['shooting-star'].energy, show: touches },
  { label: 'Satélite (poeira)', read: (s) => s.objects.reward.satellite.dust, show: touches },
  { label: 'Sinal forte', read: (s) => s.objects.signalMult, show: (v) => `x${formatDecimal(v, 1)}` },
  { label: 'Energia ao capturar', read: (s) => s.objects.onCaptureEnergyTouches, show: touches },
  { label: 'Poeira inicial', read: (s) => s.startDust, show: (v) => formatNumber(v) },
  { label: 'Energia até o próximo', read: (s) => s.energyStepFactor, show: pct },
];

/** O mesmo save com o grimório `id` pego (nível 1) ou subindo um nível, só para comparar os números. */
function withGrimoire(state: SaveState, id: string): SaveState {
  const level = state.run.build[id] ?? 0;
  return { ...state, run: { ...state.run, build: { ...state.run.build, [id]: level + 1 } } };
}

/**
 * "Poeira por toque: 12 -> 14": o que mudaria na vida atual se a carta fosse escolhida (até 2 linhas).
 * Efeitos que não aparecem nesses números (toque especial, captura) devolvem `null`.
 */
export function cardGain(state: SaveState, id: string): string | null {
  const before = effectiveStats(state);
  const after = effectiveStats(withGrimoire(state, id));
  const lines: string[] = [];
  for (const line of STAT_LINES) {
    const a = line.read(before);
    const b = line.read(after);
    if (Math.abs(a - b) > 1e-9) lines.push(`${line.label}: ${line.show(a)} -> ${line.show(b)}`);
    if (lines.length === 2) break;
  }
  return lines.length > 0 ? lines.join(' · ') : null;
}

/**
 * O que cada carta oferecida faz nos números da vida atual ("Poeira por toque: 12 -> 14"). Desde a spec 041 aparece
 * para todos; o Observatório Gaia só acrescenta a frase de efeito de ocasião quando os números não mudam.
 */
export function gaiaPreviews(state: SaveState, offers: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const gaia = gaiaActive(state);
  for (const id of offers) {
    const gain = cardGain(state, id);
    if (gain) out[id] = gain;
    else if (gaia) out[id] = 'Efeito de ocasião: sem mudança nos números agora';
  }
  return out;
}

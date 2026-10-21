// Conteúdo por colapso (spec 038, seção 5.4): a tabela que diz o que cada colapso abre. O catálogo
// (`catalog.ts`) guarda `unlockedAtCollapse` em cada registro; esta tabela é a segunda fonte, escrita
// como a spec, e o teste `content.test.ts` exige que as duas batam linha a linha.

import { GRIMOIRES, OBJECTS, REGIONS, UPGRADES } from '../catalog';

export type ContentKind = 'region' | 'grimoire' | 'upgrade' | 'object' | 'mechanic' | 'event';

/** Mecânicas e eventos não têm registro no catálogo: o motor os conhece pelo id. */
export type MechanicId = 'favorite' | 'missions';
export type EventId = 'meteor-shower' | 'solar-storm';

export const MECHANIC_NAMES: Record<MechanicId, string> = {
  favorite: 'Favorito',
  missions: 'Missões da estação',
};

export const MECHANIC_TEXT: Record<MechanicId, string> = {
  favorite: 'Marque um grimório como favorito: ele pesa o dobro no sorteio.',
  missions: 'Um objetivo por vida; cumprir dá Fragmentos extras ao colapsar.',
};

export const EVENT_NAMES: Record<EventId, string> = {
  'meteor-shower': 'Chuva de meteoros',
  'solar-storm': 'Tempestade solar',
};

export const EVENT_TEXT: Record<EventId, string> = {
  'meteor-shower': 'Por 15 s, estrelas cadentes cruzam o espaço.',
  'solar-storm': 'Por 15 s, a energia por toque vale o dobro.',
};

export interface CollapseContent {
  region: string;
  grimoires: string[];
  upgrades: string[];
  objects: string[];
  mechanics: MechanicId[];
  events: EventId[];
}

/** Colapsos 0 a 5 (v1). Os próximos entram nas etapas 14 e 15. */
export const COLLAPSE_CONTENT: readonly CollapseContent[] = [
  {
    region: 'inner-solar-system',
    grimoires: [
      'moon', 'mercury', 'venus', 'mars', 'ceres', 'phobos', 'io', 'vesta', 'halley', 'uranus',
      'europa', 'titan', 'jupiter', 'saturn', 'neptune', 'ganymede', 'pluto', 'triton',
      'sirius', 'vega', 'betelgeuse', 'polaris', 'antares', 'crab-nebula',
      'orion-nebula', 'milky-way', 'andromeda', 'sagittarius-a',
    ],
    upgrades: ['pulse', 'resonance', 'reactor', 'pleiades', 'kepler', 'hubble', 'voyager'],
    objects: ['comet', 'shooting-star', 'satellite'],
    mechanics: [],
    events: [],
  },
  { region: 'asteroid-belt', grimoires: ['pallas', 'hygiea'], upgrades: ['webb'], objects: ['asteroid'], mechanics: [], events: [] },
  {
    region: 'jupiter-saturn',
    grimoires: ['callisto', 'enceladus'],
    upgrades: [],
    objects: ['probe'],
    mechanics: ['favorite'],
    events: ['meteor-shower'],
  },
  { region: 'kuiper-belt', grimoires: ['eris', 'haumea', 'cygnus-x1'], upgrades: ['chandra'], objects: [], mechanics: [], events: [] },
  {
    region: 'oort-cloud',
    grimoires: ['sedna', 'hale-bopp'],
    upgrades: [],
    objects: [],
    mechanics: ['missions'],
    events: ['solar-storm'],
  },
  { region: 'alpha-centauri', grimoires: ['proxima-centauri', 'alpha-centauri-a', 'm87'], upgrades: ['gaia'], objects: [], mechanics: [], events: [] },
];

/** Último colapso com conteúdo nesta versão (v1). */
export const LAST_CONTENT_COLLAPSE = COLLAPSE_CONTENT.length - 1;

export function contentAtCollapse(k: number): CollapseContent | undefined {
  return COLLAPSE_CONTENT[k];
}

export interface NewContentItem {
  kind: ContentKind;
  id: string;
  name: string;
  /** Uma frase para a faixa "Novo no espaço". */
  text: string;
}

/** O que o colapso `k` trouxe, para a faixa "Novo no espaço" (a região vem primeiro). */
export function newContentAt(k: number): NewContentItem[] {
  const row = COLLAPSE_CONTENT[k];
  if (!row) return [];
  const items: NewContentItem[] = [];
  const region = REGIONS.find((r) => r.id === row.region);
  if (region) items.push({ kind: 'region', id: region.id, name: region.name, text: 'Nova região do espaço' });
  for (const id of row.grimoires) {
    const g = GRIMOIRES.find((d) => d.id === id);
    if (g) items.push({ kind: 'grimoire', id, name: g.name, text: 'Novo grimório' });
  }
  for (const id of row.upgrades) {
    const u = UPGRADES.find((d) => d.id === id);
    if (u) items.push({ kind: 'upgrade', id, name: u.name, text: 'Nova melhoria' });
  }
  for (const id of row.objects) {
    const o = OBJECTS.find((d) => d.kind === id);
    if (o) items.push({ kind: 'object', id, name: o.name, text: 'Novo objeto no espaço' });
  }
  for (const id of row.mechanics) items.push({ kind: 'mechanic', id, name: MECHANIC_NAMES[id], text: MECHANIC_TEXT[id] });
  for (const id of row.events) items.push({ kind: 'event', id, name: EVENT_NAMES[id], text: EVENT_TEXT[id] });
  return items;
}

/** Mecânica aberta para um save com `collapses` colapsos. */
export function mechanicOpen(id: MechanicId, collapses: number): boolean {
  return COLLAPSE_CONTENT.some((row, k) => k <= collapses && row.mechanics.includes(id));
}

/** Eventos abertos para um save com `collapses` colapsos. */
export function eventsOpen(collapses: number): EventId[] {
  return COLLAPSE_CONTENT.flatMap((row, k) => (k <= collapses ? row.events : []));
}

// --- Missões da estação (colapso 4): uma por vida ---

export type MissionMetric = 'capture' | 'touch' | 'pick';

export interface MissionDef {
  id: string;
  metric: MissionMetric;
  target: number;
  text: string;
}

export const MISSIONS: readonly MissionDef[] = [
  { id: 'capture-10', metric: 'capture', target: 10, text: 'Capturar 10 objetos no espaço' },
  { id: 'touch-600', metric: 'touch', target: 600, text: 'Tocar o botão 600 vezes' },
  { id: 'pick-10', metric: 'pick', target: 10, text: 'Escolher 10 grimórios' },
  { id: 'capture-20', metric: 'capture', target: 20, text: 'Capturar 20 objetos no espaço' },
];

export function missionById(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}

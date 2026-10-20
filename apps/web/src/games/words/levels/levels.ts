import type { BeePuzzle, ConnectPuzzle } from '@nocap/games';

/**
 * Uma fase do Bee: letra do centro, as 6 de fora, as palavras da fase e quais delas são pangramas.
 * `t` é a faixa (0 Fácil a 3 Mestre). `x` são palavras que existem no favo mas não contam nesta fase
 * (nas faixas fáceis a lista é "aparada" para ficar com palavras curtas e comuns).
 */
export interface BeeLevel {
  id: string;
  t: number;
  c: string;
  l: string[];
  w: string[];
  p: string[];
  x: string[];
}

/** Uma fase do Connect: 4 grupos com nível (1 a 4), título e palavras; `t` é a faixa (0 Fácil a 3 Mestre). */
export interface ConnectLevel {
  id: string;
  t: number;
  g: { l: number; t: string; w: string[] }[];
}

/** Uma fase do Classic: as palavras da fase (1, 2 ou 4, com acento); `t` é a faixa (0 Fácil a 3 Mestre). */
export interface ClassicLevel {
  id: string;
  t: number;
  w: string[];
}
export type ClassicLevels = { c: ClassicLevel[]; d: ClassicLevel[]; q: ClassicLevel[] };

/** Os dados são carregados sob demanda (um pedaço separado do app), já ordenados do mais fácil ao mais difícil. */
export async function loadBeeLevels(): Promise<BeeLevel[]> {
  return (await import('./bee-levels.json')).default as BeeLevel[];
}
export async function loadConnectLevels(): Promise<ConnectLevel[]> {
  return (await import('./connect-levels.json')).default as ConnectLevel[];
}

export async function loadClassicLevels(): Promise<ClassicLevels> {
  return (await import('./classic-levels.json')).default as ClassicLevels;
}
/** Todas as palavras que valem como palpite (o dicionário que o servidor também usa). */
export async function loadClassicAccepted(): Promise<string[]> {
  return (await import('./classic-accepted.json')).default as string[];
}

export const toBeePuzzle = (l: BeeLevel): BeePuzzle => ({
  id: l.id,
  center: l.c,
  letters: l.l,
  words: l.w.map((w) => ({ w, ...(l.p.includes(w) ? { pangram: true } : {}) })),
});

export const toConnectPuzzle = (l: ConnectLevel): ConnectPuzzle => ({
  id: l.id,
  groups: l.g.map((g) => ({ level: g.l as 1 | 2 | 3 | 4, title: g.t, words: g.w })),
});

export const TIERS = ['Fácil', 'Médio', 'Difícil', 'Mestre'] as const;
export type Tier = (typeof TIERS)[number];

/** A faixa de dificuldade de uma fase (as listas já vêm agrupadas por faixa, da mais fácil à mais difícil). */
export const tierOf = (level: { t: number }): Tier => TIERS[Math.min(3, Math.max(0, level.t))]!;

/** De que fase a que fase vai cada faixa (1 a N), para o catálogo. */
export function tierRanges(levels: readonly { t: number }[]): { tier: Tier; from: number; to: number }[] {
  return TIERS.map((tier, t) => {
    const idx = levels.map((l, i) => (l.t === t ? i + 1 : 0)).filter(Boolean);
    return { tier, from: idx[0] ?? 0, to: idx[idx.length - 1] ?? 0 };
  }).filter((r) => r.from > 0);
}

/** Embaralhamento estável pela semente (a mesma fase abre sempre na mesma ordem). */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rand = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

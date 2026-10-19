import type { BeePuzzle, ConnectPuzzle } from '@nocap/games';

/** Uma fase do Bee: letra do centro, as 6 de fora, as palavras do favo e quais delas são pangramas. */
export interface BeeLevel {
  id: string;
  c: string;
  l: string[];
  w: string[];
  p: string[];
}

/** Uma fase do Connect: 4 grupos com nível (1 a 4), título e palavras. */
export interface ConnectLevel {
  id: string;
  g: { l: number; t: string; w: string[] }[];
}

/** Os dados são carregados sob demanda (um pedaço separado do app), já ordenados do mais fácil ao mais difícil. */
export async function loadBeeLevels(): Promise<BeeLevel[]> {
  return (await import('./bee-levels.json')).default as BeeLevel[];
}
export async function loadConnectLevels(): Promise<ConnectLevel[]> {
  return (await import('./connect-levels.json')).default as ConnectLevel[];
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

/** A faixa de dificuldade de uma fase (quatro partes iguais da lista ordenada). */
export function tierOf(index: number, total: number): Tier {
  return TIERS[Math.min(3, Math.floor((index / Math.max(1, total)) * 4))]!;
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

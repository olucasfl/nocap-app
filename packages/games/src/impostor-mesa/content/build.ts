import type { ImQuestion, ImWord } from '../index';

/** Linha de conteúdo: [palavra, par parecido, "tag=valor,tag=valor", fama (1 padrão)]. */
export type Row = readonly [text: string, pair: string, tags: string, fame?: 1 | 2];

export function words(category: string, rows: readonly Row[]): ImWord[] {
  return rows.map(([text, pair, tags, fame], i) => ({
    id: `${category}-${i + 1}`,
    category,
    text,
    pair,
    tags: Object.fromEntries(tags.split(',').filter(Boolean).map((t) => t.split('=') as [string, string])),
    fame: fame ?? 1,
  }));
}

export function questions(category: string, rows: readonly (readonly [string, string])[]): ImQuestion[] {
  return rows.map(([q, qPair], i) => ({ id: `${category}-q${i + 1}`, category, q, qPair }));
}

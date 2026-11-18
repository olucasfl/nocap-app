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

/**
 * Regras das perguntas do modo "Resposta errada" (a dos inocentes e a dos impostores):
 * 1. As duas pedem UM item da mesma categoria, para a resposta do impostor parecer natural.
 * 2. Nada de "favorito/mais gosta": pergunta aberta rende qualquer resposta. Pede-se uma escolha decidida
 *    por um contexto ("para a praia", "numa luta", "às 3 da manhã").
 * 3. Distância média: o critério muda (contexto, lado, qualidade), mas as respostas podem coincidir em parte.
 *    Se as perguntas forem opostas ("mais gosta" x "menos gosta"), o impostor se entrega logo; se forem quase
 *    iguais, ninguém descobre ninguém.
 */
export function questions(category: string, rows: readonly (readonly [string, string])[]): ImQuestion[] {
  return rows.map(([q, qPair], i) => ({ id: `${category}-q${i + 1}`, category, q, qPair }));
}

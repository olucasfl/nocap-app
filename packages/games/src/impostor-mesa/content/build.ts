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
 * 3. Distância média, nem oposta nem quase igual. Itens: mesma escolha em dois cenários diferentes
 *    ("ilha deserta" x "jantar para 40 pessoas"). Pessoais ("Quem entre vocês..."): mesma cena, duas características
 *    diferentes ("o mais competitivo" x "o mais trapaceiro"). Antônimos (melhor x pior, começar x terminar)
 *    entregam o impostor; sinônimos ("competitivo" x "bravo ao perder") dão a mesma resposta e ninguém descobre.
 * 4. As respostas das duas perguntas precisam poder coincidir: se as respostas possíveis de uma nunca servem para a
 *    outra ("ganhou a Copa" x "nunca ganhou"; "supervalorizado" x "injustiçado"), o impostor se entrega ao falar.
 *    Teste da revisão: "alguma resposta da pergunta A caberia também na B?". Ambas devem ter o mesmo tom
 *    (as duas elogiam, as duas criticam, as duas são neutras) e falar do mesmo conjunto de itens.
 * 5. Tem que ser algo sobre o qual a pessoa tenha opinião de verdade, não um cenário inventado.
 */
export function questions(category: string, rows: readonly (readonly [string, string])[]): ImQuestion[] {
  return rows.map(([q, qPair], i) => ({ id: `${category}-q${i + 1}`, category, q, qPair }));
}

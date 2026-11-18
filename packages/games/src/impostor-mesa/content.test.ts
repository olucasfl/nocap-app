import { describe, expect, it } from 'vitest';
import { IM_CATEGORIES, IM_MIN_POOL, IM_QUESTIONS, IM_WORDS, filterWords } from './index';

describe('conteúdo do Impostor', () => {
  const cats = IM_CATEGORIES.map((c) => c.id);
  it('dez categorias, cada uma com palavras suficientes', () => {
    expect(cats).toHaveLength(10);
    for (const c of cats) expect(IM_WORDS.filter((w) => w.category === c).length, c).toBeGreaterThanOrEqual(IM_MIN_POOL);
  });
  it('sem palavra repetida na categoria, sem par igual à palavra', () => {
    for (const c of cats) {
      const list = IM_WORDS.filter((w) => w.category === c);
      const texts = list.map((w) => w.text.toLowerCase());
      expect(new Set(texts).size, c).toBe(texts.length);
      for (const w of list) {
        expect(w.pair.length, w.id).toBeGreaterThan(0);
        expect(w.pair.toLowerCase(), w.id).not.toBe(w.text.toLowerCase());
      }
    }
  });
  it('ids únicos e fama só 1 ou 2', () => {
    expect(new Set(IM_WORDS.map((w) => w.id)).size).toBe(IM_WORDS.length);
    for (const w of IM_WORDS) expect([1, 2]).toContain(w.fame);
  });
  it('toda etiqueta usada existe nas opções da categoria', () => {
    for (const c of IM_CATEGORIES) {
      for (const f of c.filters) {
        const valid = new Set(f.options.map((x) => x.value));
        for (const w of IM_WORDS.filter((x) => x.category === c.id)) {
          const v = w.tags[f.tag];
          expect(v && valid.has(v), `${w.id} ${f.tag}=${v}`).toBe(true);
        }
      }
    }
  });
  it('cada opção de filtro tem palavras (e o futebol permite escolher só jogadores do Brasil)', () => {
    for (const c of IM_CATEGORIES) for (const f of c.filters) for (const opt of f.options) {
      const n = filterWords(IM_WORDS, { categories: [c.id], filters: { [c.id]: { [f.tag]: [opt.value] } } }).length;
      expect(n, `${c.id} ${f.tag}=${opt.value}`).toBeGreaterThan(0);
    }
    const jog = filterWords(IM_WORDS, { categories: ['futebol'], filters: { futebol: { group: ['jogador-brasil'] } } });
    expect(jog.every((w) => w.tags.group === 'jogador-brasil')).toBe(true);
  });
  it('o Clash Royale não tem as cartas que o Lucas tirou', () => {
    const banned = ['Night Witch', 'Magic Archer', 'Skeletons', 'Skeleton Army', 'Goblins', 'Spear Goblins', 'Goblin Gang', 'Minions', 'Minion Horde', 'Bandit', 'Phoenix', 'Skeleton King', 'Archer Queen', 'Golden Knight', 'Monk', 'Mighty Miner', 'Little Prince'];
    const texts = IM_WORDS.filter((w) => w.category === 'clash');
    for (const b of banned) {
      for (const w of texts) {
        expect(w.text.startsWith(b + ' (') || w.text === b, w.text).toBe(false);
        expect(w.pair.startsWith(b + ' (') || w.pair === b, `${w.text} par ${w.pair}`).toBe(false);
      }
    }
    expect(texts.some((w) => w.text.includes('Cão de Lava'))).toBe(false);
  });
  it('perguntas pareadas existem por categoria e são diferentes', () => {
    for (const c of cats) expect(IM_QUESTIONS.filter((q) => q.category === c).length, c).toBeGreaterThanOrEqual(30);
    for (const q of IM_QUESTIONS) expect(q.q).not.toBe(q.qPair);
  });
  it('cada tema tem perguntas pessoais para responder com o nome de quem está na mesa', () => {
    for (const c of cats) {
      const own = IM_QUESTIONS.filter((q) => q.category === c && q.q.startsWith('Quem entre vocês'));
      expect(own.length, c).toBeGreaterThanOrEqual(10);
      for (const q of own) expect(q.qPair.startsWith('Quem entre vocês'), q.qPair).toBe(true);
    }
  });
  it('perguntas seguem as regras: decididas, sem abertas demais, terminam em ?', () => {
    const open = /favorit|mais gosta\b|menos gosta\b|nunca comeria|nunca usaria/i;
    for (const q of IM_QUESTIONS) {
      for (const t of [q.q, q.qPair]) {
        expect(t.endsWith('?'), t).toBe(true);
        expect(open.test(t), t).toBe(false);
      }
    }
    // pares com antônimos entregam o impostor na hora ("melhor" x "pior", "começar" x "terminar")
    const opposites: [RegExp, RegExp][] = [
      [/\bmelhor\b/i, /\bpior\b/i], [/\bcomeçar\b/i, /\bterminar\b/i], [/\bprimeiro\b/i, /\búltimo\b/i],
      [/\bgigante\b/i, /\bminúsculo\b/i], [/\brisada\b/i, /\bchoro\b/i], [/\bderrubar\b/i, /\bproteger\b/i],
      [/\bgosta\b/i, /\bodeia\b/i], [/\bquente\b/i, /\bfrio\b/i], [/\bcomprou\b.*\barrependeu\b/i, /\badorou\b/i],
    ];
    for (const q of IM_QUESTIONS) {
      for (const [a, b] of opposites) {
        expect((a.test(q.q) && b.test(q.qPair)) || (b.test(q.q) && a.test(q.qPair)), `${q.q} | ${q.qPair}`).toBe(false);
      }
    }
    expect(new Set(IM_QUESTIONS.map((q) => q.id)).size).toBe(IM_QUESTIONS.length);
  });
});

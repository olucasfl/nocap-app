import { describe, expect, it } from 'vitest';
import { MIM_CATEGORIES, MIM_WORDS, mimCategoriesFor, mimPoolSize } from './index';

describe('conteúdo da mímica', () => {
  it('todo tema tem palavras suficientes no estilo em que aparece', () => {
    for (const c of MIM_CATEGORIES) {
      if (c.classic) expect(mimPoolSize('classic', [c.id]), `${c.id} clássico`).toBeGreaterThanOrEqual(36);
      if (c.speed) expect(mimPoolSize('speed', [c.id]), `${c.id} speed`).toBeGreaterThanOrEqual(48);
    }
  });
  it('ids únicos, textos não vazios e sem duplicadas no mesmo tema e estilo', () => {
    expect(new Set(MIM_WORDS.map((w) => w.id)).size).toBe(MIM_WORDS.length);
    const seen = new Set<string>();
    for (const w of MIM_WORDS) {
      expect(w.text.trim().length, w.id).toBeGreaterThan(1);
      const k = `${w.pool}|${w.category}|${w.text.toLowerCase()}`;
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
    }
  });
  it('Ações só no Speed; Músicas e Marcas ficaram de fora (difíceis de mimicar)', () => {
    expect(mimCategoriesFor('classic').some((c) => c.id === 'acoes')).toBe(false);
    expect(mimCategoriesFor('speed').some((c) => c.id === 'acoes')).toBe(true);
    expect(MIM_CATEGORIES.some((c) => c.id === 'musica' || c.id === 'marcas')).toBe(false);
    expect(MIM_WORDS.some((w) => w.category === 'musica' || w.category === 'marcas')).toBe(false);
  });
  it('Lugares ficou de fora e o Futebol não tem nome de jogador nem de técnico', () => {
    expect(MIM_CATEGORIES.some((c) => c.id === 'lugares')).toBe(false);
    expect(MIM_WORDS.some((w) => w.category === 'lugares')).toBe(false);
    const fut = MIM_WORDS.filter((w) => w.category === 'futebol').map((w) => w.text);
    for (const nome of ['Pelé', 'Neymar', 'Messi', 'Ronaldo', 'Romário', 'Kaká', 'Tite', 'Guardiola']) expect(fut.some((t) => t.includes(nome)), nome).toBe(false);
    expect(fut).toContain('Pênalti');
  });
  it('Clash Royale usa o nome em português, sem o nome em inglês', () => {
    const clash = MIM_WORDS.filter((w) => w.category === 'clash').map((w) => w.text);
    expect(clash).toContain('Cavaleiro');
    expect(clash.every((t) => !t.includes('('))).toBe(true);
  });
});

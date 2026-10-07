import { describe, expect, it } from 'vitest';
import { GRADES, allLines, gradeLine, gradeOf } from './grade';

describe('faixas da nota', () => {
  it('CRAVOU é só o 10: 9,9 e 9,6 não cravam', () => {
    expect(gradeOf(10).id).toBe('perfect');
    expect(gradeOf(9.9).id).toBe('near');
    expect(gradeOf(9.6).id).toBe('near');
    expect(gradeOf(9.0).id).toBe('near');
  });

  it('cada faixa começa na nota certa', () => {
    const ids = [8.9, 8, 7.9, 7, 6.9, 6, 5.9, 5, 4.9, 3, 2.9, 1, 0.9, 0].map((s) => gradeOf(s).id);
    expect(ids).toEqual([
      'great',
      'great',
      'good',
      'good',
      'pass',
      'pass',
      'meh',
      'meh',
      'bad',
      'bad',
      'awful',
      'awful',
      'zero',
      'zero',
    ]);
  });

  it('tolera erro de ponto flutuante perto do limite', () => {
    expect(gradeOf(9.999999).id).toBe('perfect');
    expect(gradeOf(7.9999999).id).toBe('great');
    expect(gradeOf(7.94).id).toBe('good');
  });

  it('toda faixa tem pelo menos 4 frases e a frase vem do conjunto dela', () => {
    for (const g of GRADES) {
      expect(allLines(g.id).length).toBeGreaterThanOrEqual(4);
      expect(allLines(g.id)).toContain(gradeLine(g.id, 'time', () => 0.5));
      expect(allLines(g.id)).toContain(gradeLine(g.id, 'color', () => 0.99));
    }
  });
});

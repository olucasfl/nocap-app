import { describe, expect, it } from 'vitest';
import { nextPopup } from './popups';

describe('fila de popups', () => {
  it('vai primeiro quem tem prioridade menor (mais importante)', () => {
    expect(nextPopup({ boas: { priority: 10, at: 1 }, update: { priority: 0, at: 2 } })).toBe(
      'update',
    );
  });
  it('empate de prioridade: quem pediu antes', () => {
    expect(nextPopup({ b: { priority: 5, at: 3 }, a: { priority: 5, at: 1 } })).toBe('a');
  });
  it('fila vazia não tem próximo', () => {
    expect(nextPopup({})).toBeNull();
  });
});

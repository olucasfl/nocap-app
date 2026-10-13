import { describe, expect, it } from 'vitest';
import { SCORE_MAX, clampScore } from './score';

describe('clampScore', () => {
  it('deixa passar notas altas de verdade (o Block Classic passa de 10 mil pontos, 100 mil décimos)', () => {
    expect(clampScore(110_000)).toBe(110_000);
    expect(clampScore(3_276_700)).toBe(3_276_700);
  });
  it('arredonda e protege o banco de números absurdos ou quebrados', () => {
    expect(clampScore(12.6)).toBe(13);
    expect(clampScore(1e15)).toBe(SCORE_MAX);
    expect(clampScore(-1e15)).toBe(-SCORE_MAX);
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

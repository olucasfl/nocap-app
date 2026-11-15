import { describe, expect, it } from 'vitest';
import { GOLF_FAIL_STROKES, GOLF_LEVELS, GOLF_ORDER, GOLF_PARS, golfNextLevel, golfTierOf, golfCountedStrokes, golfParOf, golfScoreName } from './rules';

describe('Mini Golf: regras', () => {
  it('tem 21 fases com par de 2 a 5, e as três dificuldades cobrem todas, sem repetir', () => {
    expect(GOLF_LEVELS).toBe(21);
    expect([...GOLF_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    expect(golfTierOf(1)).toBe('easy');
    expect(golfTierOf(7)).toBe('easy');
    expect(golfTierOf(8)).toBe('medium');
    expect(golfTierOf(21)).toBe('hard');
    expect(golfNextLevel(13)).toBe(14);
    expect(golfNextLevel(21)).toBeNull();
    expect(Math.min(...GOLF_PARS)).toBe(2);
    expect(Math.max(...GOLF_PARS)).toBe(5);
    expect(golfParOf(1)).toBe(2);
    expect(golfParOf(20)).toBe(5);
    expect(golfParOf(30)).toBe(5);
  });
  it('os nomes do golfe vêm do par; 1 tacada é sempre ACE', () => {
    expect(golfScoreName(1, 4)).toBe('ace');
    expect(golfScoreName(1, 2)).toBe('ace');
    expect(golfScoreName(2, 5)).toBe('albatross');
    expect(golfScoreName(2, 4)).toBe('eagle');
    expect(golfScoreName(3, 4)).toBe('birdie');
    expect(golfScoreName(4, 4)).toBe('par');
    expect(golfScoreName(5, 4)).toBe('bogey');
    expect(golfScoreName(6, 4)).toBe('double');
    expect(golfScoreName(9, 4)).toBe('triple');
    expect(golfScoreName(16, 4, false)).toBe('fail');
  });
  it('quem não encaçapa conta 16 + 2', () => {
    expect(GOLF_FAIL_STROKES).toBe(18);
    expect(golfCountedStrokes(16, false)).toBe(18);
    expect(golfCountedStrokes(5, true)).toBe(5);
  });
});

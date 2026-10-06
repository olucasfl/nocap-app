import { describe, expect, it } from 'vitest';
import { createRng, randInt } from './rng';

describe('createRng', () => {
  it('mesma seed gera a mesma sequência', () => {
    const a = createRng('color:2026-01-01');
    const b = createRng('color:2026-01-01');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('seeds diferentes geram sequências diferentes', () => {
    expect(createRng('a')()).not.toBe(createRng('b')());
  });

  it('randInt respeita os limites', () => {
    const rng = createRng('limites');
    for (let i = 0; i < 500; i++) {
      const n = randInt(rng, 35, 95);
      expect(n).toBeGreaterThanOrEqual(35);
      expect(n).toBeLessThanOrEqual(95);
    }
  });
});

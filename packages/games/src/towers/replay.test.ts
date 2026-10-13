import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { TowersGame, type TowersInput } from './game';
import { evaluateTowers, TOWERS_MAX_STEPS } from './replay';

/** Joga como uma pessoa (teclas aleatórias, giros, magias, guia de queda) e devolve a partida. */
function playRandom(seed: string, who: string): TowersGame {
  const rng = createRng(`bot:${who}`);
  const g = new TowersGame(seed);
  const input: TowersInput = { left: false, right: false, down: false };
  while (!g.over && g.steps < TOWERS_MAX_STEPS) {
    const r = rng();
    if (r < 0.03) g.press(rng() < 0.5 ? -1 : 1);
    else if (r < 0.05) g.rotate();
    else if (r < 0.055) g.castSpell();
    else if (r < 0.07) {
      input.left = rng() < 0.3;
      input.right = !input.left && rng() < 0.3;
      input.down = rng() < 0.4;
    }
    if (g.steps % 7 === 0) g.dropDistance();
    g.step(input);
    g.drainEvents();
  }
  return g;
}

describe('evaluateTowers', () => {
  it('refaz a partida e chega na mesma nota', () => {
    for (const who of ['a', 'b', 'c']) {
      const g = playRandom(`seed-${who}`, who);
      expect(g.over).toBe(true);
      const t0 = Date.now();
      const r = evaluateTowers(`seed-${who}`, g.log);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.result).toEqual(g.result);
        expect(r.steps).toBe(g.steps);
      }
      console.log('replay', who, g.steps, 'passos', g.log.length, 'entradas', Date.now() - t0, 'ms');
    }
  }, 60_000);

  it('recusa registro vazio e fora de ordem', () => {
    expect(evaluateTowers('s', []).ok).toBe(false);
    expect(evaluateTowers('s', [32 + 1, 16 + 1]).ok).toBe(false);
  });
});

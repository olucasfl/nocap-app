import { describe, expect, it } from 'vitest';
import { STICK_DEAD, STICK_RADIUS, stickVector } from './controls';

describe('joystick', () => {
  it('parado dentro da zona morta', () => {
    expect(stickVector(0, 0)).toEqual({ mx: 0, mz: 0 });
    expect(stickVector(STICK_RADIUS * STICK_DEAD * 0.9, 0)).toEqual({ mx: 0, mz: 0 });
  });

  it('o máximo é 1 e a direção é preservada (cima na tela = -Z)', () => {
    const up = stickVector(0, -STICK_RADIUS * 3);
    expect(up.mx).toBeCloseTo(0, 6);
    expect(up.mz).toBeCloseTo(-1, 6);
    const diag = stickVector(STICK_RADIUS, STICK_RADIUS);
    expect(Math.hypot(diag.mx, diag.mz)).toBeCloseTo(1, 6);
    expect(diag.mx).toBeCloseTo(diag.mz, 6);
  });

  it('a curva é suave: meio caminho anda menos que o máximo e cresce sempre', () => {
    let prev = 0;
    for (let f = 0.2; f <= 1; f += 0.1) {
      const m = Math.hypot(stickVector(STICK_RADIUS * f, 0).mx, 0);
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
    expect(Math.abs(stickVector(STICK_RADIUS * 0.5, 0).mx)).toBeLessThan(0.7);
  });
});

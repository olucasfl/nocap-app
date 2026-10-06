import { describe, expect, it } from 'vitest';
import {
  colorGame,
  colorPresets,
  decodeAnswer,
  deltaE2000,
  encodeAnswer,
  generateColorRound,
  hsbToRgb,
  scoreColor,
  scoreFromDeltaE,
  type Lab,
} from './index';

// Pares de referência de Sharma, Wu e Dalal (2005).
const sharma: [Lab, Lab, number][] = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
  [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
  [[50, 2.5, 0], [73, 25, -18], 27.1492],
];

describe('deltaE2000', () => {
  it.each(sharma)('bate com Sharma (%j × %j)', (a, b, expected) => {
    expect(deltaE2000(a, b)).toBeCloseTo(expected, 3);
    expect(deltaE2000(b, a)).toBeCloseTo(expected, 3);
  });
});

describe('hsbToRgb', () => {
  it('converte cores conhecidas', () => {
    expect(hsbToRgb({ h: 0, s: 100, b: 100 })).toEqual([255, 0, 0]);
    expect(hsbToRgb({ h: 120, s: 100, b: 100 })).toEqual([0, 255, 0]);
    expect(hsbToRgb({ h: 0, s: 0, b: 0 })).toEqual([0, 0, 0]);
  });
});

describe('presets', () => {
  it('o rápido tem 1 rodada e o tempo do Clássico', () => {
    expect(colorPresets.quick).toEqual({ rounds: 1, showMs: colorPresets.classic!.showMs });
  });
});

describe('score', () => {
  it('cor idêntica vale 10', () => {
    expect(scoreColor({ h: 200, s: 60, b: 70 }, { h: 200, s: 60, b: 70 })).toBe(10);
  });

  it('fica sempre entre 0 e 10, com 1 casa', () => {
    for (let h = 0; h < 360; h += 40) {
      const s = scoreColor({ h: 0, s: 90, b: 90 }, { h, s: 35, b: 40 });
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(10);
      expect(s).toBe(Math.round(s * 10) / 10);
    }
    expect(scoreFromDeltaE(1000)).toBe(0);
    expect(scoreFromDeltaE(0)).toBe(10);
  });

  it.each([
    [2, 9.5, 10],
    [3.5, 8.8, 9.3],
    [6, 7, 8],
    [10, 5.2, 6],
    [20, 2.8, 3.4],
    [35, 1, 2],
    [60, 0.3, 1],
  ])('ΔE %d rende entre %d e %d', (dE, min, max) => {
    const s = scoreFromDeltaE(dE);
    expect(s).toBeGreaterThanOrEqual(min);
    expect(s).toBeLessThanOrEqual(max);
  });

  it('nunca aumenta quando ΔE aumenta', () => {
    let prev = 10;
    for (let dE = 0; dE <= 120; dE += 0.5) {
      const s = scoreFromDeltaE(dE);
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
  });
});

describe('generateColorRound', () => {
  it('mesma seed gera as mesmas rodadas', () => {
    const s = colorPresets.classic!;
    const a = [0, 1, 2, 3, 4].map((i) => generateColorRound('color:2026-01-01', s, i));
    const b = [0, 1, 2, 3, 4].map((i) => generateColorRound('color:2026-01-01', s, i));
    expect(a).toEqual(b);
  });

  it('respeita as faixas de H, S e B', () => {
    const s = colorPresets.classic!;
    for (let i = 0; i < 300; i++) {
      const r = generateColorRound(`seed-${i}`, s, i % 5);
      expect(r.h).toBeGreaterThanOrEqual(0);
      expect(r.h).toBeLessThanOrEqual(359);
      expect(r.s).toBeGreaterThanOrEqual(35);
      expect(r.s).toBeLessThanOrEqual(95);
      expect(r.b).toBeGreaterThanOrEqual(40);
      expect(r.b).toBeLessThanOrEqual(95);
    }
  });
});

describe('answer encoding', () => {
  it('encode/decode é reversível', () => {
    const a = { h: 359, s: 95, b: 40 };
    expect(encodeAnswer(a)).toBe(3599540);
    expect(decodeAnswer(encodeAnswer(a))).toEqual(a);
  });
});

describe('colorGame', () => {
  it('presets seguem o schema e o contrato', () => {
    for (const p of Object.values(colorGame.presets)) {
      expect(colorGame.settingsSchema.safeParse(p).success).toBe(true);
    }
    expect(colorGame.presets.classic).toEqual({ rounds: 5, showMs: 3000 });
    expect(colorGame.presets.flash).toEqual({ rounds: 5, showMs: 400 });
    expect(colorGame.meta.ranking).toBe('score');
  });
});

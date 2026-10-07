import { describe, expect, it } from 'vitest';
import {
  generateTimeRound,
  isPlausibleAnswer,
  relativeError,
  scoreFromError,
  scoreTime,
  timeGame,
  timePresets,
} from './index';

const classic = timePresets.classic!;
const strict = timePresets.strict!;

describe('alvos', () => {
  it('mesma seed, mesmos alvos; seeds diferentes mudam', () => {
    const a = Array.from({ length: 5 }, (_, i) => generateTimeRound('s1', classic, i));
    const b = Array.from({ length: 5 }, (_, i) => generateTimeRound('s1', classic, i));
    const c = Array.from({ length: 5 }, (_, i) => generateTimeRound('s2', classic, i));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('ficam na faixa, em múltiplos de 100 ms', () => {
    for (let i = 0; i < 200; i++) {
      const t = generateTimeRound(`seed-${i}`, classic, i % 5);
      expect(t).toBeGreaterThanOrEqual(classic.minMs);
      expect(t).toBeLessThanOrEqual(classic.maxMs);
      expect(t % 100).toBe(0);
    }
  });

  it('respeita a faixa de outras salas (curtos 1–5 s)', () => {
    const short = { ...classic, minMs: 1000, maxMs: 5000 };
    for (let i = 0; i < 100; i++) {
      const t = generateTimeRound(`x-${i}`, short, 0);
      expect(t).toBeGreaterThanOrEqual(1000);
      expect(t).toBeLessThanOrEqual(5000);
    }
  });
});

describe('nota', () => {
  it('acertar em cheio vale 10 e a nota fica em [0, 10] com 1 casa', () => {
    expect(scoreFromError(0)).toBe(10);
    for (const e of [0.001, 0.05, 0.3, 1, 5, 1000]) {
      const s = scoreFromError(e);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(10);
      expect(s).toBe(Math.round(s * 10) / 10);
    }
  });

  it.each([
    [0.01, 9.7, 10],
    [0.03, 9, 9.6],
    [0.05, 8.2, 8.8],
    [0.1, 6.2, 7],
    [0.2, 3.5, 4.3],
    [0.4, 1.3, 2.1],
    [0.8, 0.3, 1],
  ])('erro de %d rende entre %d e %d', (e, min, max) => {
    const s = scoreFromError(e);
    expect(s).toBeGreaterThanOrEqual(min);
    expect(s).toBeLessThanOrEqual(max);
  });

  it('nunca aumenta quando o erro aumenta', () => {
    let prev = 10;
    for (let e = 0; e <= 3; e += 0.005) {
      const s = scoreFromError(e);
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
  });

  it('é o erro relativo que conta: 0,3 s pesa mais em 2 s do que em 10 s', () => {
    expect(scoreTime(2000, 2300, classic)).toBeLessThan(scoreTime(10_000, 10_300, classic));
    expect(relativeError(10_000, 10_300)).toBeCloseTo(0.03);
  });

  it('errar para menos e para mais pelo mesmo tempo vale o mesmo no clássico', () => {
    expect(scoreTime(8000, 7600, classic)).toBe(scoreTime(8000, 8400, classic));
  });

  it('"sem estourar": passou do alvo vale zero; parar antes ainda pontua', () => {
    expect(scoreTime(8000, 8001, strict)).toBe(0);
    expect(scoreTime(8000, 8000, strict)).toBe(10);
    expect(scoreTime(8000, 7600, strict)).toBeGreaterThan(0);
  });
});

describe('plausibilidade', () => {
  it('recusa toque duplo, contagem absurda e valor não inteiro', () => {
    expect(isPlausibleAnswer(8000, 100)).toBe(false);
    expect(isPlausibleAnswer(8000, 199)).toBe(false);
    expect(isPlausibleAnswer(8000, 24_001)).toBe(false);
    expect(isPlausibleAnswer(8000, 7999.5)).toBe(false);
    expect(isPlausibleAnswer(8000, 7600)).toBe(true);
    expect(isPlausibleAnswer(8000, 24_000)).toBe(true);
  });
});

describe('presets e definição', () => {
  it('o rápido tem 1 rodada e o "sem estourar" liga a regra', () => {
    expect(timePresets.quick!.rounds).toBe(1);
    expect(timePresets.strict!.noOvershoot).toBe(true);
    expect(timePresets.classic!.noOvershoot).toBe(false);
  });

  it('segue o contrato GameDefinition', () => {
    expect(timeGame.id).toBe('time');
    expect(timeGame.meta.ranking).toBe('score');
    for (const settings of Object.values(timePresets)) {
      expect(timeGame.settingsSchema.safeParse(settings).success).toBe(true);
    }
  });
});

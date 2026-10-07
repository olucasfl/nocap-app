import { describe, expect, it } from 'vitest';
import {
  LONG_TARGET_MS,
  SHORT_TARGET_MS,
  generateTimeRound,
  isPlausibleAnswer,
  legacyTimePresets,
  presetFor,
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
    const a = Array.from({ length: 3 }, (_, i) => generateTimeRound('s1', classic, i));
    const b = Array.from({ length: 3 }, (_, i) => generateTimeRound('s1', classic, i));
    const c = Array.from({ length: 3 }, (_, i) => generateTimeRound('s2', classic, i));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('o clássico tem 3 rodadas alternando curto (< 10 s), longo (> 10 s) e curto', () => {
    expect(classic.rounds).toBe(3);
    for (let i = 0; i < 300; i++) {
      const [r1, r2, r3] = [0, 1, 2].map((n) => generateTimeRound(`seed-${i}`, classic, n));
      expect(r1).toBeLessThan(10_000);
      expect(r2).toBeGreaterThan(10_000);
      expect(r3).toBeLessThan(10_000);
    }
  });

  it('"sem estourar" tem a mesma cadência do clássico', () => {
    expect(strict.rounds).toBe(3);
    for (let i = 0; i < 100; i++) {
      const t = [0, 1, 2].map((n) => generateTimeRound(`s-${i}`, strict, n));
      expect([t[0]! < 10_000, t[1]! > 10_000, t[2]! < 10_000]).toEqual([true, true, true]);
    }
  });

  it('os modos comuns cobrem de 1 s a 22 s; a Sequência continua de 2 a 6 s', () => {
    const all: number[] = [];
    for (let i = 0; i < 400; i++) {
      for (let n = 0; n < 3; n++) all.push(generateTimeRound(`r-${i}`, classic, n));
    }
    expect(Math.min(...all)).toBeLessThan(2000);
    expect(Math.max(...all)).toBeGreaterThan(20_000);
    expect(Math.min(...all)).toBeGreaterThanOrEqual(1000);
    expect(Math.max(...all)).toBeLessThanOrEqual(22_000);
    for (let i = 0; i < 200; i++) {
      for (let n = 0; n < 5; n++) {
        const t = generateTimeRound(`q-${i}`, timePresets.sequence!, n);
        expect(t).toBeGreaterThanOrEqual(2000);
        expect(t).toBeLessThanOrEqual(6000);
      }
    }
  });

  it('as faixas respeitam os limites e saem em múltiplos de 100 ms', () => {
    for (let i = 0; i < 300; i++) {
      const short = generateTimeRound(`x-${i}`, classic, 0);
      const long = generateTimeRound(`x-${i}`, classic, 1);
      expect(short).toBeGreaterThanOrEqual(SHORT_TARGET_MS.min);
      expect(short).toBeLessThanOrEqual(SHORT_TARGET_MS.max);
      expect(long).toBeGreaterThanOrEqual(LONG_TARGET_MS.min);
      expect(long).toBeLessThanOrEqual(LONG_TARGET_MS.max);
      expect(short % 100).toBe(0);
      expect(long % 100).toBe(0);
    }
  });

  it('o rápido é curto na maior parte das vezes e longo só de vez em quando', () => {
    const quick = timePresets.quick!;
    let long = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) if (generateTimeRound(`q-${i}`, quick, 0) > 10_000) long++;
    expect(long / n).toBeGreaterThan(0.18);
    expect(long / n).toBeLessThan(0.32);
  });

  it('salas com faixa própria (sem mix) continuam uniformes e dentro da faixa', () => {
    const room = {
      rounds: 3,
      minMs: 1000,
      maxMs: 5000,
      noOvershoot: false,
      mix: 'uniform' as const,
    };
    for (let i = 0; i < 100; i++) {
      const t = generateTimeRound(`r-${i}`, room, 0);
      expect(t).toBeGreaterThanOrEqual(1000);
      expect(t).toBeLessThanOrEqual(5000);
    }
  });
});

describe('partidas antigas (5 rodadas, 5 a 15 s)', () => {
  it('o histórico escolhe o preset pelo número de respostas guardadas', () => {
    expect(presetFor('classic', 3)).toBe(timePresets.classic);
    expect(presetFor('classic', 5)).toBe(legacyTimePresets.classic);
    expect(presetFor('strict', 5)).toBe(legacyTimePresets.strict);
    expect(presetFor('quick', 1)).toBe(timePresets.quick);
  });

  it('os alvos antigos continuam os mesmos de antes (uniformes de 5 a 15 s)', () => {
    const old = legacyTimePresets.classic!;
    for (let i = 0; i < 100; i++) {
      const t = generateTimeRound(`old-${i}`, old, i % 5);
      expect(t).toBeGreaterThanOrEqual(5000);
      expect(t).toBeLessThanOrEqual(15_000);
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

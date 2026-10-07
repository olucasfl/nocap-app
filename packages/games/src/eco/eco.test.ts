import { describe, expect, it } from 'vitest';
import {
  ECO_MAX_PADS,
  ECO_MAX_STEPS,
  ECO_MIN_TAP_MS,
  ECO_PAUSE_MS,
  ecoPresets,
  ecoTenths,
  evaluateRun,
  expectedTaps,
  lengthAt,
  maxRounds,
  minDurationMs,
  padsAt,
  sequenceFor,
  stepAt,
  stepMsAt,
} from './index';

const classic = ecoPresets.classic;

/** Toques perfeitos das `n` primeiras rodadas. */
function perfect(seed: string, s: typeof classic, n: number): number[] {
  const taps: number[] = [];
  for (let r = 1; r <= n; r++) taps.push(...expectedTaps(seed, s, r));
  return taps;
}

describe('sequência', () => {
  it('mesma seed, mesma sequência; seeds diferentes divergem', () => {
    expect(sequenceFor('a', classic, 12)).toEqual(sequenceFor('a', classic, 12));
    expect(sequenceFor('a', classic, 12)).not.toEqual(sequenceFor('b', classic, 12));
  });

  it('o começo nunca muda quando a sequência cresce (todos os modos)', () => {
    for (const s of Object.values(ecoPresets)) {
      const short = sequenceFor('seed-x', s, 3);
      const long = sequenceFor('seed-x', s, 30);
      expect(long.slice(0, short.length)).toEqual(short);
    }
  });

  it('só usa botões que existem na rodada em que o passo entrou', () => {
    for (const s of Object.values(ecoPresets)) {
      for (let i = 0; i < 40; i++) {
        const v = stepAt('seed-y', s, i);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(padsAt(s, Math.max(1, i + 2 - s.startLength)));
      }
    }
  });

  it('cada rodada tem o tamanho certo (Reverso começa com 2)', () => {
    expect(sequenceFor('s', classic, 1)).toHaveLength(1);
    expect(sequenceFor('s', classic, 9)).toHaveLength(9);
    expect(sequenceFor('s', ecoPresets.reverso, 1)).toHaveLength(2);
  });
});

describe('modos', () => {
  it('Clássico mantém 4 botões e 700 ms', () => {
    expect(padsAt(classic, 1)).toBe(4);
    expect(padsAt(classic, 40)).toBe(4);
    expect(stepMsAt(classic, 40)).toBe(700);
  });

  it('Escalada ganha um botão a cada 5 rodadas e para em 9 (rodada 26)', () => {
    const s = ecoPresets.escalada;
    expect([1, 5, 6, 10, 11, 25, 26, 40].map((r) => padsAt(s, r))).toEqual([
      4, 4, 5, 5, 6, 8, 9, 9,
    ]);
    expect(padsAt(s, 100)).toBe(ECO_MAX_PADS);
  });

  it('Velocidade começa em 800 ms, cai 25 ms por rodada e para em 250 (rodada 23)', () => {
    const s = ecoPresets.velocidade;
    expect(stepMsAt(s, 1)).toBe(800);
    expect(stepMsAt(s, 2)).toBe(775);
    expect(stepMsAt(s, 23)).toBe(250);
    expect(stepMsAt(s, 40)).toBe(250);
  });

  it('Reverso espera a sequência de trás para frente', () => {
    const s = ecoPresets.reverso;
    const seq = sequenceFor('r', s, 4);
    expect(expectedTaps('r', s, 4)).toEqual([...seq].reverse());
    expect(expectedTaps('r', classic, 4)).toEqual(sequenceFor('r', classic, 4));
  });

  it('o teto é de 40 passos em todos os modos', () => {
    for (const s of Object.values(ecoPresets)) {
      expect(lengthAt(s, maxRounds(s))).toBe(ECO_MAX_STEPS);
    }
  });
});

describe('evaluateRun', () => {
  it('nenhum toque: acaba por tempo sem passos', () => {
    const r = evaluateRun('s', classic, []);
    expect(r).toMatchObject({
      completed: 0,
      steps: 0,
      ended: 'timeout',
      usedTaps: 0,
      roundsShown: 1,
    });
  });

  it('repetir 5 rodadas e errar na sexta vale 5 passos', () => {
    const seed = 'abc';
    const right = expectedTaps(seed, classic, 6);
    const wrong = (right[0]! + 1) % 4;
    const taps = [...perfect(seed, classic, 5), wrong];
    const r = evaluateRun(seed, classic, taps);
    expect(r).toMatchObject({
      completed: 5,
      steps: 5,
      ended: 'wrong',
      usedTaps: taps.length,
      roundsShown: 6,
    });
    expect(ecoTenths(r)).toBe(50);
  });

  it('errar já no primeiro toque vale 0', () => {
    const first = expectedTaps('z', classic, 1)[0]!;
    const r = evaluateRun('z', classic, [(first + 1) % 4]);
    expect(r).toMatchObject({ completed: 0, steps: 0, ended: 'wrong', usedTaps: 1 });
  });

  it('parar de tocar no meio da rodada conta só as rodadas fechadas', () => {
    const taps = [...perfect('q', classic, 3), ...expectedTaps('q', classic, 4).slice(0, 2)];
    const r = evaluateRun('q', classic, taps);
    expect(r).toMatchObject({ completed: 3, steps: 3, ended: 'timeout', usedTaps: taps.length });
  });

  it('toques depois do erro não contam (usedTaps denuncia o excesso)', () => {
    const right = expectedTaps('w', classic, 1)[0]!;
    const taps = [(right + 1) % 4, 0, 1, 2];
    expect(evaluateRun('w', classic, taps).usedTaps).toBe(1);
  });

  it('chegar ao teto de 40 passos é "perfeito"', () => {
    for (const [name, s] of Object.entries(ecoPresets)) {
      const taps = perfect('top', s, maxRounds(s));
      const r = evaluateRun('top', s, taps);
      expect(r.ended, name).toBe('perfect');
      expect(r.steps, name).toBe(ECO_MAX_STEPS);
      expect(r.usedTaps, name).toBe(taps.length);
    }
  });

  it('Reverso exige a ordem inversa: a ordem normal erra', () => {
    const s = ecoPresets.reverso;
    const seq = sequenceFor('rev', s, 1);
    // só é um erro de verdade se a sequência não for um palíndromo
    if (seq[0] !== seq[1]) {
      expect(evaluateRun('rev', s, seq).ended).toBe('wrong');
    }
    expect(evaluateRun('rev', s, [...seq].reverse()).completed).toBe(1);
  });
});

describe('tempo mínimo plausível', () => {
  it('soma pausas, reproduções e o tempo de tocar', () => {
    const taps = perfect('t', classic, 3);
    const run = evaluateRun('t', classic, taps);
    const playback = (1 + 2 + 3 + 4) * 700; // 3 rodadas completas + a quarta mostrada
    expect(run.roundsShown).toBe(4);
    expect(minDurationMs(classic, run)).toBe(
      taps.length * ECO_MIN_TAP_MS + 4 * ECO_PAUSE_MS + playback,
    );
  });

  it('Velocidade é mais curta que o Clássico para a mesma partida', () => {
    const seedRun = (s: typeof classic) => {
      const taps = perfect('v', s, 10);
      return minDurationMs(s, evaluateRun('v', s, taps));
    };
    expect(seedRun(ecoPresets.velocidade)).toBeLessThan(seedRun(ecoPresets.classic));
  });
});

import { BadRequestException } from '@nestjs/common';
import { colorGame, generateTimeRound, timePresets } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { scoreMatch, scoreTimeMatch } from './match-scoring';

const SEED = 'seed-sv';
const colorPerfect = (i: number) => colorGame.generateRound(SEED, colorGame.presets.survival!, i);
const colorBad = { h: 180, s: 0, b: 0 };

describe('Cor: Sobrevivência', () => {
  it('termina quando as 3 vidas acabam e guarda as rodadas jogadas (x10)', () => {
    const answers = [colorPerfect(0), colorPerfect(1), colorBad, colorBad, colorBad];
    const scored = scoreMatch({ mode: 'survival', seed: SEED, answers });
    expect(scored.totalTenths).toBe(50);
    expect(scored.rounds).toHaveLength(5);
  });

  it('recusa partida que não terminou', () => {
    expect(() =>
      scoreMatch({ mode: 'survival', seed: SEED, answers: [colorPerfect(0), colorBad] }),
    ).toThrow(BadRequestException);
  });

  it('recusa rodadas depois do fim', () => {
    const answers = [colorBad, colorBad, colorBad, colorPerfect(3)];
    expect(() => scoreMatch({ mode: 'survival', seed: SEED, answers })).toThrow(
      BadRequestException,
    );
  });
});

describe('Cor: Às cegas', () => {
  it('é uma partida de 5 rodadas como a clássica', () => {
    const answers = [0, 1, 2, 3, 4].map((i) =>
      colorGame.generateRound(SEED, colorGame.presets.blind!, i),
    );
    const scored = scoreMatch({ mode: 'blind', seed: SEED, answers });
    expect(scored.totalTenths).toBe(500);
    expect(() => scoreMatch({ mode: 'blind', seed: SEED, answers: answers.slice(0, 3) })).toThrow(
      BadRequestException,
    );
  });
});

describe('Tempo: Sequência e Sobrevivência', () => {
  const target = (mode: string, i: number) => generateTimeRound(SEED, timePresets[mode]!, i);

  it('Sequência: 5 alvos curtos (2 a 6 s)', () => {
    for (let i = 0; i < 5; i++) {
      const t = target('sequence', i);
      expect(t).toBeGreaterThanOrEqual(2000);
      expect(t).toBeLessThanOrEqual(6000);
    }
    const answers = [0, 1, 2, 3, 4].map((i) => target('sequence', i));
    const scored = scoreTimeMatch({ mode: 'sequence', seed: SEED, answers, elapsedMs: 60_000 });
    expect(scored.totalTenths).toBe(500);
  });

  it('Sobrevivência: acaba na terceira falha e confere o relógio', () => {
    const miss = (i: number) => Math.round(target('survival', i) * 1.6);
    const answers = [target('survival', 0), miss(1), miss(2), miss(3)];
    const total = answers.reduce((a, b) => a + b, 0);
    const scored = scoreTimeMatch({
      mode: 'survival',
      seed: SEED,
      answers,
      elapsedMs: total + 500,
    });
    expect(scored.totalTenths).toBe(40);
    expect(() =>
      scoreTimeMatch({ mode: 'survival', seed: SEED, answers, elapsedMs: total / 2 }),
    ).toThrow(BadRequestException);
    expect(() =>
      scoreTimeMatch({
        mode: 'survival',
        seed: SEED,
        answers: answers.slice(0, 3),
        elapsedMs: 99_999,
      }),
    ).toThrow(BadRequestException);
  });
});

describe('Cor: Sobrevivência com nota mínima crescente', () => {
  it('aceita uma partida longa (até 30 rodadas) e exige 7 na rodada 5', () => {
    const perfect = (i: number) => colorGame.generateRound(SEED, colorGame.presets.survival!, i);
    const run = [0, 1, 2, 3].map(perfect);
    // Rodada 5 (índice 4) com a cor errada: perde uma vida (mínimo 7), e mais duas falham no fim.
    const answers = [...run, colorBad, colorBad, colorBad];
    const scored = scoreMatch({ mode: 'survival', seed: SEED, answers });
    expect(scored.totalTenths).toBe(70);
    // Perfeito nas 30 rodadas: completou, e guarda 30 rodadas (x10).
    const all = Array.from({ length: 30 }, (_, i) => perfect(i));
    expect(scoreMatch({ mode: 'survival', seed: SEED, answers: all }).totalTenths).toBe(300);
  });
});

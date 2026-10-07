import { describe, expect, it } from 'vitest';
import {
  SURVIVAL_LIVES,
  SURVIVAL_MAX_ROUNDS,
  evaluateSurvival,
  survivalMinScore,
  survivalShowMs,
} from './survival';

describe('survival', () => {
  it('Cor e Tempo: a nota mínima sobe de 6 até 9, de cinco em cinco rodadas', () => {
    for (const game of ['color', 'time'] as const) {
      const at = (round: number) => survivalMinScore(game, round - 1);
      expect([1, 5, 6, 10, 11, 15, 16, 20, 21, 25, 26, 30].map(at)).toEqual([
        6, 6, 7, 7, 7.5, 7.5, 8, 8, 8.5, 8.5, 9, 9,
      ]);
    }
  });

  it('o limite é 30 rodadas nos dois jogos', () => {
    expect(SURVIVAL_MAX_ROUNDS).toEqual({ color: 30, time: 30 });
  });

  it('o tempo de decorar cai devagar até 1 s', () => {
    expect(survivalShowMs(0)).toBe(3000);
    expect(survivalShowMs(10)).toBe(2000);
    expect(survivalShowMs(40)).toBe(1000);
  });

  it('perder as 3 vidas encerra na rodada da terceira falha', () => {
    const s = evaluateSurvival('time', [9, 2, 9, 2, 9, 2, 9]);
    expect(s).toMatchObject({ played: 6, lives: 0, ended: 'lives' });
    expect(s.passed).toEqual([true, false, true, false, true, false]);
  });

  it('enquanto há vidas a partida segue (ended null)', () => {
    expect(evaluateSurvival('color', [9, 9, 3])).toMatchObject({
      played: 3,
      lives: SURVIVAL_LIVES - 1,
      ended: null,
    });
  });

  it('Cor: na rodada 6 o mínimo passa a ser 7 (6,9 não passa)', () => {
    const base = [10, 10, 10, 10, 10];
    expect(evaluateSurvival('color', [...base, 7]).passed[5]).toBe(true);
    expect(evaluateSurvival('color', [...base, 6.9]).passed[5]).toBe(false);
  });

  it('Cor: completar as 30 rodadas com notas altas ganha', () => {
    const scores = Array.from({ length: 30 }, (_, i) => survivalMinScore('color', i) + 0.5);
    expect(evaluateSurvival('color', scores)).toMatchObject({ played: 30, lives: 3, ended: 'cap' });
    // Um 8,9 na rodada 26 (mínimo 9) custa uma vida mas não acaba o jogo.
    const slip = [...scores];
    slip[25] = 8.9;
    const s = evaluateSurvival('color', slip);
    expect(s.passed[25]).toBe(false);
    expect(s).toMatchObject({ played: 30, lives: 2, ended: 'cap' });
  });

  it('Tempo: chegar ao limite de 30 rodadas completa a partida', () => {
    const s = evaluateSurvival('time', Array(35).fill(10));
    expect(s).toMatchObject({ played: 30, ended: 'cap' });
  });
});

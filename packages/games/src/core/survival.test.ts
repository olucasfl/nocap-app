import { describe, expect, it } from 'vitest';
import {
  SURVIVAL_LIVES,
  SURVIVAL_MAX_ROUNDS,
  evaluateSurvival,
  survivalMinScore,
  survivalShowMs,
} from './survival';

describe('survival', () => {
  it('a nota mínima sobe com as rodadas (5, 6, 7)', () => {
    expect([0, 2, 3, 7, 8, 15].map(survivalMinScore)).toEqual([5, 5, 6, 6, 7, 7]);
  });

  it('o tempo de decorar cai até 0,8 s', () => {
    expect(survivalShowMs(0)).toBe(3000);
    expect(survivalShowMs(4)).toBe(2400);
    expect(survivalShowMs(40)).toBe(800);
  });

  it('perder as 3 vidas encerra na rodada da terceira falha', () => {
    const s = evaluateSurvival([9, 2, 9, 2, 9, 2, 9]);
    expect(s).toMatchObject({ played: 6, lives: 0, ended: 'lives' });
    expect(s.passed).toEqual([true, false, true, false, true, false]);
  });

  it('enquanto há vidas a partida segue (ended null)', () => {
    expect(evaluateSurvival([9, 9, 3])).toMatchObject({
      played: 3,
      lives: SURVIVAL_LIVES - 1,
      ended: null,
    });
  });

  it('chegar ao limite de rodadas completa a partida', () => {
    const s = evaluateSurvival(Array(SURVIVAL_MAX_ROUNDS + 5).fill(10));
    expect(s).toMatchObject({ played: SURVIVAL_MAX_ROUNDS, ended: 'cap' });
  });

  it('a mínima da rodada vale: 6 passa na rodada 4, mas 5,9 não', () => {
    expect(evaluateSurvival([9, 9, 9, 6]).passed[3]).toBe(true);
    expect(evaluateSurvival([9, 9, 9, 5.9]).passed[3]).toBe(false);
  });
});

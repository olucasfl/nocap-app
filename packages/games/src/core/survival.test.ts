import { describe, expect, it } from 'vitest';
import {
  SURVIVAL_LIVES,
  SURVIVAL_MAX_ROUNDS,
  evaluateSurvival,
  survivalMinScore,
  survivalShowMs,
} from './survival';

describe('survival', () => {
  it('Cor: a nota mínima sobe (6, 7 na rodada 5, 8 na 10, 9 na 15, 10 da 20 em diante)', () => {
    const at = (round: number) => survivalMinScore('color', round - 1);
    expect([1, 4, 5, 9, 10, 14, 15, 19, 20, 30].map(at)).toEqual([6, 6, 7, 7, 8, 8, 9, 9, 10, 10]);
  });

  it('Tempo: nota mínima fixa em 6', () => {
    expect([0, 4, 9, 15].map((i) => survivalMinScore('time', i))).toEqual([6, 6, 6, 6]);
  });

  it('o limite é 30 rodadas na Cor e 20 no Tempo', () => {
    expect(SURVIVAL_MAX_ROUNDS).toEqual({ color: 30, time: 20 });
  });

  it('o tempo de decorar cai até 0,8 s', () => {
    expect(survivalShowMs(0)).toBe(3000);
    expect(survivalShowMs(4)).toBe(2400);
    expect(survivalShowMs(40)).toBe(800);
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

  it('Cor: na rodada 5 o mínimo passa a ser 7 (6,9 não passa)', () => {
    const base = [10, 10, 10, 10];
    expect(evaluateSurvival('color', [...base, 7]).passed[4]).toBe(true);
    expect(evaluateSurvival('color', [...base, 6.9]).passed[4]).toBe(false);
  });

  it('Cor: da rodada 20 até a 30 só vale 10; completar as 30 ganha', () => {
    const perfect = Array(30).fill(10);
    expect(evaluateSurvival('color', perfect)).toMatchObject({
      played: 30,
      lives: 3,
      ended: 'cap',
    });
    // Um 9,9 na rodada 20 custa uma vida.
    const slip = [...perfect];
    slip[19] = 9.9;
    expect(evaluateSurvival('color', slip.slice(0, 31)).passed[19]).toBe(false);
  });

  it('Tempo: chegar ao limite de 20 rodadas completa a partida', () => {
    const s = evaluateSurvival('time', Array(25).fill(10));
    expect(s).toMatchObject({ played: 20, ended: 'cap' });
  });
});

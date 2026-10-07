import { describe, expect, it } from 'vitest';
import {
  defaultLeaderRounds,
  firstBrokenRule,
  followerScore,
  leaderCreateMs,
  leaderPads,
  leaderRules,
  leaderScore,
  leaderTaps,
  ruleHolds,
  validLeaderSequence,
} from './leader';

describe('Siga o Líder: dificuldade', () => {
  it('toques e botões crescem como na spec', () => {
    expect([1, 2, 3, 4, 9, 20].map(leaderTaps)).toEqual([4, 6, 8, 10, 20, 20]);
    expect([1, 2, 3, 4, 5, 11, 12].map(leaderPads)).toEqual([4, 4, 5, 5, 6, 9, 9]);
  });

  it('regras extras: 0 nas rodadas 1 e 2, 1 até a 6, 2 depois', () => {
    const extras = (r: number) => leaderRules('s', r).length - 1;
    expect([1, 2, 3, 6, 7, 12].map(extras)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('tempo para criar: 20 s + 3 s por toque, no máximo 60 s', () => {
    expect(leaderCreateMs(1)).toBe(32_000);
    expect(leaderCreateMs(12)).toBe(60_000);
  });

  it('rodadas padrão: o maior entre 6 e os jogadores, até 12', () => {
    expect([2, 6, 9, 20].map(defaultLeaderRounds)).toEqual([6, 6, 9, 12]);
  });
});

describe('Siga o Líder: regras', () => {
  it('toda combinação sorteada tem pelo menos uma sequência possível', () => {
    for (let i = 0; i < 60; i++) {
      for (let round = 1; round <= 12; round++) {
        const seq = validLeaderSequence(`seed-${i}`, round);
        const rules = leaderRules(`seed-${i}`, round);
        expect(firstBrokenRule(seq, rules, leaderPads(round))).toBeNull();
        expect(seq).toHaveLength(leaderTaps(round));
      }
    }
  });

  it('é determinística pela seed', () => {
    expect(leaderRules('abc', 8)).toEqual(leaderRules('abc', 8));
    expect(validLeaderSequence('abc', 8)).toEqual(validLeaderSequence('abc', 8));
  });

  it('cada regra do catálogo vale e falha quando deve', () => {
    expect(ruleHolds({ kind: 'count', n: 3 }, [0, 1, 2])).toBe(true);
    expect(ruleHolds({ kind: 'count', n: 3 }, [0, 1])).toBe(false);
    expect(ruleHolds({ kind: 'minColors', k: 3 }, [0, 1, 1, 2])).toBe(true);
    expect(ruleHolds({ kind: 'minColors', k: 3 }, [0, 1, 1, 0])).toBe(false);
    expect(ruleHolds({ kind: 'noRepeat' }, [0, 1, 0])).toBe(true);
    expect(ruleHolds({ kind: 'noRepeat' }, [0, 0, 1])).toBe(false);
    expect(ruleHolds({ kind: 'sameEnds' }, [2, 1, 2])).toBe(true);
    expect(ruleHolds({ kind: 'sameEnds' }, [2, 1, 3])).toBe(false);
    expect(ruleHolds({ kind: 'useAtLeast', pad: 1, times: 2 }, [1, 0, 1])).toBe(true);
    expect(ruleHolds({ kind: 'useAtLeast', pad: 1, times: 2 }, [1, 0, 2])).toBe(false);
    expect(ruleHolds({ kind: 'avoid', pad: 3 }, [0, 1, 2])).toBe(true);
    expect(ruleHolds({ kind: 'avoid', pad: 3 }, [0, 3])).toBe(false);
  });

  it('recusa botão que não existe na rodada', () => {
    const rules = leaderRules('s', 1);
    expect(firstBrokenRule([0, 1, 2, 7], rules, 4)).toBe(0);
  });
});

describe('Siga o Líder: notas', () => {
  it('seguidor: completar vale 10', () => {
    expect(followerScore(8, 8)).toBe(10);
    expect(followerScore(4, 8)).toBe(5);
    expect(followerScore(0, 8)).toBe(0);
  });

  it('líder: 0,7 × (10 − média) e no máximo 7', () => {
    expect(leaderScore([10, 10])).toBe(0);
    expect(leaderScore([0, 0])).toBe(7);
    expect(leaderScore([5, 5])).toBe(3.5);
    expect(leaderScore([])).toBe(0);
  });
});

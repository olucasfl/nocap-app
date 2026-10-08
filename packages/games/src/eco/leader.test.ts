import { describe, expect, it } from 'vitest';
import {
  defaultLeaderRounds,
  fairLeaderRounds,
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
  it('as três primeiras rodadas crescem devagar: 3 sem regra, 4 com uma, 5 com duas', () => {
    const shape = (r: number) => [leaderTaps('s', r), leaderRules('s', r).length - 1];
    expect(shape(1)).toEqual([3, 0]);
    expect(shape(2)).toEqual([4, 1]);
    expect(shape(3)).toEqual([5, 2]);
  });

  it('nunca pede mais de 12 toques nem mais de 3 regras extras', () => {
    for (let i = 0; i < 40; i++) {
      for (let r = 1; r <= 20; r++) {
        expect(leaderTaps(`s${i}`, r)).toBeLessThanOrEqual(12);
        expect(leaderRules(`s${i}`, r).length - 1).toBeLessThanOrEqual(3);
      }
    }
  });

  it('da 4ª rodada em diante há variedade: curtas com regras, longas sem regra, e nunca o mesmo tipo seguido', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      for (let r = 4; r <= 12; r++) {
        const taps = leaderTaps(`v${i}`, r);
        const extras = leaderRules(`v${i}`, r).length - 1;
        seen.add(extras === 0 ? 'longa-sem-regra' : taps <= 5 ? 'curta-com-regras' : 'media');
      }
    }
    expect(seen.has('longa-sem-regra')).toBe(true);
    expect(seen.has('curta-com-regras')).toBe(true);
    expect(seen.has('media')).toBe(true);
  });

  it('botões: 4 nas três primeiras rodadas, mais um a cada 3, até 9', () => {
    expect([1, 3, 4, 6, 7, 16, 20].map((r) => leaderPads('s', r))).toEqual([4, 4, 5, 5, 6, 9, 9]);
  });

  it('tempo para criar: 10 s + 2 s por toque + 3 s por regra extra, no máximo 45 s', () => {
    expect(leaderCreateMs(3)).toBe(16_000);
    expect(leaderCreateMs(5, 2)).toBe(26_000);
    expect(leaderCreateMs(12, 4)).toBe(45_000);
  });

  it('rodadas padrão: o maior entre 6 e os jogadores, até 12', () => {
    expect([2, 6, 9, 20].map(defaultLeaderRounds)).toEqual([6, 6, 9, 12]);
  });

  it('rodadas justas são múltiplos do número de jogadores, até 12', () => {
    expect(fairLeaderRounds(3)).toEqual([3, 6, 9, 12]);
    expect(fairLeaderRounds(4)).toEqual([4, 8, 12]);
    expect(fairLeaderRounds(2)).toEqual([2, 4, 6, 8, 10, 12]);
    expect(fairLeaderRounds(12)).toEqual([12]);
  });
});

describe('Siga o Líder: regras', () => {
  it('toda combinação sorteada tem pelo menos uma sequência possível', () => {
    for (let i = 0; i < 150; i++) {
      for (let round = 1; round <= 20; round++) {
        const seq = validLeaderSequence(`seed-${i}`, round);
        const rules = leaderRules(`seed-${i}`, round);
        expect(firstBrokenRule(seq, rules, leaderPads(`seed-${i}`, round))).toBeNull();
        expect(seq).toHaveLength(leaderTaps(`seed-${i}`, round));
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
    expect(firstBrokenRule([0, 1, 7], rules, 4)).toBe(0);
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

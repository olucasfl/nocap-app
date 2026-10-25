import { describe, expect, it } from 'vitest';
import { UPGRADES } from './catalog';
import { mechanicOpen } from './content';
import {
  COMBO_CHAIN_CAP,
  COMBO_FULL_CAP_SEC,
  GENERATOR_COUNT,
  MILESTONE_ORDER,
  generatorGoal,
  generatorsAtLevel,
  meetMilestone,
  milestoneAvailable,
  milestoneGoal,
  milestoneKind,
  milestoneProgress,
  type MilestoneCounters,
  type MilestoneKind,
} from './milestone';

const counters = (over: Partial<MilestoneCounters> = {}): MilestoneCounters => ({
  captured: 0,
  rares: 0,
  chainBest: 0,
  fullBest: 0,
  missionsDone: 0,
  upgradeLevels: new Array<number>(UPGRADES.length).fill(0),
  ...over,
});

describe('marco da vida: o tipo gira entre 6', () => {
  it('é o de índice n mod 6 do ciclo (quando o conteúdo existe)', () => {
    // Com tudo aberto (muitos colapsos): n mod 6 escolhe direto.
    const kinds = Array.from({ length: 12 }, (_, i) => milestoneKind(i + 1, 40));
    expect(kinds.slice(6)).toEqual(kinds.slice(0, 6));
    // O combo saiu do jogo (spec 043): só sobram 4 tipos.
    expect(new Set(kinds)).toEqual(new Set(['capture', 'generators', 'missions', 'rares']));
  });

  it('o 1º colapso pede geradores; o 6º, objetos capturados', () => {
    expect(milestoneKind(1)).toBe('generators');
    expect(milestoneKind(6, 5)).toBe('capture');
  });

  it('pula o que ainda não existe: sem missões da estação (abrem no colapso 4), vai para o próximo do ciclo', () => {
    expect(mechanicOpen('missions', 2)).toBe(false);
    expect(milestoneAvailable('missions', 2)).toBe(false);
    // Colapso 3 cairia em "missões" (3 mod 6 = 3 -> índice 2... ver a ordem): confere por tipo.
    for (let n = 1; n <= 4; n++) expect(milestoneKind(n, n - 1)).not.toBe('missions');
    // Quando abre, volta a valer.
    expect(milestoneKind(3, 5)).toBe('missions');
  });

  it('com os objetos desligados (Cygnus X-1), pula capturas, raros e missões: a vida nunca fica impossível', () => {
    for (let n = 1; n <= 60; n++) {
      const kind = milestoneKind(n, Math.max(0, n - 1), true);
      expect(['capture', 'rares', 'missions']).not.toContain(kind);
    }
  });

  it('cada tipo de marco sempre devolve um tipo disponível', () => {
    for (let c = 0; c < 80; c++) {
      for (const off of [false, true]) expect(milestoneAvailable(milestoneKind(c + 1, c, off), c, off)).toBe(true);
    }
  });
});

describe('marco da vida: a meta cresce com n', () => {
  it('objetos capturados: ceil(2 + n/2)', () => {
    expect([1, 2, 3, 10, 40].map((n) => milestoneGoal('capture', n).target)).toEqual([3, 3, 4, 7, 22]);
  });

  it('combo: min(5 + n/3, teto)', () => {
    expect([1, 3, 6, 30].map((n) => milestoneGoal('combo', n).target)).toEqual([5, 6, 7, 15]);
    expect(milestoneGoal('combo', 10_000).target).toBe(COMBO_CHAIN_CAP);
  });

  it('missões da estação: ceil(n/4) e raros: ceil(n/5)', () => {
    expect([1, 4, 5, 21].map((n) => milestoneGoal('missions', n).target)).toEqual([1, 1, 2, 6]);
    expect([1, 5, 6, 21].map((n) => milestoneGoal('rares', n).target)).toEqual([1, 1, 2, 5]);
  });

  it('combo cheio por 20 + n segundos, com teto humano', () => {
    expect([1, 10, 100].map((n) => milestoneGoal('comboFull', n).target)).toEqual([21, 30, 120]);
    expect(milestoneGoal('comboFull', 100_000).target).toBe(COMBO_FULL_CAP_SEC);
  });

  it('geradores: k geradores acima do nível f(n), os dois sobem com n e param nos tetos', () => {
    const goals = Array.from({ length: 60 }, (_, i) => generatorGoal(i + 1));
    for (let i = 1; i < goals.length; i++) {
      expect(goals[i]!.level).toBeGreaterThanOrEqual(goals[i - 1]!.level);
      expect(goals[i]!.count).toBeGreaterThanOrEqual(goals[i - 1]!.count);
    }
    // Spec 041: 1 gerador no nível 4 no começo, até 3 geradores no nível 8 (cada gerador vai de 0 a 8 ou mais).
    expect(goals[0]).toEqual({ count: 1, level: 4 });
    expect(goals.at(-1)!.count).toBeLessThanOrEqual(GENERATOR_COUNT);
    expect(generatorGoal(1_000_000)).toEqual({ count: 3, level: 8 });
  });

  it('toda meta é um inteiro positivo e nunca decresce com n', () => {
    for (const kind of MILESTONE_ORDER) {
      let prev = 0;
      for (let n = 1; n <= 500; n++) {
        const t = milestoneGoal(kind, n).target;
        expect(Number.isInteger(t) && t > 0, `${kind} n=${n}`).toBe(true);
        expect(t).toBeGreaterThanOrEqual(prev);
        prev = t;
      }
    }
  });
});

describe('marco da vida: progresso', () => {
  it('conta pelo contador de cada tipo e satura na meta', () => {
    const c = (n: number, k: number) => milestoneProgress(n, k, counters({ captured: 99, chainBest: 99, fullBest: 999, missionsDone: 99, rares: 99 }));
    for (let n = 1; n <= 12; n++) {
      const p = c(n, 40);
      expect(p.done, `n=${n} ${p.kind}`).toBe(p.kind !== 'generators');
      expect(p.value).toBeLessThanOrEqual(p.target);
    }
  });

  it('zero é zero; metade é metade', () => {
    const n = Array.from({ length: 12 }, (_, i) => i + 1).find((i) => milestoneKind(i, 40) === 'capture') as number;
    const none = milestoneProgress(n, 40, counters());
    expect(none).toMatchObject({ kind: 'capture', value: 0, done: false, fill: 0 });
    const half = milestoneProgress(n, 40, counters({ captured: none.target / 2 }));
    expect(half.fill).toBeCloseTo(0.5, 6);
    expect(milestoneProgress(n, 40, counters({ captured: none.target })).done).toBe(true);
  });

  it('geradores contam os que passam do nível pedido', () => {
    const goal = generatorGoal(2);
    const levels = new Array<number>(UPGRADES.length).fill(0);
    const gens = UPGRADES.map((u, i) => (u.kind === 'item' ? -1 : i)).filter((i) => i >= 0);
    levels[gens[0]!] = goal.level;
    expect(generatorsAtLevel(levels, goal.level)).toBe(1);
    levels[gens[1]!] = goal.level - 1;
    expect(generatorsAtLevel(levels, goal.level)).toBe(1);
    levels[gens[1]!] = goal.level;
    expect(generatorsAtLevel(levels, goal.level)).toBe(2);
    expect(milestoneProgress(2, 1, counters({ upgradeLevels: levels })).kind).toBe('generators');
    expect(milestoneProgress(2, 1, counters({ upgradeLevels: levels })).done).toBe(true);
  });

  it('meetMilestone cumpre exatamente o marco de qualquer colapso', () => {
    for (let c = 0; c < 80; c++) {
      for (const off of [false, true]) {
        const patch = meetMilestone(c, new Array<number>(UPGRADES.length).fill(0), off);
        const p = milestoneProgress(c + 1, c, counters(patch), off);
        expect(p.done, `c=${c} ${p.kind}`).toBe(true);
        // E não cumpre sem o patch.
        expect(milestoneProgress(c + 1, c, counters(), off).done).toBe(false);
      }
    }
  });

  it('as metas disponíveis são todas distintas em tipo', () => {
    const seen = new Set<MilestoneKind>();
    for (let n = 1; n <= 6; n++) seen.add(milestoneKind(n, 40));
    expect(seen.size).toBe(4);
  });
});

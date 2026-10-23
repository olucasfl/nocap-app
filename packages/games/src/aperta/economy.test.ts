import { describe, expect, it } from 'vitest';
import { UPGRADES } from './catalog';
import {
  COST_FLOOR,
  GOAL_BASE,
  GOAL_SEGMENTS,
  GOAL_TABLE,
  GOAL_TAIL_RATIO,
  LIFE_BAND_LAST_COLLAPSE,
  LIFE_GROWTH_MAX,
  LIFE_HOURS_MAX,
  LIFE_HOURS_MIN,
  ENERGY_STEP_GROWTH,
  MAX_COLLAPSE_COUNT,
  lifeHoursBand,
  MAX_NUMBER,
  clampCostFactor,
  dustGoal,
  energyCap,
  levelFactor,
  minPicks,
  rarityUnlockPicks,
  upgradeCost,
} from './economy';

const pulse = UPGRADES.find((u) => u.id === 'satellite')!;

describe('upgradeCost', () => {
  it('o 1º Satélite custa 15 e o preço sobe 15% a cada compra (15, 17, 20...)', () => {
    expect(upgradeCost(pulse, 0)).toBe(15);
    expect(upgradeCost(pulse, 1)).toBe(17);
    expect(upgradeCost(pulse, 2)).toBe(20);
    for (let l = 1; l < 60; l++) expect(upgradeCost(pulse, l)).toBeGreaterThan(upgradeCost(pulse, l - 1));
  });

  it('cada compra custa x1,15 da anterior', () => {
    const ratio = (l: number) => upgradeCost(pulse, l + 1) / upgradeCost(pulse, l);
    for (const l of [10, 20, 30]) {
      expect(ratio(l)).toBeGreaterThan(1.14);
      expect(ratio(l)).toBeLessThan(1.16);
    }
  });

  it('cada gerador abre bem mais caro que o anterior', () => {
    for (const kind of ['generator', 'energy'] as const) {
      const list = UPGRADES.filter((u) => u.kind === kind);
      list.slice(1).forEach((def, i) => expect(def.base, def.id).toBeGreaterThanOrEqual((list[i] as typeof def).base * 5));
    }
  });

  it('aplica o desconto com piso de 40% do custo', () => {
    const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
    near(upgradeCost(pulse, 10, 0.5), upgradeCost(pulse, 10) * 0.5);
    near(upgradeCost(pulse, 10, 0.01), upgradeCost(pulse, 10) * COST_FLOOR);
    expect(clampCostFactor(0.1)).toBe(COST_FLOOR);
    expect(clampCostFactor(1.4)).toBe(1.4);
  });

  it('nunca devolve NaN, zero nem infinito', () => {
    expect(upgradeCost(pulse, -3)).toBe(15);
    expect(upgradeCost(pulse, 5000)).toBe(MAX_NUMBER);
    expect(upgradeCost(pulse, 2, Number.NaN)).toBe(upgradeCost(pulse, 2));
    expect(upgradeCost(pulse, 2, Infinity)).toBe(upgradeCost(pulse, 2));
  });
});

describe('energyCap', () => {
  it('usa os seis passos e depois cresce pelo fator da economia', () => {
    expect([0, 1, 2, 3, 4, 5].map((n) => energyCap(n))).toEqual([19, 40, 75, 130, 210, 320]);
    expect(energyCap(6)).toBeCloseTo(320 * ENERGY_STEP_GROWTH, 6);
    expect(energyCap(7)).toBeCloseTo(320 * ENERGY_STEP_GROWTH ** 2, 6);
  });

  it('o 1º grimório sai em ~19 toques (metade da barra de antes, spec 041)', () => {
    expect(energyCap(0)).toBe(19);
    expect(energyCap(0)).toBeLessThanOrEqual(20);
  });

  it('as barras do começo ficam mais curtas que as da calibragem antiga (60, 90, 130...) em toques', () => {
    // Em toques (energia por toque: 0,25 antes, 1 agora).
    const old = [60, 90, 130, 180, 240, 320].map((e) => e / 0.25);
    [0, 1, 2, 3, 4, 5].forEach((n, i) => expect(energyCap(n) / 1).toBeLessThan(old[i]!));
  });

  it('aplica o fator de passo (M87*) e ignora fator inválido', () => {
    expect(energyCap(0, 1.25)).toBe(23.75);
    expect(energyCap(0, Number.NaN)).toBe(19);
    expect(energyCap(0, -2)).toBe(19);
  });

  it('fica finito em contagens absurdas', () => {
    expect(Number.isFinite(energyCap(100_000))).toBe(true);
    expect(energyCap(100_000)).toBeLessThanOrEqual(MAX_NUMBER);
    expect(energyCap(-4)).toBe(19);
  });
});

describe('levelFactor', () => {
  it('soma 50% por nível até o 10', () => {
    expect(levelFactor(1)).toBe(1);
    expect(levelFactor(2)).toBe(1.5);
    expect(levelFactor(10)).toBe(5.5);
    expect(levelFactor(99)).toBe(5.5);
    expect(levelFactor(0)).toBe(1);
  });
});

describe('rarityUnlockPicks', () => {
  it('na 1ª vida usa os limiares da seção 4.3', () => {
    expect(rarityUnlockPicks('common', 0)).toBe(0);
    expect(rarityUnlockPicks('rare', 0)).toBe(2);
    expect(rarityUnlockPicks('epic', 0)).toBe(5);
    expect(rarityUnlockPicks('legendary', 0)).toBe(9);
  });

  it('cai para 60% depois do 1º colapso e 40% depois do 5º', () => {
    expect(rarityUnlockPicks('epic', 1)).toBe(3);
    expect(rarityUnlockPicks('epic', 5)).toBe(2);
  });
});

describe('requisitos de colapso (spec 040)', () => {
  it('a meta do 1º colapso é 50 mi e as metas só crescem', () => {
    expect(GOAL_BASE).toBe(5e7);
    expect(dustGoal(1)).toBe(GOAL_TABLE[0]);
    expect(dustGoal(0)).toBe(dustGoal(1));
    for (let k = 2; k <= 2000; k++) expect(dustGoal(k), `colapso ${k}`).toBeGreaterThan(dustGoal(k - 1));
  });

  it('as 15 primeiras metas vêm da tabela calibrada e depois cresce GOAL_TAIL_RATIO por colapso', () => {
    GOAL_TABLE.forEach((g, i) => expect(dustGoal(i + 1)).toBe(g));
    const last = GOAL_TABLE[GOAL_TABLE.length - 1] as number;
    expect(dustGoal(GOAL_TABLE.length + 1) / last).toBeCloseTo(GOAL_TAIL_RATIO, 9);
    expect(dustGoal(GOAL_TABLE.length + 4) / last).toBeCloseTo(GOAL_TAIL_RATIO ** 4, 9);
    // O 1º colapso pede ~1 h de jogo (50 mi) e a conta cresce sem teto (até o guarda de 1e300).
    expect(GOAL_TABLE[0]).toBe(5e7);
    expect(GOAL_SEGMENTS.at(-1)!.upTo).toBe(Infinity);
  });

  it('trava no guarda de 1e300 e o último colapso aceito é o que ainda cabe', () => {
    expect(dustGoal(10_000_000)).toBe(MAX_NUMBER);
    expect(dustGoal(MAX_COLLAPSE_COUNT)).toBeLessThan(MAX_NUMBER);
    expect(dustGoal(MAX_COLLAPSE_COUNT + 1)).toBe(MAX_NUMBER);
    expect(Number.isFinite(dustGoal(Number.MAX_SAFE_INTEGER))).toBe(true);
  });

  it('pede mais escolhas no 1º colapso', () => {
    expect(minPicks(1)).toBe(12);
    expect(minPicks(2)).toBe(10);
    expect(minPicks(5)).toBe(10);
    expect(minPicks(6)).toBe(8);
    expect(minPicks(30)).toBe(8);
    expect(minPicks(100_000)).toBe(8);
  });

  it('a faixa de horas (spec 041): 0,7 a 2,5 h até o 15º e, depois, +3% sobre a vida anterior', () => {
    expect([LIFE_HOURS_MIN, LIFE_HOURS_MAX, LIFE_BAND_LAST_COLLAPSE, LIFE_GROWTH_MAX]).toEqual([0.7, 2.5, 15, 0.03]);
    expect(lifeHoursBand(1, null)).toEqual({ min: 0.7, max: 2.5 });
    expect(lifeHoursBand(15, 2)).toEqual({ min: 0.7, max: 2.5 });
    expect(lifeHoursBand(16, 2).max).toBeCloseTo(2.06, 9);
    expect(lifeHoursBand(40, 5).max).toBeCloseTo(5.15, 9);
  });

  it('a energia cresce x1,16 depois da 6ª escolha', () => {
    expect(ENERGY_STEP_GROWTH).toBe(1.16);
    expect(energyCap(6)).toBeCloseTo(320 * 1.16, 6);
    expect(energyCap(7)).toBeCloseTo(320 * 1.16 * 1.16, 6);
  });
});




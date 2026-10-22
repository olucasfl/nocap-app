import { describe, expect, it } from 'vitest';
import { UPGRADES } from './catalog';
import {
  COST_FLOOR,
  DUST_GOAL,
  MAX_NUMBER,
  MIN_PICKS,
  TARGET_HOURS,
  atlasSlots,
  clampCostFactor,
  dustGoal,
  energyCap,
  fragmentsFor,
  levelFactor,
  minPicks,
  rarityUnlockPicks,
  respecFee,
  setBonusTier,
  targetHours,
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
  it('usa os seis passos e depois cresce x1,35', () => {
    expect([0, 1, 2, 3, 4, 5].map((n) => energyCap(n))).toEqual([38, 80, 150, 260, 420, 640]);
    expect(energyCap(6)).toBeCloseTo(864, 6);
    expect(energyCap(7)).toBeCloseTo(864 * 1.35, 6);
  });

  it('o 1º passo cabe em ~50 de poeira ganha (25 toques, a 1ª melhoria, mais ~13 toques de 2)', () => {
    const touches = 25 + (energyCap(0) - 25); // energia 1 por toque
    const dust = 25 + (touches - 25) * 2;
    expect(dust).toBeGreaterThanOrEqual(45);
    expect(dust).toBeLessThanOrEqual(60);
  });

  it('as barras do começo ficam mais curtas que as da calibragem antiga (60, 90, 130...) em toques', () => {
    // Em toques (energia por toque: 0,25 antes, 1 agora).
    const old = [60, 90, 130, 180, 240, 320].map((e) => e / 0.25);
    [0, 1, 2, 3, 4, 5].forEach((n, i) => expect(energyCap(n) / 1).toBeLessThan(old[i]!));
  });

  it('aplica o fator de passo (M87*) e ignora fator inválido', () => {
    expect(energyCap(0, 1.25)).toBe(47.5);
    expect(energyCap(0, Number.NaN)).toBe(38);
    expect(energyCap(0, -2)).toBe(38);
  });

  it('fica finito em contagens absurdas', () => {
    expect(Number.isFinite(energyCap(100_000))).toBe(true);
    expect(energyCap(100_000)).toBeLessThanOrEqual(MAX_NUMBER);
    expect(energyCap(-4)).toBe(38);
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
    expect(rarityUnlockPicks('rare', 0)).toBe(3);
    expect(rarityUnlockPicks('epic', 0)).toBe(8);
    expect(rarityUnlockPicks('legendary', 0)).toBe(14);
    expect(rarityUnlockPicks('forbidden', 0)).toBe(22);
  });

  it('cai para 60% depois do 1º colapso e 40% depois do 5º', () => {
    expect(rarityUnlockPicks('epic', 1)).toBe(5);
    expect(rarityUnlockPicks('forbidden', 4)).toBe(14);
    expect(rarityUnlockPicks('epic', 5)).toBe(4);
    expect(rarityUnlockPicks('forbidden', 9)).toBe(9);
  });

  it('a árvore pode trocar o limiar do proibido', () => {
    expect(rarityUnlockPicks('forbidden', 0, 10)).toBe(10);
    expect(rarityUnlockPicks('rare', 0, 10)).toBe(3);
  });
});

describe('metas de colapso', () => {
  it('tem uma linha por colapso, até o 15º', () => {
    expect(DUST_GOAL).toHaveLength(15);
    expect(MIN_PICKS).toHaveLength(15);
    expect(TARGET_HOURS).toHaveLength(15);
  });

  it('segue x3 por colapso depois do 15º e trava no teto', () => {
    expect(dustGoal(16)).toBeCloseTo(dustGoal(15) * 3, -3);
    expect(dustGoal(10_000)).toBe(MAX_NUMBER);
    expect(dustGoal(0)).toBe(dustGoal(1));
  });

  it('pede mais escolhas no 1º colapso', () => {
    expect(minPicks(1)).toBe(20);
    expect(minPicks(2)).toBe(15);
    expect(minPicks(30)).toBe(12);
  });

  it('as durações-alvo nunca crescem', () => {
    for (let k = 2; k <= 15; k++) expect(targetHours(k)).toBeLessThan(targetHours(k - 1));
    expect(targetHours(1)).toBe(8);
    expect(targetHours(40)).toBe(1.2);
  });
});

describe('fragmentsFor', () => {
  it('dá 3 + nº do colapso', () => {
    expect(fragmentsFor(1, 2e6)).toBe(4);
    expect(fragmentsFor(5, 1e6)).toBe(8);
  });

  it('soma 1 por década acima de 2 mi', () => {
    expect(fragmentsFor(1, 2e7)).toBe(5);
    expect(fragmentsFor(1, 2e9)).toBe(7);
    expect(fragmentsFor(1, 1.9e7)).toBe(4);
  });

  it('é seguro com poeira inválida', () => {
    expect(fragmentsFor(1, Number.NaN)).toBe(4);
    expect(fragmentsFor(1, 0)).toBe(4);
  });
});

describe('Atlas', () => {
  it('abre com 3 espaços e ganha 1 nos colapsos 5, 10, 25 e 50', () => {
    expect(atlasSlots(0)).toBe(3);
    expect(atlasSlots(4)).toBe(3);
    expect(atlasSlots(5)).toBe(4);
    expect(atlasSlots(10)).toBe(5);
    expect(atlasSlots(24)).toBe(5);
    expect(atlasSlots(25)).toBe(6);
    expect(atlasSlots(50)).toBe(7);
    expect(atlasSlots(500)).toBe(7);
  });

  it('o bônus de conjunto vem com 2, 3 e 4+ páginas', () => {
    expect([0, 1, 2, 3, 4, 7].map(setBonusTier)).toEqual([-1, -1, 0, 1, 2, 2]);
  });
});

describe('respecFee', () => {
  it('é 20% arredondado para cima, mínimo 1 se houve gasto', () => {
    expect(respecFee(0)).toBe(0);
    expect(respecFee(1)).toBe(1);
    expect(respecFee(7)).toBe(2);
    expect(respecFee(10)).toBe(2);
    expect(respecFee(11)).toBe(3);
  });
});

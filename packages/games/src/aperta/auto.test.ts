import { describe, expect, it } from 'vitest';
import { upgradeIndex } from './catalog';
import { autoRates, newSave, press, syncClock, type SaveState } from './engine';

const owning = (levels: Record<string, number>): SaveState => {
  const s = newSave('auto', 0);
  const upgradeLevels = s.run.upgradeLevels.slice();
  for (const [id, n] of Object.entries(levels)) upgradeLevels[upgradeIndex(id)] = n;
  return { ...s, run: { ...s.run, upgradeLevels } };
};

describe('autoRates (o que os geradores rendem agora)', () => {
  it('sem gerador nada rende', () => {
    expect(autoRates(newSave('a', 0))).toMatchObject({ dust: 0, energy: 0 });
  });

  it('os geradores rendem o máximo sempre: parado rende o mesmo que tocando (pedido do Lucas)', () => {
    const idle = autoRates(owning({ satellite: 4 }));
    expect(idle).toMatchObject({ active: false, surge: false });
    expect(idle.dust).toBeCloseTo(0.8, 9);
    const touched = press(owning({ satellite: 4 }), 1);
    const active = autoRates(touched);
    expect(active.active).toBe(true);
    expect(active.dust).toBeCloseTo(0.8, 9);
    expect(active.dust).toBeCloseTo(idle.dust, 9);
    expect(active.energy).toBeCloseTo(idle.energy, 9);
  });

  it('só os geradores de energia enchem a barra de grimórios; os de poeira não', () => {
    const dustOnly = autoRates(owning({ satellite: 4 }));
    expect(dustOnly.energy).toBe(0);
    const s = owning({ antenna: 5 });
    const r = autoRates(s);
    expect(r.energy).toBeGreaterThan(0);
    const after = syncClock(s, 4);
    expect(after.run.energy).toBeCloseTo(r.energy * 4, 9);
  });

  it('os geradores de energia somam à energia dos de poeira', () => {
    const both = autoRates(owning({ satellite: 4, antenna: 5 }));
    const onlyDust = autoRates(owning({ satellite: 4 }));
    const onlyEnergy = autoRates(owning({ antenna: 5 }));
    expect(both.energy).toBeCloseTo(onlyDust.energy + onlyEnergy.energy, 9);
    expect(onlyDust.energy).toBe(0);
  });

  it('o motor usa a mesma conta do número que a tela mostra', () => {
    const s = owning({ satellite: 10, antenna: 3 });
    const r = autoRates(s);
    const after = syncClock(s, 3);
    expect(after.run.dust).toBeCloseTo(r.dust * 3, 9);
    expect(after.run.energy).toBeCloseTo(r.energy * 3, 9);
  });
});

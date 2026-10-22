import { describe, expect, it } from 'vitest';
import { upgradeIndex } from './catalog';
import { autoRates, effectiveStats, newSave, press, syncClock, type SaveState } from './engine';

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

  it('parado rende uma fração; tocando rende cheio', () => {
    const idle = autoRates(owning({ satellite: 4 }));
    expect(idle).toMatchObject({ active: false, surge: false });
    expect(idle.dust).toBeCloseTo(0.4 * 0.25, 9);
    const touched = press(owning({ satellite: 4 }), 1);
    const active = autoRates(touched);
    expect(active.active).toBe(true);
    expect(active.dust).toBeCloseTo(0.4, 9);
    expect(active.dust).toBeGreaterThan(idle.dust);
  });

  it('a poeira dos geradores também enche a barra de grimórios (como toques, a 1/4 da energia)', () => {
    const s = owning({ satellite: 4 });
    const st = effectiveStats(s);
    const r = autoRates(s);
    // 0,1 de poeira por segundo parado = 0,1 toque; vale 1/4 da energia de um toque.
    expect(r.energy).toBeCloseTo((r.dust / st.dustPerTouch) * st.energyPerTouch * 0.25, 9);
    expect(r.energy).toBeGreaterThan(0);
    const after = syncClock(s, 4);
    expect(after.run.energy).toBeCloseTo(r.energy * 4, 9);
  });

  it('os geradores de energia somam à energia dos de poeira', () => {
    const both = autoRates(owning({ satellite: 4, antenna: 5 }));
    const onlyDust = autoRates(owning({ satellite: 4 }));
    const onlyEnergy = autoRates(owning({ antenna: 5 }));
    expect(both.energy).toBeCloseTo(onlyDust.energy + onlyEnergy.energy, 9);
  });

  it('o motor usa a mesma conta do número que a tela mostra', () => {
    const s = owning({ satellite: 10, antenna: 3 });
    const r = autoRates(s);
    const after = syncClock(s, 3);
    expect(after.run.dust).toBeCloseTo(r.dust * 3, 9);
    expect(after.run.energy).toBeCloseTo(r.energy * 3, 9);
  });
});

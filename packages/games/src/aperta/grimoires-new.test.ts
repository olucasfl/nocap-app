import { describe, expect, it } from 'vitest';
import { GRIMOIRES, upgradeIndex } from './catalog';
import { pickInto } from './economy';
import { drawGrimoires, effectiveStats, newSave, type SaveState } from './engine';
import type { GrimoireRarity } from './catalog';

/** Os 8 grimórios novos do adendo da spec 042: cada um muda um número que dá para ver na carta. */
const hold = (s: SaveState, id: string, rarity: GrimoireRarity = 'common', levels = 1): SaveState => ({ ...s, run: { ...s.run, ...pickInto(s.run, id, rarity, levels) } });
const base = () => newSave('novos', 0);

describe('grimórios novos', () => {
  it('Júpiter: o toque com o combo cheio rende mais, e a raridade aumenta', () => {
    expect(effectiveStats(base()).combo.fullMult).toBe(1);
    const common = effectiveStats(hold(base(), 'jupiter')).combo.fullMult;
    const rare = effectiveStats(hold(base(), 'jupiter', 'rare')).combo.fullMult;
    expect(common).toBeGreaterThan(1);
    expect(rare).toBeGreaterThan(common);
  });

  it('Saturno: soma poeira por toque só com grimórios raros no livro', () => {
    const without = effectiveStats(hold(base(), 'saturn')).dustPerTouch;
    expect(without).toBe(effectiveStats(base()).dustPerTouch);
    const withRare = effectiveStats(hold(hold(base(), 'saturn'), 'moon', 'rare')).dustPerTouch;
    // O raro conta (e a Lua, sozinha, não muda o toque): a diferença vem do Saturno.
    expect(withRare).toBeGreaterThan(effectiveStats(hold(base(), 'moon', 'rare')).dustPerTouch);
  });

  it('Capela: cada colapso feito soma poeira por toque', () => {
    const at = (collapses: number) => effectiveStats(hold({ ...base(), collapses }, 'capella')).dustPerTouch;
    expect(at(0)).toBe(effectiveStats(base()).dustPerTouch);
    expect(at(2)).toBeGreaterThan(at(1));
    expect(at(1)).toBeGreaterThan(at(0));
  });

  it('Europa: o satélite capturado rende mais poeira', () => {
    const plain = effectiveStats(base()).objects.reward.satellite.dust;
    expect(effectiveStats(hold(base(), 'europa')).objects.reward.satellite.dust).toBeGreaterThan(plain);
  });

  it('Ganimedes: o próximo objeto comum demora menos', () => {
    const plain = effectiveStats(base()).objects.spawnMaxSec;
    expect(effectiveStats(hold(base(), 'ganymede')).objects.spawnMaxSec).toBeLessThan(plain);
  });

  it('Polaris: o combo cheio dá energia a mais por toque', () => {
    expect(effectiveStats(base()).combo.fullEnergyAdd).toBe(0);
    expect(effectiveStats(hold(base(), 'polaris')).combo.fullEnergyAdd).toBeGreaterThan(0);
  });

  it('Proxima: a barra de energia do próximo grimório fica menor', () => {
    const plain = effectiveStats(base()).energyStepFactor;
    expect(effectiveStats(hold(base(), 'proxima')).energyStepFactor).toBeLessThan(plain);
  });

  it('Cassiopeia: cartas épicas e lendárias pesam mais no sorteio', () => {
    expect(effectiveStats(hold(base(), 'cassiopeia')).choice.rarityBoost).toBeGreaterThan(effectiveStats(base()).choice.rarityBoost);
  });

  it('Titã devolve poeira nas compras e nada no começo da vida', () => {
    const s = effectiveStats(hold(base(), 'titan'));
    expect(s.buyRefundTouches).toBeGreaterThan(0);
    expect(s.startDust).toBe(0);
  });

  it('já na primeira vida há 15 grimórios para sortear e as ofertas variam entre sementes', () => {
    expect(GRIMOIRES.filter((g) => g.unlockedAtCollapse === 0)).toHaveLength(15);
    // Com o Ritmo Firme (combo) e os objetos abertos, tudo que existe na primeira vida pode sair.
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const s = newSave(`s${i}`);
      const levels = s.run.upgradeLevels.slice();
      levels[upgradeIndex('rhythm')] = 1;
      const ready = { ...s, tutorial: 'done' as const, run: { ...s.run, upgradeLevels: levels } };
      for (const id of drawGrimoires(ready).offers) seen.add(id);
    }
    expect(seen.size).toBeGreaterThanOrEqual(11);
    for (const id of ['jupiter', 'saturn', 'europa', 'polaris', 'proxima']) expect(seen.has(id), id).toBe(true);
  });
});

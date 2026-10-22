import { describe, expect, it } from 'vitest';
import { UPGRADES, effectDomain, GRIMOIRES } from './catalog';
import { dustGoal, minPicks } from './economy';
import { collapse, effectiveStats, newSave, vaultOffers, type SaveState } from './engine';
import { FORBIDDEN, FORBIDDEN_IDS, FORBIDDEN_MAX_LEVEL, SEAL_DUST_PER_TOUCH, VAULT_OFFER_SIZE, forbiddenEffects } from './forbidden';
import { meetMilestone } from './milestone';

/** Deixa a vida pronta para colapsar (poeira, escolhas e marco cumpridos). */
function ready(st: SaveState): SaveState {
  const k = st.collapses + 1;
  const r = { ...st, run: { ...st.run, dustLife: dustGoal(k), dust: dustGoal(k), picks: minPicks(k) } };
  return { ...r, run: { ...r.run, ...meetMilestone(st.collapses, r.run.upgradeLevels, effectiveStats(st).objects.disabled) } };
}

const withVault = (vault: Record<string, number>, collapses = 40): SaveState => ({
  ...newSave('cofre'),
  tutorial: 'done',
  collapses,
  vault,
  album: Object.keys(vault),
});

describe('oferta do Cofre', () => {
  it('são 10 proibidos e a oferta tem até 3 distintos, nunca no nível 5', () => {
    expect(FORBIDDEN_IDS).toHaveLength(10);
    const vault: Record<string, number> = { 'ton-618': 5, 'phoenix-a': 5, 'gaia-bh3': 2 };
    for (let i = 0; i < 40; i++) {
      const s = { ...withVault(vault), run: { ...newSave(`o${i}`).run } };
      const offers = vaultOffers(s);
      expect(offers).toHaveLength(VAULT_OFFER_SIZE);
      expect(new Set(offers).size).toBe(VAULT_OFFER_SIZE);
      for (const id of offers) expect(vault[id] ?? 0).toBeLessThan(FORBIDDEN_MAX_LEVEL);
    }
  });

  it('com menos de 3 elegíveis sobram só eles; sem nenhum, o colapso dá o Selo Estelar', () => {
    const almost = Object.fromEntries(FORBIDDEN_IDS.map((id, i) => [id, i < 8 ? 5 : 3]));
    expect(vaultOffers(withVault(almost)).sort()).toEqual(FORBIDDEN_IDS.slice(8).sort());
    const all = Object.fromEntries(FORBIDDEN_IDS.map((id) => [id, 5]));
    const full = withVault(all);
    expect(vaultOffers(full)).toEqual([]);
    const after = collapse(ready(full));
    expect(after.collapses).toBe(41);
    expect(after.seals).toBe(1);
    expect(after.vault).toEqual(all);
    // O selo vale uma poeira fixa por toque e a poeira por toque sobe de verdade.
    expect(effectiveStats({ ...full, seals: 1 }).dustPerTouch).toBeGreaterThan(effectiveStats(full).dustPerTouch);
    expect(SEAL_DUST_PER_TOUCH).toBeGreaterThan(0);
  });

  it('escolha fora da oferta não colapsa', () => {
    const s = ready(withVault({ 'ton-618': 5 }, 3));
    const outside = FORBIDDEN_IDS.find((id) => !vaultOffers(s).includes(id))!;
    expect(collapse(s, outside)).toBe(s);
    expect(collapse(s, null)).toBe(s);
  });
});

describe('evolução até o nível 5', () => {
  it('pegar o mesmo proibido de novo sobe 1 nível, até o 5 com o selo', () => {
    let s = withVault({}, 0);
    for (let level = 1; level <= FORBIDDEN_MAX_LEVEL; level++) {
      // Só o m87 elegível entre os que a oferta mostra: força a oferta com os outros no 5.
      const others = Object.fromEntries(FORBIDDEN_IDS.filter((id) => id !== 'm87').map((id) => [id, 5]));
      s = ready({ ...s, vault: { ...others, m87: level - 1 }, album: [...FORBIDDEN_IDS] , collapses: s.collapses });
      s = collapse(s, 'm87');
      expect(s.vault.m87).toBe(level);
      expect(s.stats.forbiddenBest.m87).toBe(level);
    }
    expect(forbiddenEffects('m87', 5).length).toBeGreaterThan(forbiddenEffects('m87', 4).length);
    expect(forbiddenEffects('m87', 4).length).toBe(forbiddenEffects('m87', 1).length);
  });
});

describe('não duplicação', () => {
  const upgradeDomains = new Set(UPGRADES.flatMap((u) => u.domains));

  it('cada proibido tem bônus e preço, e o preço pesa contra o bônus', () => {
    for (const f of FORBIDDEN) {
      const eff = f.effects(1);
      expect(eff.some((e) => 'price' in e && e.price), f.id).toBe(true);
      expect(eff.some((e) => !('price' in e && e.price)), f.id).toBe(true);
      expect(f.sealText.length, f.id).toBeGreaterThan(0);
    }
  });

  it('o bônus de um proibido não repete o de uma melhoria', () => {
    for (const f of FORBIDDEN) {
      for (const e of f.effects(1)) {
        if ('price' in e && e.price) continue;
        expect(upgradeDomains.has(effectDomain(e)), `${f.id}: ${e.kind}`).toBe(false);
      }
    }
  });

  it('dois proibidos não dão o mesmo bônus principal', () => {
    const main = FORBIDDEN.map((f) => f.effects(1).filter((e) => !('price' in e && e.price)).map((e) => effectDomain(e)).sort().join('+'));
    expect(new Set(main).size).toBe(main.length);
  });

  it('o bônus de um proibido é mais forte que o do grimório comum que mexe no mesmo domínio', () => {
    // Um proibido troca regra por poder: o nível 1 já passa do melhor comum do mesmo tipo de efeito.
    const best = (kind: string): number =>
      Math.max(0, ...GRIMOIRES.flatMap((g) => g.effects.filter((e) => e.kind === kind).map((e) => (e as { pct?: number }).pct ?? 0)));
    const ton = FORBIDDEN.find((f) => f.id === 'ton-618')!.effects(1).find((e) => e.kind === 'generatorPct') as { pct: number };
    expect(ton.pct).toBeGreaterThan(best('generatorPct'));
  });

});

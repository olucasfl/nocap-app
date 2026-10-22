import { describe, expect, it } from 'vitest';
import { GRIMOIRES, UPGRADES, effectDomain, type Effect } from './catalog';

// Melhorias x grimórios (spec 038, 5.1 e 5.2): melhoria = poder básico contínuo, grimório = estilo e situação.

const upgradeDomains = new Set(UPGRADES.flatMap((u) => u.domains));
const grimoireDomains = new Set(GRIMOIRES.flatMap((g) => g.effects.map(effectDomain)));

/** Primitivas em % que só o Atlas e a árvore usam; um grimório fala em números. */
const PERCENT_KINDS: Effect['kind'][] = ['dustPerTouchPct', 'energyPerTouchPct', 'objectDuration', 'maxObjects', 'comboMax', 'freeUpgradeLevels'];
/** Proibidos trocam uma regra por um fator: podem manter o desconto e o preço em % (spec 5.2). */
const PERCENT_ALLOWED = new Set(['m87']);

describe('melhorias e grimórios não competem', () => {
  it('nenhum grimório mexe no domínio de uma melhoria', () => {
    const overlap = [...grimoireDomains].filter((d) => upgradeDomains.has(d));
    expect(overlap).toEqual([]);
  });

  it('cada efeito de grimório declara um domínio e nenhum é igual ao de outra melhoria por outro nome', () => {
    for (const g of GRIMOIRES) {
      for (const e of g.effects) {
        const d = effectDomain(e);
        expect(upgradeDomains.has(d), `${g.id} (${e.kind}) cai no domínio de melhoria "${d}"`).toBe(false);
      }
    }
  });

  it('as melhorias cobrem poder básico: poeira por toque, por segundo e energia por toque', () => {
    expect(upgradeDomains).toContain('dustPerTouch');
    expect(upgradeDomains).toContain('dustPerSecond');
    expect(upgradeDomains).toContain('energyPerTouch');
  });

  it('os grimórios cobrem estilo e situação: combo, objetos, sorte, toques especiais', () => {
    for (const d of ['comboWindow', 'comboFullDust', 'objectReward', 'choiceExtra', 'everyNthTouch', 'afterCaptureMult', 'onCapture']) {
      expect(grimoireDomains, d).toContain(d);
    }
  });

  it('grimórios não usam as primitivas em % (Atlas e árvore), salvo o proibido com preço', () => {
    for (const g of GRIMOIRES) {
      for (const e of g.effects) expect(PERCENT_KINDS, `${g.id}: ${e.kind}`).not.toContain(e.kind);
    }
  });

  it('o texto das cartas fala em números: sem "%" fora do M87*', () => {
    for (const g of GRIMOIRES) {
      if (PERCENT_ALLOWED.has(g.id)) continue;
      expect(g.text, g.id).not.toContain('%');
    }
    expect(GRIMOIRES.find((g) => g.id === 'm87')!.text).toContain('%');
  });

  it('o número do texto bate com o número do efeito', () => {
    const fmt = (n: number): string => String(n).replace('.', ',');
    for (const g of GRIMOIRES) {
      for (const e of g.effects) {
        let value: number | undefined;
        switch (e.kind) {
          case 'comboFullDust':
          case 'comboFullEnergy':
          case 'objectReward':
          case 'dustPerOwned':
          case 'dustPerCollapse':
            value = e.add;
            break;
          case 'comboWindow':
            value = e.sec;
            break;
          case 'startDust':
            value = e.amount;
            break;
          case 'buyRefund':
            value = e.touches;
            break;
          case 'onCapture':
            value = e.energyTouches;
            break;
          case 'satelliteMult':
            value = 2 + e.add;
            break;
          case 'everyNthTouch':
            expect(g.text, g.id).toContain(String(e.n));
            if (e.energy) expect(g.text, g.id).toContain(fmt(e.energy));
            break;
        }
        if (value !== undefined) expect(g.text, `${g.id}: ${e.kind}`).toContain(fmt(value));
      }
    }
  });

  it('o catálogo tem 40 grimórios e os ids não se repetem', () => {
    expect(GRIMOIRES).toHaveLength(40);
    expect(new Set(GRIMOIRES.map((g) => g.id)).size).toBe(GRIMOIRES.length);
  });
});

describe('melhorias: liberação e preço', () => {
  it('a 1ª melhoria é o Pulso Solar, custa 25 e é a única sem marco', () => {
    expect(UPGRADES[0]!.id).toBe('pulse');
    expect(UPGRADES[0]!.base).toBe(25);
    expect(UPGRADES.filter((u) => u.unlock === undefined && u.unlockedAtCollapse === 0 && !u.requiresUpgrade).map((u) => u.id)).toEqual(['pulse']);
  });

  it('todo marco aponta para melhorias que existem e para um nível possível, e o custo cresce', () => {
    for (const u of UPGRADES) {
      for (const ref of [u.unlock?.upgrade, u.requiresUpgrade]) {
        if (!ref) continue;
        const target = UPGRADES.find((x) => x.id === ref.id);
        expect(target, `${u.id} -> ${ref.id}`).toBeDefined();
        expect(ref.level).toBeLessThanOrEqual(target!.max);
      }
      expect(u.growth).toBeGreaterThan(1);
    }
  });

  it('o marco de poeira abre a melhoria perto do preço da 1ª compra (nunca muito antes)', () => {
    for (const u of UPGRADES) {
      if (u.unlock?.dust !== undefined) expect(u.unlock.dust, u.id).toBeLessThanOrEqual(u.base * 1.2);
    }
  });
});

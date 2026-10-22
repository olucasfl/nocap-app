import { describe, expect, it } from 'vitest';
import { GRIMOIRES, GRIMOIRE_CATEGORIES, RARITIES, UPGRADES, effectDomain, type Effect } from './catalog';

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

  it('as melhorias cobrem poder básico: toque, poeira por segundo, energia por segundo e por toque', () => {
    expect(upgradeDomains).toContain('touchMult');
    expect(upgradeDomains).toContain('dustPerSecond');
    expect(upgradeDomains).toContain('energyPerSecond');
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

  it('o catálogo tem 58 grimórios e os ids não se repetem', () => {
    expect(GRIMOIRES).toHaveLength(58);
    expect(new Set(GRIMOIRES.map((g) => g.id)).size).toBe(GRIMOIRES.length);
  });
});

describe('melhorias: prateleira e preço', () => {
  it('a 1ª de cada tipo é a Lente Polida (100), o Satélite (15) e a Antena (400)', () => {
    const first = (kind: string) => UPGRADES.find((u) => u.kind === kind && u.unlockedAtCollapse === 0)!;
    expect([first('touch').id, first('touch').base]).toEqual(['lens', 100]);
    expect([first('generator').id, first('generator').base]).toEqual(['satellite', 15]);
    expect([first('energy').id, first('energy').base]).toEqual(['antenna', 400]);
  });

  it('dentro de cada tipo a fila segue a ordem do preço', () => {
    for (const kind of ['touch', 'generator', 'energy']) {
      const early = UPGRADES.filter((u) => u.kind === kind && u.unlockedAtCollapse === 0);
      early.forEach((u, i) => {
        if (i > 0) expect(u.base, u.id).toBeGreaterThanOrEqual((early[i - 1] as typeof u).base);
      });
    }
  });

  it('as de toque são únicas, as de gerador crescem 15% por unidade, e toda exigência existe', () => {
    for (const u of UPGRADES) {
      if (u.kind === 'touch') expect([u.id, u.max, u.growth]).toEqual([u.id, 1, 1]);
      else expect(u.growth, u.id).toBe(1.15);
      if (u.requiresUpgrade) {
        const target = UPGRADES.find((x) => x.id === u.requiresUpgrade!.id);
        expect(target, u.id).toBeDefined();
        expect(u.requiresUpgrade.level).toBeLessThanOrEqual(target!.max);
      }
    }
  });

  it('as melhorias de toque cobrem tipos variados, não só "dobra o toque"', () => {
    const touchDomains = new Set(UPGRADES.filter((u) => u.kind === 'touch').flatMap((u) => u.domains));
    for (const d of ['touchMult', 'touchFlat', 'touchNth', 'touchCrit', 'touchEcho', 'comboUnlock', 'objectSpawn']) {
      expect(touchDomains, d).toContain(d);
    }
  });
});

describe('categorias de grimório (spec 039, seção 7)', () => {
  it('todo grimório tem categoria e raridade, e as categorias têm nome e explicação', () => {
    const ids = new Set(GRIMOIRE_CATEGORIES.map((c) => c.id));
    expect(ids.size).toBe(4);
    for (const c of GRIMOIRE_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.hint.length).toBeGreaterThan(10);
    }
    for (const g of GRIMOIRES) {
      expect(ids.has(g.category), g.id).toBe(true);
      expect(RARITIES, g.id).toContain(g.rarity);
    }
  });

  it('cada categoria tem grimórios de pelo menos 3 raridades e um bom punhado deles', () => {
    for (const c of GRIMOIRE_CATEGORIES) {
      const list = GRIMOIRES.filter((g) => g.category === c.id);
      expect(list.length, c.id).toBeGreaterThanOrEqual(9);
      expect(new Set(list.map((g) => g.rarity)).size, c.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('a categoria bate com o que o grimório faz', () => {
    const kindsOf = (id: string) => GRIMOIRES.find((g) => g.id === id)!.effects.map((e) => e.kind);
    for (const g of GRIMOIRES.filter((x) => x.category === 'generators')) {
      expect(kindsOf(g.id).some((k) => ['generatorPct', 'energyGenPct', 'idleFloor', 'activeWindow'].includes(k)), g.id).toBe(true);
    }
    for (const g of GRIMOIRES.filter((x) => x.category === 'objects')) {
      expect(
        kindsOf(g.id).some((k) => ['objectReward', 'spawnCut', 'rareCut', 'rareLife', 'satelliteMult', 'onCapture', 'afterCaptureMult'].includes(k)),
        g.id,
      ).toBe(true);
    }
  });

  it('o texto da carta diz o que muda, sem jargão solto: combo vem explicado e nada de "janela"', () => {
    for (const g of GRIMOIRES) {
      expect(g.text, g.id).not.toMatch(/janela/i);
      expect(g.text.length, g.id).toBeLessThanOrEqual(150);
    }
  });
});

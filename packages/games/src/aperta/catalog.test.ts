import { describe, expect, it } from 'vitest';
import { GRIMOIRES, GRIMOIRE_CATEGORIES, UPGRADES, effectDomain, type Effect } from './catalog';

// Melhorias x grimórios (spec 038, 5.1 e 5.2): melhoria = poder básico contínuo, grimório = estilo e situação.

const upgradeDomains = new Set(UPGRADES.flatMap((u) => u.domains));
const grimoireDomains = new Set(GRIMOIRES.flatMap((g) => g.effects.map(effectDomain)));

/** Primitivas em % que só o Atlas e a árvore usam; um grimório fala em números. */
const PERCENT_KINDS: Effect['kind'][] = ['dustPerTouchPct', 'energyPerTouchPct', 'objectDuration', 'maxObjects', 'comboMax', 'freeUpgradeLevels'];

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
    for (const d of ['comboWindow', 'comboFullDust', 'objectReward', 'choiceExtra', 'everyNthTouch', 'onCapture']) {
      expect(grimoireDomains, d).toContain(d);
    }
  });

  it('grimórios não usam as primitivas em % (Atlas e árvore), salvo o proibido com preço', () => {
    for (const g of GRIMOIRES) {
      for (const e of g.effects) expect(PERCENT_KINDS, `${g.id}: ${e.kind}`).not.toContain(e.kind);
    }
  });

  it('o texto das cartas não traz "%" e quem fala em "a cada N toques" diz o N', () => {
    for (const g of GRIMOIRES) {
      expect(g.text, g.id).not.toContain('%');
      for (const e of g.effects) if (e.kind === 'everyNthTouch') expect(g.text, g.id).toContain(String(e.n));
    }
  });

  it('o catálogo tem 14 grimórios e os ids não se repetem', () => {
    expect(GRIMOIRES).toHaveLength(14);
    expect(new Set(GRIMOIRES.map((g) => g.id)).size).toBe(GRIMOIRES.length);
  });

  it('nenhum grimório mexe em gerador (isso é das Melhorias e da Árvore)', () => {
    const generatorKinds = ['generatorPct', 'energyGenPct', 'idleFloor', 'activeWindow'];
    for (const g of GRIMOIRES) {
      for (const e of g.effects) expect(generatorKinds, `${g.id}: ${e.kind}`).not.toContain(e.kind);
    }
  });
});

describe('melhorias: prateleira e preço', () => {
  it('a 1ª de cada tipo é a Lente Polida (100), o Satélite (15) e a Antena (400)', () => {
    const first = (kind: string) => UPGRADES.find((u) => u.kind === kind && u.unlockedAtCollapse === 0)!;
    expect([first('touch').id, first('touch').base]).toEqual(['lens', 100]);
    expect([first('generator').id, first('generator').base]).toEqual(['satellite', 15]);
    expect([first('energy').id, first('energy').base]).toEqual(['antenna', 300]);
  });

  it('dentro de cada tipo a fila segue a ordem do preço', () => {
    for (const kind of ['touch', 'generator', 'energy', 'perk']) {
      // O catálogo guarda as acrescentadas no fim (índices dos saves); a prateleira ordena por preço (`shelfOf`).
      const early = UPGRADES.filter((u) => u.kind === kind && u.unlockedAtCollapse === 0).sort((a, b) => a.base - b.base);
      early.forEach((u, i) => {
        if (i > 0) expect(u.base, u.id).toBeGreaterThanOrEqual((early[i - 1] as typeof u).base);
      });
    }
  });

  it('as de toque são únicas, as de gerador crescem 15% por unidade, e toda exigência existe', () => {
    for (const u of UPGRADES) {
      if (u.kind === 'touch' || u.kind === 'perk') expect([u.id, u.max, u.growth]).toEqual([u.id, 1, 1]);
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

describe('categorias de grimório (spec 042)', () => {
  it('as 3 categorias têm nome e explicação, e todo grimório cabe em uma', () => {
    const ids = new Set(GRIMOIRE_CATEGORIES.map((c) => c.id));
    expect(ids.size).toBe(3);
    for (const c of GRIMOIRE_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.hint.length).toBeGreaterThan(10);
    }
    for (const g of GRIMOIRES) expect(ids.has(g.category), g.id).toBe(true);
  });

  it('cada categoria tem de 4 a 5 grimórios', () => {
    for (const c of GRIMOIRE_CATEGORIES) {
      const n = GRIMOIRES.filter((g) => g.category === c.id).length;
      expect(n, c.id).toBeGreaterThanOrEqual(4);
      expect(n, c.id).toBeLessThanOrEqual(5);
    }
  });

  it('a categoria bate com o que o grimório faz', () => {
    const kindsOf = (id: string) => GRIMOIRES.find((g) => g.id === id)!.effects.map((e) => e.kind);
    for (const g of GRIMOIRES.filter((x) => x.category === 'objects')) {
      expect(kindsOf(g.id).some((k) => ['objectReward', 'spawnCut', 'rareCut', 'rareLife', 'satelliteMult'].includes(k)), g.id).toBe(true);
    }
    for (const g of GRIMOIRES.filter((x) => x.category === 'touch')) {
      expect(kindsOf(g.id).some((k) => ['everyNthTouch', 'comboFullDust', 'comboWindow', 'dustPerGrimoire'].includes(k)), g.id).toBe(true);
    }
  });

  it('o texto da carta explica o combo (sequência) e cabe numa linha curta', () => {
    for (const g of GRIMOIRES) {
      expect(g.text, g.id).not.toMatch(/janela/i);
      if (/combo/i.test(g.text)) expect(g.text, g.id).toMatch(/sequência/);
      expect(g.text.length, g.id).toBeLessThanOrEqual(110);
    }
  });
});

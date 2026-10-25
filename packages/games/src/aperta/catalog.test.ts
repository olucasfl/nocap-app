import { describe, expect, it } from 'vitest';
import { GRIMOIRES, GRIMOIRE_CATEGORIES, UPGRADES, effectDomain, eraOfPrice, itemText, type Effect } from './catalog';

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

  it('os grimórios cobrem toque, energia, sorte e objetos (sem combo)', () => {
    for (const d of ['dustFlat', 'energyFlat', 'objectReward', 'objectLife', 'fieldSlots', 'choiceExtra', 'everyNthTouch', 'onCapture', 'spawnCut']) {
      expect(grimoireDomains, d).toContain(d);
    }
    for (const g of GRIMOIRES) for (const e of g.effects) expect(e.kind.startsWith('combo'), `${g.id}: ${e.kind}`).toBe(false);
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

  it('o catálogo tem 20 grimórios e os ids não se repetem', () => {
    expect(GRIMOIRES).toHaveLength(20);
    expect(new Set(GRIMOIRES.map((g) => g.id)).size).toBe(GRIMOIRES.length);
  });

  it('nenhum grimório mexe em gerador (isso é das Melhorias e da Árvore)', () => {
    const generatorKinds = ['generatorPct', 'energyGenPct', 'idleFloor', 'activeWindow'];
    for (const g of GRIMOIRES) {
      for (const e of g.effects) expect(generatorKinds, `${g.id}: ${e.kind}`).not.toContain(e.kind);
    }
  });
});

describe('itens: a escada (spec 043)', () => {
  const items = UPGRADES.filter((u) => u.kind === 'item');

  it('os itens são só de 5 tipos, compra única, e o texto vem do efeito', () => {
    expect(items.length).toBeGreaterThanOrEqual(40);
    for (const u of items) {
      expect([u.id, u.max, u.growth]).toEqual([u.id, 1, 1]);
      expect(['touchMult', 'energyMult', 'genMult', 'energyGenMult'], u.id).toContain(u.item!.type);
      expect(u.text, u.id).toBe(itemText(u.item!));
      expect(u.text, u.id).not.toContain('%');
      expect(u.era, u.id).toBeDefined();
    }
  });

  it('a primeira vida tem 24 itens e cada colapso novo traz mais 6, sempre mais caros que os de antes', () => {
    const at = (k: number) => items.filter((u) => u.unlockedAtCollapse === k);
    expect([at(0).length, at(1).length, at(2).length, at(3).length]).toEqual([24, 6, 6, 6]);
    for (let k = 1; k <= 3; k++) {
      const before = Math.max(...items.filter((u) => u.unlockedAtCollapse < k).map((u) => u.base));
      for (const u of at(k)) expect(u.base, u.id).toBeGreaterThan(before);
    }
  });

  it('os preços crescem por degraus pequenos (cada item custa até 3x o anterior): nada de salto impossível', () => {
    const sorted = [...items].sort((a, b) => a.base - b.base);
    sorted.forEach((u, i) => {
      if (i === 0) return;
      const ratio = u.base / sorted[i - 1]!.base;
      expect(ratio, `${sorted[i - 1]!.id} -> ${u.id}`).toBeLessThanOrEqual(3);
      expect(ratio, `${sorted[i - 1]!.id} -> ${u.id}`).toBeGreaterThanOrEqual(1);
    });
  });

  it('a 1ª de cada tipo é a Lente Polida (100), o Satélite (50) e a Antena (300)', () => {
    const first = (kind: string) => UPGRADES.filter((u) => u.kind === kind && u.unlockedAtCollapse === 0).sort((a, b) => a.base - b.base)[0]!;
    expect([first('item').id, first('item').base]).toEqual(['lens', 100]);
    expect([first('generator').id, first('generator').base]).toEqual(['satellite', 50]);
    expect([first('energy').id, first('energy').base]).toEqual(['antenna', 300]);
  });

  it('os geradores crescem 15% por nível e têm limite de níveis', () => {
    for (const u of UPGRADES.filter((x) => x.kind !== 'item')) {
      expect(u.growth, u.id).toBe(1.15);
      expect(u.max, u.id).toBeGreaterThanOrEqual(6);
    }
  });

  it('a era de cada item bate com o preço (poeira, mil, milhões, bilhões)', () => {
    expect(eraOfPrice(100)).toBe('poeira');
    expect(eraOfPrice(15_000)).toBe('mil');
    expect(eraOfPrice(3_000_000)).toBe('milhoes');
    expect(eraOfPrice(5_000_000_000)).toBe('bilhoes');
    for (const u of items) expect(u.era, u.id).toBe(eraOfPrice(u.base));
  });

  it('não sobrou item de combo, crítico, "a cada N", objeto específico nem melhoria de gerador', () => {
    const gone = ['rhythm', 'cadence', 'trained', 'luck', 'warmup', 'echo', 'hands', 'magnet', 'kepler', 'voyager', 'gaia', 'network', 'lure', 'burst', 'scale', 'peak', 'queue', 'convert', 'rotation'];
    for (const id of gone) expect(UPGRADES.some((u) => u.id === id), id).toBe(false);
  });
});

describe('categorias de grimório (spec 042)', () => {
  it('as 4 categorias têm nome e explicação, e todo grimório cabe em uma', () => {
    const ids = new Set(GRIMOIRE_CATEGORIES.map((c) => c.id));
    expect(ids.size).toBe(4);
    for (const c of GRIMOIRE_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.hint.length).toBeGreaterThan(10);
    }
    for (const g of GRIMOIRES) expect(ids.has(g.category), g.id).toBe(true);
  });

  it('são 4 categorias (Toque, Energia, Sorte e Objetos) com 4 a 6 grimórios cada', () => {
    expect(GRIMOIRE_CATEGORIES.map((c) => c.id)).toEqual(['touch', 'energy', 'luck', 'objects']);
    for (const c of GRIMOIRE_CATEGORIES) {
      const n = GRIMOIRES.filter((g) => g.category === c.id).length;
      expect(n, c.id).toBeGreaterThanOrEqual(4);
      expect(n, c.id).toBeLessThanOrEqual(6);
    }
  });

  it('nenhum grimório dá algo "no começo da vida": o que vale é o que se faz durante a rodada', () => {
    for (const g of GRIMOIRES) expect(g.effects.map((e) => e.kind), g.id).not.toContain('startDust');
    expect(GRIMOIRES.some((g) => /começa/i.test(g.text))).toBe(false);
  });

  it('o jogador tem de 12 a 20 grimórios para sortear já na primeira vida', () => {
    const first = GRIMOIRES.filter((g) => g.unlockedAtCollapse === 0).length;
    expect(first).toBe(14);
  });

  it('os grimórios de objetos são gerais: nenhum fala de cometa, satélite, asteroide ou Estrela Dourada em particular', () => {
    for (const g of GRIMOIRES.filter((x) => x.category === 'objects')) {
      expect(g.text, g.id).not.toMatch(/cometa|sat[eé]lite|asteroide|dourada|estrela cadente|sonda/i);
      for (const e of g.effects) if (e.kind === 'objectReward') expect(e.target, g.id).toBe('all');
    }
  });

  it('o texto de todo grimório traz o número ou diz com clareza o que muda (sem porcentagem)', () => {
    for (const g of GRIMOIRES) expect(g.text, g.id).not.toContain('%');
  });

  it('a categoria bate com o que o grimório faz', () => {
    const kindsOf = (id: string) => GRIMOIRES.find((g) => g.id === id)!.effects.map((e) => e.kind);
    const by: Record<string, string[]> = {
      touch: ['everyNthTouch', 'dustFlat', 'dustMult', 'dustPerGrimoire', 'dustPerCollapse'],
      energy: ['energyMult', 'energyFlat', 'energyPerCollapse', 'energyStepPct'],
      luck: ['choiceExtra', 'rarityBoost', 'buyRefund'],
      objects: ['objectReward', 'spawnCut', 'objectLife', 'fieldSlots', 'afterCaptureMult', 'onCapture'],
    };
    for (const g of GRIMOIRES) expect(kindsOf(g.id).some((k) => by[g.category]!.includes(k)), g.id).toBe(true);
  });

  it('o texto da carta cabe numa linha curta e não fala de combo', () => {
    for (const g of GRIMOIRES) {
      expect(g.text, g.id).not.toMatch(/janela/i);
      expect(g.text, g.id).not.toMatch(/combo/i);
      expect(g.text.length, g.id).toBeLessThanOrEqual(110);
    }
  });
});

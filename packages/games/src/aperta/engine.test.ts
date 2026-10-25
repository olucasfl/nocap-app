import { describe, expect, it } from 'vitest';
import { GRIMOIRES, OBJECTS, UPGRADES, upgradeIndex, type GrimoireDef, type GrimoireRarity } from './catalog';
import { GRIMOIRE_LEVEL_STEP, pickInto } from './economy';
import { CHOICE_LOCK_SEC, ENERGY_STEPS, MAX_NUMBER, MIN_PICKS_FIRST, dustGoal, energyCap, minPicks } from './economy';
import { meetMilestone } from './milestone';
import {
  buyUpgrade,
  canCollapse,
  captureObject,
  chooseGrimoire,
  clampNum,
  collapse,
  vaultOffers,
  collapseProgress,
  currentEnergyCap,
  drawGrimoires,
  effectiveStats,
  sparksAvailable,
  newSave,
  nextRandom,
  nextItemIndex,
  nextUpgradeCost,
  objectReward,
  objectsOpen,
  press,
  regionFor,
  rerollGrimoire,
  resumeClock,
  selectGrimoire,
  syncClock,
  tickObjects,
  unlockedContent,
  upgradeLock,
  upgradeUnlocks,
  type RunState,
  type SaveState,
  objectPreview,
} from './engine';

const idx = upgradeIndex;

function withRun(s: SaveState, patch: Partial<RunState>): SaveState {
  return { ...s, run: { ...s.run, ...patch } };
}

function withLevels(s: SaveState, levels: Record<string, number>): SaveState {
  const upgradeLevels = s.run.upgradeLevels.slice();
  for (const [id, lvl] of Object.entries(levels)) upgradeLevels[idx(id)] = lvl;
  return withRun(s, { upgradeLevels });
}

function withBuild(s: SaveState, build: Record<string, number>): SaveState {
  return withRun(s, { build });
}

/** O grimório `id` no livro, pego `levels` vezes na raridade `rarity` (o 1º nível vale o passo cheio, os outros metade). */
function holdIn(s: SaveState, id: string, rarity: GrimoireRarity = 'common', levels = 1): SaveState {
  return withRun(s, pickInto(s.run, id, rarity, levels));
}

/** Aperta `n` vezes, uma a cada `dt` s, começando em `t0`. */
function pressN(s: SaveState, n: number, t0 = 1, dt = 0.4): { state: SaveState; t: number } {
  let state = s;
  let t = t0;
  for (let i = 0; i < n; i++) {
    state = press(state, t);
    t += dt;
  }
  return { state, t };
}

/** Escolhe a carta `id` respeitando o bloqueio de 1,6 s. */
function pick(s: SaveState, id: string, now: number): SaveState {
  const at = now + CHOICE_LOCK_SEC + 0.1;
  return chooseGrimoire(selectGrimoire(s, id, at), id, at);
}

function readyToCollapse(s: SaveState): SaveState {
  const k = s.collapses + 1;
  const base = withRun(s, { dustLife: dustGoal(k), picks: minPicks(k) });
  return withRun(base, meetMilestone(s.collapses, base.run.upgradeLevels));
}

function assertSane(s: SaveState): void {
  const nums: number[] = [
    s.playSeconds,
    s.run.dust,
    s.run.dustLife,
    s.run.energy,
    s.run.picks,
    s.run.clicks,
    s.run.combo,
    s.run.lastGain,
    s.stats.dustTotal,
    s.sparks.legacy,
    s.sparks.spent,
    ...s.run.upgradeLevels,
    ...Object.values(s.run.build),
  ];
  for (const n of nums) {
    expect(Number.isFinite(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(0);
  }
  expect(JSON.parse(JSON.stringify(s))).toEqual(s);
}

describe('newSave', () => {
  it('começa vazio, na região inicial e com o Cofre dos Proibidos vazio', () => {
    const s = newSave('x');
    expect(s.run.dust).toBe(0);
    expect(s.run.upgradeLevels).toHaveLength(UPGRADES.length);
    expect(s.collapses).toBe(0);
    expect(s.regionId).toBe('inner-solar-system');
    expect(s.vault).toEqual({});
    expect(s.seals).toBe(0);
    assertSane(s);
  });

  it('a mesma semente dá o mesmo estado e outra semente dá outro gerador', () => {
    expect(newSave('x')).toEqual(newSave('x'));
    expect(newSave('x').run.rngState).not.toBe(newSave('y').run.rngState);
  });
});

describe('nextRandom', () => {
  it('é determinístico, fica em [0,1) e avança o estado', () => {
    const [a, s1] = nextRandom(123);
    const [b] = nextRandom(123);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    expect(s1).not.toBe(123);
  });
});

describe('clampNum', () => {
  it('trava em [0, 1e300] e troca NaN por 0', () => {
    expect(clampNum(Number.NaN)).toBe(0);
    expect(clampNum(-5)).toBe(0);
    expect(clampNum(Infinity)).toBe(MAX_NUMBER);
    expect(clampNum(Number.MAX_VALUE * 2)).toBe(MAX_NUMBER);
    expect(clampNum(42)).toBe(42);
  });
});

describe('press', () => {
  it('começa com 0 de poeira e o 1º toque dá exatamente 1 de poeira e 1 de energia', () => {
    const fresh = newSave('p');
    expect(fresh.run.dust).toBe(0);
    expect(fresh.run.dustLife).toBe(0);
    expect(fresh.stats.dustTotal).toBe(0);
    expect(effectiveStats(fresh).dustPerTouch).toBe(1);
    const s = press(fresh, 1);
    expect(s.run.dust).toBe(1);
    expect(s.run.dustLife).toBe(1);
    expect(s.run.lastGain).toBe(1);
    expect(s.run.energy).toBe(1);
    expect(s.run.clicks).toBe(1);
    expect(s.stats.clicks).toBe(1);
  });

  it('a Lente Polida paga com 100 toques e o 1º grimório sai aos 19 toques (o 1º passo da barra)', () => {
    let { state, t } = pressN(newSave('flow'), 15);
    expect(state.run.dust).toBe(15);
    state = withRun(state, { dust: 15 + 85 });
    expect(nextUpgradeCost(state, idx('lens'))).toBe(100);
    expect(state.run.pending).toBeNull();
    state = buyUpgrade(state, idx('lens'));
    expect(state.run.dust).toBe(0);
    let touches = 15;
    while (!state.run.pending && touches < 100) {
      state = press(state, t);
      t += 0.4;
      touches++;
    }
    expect(touches).toBe(ENERGY_STEPS[0]);
  });

  it('as Luvas e a Lente Polida dobram o toque, e juntas quadruplicam', () => {
    expect(press(withLevels(newSave('p'), { gloves: 1 }), 1).run.dust).toBe(2);
    expect(press(withLevels(newSave('p'), { lens: 1 }), 1).run.dust).toBe(2);
    expect(press(withLevels(newSave('p'), { gloves: 1, lens: 1 }), 1).run.dust).toBe(4);
  });

  it('ignora toques mais rápidos que 12 por segundo', () => {
    let s = press(newSave('p'), 1);
    const again = press(s, 1.05);
    expect(again.run.clicks).toBe(1);
    s = press(s, 1.1);
    expect(s.run.clicks).toBe(2);
  });

  it('a energia cheia abre a escolha e os toques seguintes não contam', () => {
    const { state, t } = pressN(newSave('p'), ENERGY_STEPS[0]);
    expect(state.run.pending).not.toBeNull();
    expect(state.run.pending?.offers).toHaveLength(3);
    expect(state.run.energy).toBe(ENERGY_STEPS[0]);
    const before = state.run.clicks;
    const after = press(state, t + 1);
    expect(after.run.clicks).toBe(before);
    expect(after.run.dust).toBe(state.run.dust);
  });

  it('o toque vale no mínimo 1 mesmo com multiplicadores menores que 1', () => {
    const s = press(withBuild(newSave('p'), { 'sagittarius-a': 1 }), 1);
    expect(s.run.lastGain).toBeGreaterThanOrEqual(1);
  });

  it('nunca passa de 1e300 nem vira NaN', () => {
    const s = press(withRun(newSave('p'), { dust: MAX_NUMBER, dustLife: MAX_NUMBER }), 1);
    expect(s.run.dust).toBe(MAX_NUMBER);
    assertSane(s);
  });

  it('não muta o estado recebido', () => {
    const s = newSave('p');
    const snapshot = JSON.stringify(s);
    press(s, 1);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

describe('buyUpgrade', () => {
  it('desconta o custo e sobe o nível', () => {
    const s = buyUpgrade(withRun(newSave('b'), { dust: 300 }), idx('satellite'));
    expect(s.run.upgradeLevels[idx('satellite')]).toBe(1);
    expect(s.run.dust).toBe(250);
  });

  it('o preço do gerador sobe 15% a cada compra: 50, 57, 66...', () => {
    let s = withRun(newSave('b'), { dust: 1e6 });
    expect(nextUpgradeCost(s, idx('satellite'))).toBe(50);
    s = buyUpgrade(s, idx('satellite'));
    expect(nextUpgradeCost(s, idx('satellite'))).toBe(57);
    s = buyUpgrade(s, idx('satellite'));
    expect(nextUpgradeCost(s, idx('satellite'))).toBe(66);
    let last = 0;
    // O Satélite vai até 8 níveis (0/8); depois some da prateleira e o próximo gerador aparece.
    for (let i = 0; i < 5; i++) {
      const c = nextUpgradeCost(s, idx('satellite')) as number;
      expect(c).toBeGreaterThan(last);
      last = c;
      s = buyUpgrade(s, idx('satellite'));
    }
  });

  it('sem saldo devolve o mesmo estado', () => {
    const s = withRun(newSave('b'), { dust: 14 });
    expect(buyUpgrade(s, idx('satellite'))).toBe(s);
  });

  it('índice inválido e nível máximo não compram (melhoria de toque é única)', () => {
    const s = withRun(newSave('b'), { dust: 1e30, dustLife: 1e30 });
    expect(buyUpgrade(s, 99)).toBe(s);
    expect(buyUpgrade(s, -1)).toBe(s);
    const bought = buyUpgrade(s, idx('lens'));
    expect(bought.run.upgradeLevels[idx('lens')]).toBe(1);
    expect(nextUpgradeCost(bought, idx('lens'))).toBeNull();
    expect(buyUpgrade(bought, idx('lens'))).toBe(bought);
  });

  it('a escada de itens mostra o próximo e os 2 seguintes (esmaecidos), na ordem do preço, e os geradores um por vez', () => {
    const s = withRun(newSave('b'), { dust: 1e12 });
    const open = (st: SaveState) => upgradeUnlocks(st).filter((u) => u.unlocked).map((u) => u.id);
    // Só o 1º item e o 1º gerador de cada tipo estão à venda.
    expect(open(s)).toEqual(['lens', 'satellite', 'antenna']);
    // Os 2 seguintes já aparecem (nome, efeito e preço), mas esperam o de antes: é o objetivo que dá vontade.
    expect(upgradeLock(s, idx('gloves'))).toEqual({ kind: 'order', before: 'lens' });
    expect(upgradeLock(s, idx('charged'))).toEqual({ kind: 'order', before: 'lens' });
    // O 4º item ainda nem aparece.
    expect(upgradeLock(s, idx('solar'))).toEqual({ kind: 'shelf' });
    expect(nextUpgradeCost(s, idx('gloves'))).toBeNull();
    // Geradores (poeira e energia): um por vez. O próximo só aparece depois de completar o atual (8/8).
    expect(upgradeLock(s, idx('probe'))).toEqual({ kind: 'shelf' });
    expect(upgradeLock(s, idx('receiver'))).toEqual({ kind: 'shelf' });
    expect(upgradeLock(withLevels(s, { satellite: 8 }), idx('probe'))).toBeNull();
    expect(upgradeLock(withLevels(s, { antenna: 6 }), idx('receiver'))).toBeNull();
  });

  it('comprar o item de cima libera o próximo e a escada anda (a janela de 3 desliza)', () => {
    let s = withRun(newSave('b'), { dust: 1e12, dustLife: 1e12 });
    expect(nextItemIndex(s)).toBe(idx('lens'));
    s = buyUpgrade(s, idx('lens'));
    expect(nextItemIndex(s)).toBe(idx('gloves'));
    expect(upgradeLock(s, idx('gloves'))).toBeNull();
    expect(upgradeLock(s, idx('solar'))).toEqual({ kind: 'order', before: 'gloves' });
    // Um item de trás não pode ser comprado fora da ordem.
    expect(buyUpgrade(s, idx('solar'))).toBe(s);
    s = buyUpgrade(buyUpgrade(s, idx('gloves')), idx('charged'));
    expect(s.run.upgradeLevels[idx('charged')]).toBe(1);
    expect(nextItemIndex(s)).toBe(idx('solar'));
  });

  it('o item de outro colapso espera o colapso e aparece no fim da escada', () => {
    const s = withRun(newSave('b'), { dust: 1e12, dustLife: 1e12 });
    expect(upgradeLock(s, idx('deep'))).toEqual({ kind: 'collapse', collapse: 1 });
    expect(upgradeUnlocks(s).find((u) => u.id === 'deep')?.hidden).toBe(true);
    // Com o colapso aberto ele fica depois dos 24 da primeira vida: só aparece quando os de antes foram comprados.
    expect(upgradeLock({ ...s, collapses: 1 }, idx('deep'))).toEqual({ kind: 'shelf' });
    const all24 = Object.fromEntries(UPGRADES.filter((u) => u.kind === 'item' && u.unlockedAtCollapse === 0).map((u) => [u.id, 1]));
    expect(upgradeLock(withLevels({ ...s, collapses: 1 }, all24), idx('deep'))).toBeNull();
  });

  it('o item comprado muda o total: o efeito é o que a tela diz', () => {
    const base = effectiveStats(newSave('b'));
    expect(base.dustPerTouch).toBe(1);
    // Lente Polida: Toque x2. Luvas: Toque x2. Juntas: x4.
    expect(effectiveStats(withLevels(newSave('b'), { lens: 1 })).dustPerTouch).toBe(2);
    expect(effectiveStats(withLevels(newSave('b'), { lens: 1, gloves: 1 })).dustPerTouch).toBe(4);
    // Pulso Carregado: energia por toque x2.
    expect(effectiveStats(withLevels(newSave('b'), { charged: 1 })).energyPerTouch).toBe(base.energyPerTouch * 2);
    // Painéis Solares: geradores de poeira x2; Antena Dupla: geradores de energia x1,5.
    const gens = withLevels(newSave('b'), { satellite: 4, antenna: 2 });
    const solar = effectiveStats(withLevels(gens, { solar: 1 }));
    expect(solar.autoDustPerSec).toBeCloseTo(effectiveStats(gens).autoDustPerSec * 2, 9);
    const ant = effectiveStats(withLevels(gens, { antenna2: 1 }));
    expect(ant.autoEnergyPerSec).toBeCloseTo(effectiveStats(gens).autoEnergyPerSec * 1.5, 9);
  });

  it('cada gerador custa bem mais que o anterior e sobe a cada compra', () => {
    const rich = withRun({ ...newSave('b'), collapses: 5 }, { dust: 1e30, dustLife: 1e30 });
    const gens = UPGRADES.filter((u) => u.kind === 'generator');
    gens.forEach((def, i) => {
      // Um gerador por vez: para o i-ésimo aparecer, os anteriores precisam estar completos (8/8, 10/10...).
      const before = Object.fromEntries(gens.slice(0, i).map((g) => [g.id, g.max]));
      const open = withLevels(rich, before);
      expect(nextUpgradeCost(open, idx(def.id)), def.id).toBe(def.base);
      const lvl1 = withLevels(open, { [def.id]: 1 });
      expect(nextUpgradeCost(lvl1, idx(def.id)) as number, def.id).toBeGreaterThan(def.base);
      if (i > 0) expect(def.base).toBeGreaterThanOrEqual((gens[i - 1] as typeof def).base * 5);
    });
  });

  it('Titã devolve a poeira de alguns toques a cada compra (sem passar do preço)', () => {
    const base = withRun(withLevels(newSave('b'), { lens: 1 }), { dust: 1000 });
    const plain = buyUpgrade(base, idx('satellite'));
    const titan = buyUpgrade(holdIn(base, 'titan', 'common'), idx('satellite'));
    // Toque de 2: Titã Comum devolve 2 toques (4), abaixo do preço de 200.
    expect(titan.run.dust - plain.run.dust).toBe(2 * effectiveStats(base).dustPerTouch);
    // Um Titã Lendário devolveria mais que o preço (15), mas nunca passa dele.
    const big = buyUpgrade(holdIn(base, 'titan', 'legendary', 10), idx('satellite'));
    expect(big.run.dust - plain.run.dust).toBeLessThanOrEqual(200);
    const tiny = withRun(newSave('b'), { dust: 200 });
    expect(buyUpgrade(holdIn(tiny, 'titan', 'legendary', 10), idx('satellite')).run.dust).toBeLessThanOrEqual(200);
  });
});

describe('drawGrimoires', () => {
  it('é determinístico pela semente do save', () => {
    expect(drawGrimoires(newSave('d'))).toEqual(drawGrimoires(newSave('d')));
    expect(drawGrimoires(newSave('d')).offers).not.toEqual(drawGrimoires(newSave('e')).offers);
  });

  it('devolve 3 cartas diferentes e não muta o estado', () => {
    const s = newSave('d');
    const snapshot = JSON.stringify(s);
    const { offers } = drawGrimoires(s);
    expect(new Set(offers).size).toBe(3);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('as 3 primeiras escolhas só têm comuns, em qualquer semente', () => {
    for (let i = 0; i < 40; i++) {
      // A 1ª carta rara abre com 2 escolhas feitas (spec 041: mais chance de raro, épico e lendário).
      for (const picks of [0, 1]) {
        const s = withRun(newSave(`c${i}`), { picks });
        const d = drawGrimoires(s);
        for (const id of d.offers) expect(d.rarities[id]).toBe('common');
      }
    }
  });

  it('libera as raridades aos poucos pelo nº de escolhas', () => {
    const seen = (picks: number, collapses = 0): Set<string> => {
      const rarities = new Set<string>();
      for (let i = 0; i < 400; i++) {
        const s = { ...withRun(newSave(`r${i}`), { picks }), collapses };
        const d = drawGrimoires(s);
        for (const id of d.offers) rarities.add(d.rarities[id] ?? '?');
      }
      return rarities;
    };
    expect(seen(3)).toEqual(new Set(['common', 'rare']));
    expect(seen(8)).toEqual(new Set(['common', 'rare', 'epic']));
    expect(seen(14)).toEqual(new Set(['common', 'rare', 'epic', 'legendary']));
  });

  it('respeita os pesos: comum aparece bem mais que lendário', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 600; i++) {
      const s = withRun(newSave(`w${i}`), { picks: 30 });
      const d = drawGrimoires(s);
      for (const id of d.offers) counts[d.rarities[id] as string] = (counts[d.rarities[id] as string] ?? 0) + 1;
    }
    expect(counts.common ?? 0).toBeGreaterThan((counts.rare ?? 0) * 2);
    expect(counts.rare ?? 0).toBeGreaterThan(counts.legendary ?? 0);
    expect(counts.epic ?? 0).toBeGreaterThan(counts.legendary ?? 0);
  });

  it('a raridade não muda a chance de o grimório aparecer (sorteia o grimório, depois a raridade)', () => {
    const byGrimoire: Record<string, number> = {};
    for (let i = 0; i < 900; i++) {
      for (const id of drawGrimoires(withRun(newSave(`q${i}`), { picks: 30 })).offers) byGrimoire[id] = (byGrimoire[id] ?? 0) + 1;
    }
    const counts = Object.values(byGrimoire);
    expect(Math.max(...counts) / Math.min(...counts)).toBeLessThan(2);
  });

  it('o grimório que você já tem nunca vem em raridade menor, e vem a mesma ou maior', () => {
    for (let i = 0; i < 200; i++) {
      const s = holdIn(withRun(newSave(`h${i}`), { picks: 30 }), 'moon', 'rare', 2);
      const d = drawGrimoires(s);
      if (d.offers.includes('moon')) expect(['rare', 'epic', 'legendary']).toContain(d.rarities.moon);
    }
  });

  it('no teto da raridade o grimório sai do sorteio, mas uma raridade maior ainda pode vir', () => {
    // Comum no teto (5 níveis): só vem de novo em Raro ou melhor.
    let atCap = 0;
    let sawHigher = false;
    for (let i = 0; i < 400; i++) {
      const s = holdIn(withRun(newSave(`t${i}`), { picks: 30 }), 'moon', 'common', 5);
      const d = drawGrimoires(s);
      if (!d.offers.includes('moon')) continue;
      atCap++;
      expect(d.rarities.moon).not.toBe('common');
      sawHigher = true;
    }
    expect(atCap).toBeGreaterThan(0);
    expect(sawHigher).toBe(true);
    // Lendário no teto (10): nunca mais é oferecido.
    for (let i = 0; i < 100; i++) {
      const s = holdIn(withRun(newSave(`l${i}`), { picks: 30 }), 'moon', 'legendary', 10);
      expect(drawGrimoires(s).offers).not.toContain('moon');
    }
  });

  it('conteúdo de colapso futuro nunca aparece', () => {
    for (let i = 0; i < 300; i++) {
      const s = withRun(newSave(`f${i}`), { picks: 40 });
      for (const id of drawGrimoires(s).offers) {
        expect(['uranus', 'halley', 'antares', 'orion-nebula']).not.toContain(id);
      }
    }
    const ids = new Set<string>();
    for (let i = 0; i < 600; i++) {
      // Com o Ritmo Firme e os objetos abertos, todos os grimórios do colapso 3 podem sair.
      const base = withLevels({ ...withRun(newSave(`g${i}`), { picks: 40 }), collapses: 3 }, { rhythm: 1, satellite: 1 });
      for (const id of drawGrimoires(base).offers) ids.add(id);
    }
    expect(ids.has('orion-nebula')).toBe(true);
    expect(ids.has('uranus')).toBe(true);
  });

  it('não oferece grimório que já está no teto (nível 10 num Lendário)', () => {
    const maxed = GRIMOIRES.filter((g) => g.unlockedAtCollapse === 0 && g.id !== 'moon').reduce((s, g) => holdIn(s, g.id, 'legendary', 10), newSave('m'));
    for (let i = 0; i < 20; i++) {
      const { offers } = drawGrimoires(withRun({ ...maxed, run: { ...maxed.run, rngState: i * 977 + 1 } }, { picks: 40 }));
      expect(offers).toEqual(['moon']);
    }
  });

  it('oferece menos cartas se o catálogo acabar, sem quebrar', () => {
    const all = GRIMOIRES.reduce((st, g) => holdIn(st, g.id, 'legendary', 10), newSave('z'));
    expect(drawGrimoires({ ...all, collapses: 5 }).offers).toEqual([]);
  });
});

describe('escolha de grimório', () => {
  function opened(seed = 'ch'): { s: SaveState; t: number; offers: string[] } {
    const { state, t } = pressN(newSave(seed), 240);
    return { s: state, t, offers: state.run.pending?.offers ?? [] };
  }

  it('as cartas ficam bloqueadas por 1,6 s', () => {
    const { s, t, offers } = opened();
    const openedAt = s.run.pending?.openedAt ?? 0;
    const early = selectGrimoire(s, offers[0] as string, openedAt + 1.0);
    expect(early.run.pending?.selected).toBeNull();
    const late = selectGrimoire(s, offers[0] as string, openedAt + 1.7);
    expect(late.run.pending?.selected).toBe(offers[0]);
    expect(t).toBeGreaterThan(0);
  });

  it('exige selecionar antes de confirmar (2 passos)', () => {
    const { s, offers } = opened();
    const at = (s.run.pending?.openedAt ?? 0) + 2;
    const direct = chooseGrimoire(s, offers[0] as string, at);
    expect(direct.run.pending).not.toBeNull();
    expect(direct.run.picks).toBe(0);
    const selected = selectGrimoire(s, offers[0] as string, at);
    const otherCard = chooseGrimoire(selected, offers[1] as string, at);
    expect(otherCard.run.pending).not.toBeNull();
  });

  it('não escolhe carta que não foi oferecida', () => {
    const { s, offers } = opened();
    const at = (s.run.pending?.openedAt ?? 0) + 2;
    const other = GRIMOIRES.find((g) => g.unlockedAtCollapse === 0 && !offers.includes(g.id))?.id as string;
    const sel = selectGrimoire(s, other, at);
    expect(sel.run.pending?.selected).toBeNull();
  });

  it('confirmar entrega o grimório, zera a energia e anota no álbum', () => {
    const { s, offers } = opened();
    const id = offers[0] as string;
    const next = pick(s, id, s.run.pending?.openedAt ?? 0);
    expect(next.run.pending).toBeNull();
    expect(next.run.build[id]).toBe(1);
    expect(next.run.energy).toBe(0);
    expect(next.run.picks).toBe(1);
    expect(next.album).toContain(`${id}:${s.run.pending?.rarities?.[id] ?? 'common'}`);
    expect(next.stats.picks).toBe(1);
  });

  it('o passo de energia sobe a cada escolha', () => {
    const { s, offers } = opened();
    const next = pick(s, offers[0] as string, s.run.pending?.openedAt ?? 0);
    expect(currentEnergyCap(next)).toBe(ENERGY_STEPS[1]);
  });

  it('escolher o mesmo grimório de novo sobe o nível (até o 10)', () => {
    let s = withBuild(withRun(newSave('lv'), { energy: 60, picks: 0 }), { moon: 3 });
    s = withRun(s, { pending: { offers: ['moon', 'vesta', 'mars'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 } });
    s = pick(s, 'moon', 0);
    expect(s.run.build.moon).toBe(4);
    let t = withBuild(withRun(newSave('lv'), { energy: 60 }), { moon: 10 });
    t = withRun(t, { pending: { offers: ['moon', 'vesta', 'mars'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 } });
    t = pick(t, 'moon', 0);
    expect(t.run.build.moon).toBe(10);
  });

  it('o nível sobe 1 por escolha e respeita o teto da raridade (Comum 5, Raro 6)', () => {
    const offerMoon = (st: SaveState, rarity: GrimoireRarity) =>
      withRun(st, { pending: { offers: ['moon'], rarities: { moon: rarity }, openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 } });
    let s = holdIn(withRun(newSave('cap'), { energy: 60 }), 'moon', 'common', 5);
    // Comum no teto: pegar outra Comum não sobe nada.
    expect(pick(offerMoon(s, 'common'), 'moon', 0).run.build.moon).toBe(5);
    // Raro: vira Raro e sobe 1 nível (o teto agora é 6).
    s = pick(offerMoon(s, 'rare'), 'moon', 0);
    expect(s.run.build.moon).toBe(6);
    expect(s.run.buildRarity.moon).toBe(1);
    expect(s.album).toContain('moon:rare');
  });

  it('cada nível guarda o bônus da raridade em que foi pego (esperar a carta boa não compensa)', () => {
    const tail = (st: SaveState) => effectiveStats(st).dustPerTouch;
    const base = newSave('g');
    // Lua: 5 níveis Comuns e depois 1 Raro contra 6 níveis Raros desde o começo.
    const late = holdIn(holdIn(base, 'sirius', 'common', 5), 'sirius', 'rare', 1);
    const early = holdIn(base, 'sirius', 'rare', 6);
    expect(late.run.buildGain.sirius as number).toBeLessThan(early.run.buildGain.sirius as number);
    expect(late.run.build.sirius).toBe(6);
    expect(early.run.build.sirius).toBe(6);
    void tail;
  });

  it('a Nebulosa de Órion oferece mais cartas por escolha (e a raridade aumenta, até o teto de 2 a mais)', () => {
    const plain = effectiveStats(newSave('or')).choice.cards;
    expect(effectiveStats(holdIn(newSave('or'), 'orion-nebula', 'common')).choice.cards).toBe(plain + 1);
    expect(effectiveStats(holdIn(newSave('or'), 'orion-nebula', 'legendary', 10)).choice.cards).toBe(plain + 2);
    let s = holdIn(newSave('or'), 'orion-nebula', 'common');
    s = withRun({ ...s, collapses: 3 }, { energy: 59.9, picks: 0 });
    s = press(s, 1);
    expect(s.run.pending?.offers.length).toBeGreaterThanOrEqual(4);
  });

  it('o Betelgeuse troca uma carta, uma vez, por outra fora da oferta', () => {
    let s = withBuild(newSave('be'), { betelgeuse: 1 });
    s = withRun(s, { energy: 59.9, picks: 0 });
    s = press(s, 1);
    const offers = s.run.pending?.offers ?? [];
    expect(s.run.pending?.rerollsLeft).toBe(1);
    const swapped = rerollGrimoire(s, offers[0] as string, 1);
    const after = swapped.run.pending?.offers ?? [];
    expect(after[0]).not.toBe(offers[0]);
    expect(after[1]).toBe(offers[1]);
    expect(offers).not.toContain(after[0]);
    expect(swapped.run.pending?.rerollsLeft).toBe(0);
    expect(rerollGrimoire(swapped, after[1] as string, 1)).toBe(swapped);
  });

  it('sem Betelgeuse não há troca', () => {
    const { s, offers } = opened('nr');
    expect(rerollGrimoire(s, offers[0] as string, 5)).toBe(s);
  });

  it('a Sonda Voyager deixa uma troca grátis para a próxima escolha', () => {
    let s = withRun(newSave('sv'), { freeRerolls: 1, energy: 59.9 });
    s = press(s, 1);
    expect(s.run.pending?.rerollsLeft).toBe(1);
    expect(s.run.freeRerolls).toBe(0);
  });
});

describe('effectiveStats', () => {
  it('é memoizada enquanto o estado não muda e recalcula quando muda', () => {
    const s = newSave('m');
    expect(effectiveStats(s)).toBe(effectiveStats(s));
    const bought = buyUpgrade(withRun(s, { dust: 1e5 }), 0);
    expect(effectiveStats(bought)).not.toBe(effectiveStats(s));
    expect(effectiveStats(bought).dustPerTouch).toBe(2);
  });

  it('o nível do grimório soma metade do passo da raridade por nível', () => {
    const vega = (rarity: GrimoireRarity, lvl: number) => effectiveStats(holdIn(newSave('lv'), 'vega', rarity, lvl)).dustPerTouch;
    expect(vega('common', 1)).toBeCloseTo(1 + 0.5, 9);
    expect(vega('common', 3)).toBeCloseTo(1 + 0.5 * (1 + 2 * GRIMOIRE_LEVEL_STEP), 9);
    expect(vega('rare', 1)).toBeCloseTo(1 + 0.5 * 2, 9);
  });

  it('descontos de custo se multiplicam e param no piso de 40%', () => {
    const one = effectiveStats({ ...newSave('cf'), collapses: 5, vault: { m87: 1 } }).costFactor;
    expect(one).toBeCloseTo(0.6, 9);
    // M87* no nível 5 (-72%) junto com o ramo Nebulosas das melhorias do começo: nunca abaixo do piso de 40%.
    const deep = effectiveStats({ ...newSave('cf'), collapses: 5, vault: { m87: 5 } }).costFactor;
    expect(deep).toBeGreaterThanOrEqual(0.4);
  });

  it('o preço do proibido pesa: Sagitário multiplica a poeira por 3,5 e corta a energia', () => {
    const base = effectiveStats(newSave('sg'));
    const s = effectiveStats({ ...newSave('sg'), vault: { 'sagittarius-a': 1 } });
    expect(s.dustPerTouch).toBeCloseTo(base.dustPerTouch * 3.5, 9);
    expect(s.energyPerTouch).toBeCloseTo(base.energyPerTouch * 0.5, 9);
  });

  it('M87* encarece o passo de energia e Cygnus desliga os objetos e multiplica a poeira', () => {
    const base = effectiveStats(newSave('m'));
    const m87 = effectiveStats({ ...newSave('m'), collapses: 5, vault: { m87: 1 } });
    expect(m87.energyStepFactor).toBeCloseTo(1.2, 9);
    const cyg = effectiveStats({ ...newSave('m'), collapses: 3, vault: { 'cygnus-x1': 1 } });
    expect(cyg.objects.disabled).toBe(true);
    expect(cyg.dustPerTouch).toBeCloseTo(base.dustPerTouch * 2, 9);
  });

  it('Vega soma poeira por toque a cada grimório que você tem, de qualquer raridade', () => {
    const one = effectiveStats(holdIn(newSave('v'), 'vega')).dustPerTouch;
    const three = effectiveStats(holdIn(holdIn(holdIn(newSave('v'), 'vega'), 'mercury', 'epic'), 'polaris', 'rare')).dustPerTouch;
    expect(three).toBeGreaterThan(one);
    expect(three).toBeCloseTo(1 + 0.5 * 3, 9);
  });

  it('Halley antecipa os objetos em 4 s e Europa abre 1 lugar a mais no campo', () => {
    const s0 = effectiveStats(newSave('k')).objects;
    const halley = effectiveStats(holdIn(newSave('k'), 'halley')).objects;
    expect([s0.spawnMinSec, s0.spawnMaxSec]).toEqual([60, 90]);
    expect(s0.maxOnField).toBe(1);
    expect(halley.spawnMinSec).toBeCloseTo(56, 9);
    expect(halley.spawnMaxSec).toBeCloseTo(86, 9);
    expect(effectiveStats(holdIn(newSave('k'), 'europa')).objects.maxOnField).toBe(2);
  });

  it('os geradores rendem cheio tocando ou parado, sem teto, e só com a escolha fechada', () => {
    const s = withLevels(newSave('hb'), { satellite: 4 });
    const st = effectiveStats(s);
    const per = (UPGRADES[idx('satellite')] as { perSec: number }).perSec * 4;
    expect(st.autoDustPerSec).toBeCloseTo(per, 9);
    const idle = syncClock(s, 2);
    expect(idle.run.dust).toBeCloseTo(per * 2, 9);
    expect(idle.run.dustLife).toBeCloseTo(per * 2, 9);
    expect(idle.stats.dustTotal).toBeCloseTo(per * 2, 9);
    const touched = syncClock(press(s, 1), 3);
    expect(touched.run.dust).toBeCloseTo(per + 1 + per * 2, 9);
    const hidden = syncClock(idle, 60);
    expect(hidden.run.dust).toBeCloseTo(per * 2, 9);
    const pending = syncClock(withRun(idle, { pending: { offers: ['moon'], openedAt: 2, selected: null, picksLeft: 1, rerollsLeft: 0 } }), 4);
    expect(pending.run.dust).toBeCloseTo(per * 2, 9);
  });

  it('não há teto no ganho automático: vários geradores completos somam tudo', () => {
    const s = withLevels(newSave('cap'), { satellite: 8, probe: 8, telescope: 8 });
    const sum = ['satellite', 'probe', 'telescope'].reduce((a, id) => a + (UPGRADES[idx(id)] as { perSec: number }).perSec * 8, 0);
    expect(effectiveStats(s).autoDustPerSec).toBeCloseTo(sum, 9);
    expect(syncClock(s, 2).run.dust).toBeCloseTo(sum * 2, 9);
  });

  it('o gerador rende de forma linear até o limite de níveis (0/8) e não há mais marcos que dobram', () => {
    const sat = UPGRADES[idx('satellite')] as { perSec: number; max: number };
    const rate = (n: number) => effectiveStats(withLevels(newSave('m'), { satellite: n })).autoDustPerSec;
    expect(sat.max).toBe(8);
    for (const n of [1, 4, 8]) expect(rate(n)).toBeCloseTo(sat.perSec * n, 9);
  });

  it('geradores de energia enchem a barra sem passar do teto e abrem a escolha no tick', () => {
    const s = withLevels(newSave('en'), { antenna: 5 });
    const per = (UPGRADES[idx('antenna')] as { perSec: number }).perSec * 5;
    expect(effectiveStats(s).autoEnergyPerSec).toBeCloseTo(per, 9);
    expect(syncClock(s, 4).run.energy).toBeCloseTo(per * 4, 9);
    const nearly = withRun(s, { energy: ENERGY_STEPS[0] - 0.01 });
    const opened = tickObjects(nearly, 4);
    expect(opened.run.pending).not.toBeNull();
  });

  it('Vênus soma toques à recompensa de todo objeto (e a raridade e o nível multiplicam o passo)', () => {
    const base = effectiveStats(newSave('hv')).objects.reward;
    expect(base.comet.dust).toBe(6);
    expect(base['shooting-star'].energy).toBe(2);
    expect(base.satellite.dust).toBe(0);
    const s = effectiveStats(holdIn(newSave('hv'), 'venus')).objects.reward;
    expect(s.comet.dust).toBe(6 + 3);
    expect(s['shooting-star'].energy).toBe(2 + 3);
    expect(s.satellite.dust).toBe(3);
    const rare = effectiveStats(holdIn(newSave('hv'), 'venus', 'rare')).objects.reward;
    expect(rare.comet.dust).toBe(6 + 3 * 2);
    const lvl2 = effectiveStats(holdIn(newSave('hv'), 'venus', 'common', 2)).objects.reward;
    expect(lvl2.comet.dust).toBeCloseTo(6 + 3 * (1 + GRIMOIRE_LEVEL_STEP), 9);
  });

  it('Ganimedes alonga a vida de todos os objetos', () => {
    const base = effectiveStats(newSave('du'));
    const g = effectiveStats(holdIn({ ...newSave('du'), collapses: 1 }, 'ganymede'));
    expect(g.objects.lifeSec.comet).toBeCloseTo(base.objects.lifeSec.comet + 2, 9);
    expect(g.objects.lifeSec['shooting-star']).toBeCloseTo(base.objects.lifeSec['shooting-star'] + 2, 9);
  });

  it('Io só mexe no próximo toque depois de capturar um objeto', () => {
    expect(effectiveStats(newSave('s')).objects.signalMult).toBe(2);
  });

  it('Titã não dá poeira no começo da vida: ele devolve poeira nas compras, e a raridade multiplica', () => {
    expect(effectiveStats(holdIn(newSave('t'), 'titan')).startDust).toBe(0);
    expect(effectiveStats(holdIn(newSave('t'), 'titan')).buyRefundTouches).toBe(2);
    expect(effectiveStats(holdIn(newSave('t'), 'titan', 'rare')).buyRefundTouches).toBe(4);
    expect(effectiveStats(newSave('t')).buyRefundTouches).toBe(0);
  });

});

describe('relógio e jogo parado', () => {
  it('conta o tempo jogado até 5 s de intervalo', () => {
    const s = syncClock(newSave('c'), 3);
    expect(s.playSeconds).toBe(3);
    expect(s.clock).toBe(3);
  });

  it('um salto grande é aba escondida: não conta e congela objetos, boost e combo', () => {
    let s = withLevels(newSave('c'), { resonance: 1 });
    s = withRun(s, { boostUntil: 20, objects: [{ id: 1, kind: 'comet', bornAt: 5, expiresAt: 12 }], nextSpawnAt: 15, lastPressAt: 9 });
    s = { ...s, clock: 10 };
    const back = syncClock(s, 70);
    expect(back.playSeconds).toBe(0);
    expect(back.run.boostUntil).toBe(80);
    expect(back.run.objects[0]?.expiresAt).toBe(72);
    expect(back.run.nextSpawnAt).toBe(75);
    expect(back.run.lastPressAt).toBe(69);
  });

  it('resumeClock congela mesmo um intervalo curto', () => {
    let s = withRun(newSave('c'), { boostUntil: 20 });
    s = { ...s, clock: 10 };
    const back = resumeClock(s, 13);
    expect(back.run.boostUntil).toBe(23);
    expect(back.playSeconds).toBe(0);
  });

  it('tempo que volta atrás é ignorado', () => {
    const s = { ...newSave('c'), clock: 10 };
    expect(syncClock(s, 5)).toBe(s);
  });

  it('com a escolha aberta o campo congela, mas o tempo de jogo segue', () => {
    let s = withRun({ ...newSave('c'), clock: 10 }, {
      pending: { offers: ['moon', 'vesta', 'mars'], openedAt: 10, selected: null, picksLeft: 1, rerollsLeft: 0 },
      objects: [{ id: 1, kind: 'comet', bornAt: 5, expiresAt: 12 }],
    });
    s = syncClock(s, 13);
    expect(s.playSeconds).toBe(3);
    expect(s.run.objects[0]?.expiresAt).toBe(15);
    expect(s.run.pending?.openedAt).toBe(10);
  });
});

describe('objetos no espaço', () => {
  it('a prévia da etiqueta bate com o que a captura entrega', () => {
    const s = tickTo0(newSave('p'));
    for (const kind of ['comet', 'shooting-star', 'satellite'] as const) {
      const p = objectPreview(s, kind);
      const id = 1;
      const withObj: SaveState = {
        ...s,
        run: { ...s.run, objects: [{ id, kind, bornAt: 0, expiresAt: 7 }], nextObjectId: 2 },
      };
      const after = captureObject(withObj, id, 1);
      expect(after.run.dust - s.run.dust).toBe(p.dust);
      expect(after.run.energy - s.run.energy).toBeCloseTo(p.energy, 9);
      if (kind === 'satellite') {
        expect(p).toMatchObject({ boostMult: 2, boostSec: 8 });
        expect(after.run.boostMult).toBe(p.boostMult);
      } else expect(p.boostMult).toBe(0);
    }
  });

  /** Passa o tempo em passos de 1 s (um salto maior que 5 s seria aba escondida). */
  function tickTo(s: SaveState, from: number, to: number): SaveState {
    let state = s;
    for (let t = from; t <= to + 1e-9; t += 1) state = tickObjects(state, t);
    return tickObjects(state, to);
  }

  function spawnOne(s: SaveState): { s: SaveState } {
    return { s: tickTo(s, 0, 10) };
  }

  it('nada de objeto antes da 1ª melhoria; depois, o 1º nasce entre 60 e 90 s', () => {
    const none = tickTo(newSave('o'), 0, 100);
    expect(none.run.objects).toHaveLength(0);
    expect(none.run.nextSpawnAt).toBeNull();
    const first = tickObjects(withLevels(newSave('o'), { satellite: 1 }), 0);
    expect(first.run.nextSpawnAt).toBeGreaterThanOrEqual(60);
    expect(first.run.nextSpawnAt).toBeLessThanOrEqual(90);
    // Depois do 1º colapso a vida nova já começa com os objetos abertos.
    expect(objectsOpen({ ...newSave('o'), collapses: 1 })).toBe(true);
    expect(objectsOpen(newSave('o'))).toBe(false);
  });

  it('o objeto comum nasce na janela de 60 a 90 s e dura 7 s', () => {
    let s = tickObjects(withLevels(newSave('o'), { satellite: 1 }), 0);
    const at = s.run.nextSpawnAt as number;
    s = tickTo(s, 0, at - 1.5);
    expect(s.run.objects).toHaveLength(0);
    s = tickTo(s, at - 1.5, at + 1);
    expect(s.run.objects).toHaveLength(1);
    const o = s.run.objects[0]!;
    expect(o.expiresAt - o.bornAt).toBeCloseTo(7, 9);
    s = tickTo(s, at + 1, at + 9);
    expect(s.run.objects).toHaveLength(0);
    // O próximo vem de 60 a 90 s depois.
    expect((s.run.nextSpawnAt as number) - (at + 1)).toBeGreaterThan(50);
  });

  it('a janela varia de um objeto para o outro, sempre entre 60 e 90 s', () => {
    const gaps = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const s = tickObjects(withLevels(newSave('w' + i), { satellite: 1 }), 0);
      const g = s.run.nextSpawnAt as number;
      expect(g).toBeGreaterThanOrEqual(60);
      expect(g).toBeLessThanOrEqual(90);
      gaps.add(Math.round(g));
    }
    expect(gaps.size).toBeGreaterThan(5);
  });

  it('só os objetos do colapso atual entram no sorteio', () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 200; i++) {
      let s = withLevels(newSave(`k${i}`), { satellite: 1 });
      s = withRun(s, { nextSpawnAt: 0 });
      s = tickObjects(s, 1);
      for (const o of s.run.objects) kinds.add(o.kind);
    }
    expect(kinds).toEqual(new Set(['comet', 'shooting-star', 'satellite']));
    const later = new Set<string>();
    for (let i = 0; i < 400; i++) {
      let s = { ...newSave(`k${i}`), collapses: 2 };
      s = withRun(s, { nextSpawnAt: 0 });
      s = tickObjects(s, 1);
      for (const o of s.run.objects) later.add(o.kind);
    }
    expect(later).toEqual(new Set(OBJECTS.map((o) => o.kind)));
  });

  it('respeita o máximo no campo (1 no começo)', () => {
    const one = [{ id: 1, kind: 'comet' as const, bornAt: 0, expiresAt: 100 }];
    const start = withLevels(withRun(newSave('mx'), { objects: one, nextSpawnAt: 0, nextObjectId: 2 }), { satellite: 1 });
    expect(tickObjects(start, 1).run.objects).toHaveLength(1);
    expect(tickObjects(withLevels(start, { kepler: 1 }), 1).run.objects).toHaveLength(1);
  });

  it('não nasce objeto com a escolha aberta nem com Cygnus X-1', () => {
    const paused = withRun(newSave('pc'), {
      nextSpawnAt: 0,
      pending: { offers: ['moon', 'vesta', 'mars'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 },
    });
    expect(tickObjects(paused, 1).run.objects).toHaveLength(0);
    const cyg = { ...withRun({ ...newSave('cy'), collapses: 3 }, { nextSpawnAt: 0 }), vault: { 'cygnus-x1': 1 } };
    expect(tickObjects(cyg, 1).run.objects).toHaveLength(0);
  });

  it('o cometa dá 6 toques de poeira, e Marte/Vênus/Antares somam toques', () => {
    const base = withLevels(newSave('cm'), { lens: 1 });
    expect(objectReward(base, 'comet').dust).toBe(2 * 6);
    const boosted = withBuild(base, { venus: 1 });
    expect(objectReward(boosted, 'comet').dust).toBe(2 * 9);
    let s = withRun(base, { objects: [{ id: 7, kind: 'comet', bornAt: 0, expiresAt: 10 }] });
    s = captureObject(s, 7, 1);
    expect(s.run.dust).toBe(12);
    expect(s.run.objects).toHaveLength(0);
    expect(s.stats.objectsCaptured).toBe(1);
  });

  it('no começo os objetos são fracos: um cometa vale bem menos que a 1ª melhoria já paga', () => {
    // Com 1 de poeira por toque o cometa dá 6, menos que o preço da 1ª melhoria (25).
    expect(objectReward(newSave('cm'), 'comet').dust).toBeLessThan(25);
    expect(objectReward(newSave('cm'), 'shooting-star').energy).toBeLessThan(energyCap(0) / 5);
  });

  it('a estrela cadente dá energia de 2 toques e pode encher a barra', () => {
    const s0 = withRun(newSave('st'), { objects: [{ id: 1, kind: 'shooting-star', bornAt: 0, expiresAt: 10 }] });
    expect(captureObject(s0, 1, 1).run.energy).toBeCloseTo(2 * 1, 9);
    const nearlyFull = withRun(s0, { energy: ENERGY_STEPS[0] - 1 });
    const full = captureObject(nearlyFull, 1, 1);
    expect(full.run.pending).not.toBeNull();
  });

  it('o satélite liga o Sinal forte x2 por 8 s e para depois', () => {
    let s = withLevels(newSave('sat'), { lens: 1, lens2: 1, cabin: 1 });
    s = withRun(s, { objects: [{ id: 1, kind: 'satellite', bornAt: 0, expiresAt: 10 }] });
    s = captureObject(s, 1, 1);
    expect(s.run.boostUntil).toBe(9);
    s = press(s, 2);
    expect(s.run.lastGain).toBe(10);
    s = press(s, 6);
    expect(s.run.lastGain).toBe(10);
    s = press(s, 9.5);
    expect(s.run.lastGain).toBe(5);
  });

  it('Fobos dá energia ao capturar um objeto', () => {
    let s = holdIn(newSave('pt'), 'phobos', 'rare');
    s = withRun(s, { objects: [{ id: 1, kind: 'comet', bornAt: 0, expiresAt: 10 }] });
    s = captureObject(s, 1, 1);
    expect(s.run.energy).toBeCloseTo(2 * 1, 9);
    expect(s.run.afterCapture).toBe(false);
  });

  it('a Sonda Voyager deixa uma troca grátis', () => {
    let s = withRun({ ...newSave('pb'), collapses: 2 }, { objects: [{ id: 1, kind: 'probe', bornAt: 0, expiresAt: 10 }] });
    s = captureObject(s, 1, 1);
    expect(s.run.freeRerolls).toBe(1);
  });

  it('não captura objeto expirado, inexistente nem com a escolha aberta', () => {
    const s = withRun(newSave('x'), { objects: [{ id: 1, kind: 'comet', bornAt: 0, expiresAt: 3 }] });
    expect(captureObject(s, 1, 5).run.dust).toBe(0);
    expect(captureObject(s, 99, 1).run.dust).toBe(0);
    const paused = withRun(s, { pending: { offers: ['moon', 'vesta', 'mars'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 } });
    expect(captureObject(paused, 1, 1).run.objects).toHaveLength(1);
  });

  it('uma sequência de ticks produz objetos determinísticos', () => {
    const a = spawnOne(newSave('det')).s.run.objects;
    const b = spawnOne(newSave('det')).s.run.objects;
    expect(a).toEqual(b);
  });
});

describe('colapso', () => {
  it('não colapsa antes da meta de poeira e do mínimo de escolhas', () => {
    const s = newSave('co');
    expect(canCollapse(s)).toBe(false);
    expect(canCollapse(withRun(s, { dustLife: dustGoal(1) }))).toBe(false);
    expect(canCollapse(withRun(s, { picks: 40 }))).toBe(false);
    const ready = readyToCollapse(withBuild(s, { moon: 1 }));
    expect(canCollapse(ready)).toBe(true);
    expect(collapse(s)).toBe(s);
  });

  it('mostra o progresso até a estrela ficar pronta', () => {
    const p = collapseProgress(withRun(newSave('co'), { dustLife: 1000, picks: 4 }));
    expect(p.dustGoal).toBe(dustGoal(1));
    expect(p.minPicks).toBe(MIN_PICKS_FIRST);
    expect(p.ready).toBe(false);
  });

  it('ganha um proibido no Cofre, não dá Fragmentos e recomeça do zero', () => {
    let s = withBuild(withLevels(newSave('co'), { pulse: 7 }), { vesta: 3, moon: 1 });
    s = withRun(s, { ...s.run, dust: 12345, energy: 10, clicks: 999 });
    s = { ...s, album: ['vesta', 'moon'], achievements: ['first'], stats: { ...s.stats, clicks: 999 } };
    s = readyToCollapse(s);
    const offers = vaultOffers(s);
    expect(offers).toHaveLength(3);
    const after = collapse(s, offers[1]);
    expect(after.collapses).toBe(1);
    expect(after.vault).toEqual({ [offers[1] as string]: 1 });
    expect(after.album).toContain(offers[1]);
    expect(after.stats.forbiddenBest[offers[1] as string]).toBe(1);
    // Sem Fragmentos por colapso: o saldo de Cintilas só vem das fontes (conquistas, álbum...).
    expect(after.sparks).toEqual({ legacy: 0, spent: 0 });
    expect(sparksAvailable(after)).toBeGreaterThan(0);
    expect(after.run.dust).toBe(0);
    expect(after.run.dustLife).toBe(0);
    expect(after.run.picks).toBe(0);
    expect(after.run.energy).toBe(0);
    expect(after.run.build).toEqual({});
    expect(after.run.upgradeLevels.every((l) => l === 0)).toBe(true);
    expect(after.album).toEqual(expect.arrayContaining(['vesta', 'moon']));
    expect(after.achievements).toContain('first');
    expect(after.stats.clicks).toBe(999);
    assertSane(after);
  });

  it('o 1º colapso abre a região nova e o conteúdo da vida seguinte', () => {
    const s = readyToCollapse(withBuild(newSave('co'), { moon: 1 }));
    const after = collapse(s);
    expect(regionFor(after).id).toBe('asteroid-belt');
    expect(after.regionId).toBe('asteroid-belt');
    const content = unlockedContent(after);
    expect(content.grimoires.map((g) => g.id)).toEqual(expect.arrayContaining(['uranus', 'halley']));
    expect(content.grimoires.map((g) => g.id)).not.toContain('antares');
    expect(content.upgrades.map((u) => u.id)).toContain('webb');
    expect(content.objects.map((o) => o.kind)).toContain('asteroid');
  });

  it('cada colapso destrava exatamente as linhas da tabela 5.4', () => {
    const expected: Record<number, string[]> = { 1: ['uranus', 'capella', 'ganymede'], 2: ['antares', 'cassiopeia'], 3: ['orion-nebula'], 4: [], 5: [] };
    for (let c = 1; c <= 5; c++) {
      const before = new Set(unlockedContent({ ...newSave('u'), collapses: c - 1 }).grimoires.map((g) => g.id));
      const now = unlockedContent({ ...newSave('u'), collapses: c }).grimoires.map((g) => g.id);
      expect(now.filter((id) => !before.has(id)).sort()).toEqual([...(expected[c] as string[])].sort());
    }
    expect(unlockedContent({ ...newSave('u'), collapses: 0 }).grimoires).toHaveLength(14);
    expect(unlockedContent({ ...newSave('u'), collapses: 5 }).grimoires).toHaveLength(GRIMOIRES.length);
    expect(GRIMOIRES).toHaveLength(20);
    expect(unlockedContent({ ...newSave('u'), collapses: 5 }).regions).toHaveLength(6);
  });

  it('a vida nova nasce com a poeira inicial do Cofre (nenhum grimório comum dá poeira de largada)', () => {
    const s = readyToCollapse(withBuild(newSave('ti'), { titan: 1 }));
    const after = collapse({ ...s, run: { ...s.run, build: { titan: 1 } } });
    // A vida nova nasce sem os grimórios da vida: só o Cofre vale. Holmberg 15A começa a vida com poeira.
    expect(after.run.dust).toBe(effectiveStats(after).startDust);
  });

  it('não colapsa com a escolha de grimório aberta', () => {
    const s = withRun(readyToCollapse(withBuild(newSave('co'), { moon: 1 })), {
      pending: { offers: ['moon', 'vesta', 'mars'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 },
    });
    expect(canCollapse(s)).toBe(false);
  });
});

describe('robustez numérica', () => {
  it('jogo aleatório longo nunca gera NaN, infinito nem negativo', () => {
    for (const seed of ['n1', 'n2', 'n3']) {
      let s = newSave(seed);
      let t = 0;
      let r = hashish(seed);
      for (let i = 0; i < 6000; i++) {
        let roll: number;
        [roll, r] = nextRandom(r);
        t += 0.1 + roll * 0.5;
        if (s.run.pending) {
          const id = s.run.pending.offers[0] as string;
          s = pick(s, id, s.run.pending.openedAt);
          t = Math.max(t, s.clock);
        }
        s = tickObjects(s, t);
        for (const o of s.run.objects) if (roll > 0.5) s = captureObject(s, o.id, t);
        s = press(s, t);
        if (i % 7 === 0) s = withRun(s, { dust: s.run.dust + 1e5 * (i + 1) });
        for (let u = 0; u < UPGRADES.length; u++) s = buyUpgrade(s, u);
        if (canCollapse(s)) {
          const id = Object.keys(s.run.build)[0];
          if (id) s = collapse(s);
        }
        if (i % 500 === 0) assertSane(s);
      }
      assertSane(s);
    }
  });

  it('com valores perto do teto continua finito', () => {
    let s = withRun(newSave('big'), { dust: 1e299, dustLife: 1e299 });
    s = withLevels(s, { lens: 1, lens2: 1, cabin: 1, charged: 1, satellite: 400, antenna: 400 });
    s = withBuild(s, { vega: 10, 'sagittarius-a': 10 });
    for (let i = 0; i < 50; i++) s = press(s, 1 + i);
    assertSane(s);
    expect(s.run.dust).toBeLessThanOrEqual(MAX_NUMBER);
  });

  it('o catálogo não tem ids repetidos e os efeitos estão completos', () => {
    const ids = GRIMOIRES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GRIMOIRES as readonly GrimoireDef[]) {
      expect(g.effects.length).toBeGreaterThan(0);
      expect(g.text.length).toBeGreaterThan(0);
    }
    expect(GRIMOIRES.filter((g) => g.unlockedAtCollapse === 0)).toHaveLength(14);
  });
});

function hashish(s: string): number {
  let h = 17;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

function tickTo0(s: SaveState): SaveState {
  return tickObjects(s, 0);
}

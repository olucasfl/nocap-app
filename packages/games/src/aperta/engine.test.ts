import { describe, expect, it } from 'vitest';
import { GRIMOIRES, OBJECTS, TREE, UPGRADES, grimoireById, upgradeIndex, type GrimoireDef } from './catalog';
import { CHOICE_LOCK_SEC, MAX_NUMBER, dustGoal, energyCap, minPicks } from './economy';
import {
  buyTreeNode,
  buyUpgrade,
  canCollapse,
  captureObject,
  chooseGrimoire,
  clampNum,
  collapse,
  collapseProgress,
  currentEnergyCap,
  drawGrimoires,
  effectiveStats,
  fragmentsAvailable,
  newSave,
  nextRandom,
  nextUpgradeCost,
  objectReward,
  objectsOpen,
  press,
  regionFor,
  rerollGrimoire,
  resumeClock,
  respecTree,
  selectGrimoire,
  syncClock,
  tickObjects,
  unlockedContent,
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
  return withRun(s, { dustLife: dustGoal(k), picks: minPicks(k) });
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
    s.fragments.earned,
    s.fragments.spent,
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
  it('começa vazio, na região inicial e com 3 espaços no Atlas', () => {
    const s = newSave('x');
    expect(s.run.dust).toBe(0);
    expect(s.run.upgradeLevels).toHaveLength(UPGRADES.length);
    expect(s.collapses).toBe(0);
    expect(s.regionId).toBe('inner-solar-system');
    expect(s.atlas).toEqual({ slots: 3, pages: [] });
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

  it('25 toques pagam a 1ª melhoria e o 1º grimório sai com ~50 de poeira ganha', () => {
    let { state, t } = pressN(newSave('flow'), 25);
    expect(state.run.dust).toBe(25);
    expect(nextUpgradeCost(state, idx('pulse'))).toBe(25);
    expect(state.run.pending).toBeNull();
    state = buyUpgrade(state, idx('pulse'));
    expect(state.run.dust).toBe(0);
    let touches = 25;
    while (!state.run.pending && touches < 100) {
      state = press(state, t);
      t += 0.4;
      touches++;
    }
    expect(state.run.pending).not.toBeNull();
    expect(state.run.dustLife).toBeGreaterThanOrEqual(45);
    expect(state.run.dustLife).toBeLessThanOrEqual(60);
  });

  it('o Pulso Solar soma 1 por nível', () => {
    const s = press(withLevels(newSave('p'), { pulse: 4 }), 1);
    expect(s.run.dust).toBe(5);
  });

  it('ignora toques mais rápidos que 12 por segundo', () => {
    let s = press(newSave('p'), 1);
    const again = press(s, 1.05);
    expect(again.run.clicks).toBe(1);
    s = press(s, 1.1);
    expect(s.run.clicks).toBe(2);
  });

  it('o combo só existe depois da Ressonância de Vênus', () => {
    const noCombo = pressN(withLevels(newSave('p'), { pulse: 9 }), 5).state;
    expect(noCombo.run.combo).toBe(0);
    expect(noCombo.run.lastGain).toBe(10);

    let s = withLevels(newSave('p'), { pulse: 9, resonance: 1 });
    s = pressN(s, 5).state;
    expect(s.run.combo).toBe(3);
    expect(s.run.lastGain).toBe(16);
  });

  it('o combo cai quando passa a janela e respeita o máximo', () => {
    let s = withLevels(newSave('p'), { pulse: 9, resonance: 1 });
    s = pressN(s, 3).state;
    expect(s.run.combo).toBe(2);
    s = press(s, 5);
    expect(s.run.combo).toBe(0);
    s = withLevels(newSave('p'), { resonance: 1, pleiades: 2 });
    expect(effectiveStats(s).combo.max).toBe(5);
    s = pressN(s, 12).state;
    expect(s.run.combo).toBe(5);
  });

  it('o Alinhamento das Plêiades só compra com a Ressonância', () => {
    let s = { ...newSave('p'), run: { ...newSave('p').run, dust: 1e6, dustLife: 1e6 } };
    expect(nextUpgradeCost(s, idx('pleiades'))).toBeNull();
    s = withLevels(s, { resonance: 1 });
    expect(nextUpgradeCost(s, idx('pleiades'))).not.toBeNull();
  });

  it('a Ressonância só liga o combo e os níveis seguintes valem mais por ponto; a janela é dos grimórios', () => {
    const a = effectiveStats(withLevels(newSave('p'), { resonance: 1 }));
    const b = effectiveStats(withLevels(newSave('p'), { resonance: 5 }));
    expect(a.combo.windowSec).toBeCloseTo(1.3, 9);
    expect(b.combo.windowSec).toBeCloseTo(1.3, 9);
    expect(a.combo.pointValue).toBeCloseTo(0.2, 9);
    expect(b.combo.pointValue).toBeCloseTo(0.4, 9);
    const w = effectiveStats(withBuild(withLevels(newSave('p'), { resonance: 1 }), { uranus: 1, europa: 1 }));
    expect(w.combo.windowSec).toBeCloseTo(1.3 + 0.2 + 0.5, 9);
  });

  it('o Reator soma 0,25 de energia por toque por nível', () => {
    const s = press(withLevels(newSave('p'), { reactor: 8 }), 1);
    expect(s.run.energy).toBeCloseTo(1 + 8 * 0.25, 9);
  });

  it('a energia cheia abre a escolha e os toques seguintes não contam', () => {
    const { state, t } = pressN(newSave('p'), 38);
    expect(state.run.pending).not.toBeNull();
    expect(state.run.pending?.offers).toHaveLength(3);
    expect(state.run.energy).toBe(38);
    const before = state.run.clicks;
    const after = press(state, t + 1);
    expect(after.run.clicks).toBe(before);
    expect(after.run.dust).toBe(state.run.dust);
  });

  it('a Lua dá o bônus no 10º toque', () => {
    const s = withBuild(newSave('p'), { moon: 1 });
    const { state } = pressN(s, 10);
    expect(state.run.lastGain).toBe(2);
    expect(state.run.dust).toBe(9 + 2);
  });

  it('Mercúrio soma 2 de energia a cada 5 toques (número, não % da barra)', () => {
    const { state } = pressN(withBuild(newSave('p'), { mercury: 1 }), 5);
    expect(state.run.energy).toBeCloseTo(5 + 2, 9);
    const l3 = pressN(withBuild(newSave('p'), { mercury: 3 }), 5).state;
    expect(l3.run.energy).toBeCloseTo(5 + 4, 9);
  });

  it('com o combo no máximo, Sirius soma poeira e Ganimedes soma energia por toque', () => {
    const base = withLevels(newSave('p'), { pulse: 9, resonance: 1 });
    const plain = pressN(base, 6).state;
    const full = pressN(withBuild(base, { sirius: 1, ganymede: 1 }), 6).state;
    expect(plain.run.combo).toBe(3);
    expect(full.run.combo).toBe(3);
    // (10 + 2) x 1,6 = 19 contra 10 x 1,6 = 16
    expect(plain.run.lastGain).toBe(16);
    expect(full.run.lastGain).toBe(19);
    expect(full.run.energy).toBeGreaterThan(plain.run.energy);
    // Fora do combo cheio nada muda.
    expect(press(withBuild(base, { sirius: 1 }), 1).run.lastGain).toBe(press(base, 1).run.lastGain);
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
    const s = buyUpgrade(withRun(newSave('b'), { dust: 100 }), idx('pulse'));
    expect(s.run.upgradeLevels[idx('pulse')]).toBe(1);
    expect(s.run.dust).toBe(75);
  });

  it('o preço sobe a cada compra: 25, 28, 31...', () => {
    let s = withRun(newSave('b'), { dust: 1e6 });
    expect(nextUpgradeCost(s, idx('pulse'))).toBe(25);
    s = buyUpgrade(s, idx('pulse'));
    expect(nextUpgradeCost(s, idx('pulse'))).toBe(28);
    s = buyUpgrade(s, idx('pulse'));
    expect(nextUpgradeCost(s, idx('pulse'))).toBe(31);
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const c = nextUpgradeCost(s, idx('pulse')) as number;
      expect(c).toBeGreaterThan(last);
      last = c;
      s = buyUpgrade(s, idx('pulse'));
    }
  });

  it('sem saldo devolve o mesmo estado', () => {
    const s = withRun(newSave('b'), { dust: 24 });
    expect(buyUpgrade(s, idx('pulse'))).toBe(s);
  });

  it('índice inválido e nível máximo não compram', () => {
    const s = withRun(newSave('b'), { dust: 1e30 });
    expect(buyUpgrade(s, 99)).toBe(s);
    expect(buyUpgrade(s, -1)).toBe(s);
    const maxed = withLevels(s, { pulse: UPGRADES[idx('pulse')]!.max });
    expect(nextUpgradeCost(maxed, idx('pulse'))).toBeNull();
    expect(buyUpgrade(maxed, idx('pulse'))).toBe(maxed);
  });

  it('só a 1ª melhoria existe no começo; as outras esperam um marco (poeira ganha ou nível da anterior)', () => {
    const s = withRun(newSave('b'), { dust: 1e12 });
    const open = (st: SaveState) => upgradeUnlocks(st).filter((u) => u.unlocked).map((u) => u.id);
    expect(open(s)).toEqual(['pulse']);
    for (const id of ['resonance', 'reactor', 'hubble', 'kepler', 'voyager']) expect(nextUpgradeCost(s, idx(id))).toBeNull();

    // Marco de poeira ganha na vida.
    expect(open(withRun(s, { dustLife: 100 }))).toEqual(['pulse', 'resonance']);
    expect(open(withRun(s, { dustLife: 600 }))).toEqual(['pulse', 'resonance', 'reactor', 'hubble']);
    // Marco de nível da melhoria anterior, sem a poeira.
    expect(open(withLevels(s, { pulse: 4 }))).toEqual(['pulse', 'resonance']);
    expect(open(withLevels(s, { pulse: 10 }))).toEqual(['pulse', 'resonance', 'reactor', 'hubble']);
    // Plêiades pedem também a Ressonância comprada.
    expect(open(withRun(s, { dustLife: 5000 }))).not.toContain('pleiades');
    expect(open(withLevels(withRun(s, { dustLife: 5000 }), { resonance: 1 }))).toContain('pleiades');
    // Webb, Chandra e Gaia esperam o colapso.
    expect(nextUpgradeCost(withRun(s, { dustLife: 1e12 }), idx('webb'))).toBeNull();
    expect(nextUpgradeCost({ ...s, collapses: 1 }, idx('webb'))).not.toBeNull();
  });

  it('o seletor diz a condição das melhorias em breve e some com as de colapso futuro', () => {
    const rows = upgradeUnlocks(newSave('b'));
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.pulse!.unlocked).toBe(true);
    expect(byId.pulse!.lock).toBeNull();
    expect(byId.resonance!.lock).toEqual({ kind: 'milestone', dust: 100, upgrade: { id: 'pulse', level: 4 } });
    expect(byId.pleiades!.lock).toEqual({ kind: 'requires', upgrade: 'resonance', level: 1 });
    expect(byId.webb!.hidden).toBe(true);
    expect(byId.webb!.lock).toEqual({ kind: 'collapse', collapse: 1 });
    expect(byId.resonance!.hidden).toBe(false);
  });

  it('depois do 1º colapso as melhorias conhecidas abrem no início da vida (o marco só vale na 1ª vida)', () => {
    const s = { ...newSave('b'), collapses: 1 };
    const open = upgradeUnlocks(s).filter((u) => u.unlocked).map((u) => u.id);
    expect(open).toEqual(['pulse', 'resonance', 'reactor', 'kepler', 'hubble', 'voyager', 'webb']);
    // A exigência de Plêiades continua valendo.
    expect(open).not.toContain('pleiades');
  });

  it('as melhorias seguintes custam bem mais que a primeira e sobem a cada compra', () => {
    const rich = withRun({ ...newSave('b'), collapses: 5 }, { dust: 1e30, dustLife: 1e30 });
    for (const def of UPGRADES.slice(1)) {
      const at = (lvl: number) => nextUpgradeCost(withLevels(rich, { resonance: 1, [def.id]: lvl }), idx(def.id));
      expect(at(0), def.id).toBeGreaterThan(100);
      if (def.max > 1) expect(at(1) as number, def.id).toBeGreaterThan(at(0) as number);
    }
  });

  it('M87* e o Atlas reduzem o custo das melhorias; o Webb agora soma poeira por toque', () => {
    const base = withRun({ ...newSave('b'), collapses: 5 }, { dust: 1e12 });
    const c0 = nextUpgradeCost(base, idx('pulse')) as number;
    const c1 = nextUpgradeCost(withBuild(base, { m87: 1 }), idx('pulse')) as number;
    expect(c1).toBe(Math.round(c0 * 0.7));
    expect(effectiveStats(withLevels(base, { webb: 3 })).dustPerTouch).toBe(1 + 15);
  });

  it('Ceres e Saturno devolvem a poeira de alguns toques a cada compra (sem passar do preço)', () => {
    const base = withRun(withLevels(newSave('b'), { pulse: 9 }), { dust: 1000 });
    const plain = buyUpgrade(base, idx('pulse'));
    const ceres = buyUpgrade(withBuild(base, { ceres: 1 }), idx('pulse'));
    // Pulso nível 9 -> 10 vale 10 de poeira por toque: Ceres devolve 2 toques.
    expect(ceres.run.dust - plain.run.dust).toBe(2 * effectiveStats(base).dustPerTouch);
    const saturn = buyUpgrade(withBuild(base, { saturn: 1 }), idx('pulse'));
    expect(saturn.run.dust - plain.run.dust).toBe(5 * effectiveStats(base).dustPerTouch);
    const tiny = withRun(newSave('b'), { dust: 25 });
    expect(buyUpgrade(withBuild(tiny, { saturn: 10 }), idx('pulse')).run.dust).toBeLessThanOrEqual(25);
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
      for (const picks of [0, 1, 2]) {
        const s = withRun(newSave(`c${i}`), { picks });
        for (const id of drawGrimoires(s).offers) expect(grimoireById(id)?.rarity).toBe('common');
      }
    }
  });

  it('libera as raridades aos poucos pelo nº de escolhas', () => {
    const seen = (picks: number, collapses = 0): Set<string> => {
      const rarities = new Set<string>();
      for (let i = 0; i < 400; i++) {
        const s = { ...withRun(newSave(`r${i}`), { picks }), collapses };
        for (const id of drawGrimoires(s).offers) rarities.add(grimoireById(id)?.rarity ?? '?');
      }
      return rarities;
    };
    expect(seen(3)).toEqual(new Set(['common', 'rare']));
    expect(seen(8)).toEqual(new Set(['common', 'rare', 'epic']));
    expect(seen(14)).toEqual(new Set(['common', 'rare', 'epic', 'legendary']));
    expect(seen(22, 0).has('forbidden')).toBe(true);
    expect(seen(21, 0).has('forbidden')).toBe(false);
    // Depois do 1º colapso os limiares caem para 60%: o proibido (Sagitário) já sai com 14 escolhas.
    expect(seen(14, 1).has('forbidden')).toBe(true);
  });

  it('respeita os pesos: comum aparece bem mais que lendário', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 600; i++) {
      const s = withRun(newSave(`w${i}`), { picks: 30 });
      for (const id of drawGrimoires(s).offers) {
        const r = grimoireById(id)?.rarity ?? '?';
        counts[r] = (counts[r] ?? 0) + 1;
      }
    }
    expect(counts.common ?? 0).toBeGreaterThan((counts.rare ?? 0) * 2);
    expect(counts.rare ?? 0).toBeGreaterThan(counts.legendary ?? 0);
    expect(counts.epic ?? 0).toBeGreaterThan(counts.legendary ?? 0);
  });

  it('proibidos de colapsos futuros e conteúdo fechado nunca aparecem', () => {
    for (let i = 0; i < 300; i++) {
      const s = withRun(newSave(`f${i}`), { picks: 40 });
      for (const id of drawGrimoires(s).offers) {
        expect(['cygnus-x1', 'm87', 'pallas', 'callisto']).not.toContain(id);
      }
    }
    const ids = new Set<string>();
    for (let i = 0; i < 600; i++) {
      for (const id of drawGrimoires({ ...withRun(newSave(`g${i}`), { picks: 40 }), collapses: 5 }).offers) ids.add(id);
    }
    expect(ids.has('cygnus-x1')).toBe(true);
    expect(ids.has('m87')).toBe(true);
    expect(ids.has('pallas')).toBe(true);
  });

  it('não oferece grimório que já está no nível máximo', () => {
    const maxed = Object.fromEntries(
      GRIMOIRES.filter((g) => g.rarity === 'common' && g.unlockedAtCollapse === 0 && g.id !== 'moon').map((g) => [g.id, 10]),
    );
    for (let i = 0; i < 20; i++) {
      const { offers } = drawGrimoires(withBuild(newSave(`m${i}`), maxed));
      expect(offers).toEqual(['moon']);
    }
  });

  it('oferece menos cartas se o catálogo acabar, sem quebrar', () => {
    const all = Object.fromEntries(GRIMOIRES.map((g) => [g.id, 10]));
    expect(drawGrimoires({ ...withBuild(newSave('z'), all), collapses: 5 }).offers).toEqual([]);
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
    const { s } = opened();
    const at = (s.run.pending?.openedAt ?? 0) + 2;
    const sel = selectGrimoire(s, 'sirius', at);
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
    expect(next.album).toContain(id);
    expect(next.stats.picks).toBe(1);
  });

  it('o passo de energia sobe a cada escolha', () => {
    const { s, offers } = opened();
    const next = pick(s, offers[0] as string, s.run.pending?.openedAt ?? 0);
    expect(currentEnergyCap(next)).toBe(80);
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

  it('a Nebulosa do Caranguejo faz o repetido subir 2 níveis', () => {
    let s = withBuild(withRun(newSave('cr'), { energy: 60 }), { moon: 2, 'crab-nebula': 1 });
    s = withRun(s, { pending: { offers: ['moon', 'vesta', 'mars'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 } });
    s = pick(s, 'moon', 0);
    expect(s.run.build.moon).toBe(4);
  });

  it('a Nebulosa de Órion rende duas escolhas por barra cheia', () => {
    let s = withBuild(newSave('or'), { 'orion-nebula': 1 });
    s = withRun(s, { energy: 59.9 });
    s = press(s, 1);
    expect(s.run.pending?.picksLeft).toBe(2);
    s = pick(s, s.run.pending?.offers[0] as string, 1);
    expect(s.run.pending).not.toBeNull();
    expect(s.run.pending?.picksLeft).toBe(1);
    expect(s.run.energy).toBeGreaterThan(0);
    s = pick(s, s.run.pending?.offers[0] as string, s.run.pending?.openedAt ?? 0);
    expect(s.run.pending).toBeNull();
    expect(s.run.energy).toBe(0);
    expect(s.run.picks).toBe(2);
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

  it('o nível do grimório soma metade do número base por nível', () => {
    const l1 = effectiveStats(withBuild(newSave('lv'), { vega: 1, moon: 1, mercury: 1 }));
    // Vega: +0,5 por grimório comum no livro (3 comuns: Vega é épico, então 2 comuns).
    expect(l1.dustPerTouch).toBeCloseTo(1 + 0.5 * 2, 9);
    const l3 = effectiveStats(withBuild(newSave('lv'), { vega: 3, moon: 1, mercury: 1 }));
    expect(l3.dustPerTouch).toBeCloseTo(1 + 0.5 * 2 * 2, 9);
    const vesta = (lvl: number) =>
      effectiveStats(withBuild(withLevels(newSave('lv'), { resonance: 1 }), { vesta: lvl })).combo.fullDustAdd;
    expect(vesta(1)).toBeCloseTo(0.5, 9);
    expect(vesta(2)).toBeCloseTo(0.75, 9);
    expect(vesta(3)).toBeCloseTo(1, 9);
  });

  it('descontos de custo se multiplicam e param no piso de 40%', () => {
    const one = effectiveStats(withBuild({ ...newSave('cf'), collapses: 5 }, { m87: 1 })).costFactor;
    expect(one).toBeCloseTo(0.7, 9);
    const many = effectiveStats(withBuild({ ...newSave('cf'), collapses: 5 }, { m87: 10 })).costFactor;
    expect(many).toBe(0.4);
  });

  it('o preço do proibido pesa: Sagitário triplica a poeira e corta a energia', () => {
    const base = effectiveStats(newSave('sg'));
    const s = effectiveStats(withBuild(newSave('sg'), { 'sagittarius-a': 1 }));
    expect(s.dustPerTouch).toBeCloseTo(base.dustPerTouch * 3, 9);
    expect(s.energyPerTouch).toBeCloseTo(base.energyPerTouch * 0.3, 9);
  });

  it('M87* encarece o passo de energia e Cygnus desliga os objetos', () => {
    const m87 = effectiveStats(withBuild({ ...newSave('m'), collapses: 5 }, { m87: 1 }));
    expect(m87.energyStepFactor).toBeCloseTo(1.25, 9);
    const cyg = effectiveStats(withBuild({ ...newSave('m'), collapses: 3 }, { 'cygnus-x1': 1 }));
    expect(cyg.objects.disabled).toBe(true);
    expect(cyg.combo.fullMult).toBeCloseTo(2, 9);
    expect(cyg.combo.windowSec).toBeCloseTo(2 * 1.3, 9);
  });

  it('o teto do combo é duro', () => {
    const s = effectiveStats({
      ...withLevels(newSave('cm'), { pleiades: 5 }),
      collapses: 3,
      atlas: { slots: 6, pages: [{ grimoireId: 'sirius', level: 10 }, { grimoireId: 'vega', level: 10 }, { grimoireId: 'betelgeuse', level: 10 }, { grimoireId: 'polaris', level: 10 }] },
    });
    expect(s.combo.max).toBeLessThanOrEqual(12);
  });

  it('Via Láctea conta os raros e Andrômeda conta os colapsos, em números', () => {
    const mw = effectiveStats(withBuild(newSave('mw'), { 'milky-way': 1, europa: 1, saturn: 1, moon: 1 }));
    expect(mw.dustPerTouch).toBeCloseTo(1 + 2, 9);
    const an = effectiveStats(withBuild({ ...newSave('an'), collapses: 4 }, { andromeda: 1 }));
    expect(an.dustPerTouch).toBeCloseTo(1 + 4, 9);
  });

  it('o Kepler traz os objetos mais cedo e abre mais um espaço no campo', () => {
    const s0 = effectiveStats(newSave('k')).objects;
    const s5 = effectiveStats(withLevels(newSave('k'), { kepler: 5 })).objects;
    expect(s0.intervalSec).toBe(32);
    expect(s0.maxOnField).toBe(1);
    expect(s5.intervalSec).toBeCloseTo(17, 9);
    expect(s5.maxOnField).toBe(2);
  });

  it('o Hubble rende poeira por segundo sem tocar, só com a escolha fechada', () => {
    let s = withLevels(newSave('hb'), { hubble: 3 });
    expect(effectiveStats(s).dustPerSecond).toBe(3);
    s = syncClock(s, 2);
    expect(s.run.dust).toBeCloseTo(6, 9);
    expect(s.run.dustLife).toBeCloseTo(6, 9);
    expect(s.stats.dustTotal).toBeCloseTo(6, 9);
    // Aba escondida e escolha aberta não rendem.
    const hidden = syncClock(s, 60);
    expect(hidden.run.dust).toBeCloseTo(6, 9);
    const pending = syncClock(withRun(s, { pending: { offers: ['moon'], openedAt: 2, selected: null, picksLeft: 1, rerollsLeft: 0 } }), 4);
    expect(pending.run.dust).toBeCloseTo(6, 9);
  });

  it('Antares, Vênus e Marte somam toques à recompensa dos objetos', () => {
    const base = effectiveStats(newSave('hv')).objects.reward;
    expect(base.comet.dust).toBe(6);
    expect(base['shooting-star'].energy).toBe(2);
    expect(base.satellite.dust).toBe(0);
    const s = effectiveStats(withBuild(newSave('hv'), { antares: 1, mars: 1, venus: 1 })).objects.reward;
    expect(s.comet.dust).toBe(6 + 4 + 3);
    expect(s['shooting-star'].energy).toBe(2 + 4 + 2);
    expect(s.satellite.dust).toBe(4);
    const lvl2 = effectiveStats(withBuild(newSave('hv'), { venus: 2 })).objects.reward;
    expect(lvl2.comet.dust).toBeCloseTo(6 + 3 * 1.5, 9);
  });

  it('duração dos objetos e do sinal é das melhorias (Chandra, Voyager); os grimórios mexem no valor do sinal', () => {
    const base = effectiveStats({ ...newSave('du'), collapses: 4 });
    expect(base.objects.lifeSec.comet).toBe(7);
    expect(base.objects.signalSec).toBe(8);
    const up = effectiveStats(withLevels({ ...newSave('du'), collapses: 4 }, { chandra: 4, voyager: 2 }));
    expect(up.objects.lifeSec.comet).toBeCloseTo(9, 9);
    expect(up.objects.signalSec).toBe(10);
    const g = effectiveStats(withBuild({ ...newSave('du'), collapses: 4 }, { io: 1, neptune: 1 }));
    expect(g.objects.lifeSec.comet).toBe(7);
    expect(g.objects.signalSec).toBe(8);
    expect(g.objects.signalMult).toBeCloseTo(2 + 0.5 + 1, 9);
  });

  it('Calisto dá poeira ao satélite e Voyager soma 1 s por nível', () => {
    expect(effectiveStats(newSave('s')).objects.signalMult).toBe(2);
    const s = effectiveStats(withBuild(withLevels({ ...newSave('s'), collapses: 2 }, { voyager: 3 }), { callisto: 1 }));
    expect(s.objects.reward.satellite.dust).toBe(4);
    expect(s.objects.signalSec).toBe(11);
  });

  it('Titã dá 200 de poeira inicial por vida', () => {
    expect(effectiveStats(withBuild(newSave('t'), { titan: 1 })).startDust).toBe(200);
    expect(effectiveStats(withBuild(newSave('t'), { titan: 3 })).startDust).toBe(400);
    expect(effectiveStats(newSave('t')).startDust).toBe(0);
  });

});

describe('Atlas e bônus de conjunto nos números finais', () => {
  const page = (grimoireId: string, level = 1): { grimoireId: string; level: number } => ({ grimoireId, level });
  const withPages = (s: SaveState, pages: { grimoireId: string; level: number }[]): SaveState => ({
    ...s,
    atlas: { ...s.atlas, pages },
  });

  it('uma página vale 60% do poder do grimório', () => {
    const s = effectiveStats(withPages(newSave('a'), [page('milky-way')]));
    expect(s.dustPerTouch).toBeCloseTo(1, 9);
    const v = effectiveStats(withPages(newSave('a'), [page('vesta')]));
    expect(v.combo.fullDustAdd).toBeCloseTo(0.5 * 0.6, 9);
  });

  it('a página guarda o nível (60% do efeito escalado)', () => {
    const s = effectiveStats(withPages(newSave('a'), [page('vesta', 3)]));
    expect(s.combo.fullDustAdd).toBeCloseTo(0.5 * 2 * 0.6, 9);
  });

  it('a página e o grimório da vida somam', () => {
    const s = effectiveStats(withBuild(withPages(newSave('a'), [page('vesta')]), { vesta: 1 }));
    expect(s.combo.fullDustAdd).toBeCloseTo(0.5 + 0.5 * 0.6, 9);
  });

  it('2 páginas de Planetas ativam +5% de poeira, 3 ativam +12%', () => {
    const two = effectiveStats(withPages(newSave('a'), [page('mercury'), page('venus')]));
    expect(two.dustPerTouch).toBeCloseTo(1.05, 9);
    const three = effectiveStats(withPages(newSave('a'), [page('mercury'), page('venus'), page('mars')]));
    expect(three.dustPerTouch).toBeCloseTo(1.12, 9);
  });

  it('bônus de Estrelas soma combo máximo, Luas somam energia', () => {
    const stars = effectiveStats(withPages(newSave('a'), [page('sirius'), page('vega')]));
    expect(stars.combo.max).toBe(3 + 1);
    const moons = effectiveStats(withPages(newSave('a'), [page('europa'), page('titan')]));
    expect(moons.energyPerTouch).toBeCloseTo(1 * 1.05, 9);
  });

  it('Buracos negros reforçam o ganho do proibido e cortam o preço', () => {
    const lone = effectiveStats(withBuild({ ...newSave('a'), collapses: 5 }, { 'sagittarius-a': 1 }));
    const pages = [page('sagittarius-a'), page('cygnus-x1'), page('m87')];
    const boosted = effectiveStats(withBuild(withPages({ ...newSave('a'), collapses: 5 }, pages), { 'sagittarius-a': 1 }));
    expect(boosted.energyPerTouch).toBeGreaterThan(lone.energyPerTouch);
    expect(boosted.dustPerTouch).toBeGreaterThan(lone.dustPerTouch);
  });

  it('efeitos de contagem perdem a fração na página', () => {
    const orion = effectiveStats(withPages(newSave('a'), [page('orion-nebula')]));
    expect(orion.choice.picks).toBe(1);
    const crab = effectiveStats(withPages(newSave('a'), [page('crab-nebula')]));
    expect(crab.choice.repeatLevels).toBe(2);
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

  it('nada de objeto antes da 1ª melhoria', () => {
    const none = tickTo(newSave('o'), 0, 36);
    expect(none.run.objects).toHaveLength(0);
    expect(none.run.nextSpawnAt).toBeNull();
    const first = tickTo(withLevels(newSave('o'), { pulse: 1 }), 0, 36);
    expect(first.run.objects.length).toBeGreaterThan(0);
    // Depois do 1º colapso a vida nova já começa com os objetos abertos.
    expect(objectsOpen({ ...newSave('o'), collapses: 1 })).toBe(true);
    expect(objectsOpen(newSave('o'))).toBe(false);
  });

  it('o primeiro aparece depois de 32 s e dura 7 s', () => {
    let s = tickTo(withLevels(newSave('o'), { pulse: 1 }), 0, 31);
    expect(s.run.objects).toHaveLength(0);
    s = tickTo(s, 31, 34);
    expect(s.run.objects).toHaveLength(1);
    const o = s.run.objects[0]!;
    expect(o.expiresAt - o.bornAt).toBeCloseTo(7, 9);
    s = tickTo(s, 34, 41.5);
    expect(s.run.objects).toHaveLength(0);
  });

  it('só os objetos do colapso atual entram no sorteio', () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 200; i++) {
      let s = withLevels(newSave(`k${i}`), { pulse: 1 });
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

  it('respeita o máximo no campo (1 no começo, 2 com a Kepler)', () => {
    const one = [{ id: 1, kind: 'comet' as const, bornAt: 0, expiresAt: 100 }];
    const start = withLevels(withRun(newSave('mx'), { objects: one, nextSpawnAt: 0, nextObjectId: 2 }), { pulse: 1 });
    expect(tickObjects(start, 1).run.objects).toHaveLength(1);
    const kepler = tickObjects(withLevels(start, { kepler: 1 }), 1);
    expect(kepler.run.objects).toHaveLength(2);
  });

  it('não nasce objeto com a escolha aberta nem com Cygnus X-1', () => {
    const paused = withRun(newSave('pc'), {
      nextSpawnAt: 0,
      pending: { offers: ['moon', 'vesta', 'mars'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 },
    });
    expect(tickObjects(paused, 1).run.objects).toHaveLength(0);
    const cyg = withBuild(withRun({ ...newSave('cy'), collapses: 3 }, { nextSpawnAt: 0 }), { 'cygnus-x1': 1 });
    expect(tickObjects(cyg, 1).run.objects).toHaveLength(0);
  });

  it('o cometa dá 6 toques de poeira, e Marte/Vênus/Antares somam toques', () => {
    const base = withLevels(newSave('cm'), { pulse: 4 });
    expect(objectReward(base, 'comet').dust).toBe(5 * 6);
    const boosted = withBuild(base, { venus: 1 });
    expect(objectReward(boosted, 'comet').dust).toBe(5 * 9);
    let s = withRun(base, { objects: [{ id: 7, kind: 'comet', bornAt: 0, expiresAt: 10 }] });
    s = captureObject(s, 7, 1);
    expect(s.run.dust).toBe(30);
    expect(s.run.objects).toHaveLength(0);
    expect(s.stats.objectsCaptured).toBe(1);
  });

  it('no começo os objetos são fracos: um cometa vale bem menos que a 1ª melhoria já paga', () => {
    // Com 1 de poeira por toque o cometa dá 6, menos que o preço da 1ª melhoria (25).
    expect(objectReward(newSave('cm'), 'comet').dust).toBeLessThan(25);
    expect(objectReward(newSave('cm'), 'shooting-star').energy).toBeLessThan(energyCap(0) / 10);
  });

  it('a estrela cadente dá energia de 2 toques e pode encher a barra', () => {
    const s0 = withRun(newSave('st'), { objects: [{ id: 1, kind: 'shooting-star', bornAt: 0, expiresAt: 10 }] });
    expect(captureObject(s0, 1, 1).run.energy).toBeCloseTo(2 * 1, 9);
    const nearlyFull = withRun(s0, { energy: 37 });
    const full = captureObject(nearlyFull, 1, 1);
    expect(full.run.pending).not.toBeNull();
  });

  it('o satélite liga o Sinal forte x2 por 8 s e para depois', () => {
    let s = withLevels(newSave('sat'), { pulse: 9 });
    s = withRun(s, { objects: [{ id: 1, kind: 'satellite', bornAt: 0, expiresAt: 10 }] });
    s = captureObject(s, 1, 1);
    expect(s.run.boostUntil).toBe(9);
    s = press(s, 2);
    expect(s.run.lastGain).toBe(20);
    s = press(s, 6);
    expect(s.run.lastGain).toBe(20);
    s = press(s, 9.5);
    expect(s.run.lastGain).toBe(10);
  });

  it('Polaris e Tritão agem depois da captura', () => {
    let s = withBuild(newSave('pt'), { polaris: 1, triton: 1 });
    s = withRun(s, { objects: [{ id: 1, kind: 'comet', bornAt: 0, expiresAt: 10 }] });
    s = captureObject(s, 1, 1);
    expect(s.run.energy).toBeCloseTo(3 * 1, 9);
    expect(s.run.afterCapture).toBe(true);
    s = press(s, 2);
    expect(s.run.lastGain).toBe(5);
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
    expect(collapse(s, 'moon')).toBe(s);
  });

  it('exige um grimório da vida como página', () => {
    const s = readyToCollapse(withBuild(newSave('co'), { moon: 1 }));
    expect(collapse(s, 'vega')).toBe(s);
  });

  it('mostra o progresso até a estrela ficar pronta', () => {
    const p = collapseProgress(withRun(newSave('co'), { dustLife: 1000, picks: 4 }));
    expect(p.dustGoal).toBe(dustGoal(1));
    expect(p.minPicks).toBe(20);
    expect(p.ready).toBe(false);
  });

  it('guarda a página, dá Fragmentos e recomeça do zero', () => {
    let s = withBuild(withLevels(newSave('co'), { pulse: 7 }), { vesta: 3, moon: 1 });
    s = withRun(s, { ...s.run, dust: 12345, energy: 10, clicks: 999 });
    s = { ...s, album: ['vesta', 'moon'], achievements: ['first'], stats: { ...s.stats, clicks: 999 } };
    s = readyToCollapse(s);
    const after = collapse(s, 'vesta');
    expect(after.collapses).toBe(1);
    expect(after.atlas.pages).toEqual([{ grimoireId: 'vesta', level: 3 }]);
    expect(after.fragments.earned).toBeGreaterThanOrEqual(4);
    expect(after.run.dust).toBe(0);
    expect(after.run.dustLife).toBe(0);
    expect(after.run.picks).toBe(0);
    expect(after.run.energy).toBe(0);
    expect(after.run.build).toEqual({});
    expect(after.run.upgradeLevels.every((l) => l === 0)).toBe(true);
    expect(after.album).toEqual(['vesta', 'moon']);
    expect(after.achievements).toContain('first');
    expect(after.stats.clicks).toBe(999);
    expect(effectiveStats(withLevels(after, { resonance: 1 })).combo.fullDustAdd).toBeCloseTo(0.5 * 2 * 0.6, 9);
    assertSane(after);
  });

  it('o 1º colapso abre a região nova e o conteúdo da vida seguinte', () => {
    const s = readyToCollapse(withBuild(newSave('co'), { moon: 1 }));
    const after = collapse(s, 'moon');
    expect(regionFor(after).id).toBe('asteroid-belt');
    expect(after.regionId).toBe('asteroid-belt');
    const content = unlockedContent(after);
    expect(content.grimoires.map((g) => g.id)).toEqual(expect.arrayContaining(['pallas', 'hygiea']));
    expect(content.grimoires.map((g) => g.id)).not.toContain('callisto');
    expect(content.upgrades.map((u) => u.id)).toContain('webb');
    expect(content.objects.map((o) => o.kind)).toContain('asteroid');
  });

  it('cada colapso destrava exatamente as linhas da tabela 5.4', () => {
    const expected: Record<number, string[]> = {
      1: ['pallas', 'hygiea'],
      2: ['callisto', 'enceladus'],
      3: ['eris', 'haumea', 'cygnus-x1'],
      4: ['sedna', 'hale-bopp'],
      5: ['proxima-centauri', 'alpha-centauri-a', 'm87'],
    };
    for (let c = 1; c <= 5; c++) {
      const before = new Set(unlockedContent({ ...newSave('u'), collapses: c - 1 }).grimoires.map((g) => g.id));
      const now = unlockedContent({ ...newSave('u'), collapses: c }).grimoires.map((g) => g.id);
      expect(now.filter((id) => !before.has(id)).sort()).toEqual([...(expected[c] as string[])].sort());
    }
    expect(unlockedContent({ ...newSave('u'), collapses: 0 }).grimoires).toHaveLength(28);
    expect(unlockedContent({ ...newSave('u'), collapses: 5 }).grimoires).toHaveLength(GRIMOIRES.length);
    expect(GRIMOIRES).toHaveLength(40);
    expect(unlockedContent({ ...newSave('u'), collapses: 5 }).regions).toHaveLength(6);
  });

  it('Titã começa a vida nova com poeira extra', () => {
    const s = readyToCollapse(withBuild(newSave('ti'), { titan: 1 }));
    const after = collapse(s, 'titan');
    // A página do Atlas guarda 60% dos 200 de poeira.
    expect(after.run.dust).toBe(120);
    expect(after.run.dustLife).toBe(120);
  });

  it('a 2ª página é adicionada e repetir a mesma só atualiza o nível', () => {
    let s = readyToCollapse(withBuild(newSave('co'), { vega: 2 }));
    s = collapse(s, 'vega');
    s = readyToCollapse(withBuild(s, { vega: 4, moon: 1 }));
    const same = collapse(s, 'vega');
    expect(same.atlas.pages).toEqual([{ grimoireId: 'vega', level: 4 }]);
  });

  it('com o Atlas cheio, troca a página escolhida; sem dizer qual, não colapsa', () => {
    let s: SaveState = {
      ...newSave('co'),
      collapses: 2,
      atlas: {
        slots: 3,
        pages: [
          { grimoireId: 'moon', level: 1 },
          { grimoireId: 'mars', level: 1 },
          { grimoireId: 'vega', level: 1 },
        ],
      },
    };
    s = readyToCollapse(withBuild(s, { sirius: 2 }));
    expect(collapse(s, 'sirius')).toBe(s);
    expect(collapse(s, 'sirius', 7)).toBe(s);
    const swapped = collapse(s, 'sirius', 1);
    expect(swapped.atlas.pages.map((p) => p.grimoireId)).toEqual(['moon', 'sirius', 'vega']);
    expect(swapped.collapses).toBe(3);
  });

  it('os espaços sobem nos colapsos 5, 10, 25 e 50', () => {
    for (const [c, slots] of [[4, 3], [5, 4], [9, 4], [10, 5], [24, 5], [25, 6], [49, 6], [50, 7]] as const) {
      const s = readyToCollapse(withBuild({ ...newSave('sl'), collapses: c - 1 }, { moon: 1 }));
      const after = collapse(s, 'moon');
      expect(after.collapses).toBe(c);
      expect(after.atlas.slots).toBe(slots);
    }
  });

  it('os Fragmentos crescem com o colapso e com a poeira acima de 2 mi', () => {
    const s1 = collapse(readyToCollapse(withBuild(newSave('fr'), { moon: 1 })), 'moon');
    const s2 = collapse(withRun(readyToCollapse(withBuild(s1, { moon: 1 })), { dustLife: 1e15 }), 'moon');
    expect(s2.fragments.earned - s1.fragments.earned).toBe(3 + 2 + Math.floor(Math.log10(1e15 / 2e6)));
  });

  it('não colapsa com a escolha de grimório aberta', () => {
    const s = withRun(readyToCollapse(withBuild(newSave('co'), { moon: 1 })), {
      pending: { offers: ['moon', 'vesta', 'mars'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 },
    });
    expect(canCollapse(s)).toBe(false);
  });
});

describe('Árvore de Habilidades', () => {
  const withFragments = (n: number): SaveState => ({ ...newSave('tr'), collapses: 1, fragments: { earned: n, spent: 0 } });

  it('só abre depois do 1º colapso', () => {
    const s = { ...newSave('tr'), fragments: { earned: 9, spent: 0 } };
    expect(buyTreeNode(s, 'alpha-centauri:1')).toBe(s);
  });

  it('custa 1, 2 e 4 Fragmentos e exige o nível anterior', () => {
    let s = withFragments(7);
    expect(buyTreeNode(s, 'alpha-centauri:2')).toBe(s);
    s = buyTreeNode(s, 'alpha-centauri:1');
    expect(s.tree['alpha-centauri']).toBe(1);
    expect(fragmentsAvailable(s)).toBe(6);
    s = buyTreeNode(s, 'alpha-centauri:2');
    s = buyTreeNode(s, 'alpha-centauri:3');
    expect(s.tree['alpha-centauri']).toBe(3);
    expect(fragmentsAvailable(s)).toBe(0);
    expect(buyTreeNode(s, 'alpha-centauri:3')).toBe(s);
  });

  it('não compra sem saldo nem nó que não existe', () => {
    const s = withFragments(0);
    expect(buyTreeNode(s, 'alpha-centauri:1')).toBe(s);
    expect(buyTreeNode(withFragments(9), 'nada:1')).toEqual(withFragments(9));
  });

  it('cada ramo altera os números finais', () => {
    const level = (branch: string, n: number): SaveState => ({ ...newSave('tr'), collapses: 1, tree: { [branch]: n } });
    expect(effectiveStats(level('alpha-centauri', 3)).dustPerTouch).toBeCloseTo(1.35, 9);
    expect(effectiveStats(level('crab-nebula', 2)).energyPerTouch).toBeCloseTo(1.2, 9);
    expect(effectiveStats(level('kuiper-belt', 3)).objects.maxOnField).toBe(4);
    expect(effectiveStats(level('saturn-rings', 1)).combo.windowSec).toBeCloseTo(1.3 * 1.15, 9);
    expect(effectiveStats(level('pleiades', 3)).pulseLevel).toBe(4);
    expect(effectiveStats(level('pleiades', 3)).dustPerTouch).toBe(5);
    expect(effectiveStats(level('event-horizon', 3)).forbiddenUnlockPicks).toBe(10);
  });

  it('o Horizonte de Eventos libera os proibidos mais cedo', () => {
    const forbiddenSeen = (picks: number, tree: Record<string, number>): boolean => {
      for (let i = 0; i < 500; i++) {
        const s = { ...withRun(newSave(`eh${i}`), { picks }), tree };
        if (drawGrimoires(s).offers.some((id) => grimoireById(id)?.rarity === 'forbidden')) return true;
      }
      return false;
    };
    expect(forbiddenSeen(10, {})).toBe(false);
    expect(forbiddenSeen(10, { 'event-horizon': 3 })).toBe(true);
  });

  it('refazer devolve tudo menos 20% (arredondado para cima) e limpa a árvore', () => {
    let s = withFragments(20);
    s = buyTreeNode(buyTreeNode(buyTreeNode(s, 'alpha-centauri:1'), 'alpha-centauri:2'), 'crab-nebula:1');
    expect(s.fragments.spent).toBe(4);
    const reset = respecTree(s);
    expect(reset.tree).toEqual({});
    expect(reset.fragments.spent).toBe(1);
    expect(fragmentsAvailable(reset)).toBe(19);
  });

  it('refazer sem gasto, ou duas vezes seguidas, não cobra taxa extra', () => {
    const s = withFragments(5);
    expect(respecTree(s)).toBe(s);
    const bought = buyTreeNode(s, 'alpha-centauri:1');
    const once = respecTree(bought);
    expect(respecTree(once)).toBe(once);
  });

  it('todos os 18 nós existem no catálogo', () => {
    expect(TREE).toHaveLength(6);
    for (const b of TREE) expect(b.levels).toHaveLength(3);
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
          if (id) s = collapse(s, id, 0);
        }
        if (i % 500 === 0) assertSane(s);
      }
      assertSane(s);
    }
  });

  it('com valores perto do teto continua finito', () => {
    let s = withRun(newSave('big'), { dust: 1e299, dustLife: 1e299 });
    s = withLevels(s, { pulse: 30, reactor: 20, resonance: 10, pleiades: 5 });
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
    expect(GRIMOIRES.filter((g) => g.rarity === 'common' && g.unlockedAtCollapse === 0)).toHaveLength(10);
    expect(GRIMOIRES.filter((g) => g.rarity === 'forbidden')).toHaveLength(3);
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

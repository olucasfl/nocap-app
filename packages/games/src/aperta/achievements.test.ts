import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, achievementViews, awardAchievements, newlyEarned } from './achievements';
import { TREE, upgradeIndex } from './catalog';
import {
  buyTreeNode,
  captureObject,
  chooseGrimoire,
  collapse,
  newSave,
  press,
  respecTree,
  type GameObject,
  type SaveState,
} from './engine';
import { dustGoal, minPicks } from './economy';
import { meetMilestone } from './milestone';
import { mergeSaves, validateSave } from './save';

const has = (s: SaveState, id: string) => s.achievements.includes(id);

function withRun(s: SaveState, patch: Partial<SaveState['run']>): SaveState {
  return { ...s, run: { ...s.run, ...patch } };
}

function withObjects(s: SaveState, kinds: GameObject['kind'][]): SaveState {
  return withRun(s, {
    objects: kinds.map((kind, i) => ({ id: i + 1, kind, bornAt: 0, expiresAt: 1000 })),
    nextObjectId: kinds.length + 1,
  });
}

function withResonance(s: SaveState): SaveState {
  const upgradeLevels = s.run.upgradeLevels.slice();
  upgradeLevels[upgradeIndex('rhythm')] = 1;
  return withRun(s, { upgradeLevels });
}

describe('catálogo de conquistas', () => {
  it('ids únicos, metas positivas e só a escondida é escondida', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.goal).toBeGreaterThan(0);
      expect(a.name.length).toBeGreaterThan(0);
    }
    expect(ACHIEVEMENTS.filter((a) => a.hidden).map((a) => a.id)).toEqual(['respec']);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(24);
  });

  it('um save novo não tem nenhuma conquista pronta', () => {
    expect(newlyEarned(newSave('a'))).toEqual([]);
    const s = newSave('a');
    expect(awardAchievements(s)).toBe(s);
  });
});

describe('toques e poeira', () => {
  it('o primeiro toque ganha "Primeiro toque" uma vez só', () => {
    const s = press(newSave('a'), 1);
    expect(has(s, 'tap-1')).toBe(true);
    const again = press(s, 2);
    expect(again.achievements.filter((id) => id === 'tap-1')).toHaveLength(1);
    expect(awardAchievements(again)).toBe(again);
  });

  it('metas de toques e de poeira usam os totais do save', () => {
    const base = newSave('a');
    const s = awardAchievements({ ...base, stats: { ...base.stats, clicks: 1000, dustTotal: 2e6 } });
    for (const id of ['tap-1', 'tap-100', 'tap-1k', 'dust-1k', 'dust-1m']) expect(has(s, id)).toBe(true);
    for (const id of ['tap-10k', 'dust-1b']) expect(has(s, id)).toBe(false);
  });
});

describe('grimórios', () => {
  it('subir um grimório ao nível 5 conta, e o recorde fica no save', () => {
    let s = withRun(newSave('a'), { build: { moon: 4 }, picks: 5 });
    s = withRun(s, { pending: { offers: ['moon'], openedAt: 0, selected: 'moon', picksLeft: 1, rerollsLeft: 0 } });
    s = chooseGrimoire({ ...s, clock: 10 }, 'moon', 10);
    expect(s.stats.bestLevel).toBe(5);
    expect(has(s, 'grim-lv5')).toBe(true);
    expect(has(s, 'grim-lv10')).toBe(false);
  });

  it('álbum: proibido conta e o progresso mostra quantos faltam', () => {
    const s = awardAchievements({ ...newSave('a'), album: ['moon', 'mars', 'cygnus-x1'] });
    expect(has(s, 'forbidden')).toBe(true);
    expect(has(s, 'grim-10')).toBe(false);
    expect(achievementViews(s).find((v) => v.def.id === 'grim-10')?.value).toBe(3);
  });
});

describe('objetos', () => {
  it('10 satélites em sequência; outro objeto zera a sequência, o recorde fica', () => {
    const kinds = Array<GameObject['kind']>(9).fill('satellite').concat('comet', 'satellite');
    let s = withObjects(newSave('a'), kinds);
    for (let id = 1; id <= 9; id++) s = captureObject(s, id, 1);
    expect(s.stats.satelliteStreak).toBe(9);
    s = captureObject(s, 10, 1);
    expect(s.stats.satelliteStreak).toBe(0);
    expect(s.stats.satelliteBest).toBe(9);
    s = captureObject(s, 11, 1);
    expect(has(s, 'obj-sats')).toBe(false);
    expect(s.stats.objectsCaptured).toBe(11);

    let t = withObjects(newSave('b'), Array<GameObject['kind']>(10).fill('satellite'));
    for (let id = 1; id <= 10; id++) t = captureObject(t, id, 1);
    expect(has(t, 'obj-sats')).toBe(true);
  });

  it('capturas somam em "Caçador de cometas"', () => {
    const base = newSave('a');
    const s = awardAchievements({ ...base, stats: { ...base.stats, objectsCaptured: 20 } });
    expect(has(s, 'obj-20')).toBe(true);
    expect(has(s, 'obj-100')).toBe(false);
  });
});

describe('combo', () => {
  it('chegar ao máximo e mantê-lo por 30 s', () => {
    let s = withResonance(newSave('a'));
    let t = 1;
    while (!has(s, 'combo-max') && t < 60) s = press(withRun(s, { energy: 0 }), (t += 0.4));
    expect(has(s, 'combo-max')).toBe(true);
    expect(has(s, 'combo-30')).toBe(false);
    for (let i = 0; i < 120 && !has(s, 'combo-30'); i++) s = press(withRun(s, { energy: 0 }), (t += 0.4));
    expect(has(s, 'combo-30')).toBe(true);
    expect(s.stats.comboFullBest).toBeGreaterThanOrEqual(30);
  });

  it('um toque tardio derruba o combo e a contagem recomeça', () => {
    let s = withResonance(newSave('a'));
    let t = 1;
    for (let i = 0; i < 30; i++) s = press(withRun(s, { energy: 0 }), (t += 0.4));
    expect(s.run.comboFullSince).toBeGreaterThan(0);
    s = press(withRun(s, { energy: 0 }), t + 2);
    expect(s.run.combo).toBe(0);
    expect(s.run.comboFullSince).toBeLessThan(0);
  });
});

describe('colapsos e árvore', () => {
  it('o primeiro colapso ganha a conquista e ela sobrevive à vida nova', () => {
    let s = withRun(newSave('a'), { dustLife: dustGoal(1), picks: minPicks(1), build: { moon: 1 }, ...meetMilestone(0, []) });
    s = { ...s, album: ['moon'], stats: { ...s.stats, picks: minPicks(1), dustTotal: dustGoal(1) }, tutorial: 'done' };
    const next = collapse(s, 'moon');
    expect(next.collapses).toBe(1);
    expect(has(next, 'collapse-1')).toBe(true);
    expect(has(next, 'collapse-5')).toBe(false);
  });

  it('"Saí do Sistema Solar" só no colapso que abre Alfa Centauro e "Atlas com 4 páginas" com 4 páginas', () => {
    const solar = (collapses: number) => awardAchievements({ ...newSave('a'), collapses });
    expect(has(solar(4), 'leave-solar')).toBe(false);
    expect(has(solar(5), 'leave-solar')).toBe(true);

    const page = (grimoireId: string) => ({ grimoireId, level: 1 });
    const withPages = (n: number) => {
      const s = newSave('a');
      const pages = ['moon', 'mars', 'venus', 'mercury'].slice(0, n).map(page);
      return awardAchievements({ ...s, atlas: { ...s.atlas, pages } as SaveState['atlas'] });
    };
    expect(has(withPages(3), 'atlas-4')).toBe(false);
    expect(has(withPages(4), 'atlas-4')).toBe(true);
  });

  it('comprar o 1º nó, completar um ramo e refazer (escondida)', () => {
    let s: SaveState = { ...newSave('a'), collapses: 1, fragments: { earned: 20, spent: 0 } };
    const branch = (TREE[0] as { id: string }).id;
    expect(has(s, 'tree-1')).toBe(false);
    s = buyTreeNode(s, `${branch}:1`);
    expect(has(s, 'tree-1')).toBe(true);
    expect(has(s, 'tree-branch')).toBe(false);
    s = buyTreeNode(buyTreeNode(s, `${branch}:2`), `${branch}:3`);
    expect(has(s, 'tree-branch')).toBe(true);
    expect(has(s, 'respec')).toBe(false);

    s = respecTree(s);
    expect(s.tree).toEqual({});
    expect(s.stats.respecs).toBe(1);
    expect(has(s, 'respec')).toBe(true);
    // Ganha-se uma vez: refazer a árvore não tira nada.
    expect(has(s, 'tree-1')).toBe(true);
    expect(has(s, 'tree-branch')).toBe(true);
  });
});

describe('visão para a tela', () => {
  it('conquista ganha mostra a meta cheia; a que falta limita à meta', () => {
    const base = newSave('a');
    const s = { ...base, achievements: ['tap-100'], stats: { ...base.stats, clicks: 5 } };
    const v = (st: SaveState, id: string) => achievementViews(st).find((x) => x.def.id === id);
    expect(v(s, 'tap-100')).toMatchObject({ earned: true, value: 100 });
    expect(v(s, 'tap-1k')).toMatchObject({ earned: false, value: 5 });
    const big = { ...s, stats: { ...s.stats, clicks: 5000 } };
    expect(v(big, 'tap-1k')?.value).toBe(1000);
  });
});

describe('save com conquistas', () => {
  const roundtrip = (s: SaveState) => JSON.parse(JSON.stringify(s)) as Record<string, Record<string, unknown>>;

  it('ida e volta guarda conquistas e contadores novos', () => {
    let s = press(newSave('a', 1000), 1);
    s = { ...s, stats: { ...s.stats, bestLevel: 3, satelliteBest: 4, respecs: 2, comboFullBest: 12.5, comboMaxHits: 7 } };
    const res = validateSave(roundtrip(s));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.save.achievements).toEqual(['tap-1']);
      expect(res.save.stats).toMatchObject({ bestLevel: 3, satelliteBest: 4, respecs: 2, comboFullBest: 12.5, comboMaxHits: 7 });
    }
  });

  it('save antigo, sem os campos novos, continua válido e entra zerado', () => {
    const raw = roundtrip(newSave('a', 1000));
    for (const k of ['bestLevel', 'comboMaxHits', 'comboFullBest', 'satelliteStreak', 'satelliteBest', 'respecs']) delete raw.stats![k];
    delete raw.run!.comboFullSince;
    const res = validateSave(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.save.stats).toMatchObject({ bestLevel: 0, comboMaxHits: 0, comboFullBest: 0, satelliteStreak: 0, satelliteBest: 0, respecs: 0 });
      expect(res.save.run.comboFullSince).toBeLessThan(0);
    }
  });

  it('contador fora do limite é recusado', () => {
    const raw = roundtrip(newSave('a', 1000));
    raw.stats!.bestLevel = 99;
    expect(validateSave(raw).ok).toBe(false);
    raw.stats!.bestLevel = 3;
    raw.stats!.respecs = -1;
    expect(validateSave(raw).ok).toBe(false);
  });

  it('juntar saves une conquistas e fica com o maior de cada contador', () => {
    const base = newSave('a', 1000);
    const a = { ...base, achievements: ['tap-1'], stats: { ...base.stats, bestLevel: 5, respecs: 1 } };
    const b = { ...base, achievements: ['tap-1', 'obj-20'], stats: { ...base.stats, bestLevel: 2, satelliteBest: 6 } };
    const { save } = mergeSaves(a, b);
    expect(new Set(save.achievements)).toEqual(new Set(['tap-1', 'obj-20']));
    expect(save.stats).toMatchObject({ bestLevel: 5, respecs: 1, satelliteBest: 6 });
  });
});

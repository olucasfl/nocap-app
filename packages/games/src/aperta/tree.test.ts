import { describe, expect, it } from 'vitest';
import { GRIMOIRES, effectDomain } from './catalog';
import { FORBIDDEN } from './forbidden';
import { SAVE_VERSION, buyNode, canRespec, effectiveStats, newSave, nodeNextCost, respecTree, type SaveState } from './engine';
import { sparksAvailable } from './sparks';
import { validateSave } from './save';
import {
  POWER_KINDS,
  TREE_BRANCHES,
  TREE_FEATURES,
  TREE_NODES,
  TREE_TIER_COST,
  TREE_TOTAL_COST,
  UPGRADE_DOMAINS,
  isPowerNode,
  nodeLive,
  nodeParam,
  nodeTotalCost,
  treeErrors,
  treeNodeById,
  treeSpent,
  treeStats,
  type TreeNodeDef,
  RETIRED_NODE_IDS,
} from './tree';

const open = (sparks = 40, over: Partial<SaveState> = {}): SaveState => ({
  ...newSave('arvore'),
  tutorial: 'done',
  collapses: 1,
  regionId: 'asteroid-belt',
  sparks: { legacy: sparks, spent: 0 },
  ...over,
});

/** Um save de 3 colapsos que passa no `validateSave` (15 Cintilas migradas é o que 3 colapsos de Fragmentos davam). */
const valid = (over: Partial<SaveState> = {}): SaveState => {
  const s = newSave('arvore');
  return {
    ...s,
    tutorial: 'done',
    collapses: 3,
    regionId: 'kuiper-belt',
    sparks: { legacy: 15, spent: 0 },
    stats: { ...s.stats, picks: 80, dustTotal: 2e9 },
    ...over,
  };
};

describe('o grafo', () => {
  it('116 nós (4 do Observatório aposentados), ids únicos, 24 por ramo menos os aposentados, níveis 1 a 2 e tiers 1 a 5', () => {
    expect(TREE_NODES).toHaveLength(116);
    expect(new Set(TREE_NODES.map((n) => n.id)).size).toBe(116);
    for (const id of RETIRED_NODE_IDS) expect(treeNodeById(id)).toBeUndefined();
    for (const b of TREE_BRANCHES) expect(TREE_NODES.filter((n) => n.branch === b.id)).toHaveLength(b.id === 'cosmos' ? 20 : 24);
    for (const n of TREE_NODES) {
      expect(n.maxLevel, n.id).toBeGreaterThanOrEqual(1);
      expect(n.maxLevel, n.id).toBeLessThanOrEqual(5);
      expect(n.name.length, n.id).toBeGreaterThan(0);
      expect(n.text.length, n.id).toBeGreaterThan(0);
    }
  });

  it('todo pai existe, é de tier menor e tem no máximo 3 pais; os tiers 1 saem da raiz', () => {
    for (const n of TREE_NODES) {
      expect(n.parents.length, n.id).toBeLessThanOrEqual(3);
      if (n.tier === 1) expect(n.parents, n.id).toEqual([]);
      else expect(n.parents.length, n.id).toBeGreaterThanOrEqual(1);
      for (const p of n.parents) {
        const parent = treeNodeById(p);
        expect(parent, `${n.id} <- ${p}`).toBeDefined();
        expect(parent!.tier, `${n.id} <- ${p}`).toBeLessThan(n.tier);
      }
    }
  });

  it('as ligações cruzadas entre ramos são raras (até 8) e todo nó é alcançável da raiz', () => {
    const cross = TREE_NODES.filter((n) => n.parents.some((p) => treeNodeById(p)!.branch !== n.branch));
    expect(cross.length).toBeGreaterThanOrEqual(3);
    expect(cross.length).toBeLessThanOrEqual(8);
    const reach = new Set<string>();
    for (let changed = true; changed; ) {
      changed = false;
      for (const n of TREE_NODES) if (!reach.has(n.id) && n.parents.every((p) => reach.has(p))) {
          reach.add(n.id);
          changed = true;
        }
    }
    expect(reach.size).toBe(116);
  });

  it('o custo por nível vem do tier (1, 2, 3, 5, 8) e T é a soma', () => {
    const cost = (n: TreeNodeDef) => TREE_TIER_COST[n.tier - 1]! * n.maxLevel;
    for (const n of TREE_NODES) expect(nodeTotalCost(n)).toBe(cost(n));
    expect(TREE_TOTAL_COST).toBe(TREE_NODES.reduce((a, n) => a + cost(n), 0));
  });

  it('nó cuja mecânica ainda não existe fica fechado, e o filho dele também', () => {
    expect(TREE_FEATURES).toEqual({ automation: true, skills: true, luck: true, exploration: true, observatory: false });
    expect(nodeLive(treeNodeById('au-01')!)).toBe(true);
    expect([...RETIRED_NODE_IDS].map((id) => treeNodeById(id))).toEqual([undefined, undefined, undefined, undefined]);
    expect(TREE_NODES.every((n) => nodeLive(n))).toBe(true);
    expect(nodeLive(treeNodeById('co-01')!)).toBe(true);
    expect(nodeLive(treeNodeById('au-24')!)).toBe(true);
  });
});

describe('comprar um nó', () => {
  it('só depois do 1º colapso, com Cintilas, pelo custo do tier', () => {
    const closed = { ...open(), collapses: 0 };
    expect(buyNode(closed, 'co-01')).toBe(closed);
    let s = open(10);
    s = buyNode(s, 'co-01');
    expect(s.tree['co-01']).toBe(1);
    expect(s.sparks.spent).toBe(1);
    s = buyNode(s, 'co-01');
    expect(s.tree['co-01']).toBe(2);
    expect(s.sparks.spent).toBe(2);
    // Nível máximo.
    expect(buyNode(s, 'co-01')).toBe(s);
    const poor = open(0);
    expect(buyNode(poor, 'co-01')).toBe(poor);
  });

  it('exige os pais: o filho só abre depois do pai, e dois pais exigem os dois', () => {
    let s = open(60);
    expect(buyNode(s, 'co-05')).toBe(s);
    s = buyNode(s, 'co-02');
    expect(nodeNextCost(s, 'co-05')).toBe(2);
    // co-09 pede co-02 e co-03.
    expect(buyNode(s, 'co-09')).toBe(s);
    s = buyNode(s, 'co-03');
    expect(nodeNextCost(s, 'co-09')).toBe(2);
    s = buyNode(s, 'co-09');
    expect(s.tree['co-09']).toBe(1);
  });

  it('não compra nó que não existe nem nó fechado por mecânica futura', () => {
    const s = open(60);
    expect(buyNode(s, 'nada')).toBe(s);
    expect(buyNode(s, 'co-06')).toBe(s);
    expect(nodeNextCost(s, 'co-06')).toBeNull();
  });
});

describe('refazer a árvore', () => {
  it('devolve 100% das Cintilas, sem custo, na tela de colapso ou com a vida zerada', () => {
    let s = open(30);
    s = buyNode(buyNode(buyNode(s, 'co-02'), 'co-05'), 'co-11');
    const spent = s.sparks.spent;
    expect(spent).toBe(1 + 2 + 3);
    const before = sparksAvailable(s);
    // Vida zerada: pode.
    expect(canRespec(s)).toBe(true);
    const back = respecTree(s);
    expect(back.tree).toEqual({});
    expect(back.sparks.spent).toBe(0);
    // O saldo volta inteiro (e a conquista escondida de refazer pode somar uma recompensa).
    expect(sparksAvailable(back)).toBeGreaterThanOrEqual(before + spent);
    expect(respecTree(back)).toBe(back);
  });

  it('não refaz no meio de uma vida em andamento', () => {
    let s = open(30);
    s = buyNode(s, 'co-02');
    const playing = { ...s, run: { ...s.run, clicks: 12, picks: 2, dust: 400, dustLife: 400 } };
    expect(canRespec(playing)).toBe(false);
    expect(respecTree(playing)).toBe(playing);
  });
});

describe('valida o save', () => {
  const ok = (s: SaveState) => {
    const r = validateSave(JSON.parse(JSON.stringify(s)));
    return r.ok ? [] : r.errors;
  };

  it('aceita uma árvore comprada de verdade e recusa nó, nível, pai e gasto impossíveis', () => {
    let s = valid();
    s = buyNode(buyNode(buyNode(s, 'co-02'), 'co-05'), 'co-11');
    expect(ok(s)).toEqual([]);
    expect(ok({ ...s, tree: { ...s.tree, 'nada-x': 1 } })).toContain('Nó desconhecido: nada-x');
    expect(ok({ ...s, tree: { ...s.tree, 'co-11': 3 } })).toContain('Nó acima do nível máximo: co-11');
    expect(ok({ ...s, tree: { 'co-11': 1 }, sparks: { legacy: 15, spent: 3 } })).toContain('Nó sem os pré-requisitos: co-11');
    expect(ok({ ...s, tree: { 'co-06': 1 }, sparks: { legacy: 15, spent: 1 } })).toContain('Nó desconhecido: co-06');
    expect(ok({ ...s, sparks: { legacy: 15, spent: 2 } })).toContain('Árvore custa mais que as Cintilas gastas');
    expect(treeErrors({ 'co-05': 1 })).toEqual(['Nó sem os pré-requisitos: co-05']);
  });
});

describe('migração da árvore antiga', () => {
  it('a árvore de 6 ramos some, o gasto volta como Cintilas livres e a versão sobe', () => {
    const v3 = JSON.parse(JSON.stringify(valid())) as Record<string, unknown>;
    v3.version = 3;
    v3.tree = { 'alpha-centauri': 3, 'crab-nebula': 1 };
    v3.sparks = { legacy: 15, spent: 7 };
    const r = validateSave(v3);
    expect(r.ok, r.ok ? '' : r.errors.join(';')).toBe(true);
    if (r.ok) {
      expect(r.save.version).toBe(SAVE_VERSION);
      expect(r.save.tree).toEqual({});
      expect(r.save.sparks.spent).toBe(0);
      expect(sparksAvailable(r.save)).toBeGreaterThanOrEqual(15);
    }
  });
});

describe('equilíbrio da árvore', () => {
  it('poder direto (poeira ou energia) é no máximo 15% dos nós', () => {
    const power = TREE_NODES.filter(isPowerNode);
    expect(power.length).toBeGreaterThan(0);
    expect(power.length / TREE_NODES.length).toBeLessThanOrEqual(0.15);
    for (const n of power) expect(POWER_KINDS.has(n.effect.kind)).toBe(true);
  });

  it('nenhum nó de mecânica repete o efeito de uma melhoria, de um grimório (comum ou proibido)', () => {
    const grimoire = new Set(GRIMOIRES.flatMap((g) => g.effects.map((e) => effectDomain(e))));
    const forbidden = new Set(FORBIDDEN.flatMap((f) => [...f.effects(5), ...f.seal].map((e) => effectDomain(e))));
    const names = new Set(GRIMOIRES.map((g) => g.name.toLowerCase()));
    for (const n of TREE_NODES) {
      const k = n.effect.kind;
      if (isPowerNode(n)) continue;
      // `forbiddenPower` é o reforço da árvore sobre o Cofre: mexe nos números do proibido, não repete um efeito dele.
      if (k === 'forbiddenPower') continue;
      expect(UPGRADE_DOMAINS.has(k), `${n.id} (${k}) cai no domínio de uma melhoria`).toBe(false);
      expect(grimoire.has(k), `${n.id} (${k}) repete um efeito de grimório`).toBe(false);
      expect(forbidden.has(k), `${n.id} (${k}) repete um efeito de proibido`).toBe(false);
      expect(names.has(n.name.toLowerCase()), `${n.id} tem o nome de um grimório`).toBe(false);
    }
  });
});

describe('os nós que já funcionam entram em effectiveStats', () => {
  it('poder direto, Sintonia, Constelação, Eco, Capa e Largada', () => {
    const base = effectiveStats(open());
    const tree = (t: Record<string, number>, over: Partial<SaveState> = {}) => effectiveStats(open(0, { tree: t, ...over }));
    expect(tree({ 'co-04': 2 }).dustPerTouch).toBeCloseTo(base.dustPerTouch * (1 + nodeParam(treeNodeById('co-04')!, 'pct', 2) / 100), 9);
    expect(tree({ 'co-08': 1 }).energyPerTouch).toBeCloseTo(base.energyPerTouch * (1 + nodeParam(treeNodeById('co-08')!, 'pct', 1) / 100), 9);
    // Sintonia: +0,1 de poeira por nível de proibido no Cofre.
    const vault = { 'cygnus-x1': 3 };
    const noTree = effectiveStats(open(0, { vault })).dustPerTouch;
    expect(tree({ 'co-02': 1 }, { vault }).dustPerTouch).toBeCloseTo(noTree + nodeParam(treeNodeById('co-02')!, 'add', 1) * 3, 9);
    expect(treeStats({ 'co-03': 2 })).toMatchObject({ echoTouches: nodeParam(treeNodeById('co-03')!, 'touches', 2), echoMult: nodeParam(treeNodeById('co-03')!, 'mult', 2) });
    expect(treeStats({ 'co-01': 2 }).coverLevel).toBe(2);
    expect(treeStats({ 'co-10': 2 }).warmStartTouches).toBe(15);
    expect(treeStats({ 'au-01': 1 })).toEqual(treeStats({}));
  });

  it('o custo do que está comprado bate com o gasto', () => {
    expect(treeSpent({ 'co-01': 2, 'co-05': 1, 'co-11': 2 })).toBe(2 + 2 + 6);
  });
});

import { describe, expect, it } from 'vitest';
import { GRIMOIRES, UPGRADES } from './catalog';
import { dustGoal, minPicks } from './economy';
import { meetMilestone } from './milestone';
import {
  buyUpgrade,
  canCollapse,
  chooseGrimoire,
  collapse,
  FRESH_STATS,
  newSave,
  nextUpgradeCost,
  press,
  selectGrimoire,
  type SaveState,
  effectiveStats,
} from './engine';
import { MAX_SAVE_BYTES, mergeSaves, validateSave } from './save';

const NOW = Date.parse('2026-10-21T12:00:00Z');

/** Joga como uma pessoa: toca 10x/s, escolhe a 1ª carta, compra a melhoria mais barata, colapsa quando pode. */
function play(seed: string, seconds: number, from: SaveState = newSave(seed, NOW - seconds * 2000), collapsing = false): SaveState {
  let s = from;
  let t = s.clock;
  const end = t + seconds;
  while (t < end) {
    t += 0.1;
    s = press(s, t);
    const offer = s.run.pending?.offers[0];
    if (offer) {
      t += 1.7;
      s = chooseGrimoire(selectGrimoire(s, offer, t), offer, t);
    }
    let best = -1;
    let cost = Infinity;
    UPGRADES.forEach((_, i) => {
      const c = nextUpgradeCost(s, i);
      if (c !== null && c < cost) [best, cost] = [i, c];
    });
    if (best >= 0 && s.run.dust >= cost) s = buyUpgrade(s, best);
    if (collapsing && canCollapse(s)) {
      s = collapse(s);
    }
  }
  return s;
}

const base = () => play('aperta-teste', 600);
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const rejects = (raw: unknown, opts = {}) => {
  const r = validateSave(raw, opts);
  expect(r.ok).toBe(false);
  return r.ok ? [] : r.errors;
};

describe('validateSave: formato', () => {
  it('aceita um save novo e um save jogado de verdade', () => {
    expect(validateSave(newSave('x', NOW)).ok).toBe(true);
    const r = validateSave(base(), { nowMs: NOW, createdAtMs: NOW - 1_200_000 });
    expect(r.ok && r.flagged).toEqual([]);
    expect(r.ok && r.save.run.picks).toBeGreaterThan(0);
  });

  it('um save depois de colapso também passa (Atlas, Cintilas)', () => {
    const fresh = newSave('k');
    const ready: SaveState = {
      ...fresh,
      tutorial: 'done',
      run: { ...fresh.run, picks: 20, dust: dustGoal(1), dustLife: dustGoal(1), build: { moon: 1 }, ...meetMilestone(0, fresh.run.upgradeLevels) },
      album: ['moon'],
      stats: { ...fresh.stats, picks: 20, dustTotal: dustGoal(1) },
    };
    const s = collapse(ready);
    expect(s.collapses).toBe(1);
    expect(Object.values(s.vault)).toEqual([1]);
    const r = validateSave(s);
    expect(r.ok, r.ok ? '' : r.errors.join(';')).toBe(true);
  });

  it('uma cadeia de 12 colapsos com o Cofre crescendo passa em cada passo', () => {
    const pages = ['moon', 'mars', 'venus', 'mercury', 'ceres', 'vesta', 'phobos', 'io', 'europa', 'titan'];
    let s: SaveState = { ...newSave('chain'), tutorial: 'done' };
    for (let k = 1; k <= 12; k++) {
      const goal = dustGoal(k);
      const id = pages[(k - 1) % pages.length] as string;
      s = {
        ...s,
        run: { ...s.run, picks: minPicks(k), dust: goal, dustLife: goal, build: { [id]: 1 }, ...meetMilestone(k - 1, s.run.upgradeLevels, effectiveStats(s).objects.disabled) },
        album: [...new Set([...s.album, id])],
        stats: { ...s.stats, picks: s.stats.picks + minPicks(k), dustTotal: s.stats.dustTotal + goal },
      };
      s = collapse(s);
      expect(s.collapses).toBe(k);
      expect(Object.values(s.vault).reduce((a, b) => a + b, 0)).toBe(k);
      const r = validateSave(s);
      expect(r.ok, r.ok ? '' : `colapso ${k}: ${r.errors.join(';')}`).toBe(true);
    }
    expect(Object.keys(s.vault).length).toBeGreaterThan(1);
  });

  it('o servidor recusa Cofre inválido: proibido que não existe, nível 6, mais níveis que colapsos e selo sem o Cofre completo', () => {
    const fresh = newSave('a');
    const ok = {
      ...fresh,
      tutorial: 'done' as const,
      collapses: 1,
      sparks: { legacy: 4, spent: 0 },
      stats: { ...fresh.stats, picks: 20, dustTotal: 2e8 },
      album: ['moon', 'm87'],
      vault: { m87: 1 },
      regionId: 'asteroid-belt',
    };
    const first = validateSave(ok);
    expect(first.ok, first.ok ? '' : first.errors.join(';')).toBe(true);
    expect(rejects({ ...ok, vault: { 'nao-existe': 1 }, album: ['moon', 'nao-existe'] })).toContain('Proibido inválido no Cofre: nao-existe');
    expect(rejects({ ...ok, vault: { m87: 6 } })).toBeTruthy();
    expect(rejects({ ...ok, vault: { m87: 1, 'cygnus-x1': 1 }, album: ['moon', 'm87', 'cygnus-x1'] })).toContain('Cofre maior que os colapsos');
    expect(rejects({ ...ok, vault: {}, seals: 1 })).toContain('Selos sem o Cofre completo');
    expect(rejects({ ...ok, vault: { m87: 1 }, album: ['moon'] })).toContain('Proibido fora do álbum: m87');
  });

  it('recusa lixo, campo faltando, tipo errado e versão do futuro', () => {
    for (const raw of [null, 42, 'x', [], {}, { ...newSave('x'), run: undefined }, { ...newSave('x'), name: 7 }]) rejects(raw);
    rejects({ ...newSave('x'), version: 99 });
  });

  it('recusa NaN, infinito e números negativos', () => {
    const s = newSave('x');
    rejects({ ...s, run: { ...s.run, dust: -1 } });
    rejects({ ...s, run: { ...s.run, dustLife: NaN } });
    rejects({ ...s, playSeconds: Infinity });
    rejects({ ...s, sparks: { legacy: -3, spent: 0 } });
    // pelo fio o NaN vira null, que também não é número
    rejects(JSON.parse(JSON.stringify({ ...s, run: { ...s.run, energy: NaN } })));
  });

  it('recusa save grande demais e ignora chaves desconhecidas', () => {
    expect(rejects({ ...newSave('x'), name: 'a'.repeat(MAX_SAVE_BYTES) })).toEqual(['Save grande demais']);
    const r = validateSave({ ...newSave('x'), hack: 1 });
    expect(r.ok && 'hack' in r.save).toBe(false);
  });

  it('recusa ids fora do catálogo', () => {
    const s = clone(base());
    rejects({ ...s, album: [...s.album, 'planeta-x'] });
    rejects({ ...s, run: { ...s.run, build: { ...s.run.build, 'planeta-x': 1 } }, album: [...s.album, 'planeta-x'] });
    rejects({ ...s, regionId: 'andromeda' });
    rejects({ ...s, tree: { 'galaxia-x': 1 }, collapses: 1 });
  });
});

describe('validateSave: coerência', () => {
  it('recusa melhoria que custa mais que a poeira ganha', () => {
    const s = clone(base());
    s.run.upgradeLevels[UPGRADES.findIndex((u) => u.id === 'satellite')] = 8;
    s.run.dustLife = 0;
    expect(rejects(s)).toContain('Melhorias custam mais que a poeira ganha');
  });

  it('recusa nível acima do máximo e melhoria de colapso futuro', () => {
    const s = clone(base());
    s.run.dustLife = s.stats.dustTotal = 1e30;
    s.run.upgradeLevels[UPGRADES.findIndex((u) => u.id === 'lens')] = 2;
    expect(rejects(s)).toContain('Nível acima do máximo: lens');
    const f = clone(base());
    f.run.dustLife = f.stats.dustTotal = 1e30;
    f.run.upgradeLevels[UPGRADES.findIndex((u) => u.id === 'webb')] = 1;
    expect(rejects(f)).toContain('Melhoria de colapso futuro: webb');
  });

  it('recusa grimório de colapso futuro e mais grimórios que escolhas', () => {
    const future = GRIMOIRES.find((g) => g.unlockedAtCollapse > 0)!;
    const s = clone(base());
    s.run.build[future.id] = 1;
    s.album.push(future.id);
    expect(rejects(s)).toContain(`Grimório de colapso futuro: ${future.id}`);
    const t = newSave('x');
    expect(rejects({ ...t, run: { ...t.run, build: { moon: 1 } }, album: ['moon'] })).toContain('Mais grimórios do que escolhas');
  });

  it('recusa poeira maior que a da vida e da vida maior que o total', () => {
    const s = clone(base());
    expect(rejects({ ...s, run: { ...s.run, dust: s.run.dustLife * 2 + 10 } })).toContain('Poeira maior que a ganha na vida');
    expect(rejects({ ...s, stats: { ...s.stats, dustTotal: 0 } })).toContain('Poeira da vida maior que o total');
  });

  it('recusa Cintilas incoerentes', () => {
    const s = newSave('x');
    expect(rejects({ ...s, sparks: { legacy: 0, spent: 9 } })).toContain('Cintilas gastas maiores que as ganhas');
    expect(rejects({ ...s, sparks: { legacy: 50, spent: 0 } })).toContain('Cintilas migradas não batem com os colapsos');
  });

  it('recusa árvore que custa mais que as Cintilas gastas', () => {
    const s = { ...newSave('x'), collapses: 1, tutorial: 'done' as const, regionId: 'asteroid-belt' };
    const withTree = { ...s, tree: { 'co-02': 1, 'co-05': 2, 'co-11': 1 }, sparks: { legacy: 4, spent: 2 }, stats: { ...s.stats, picks: 1 } };
    expect(rejects(withTree)).toContain('Árvore custa mais que as Cintilas gastas');
  });

  it('recusa região ainda fechada', () => {
    expect(rejects({ ...newSave('x'), regionId: 'asteroid-belt' })).toContain('Região ainda fechada');
  });
});

describe('validateSave: ritmo possível (corta e marca)', () => {
  it('tempo jogado maior que o tempo desde a criação é cortado', () => {
    const s = { ...base(), playSeconds: 1e6 };
    const r = validateSave(s, { nowMs: NOW, createdAtMs: NOW - 3_600_000 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.flagged).toContain('playSeconds');
      expect(r.save.playSeconds).toBeLessThanOrEqual(3600 + 120);
    }
  });

  it('poeira acima do que o tempo permite é cortada e continua válida', () => {
    const s = clone(newSave('x', NOW - 60_000));
    s.playSeconds = 30;
    s.run.dustLife = s.run.dust = s.stats.dustTotal = 5e9;
    const r = validateSave(s, { nowMs: NOW, createdAtMs: NOW - 60_000 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.flagged).toContain('dustLife');
      expect(r.save.run.dustLife).toBeLessThan(1e6);
      expect(r.save.run.dust).toBeLessThanOrEqual(r.save.run.dustLife);
      expect(r.save.stats.dustTotal).toBeGreaterThanOrEqual(r.save.run.dustLife);
    }
  });

  it('não muta o que recebeu', () => {
    const s = { ...base(), playSeconds: 1e6 };
    const before = JSON.stringify(s);
    validateSave(s, { nowMs: NOW, createdAtMs: NOW - 1000 });
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('mergeSaves', () => {
  const ok = (s: SaveState) => {
    const r = validateSave(s);
    expect(r.ok, r.ok ? '' : r.errors.join(';')).toBe(true);
  };

  it('um save atrasado do mesmo jogo não tira nada do adiantado, sem conflito', () => {
    const early = play('m', 300);
    const late = play('m', 300, early);
    const r = mergeSaves(early, late);
    expect(r.winner).toBe('b');
    expect(r.conflict).toBe(false);
    expect(r.save.run.picks).toBe(late.run.picks);
    ok(r.save);
  });

  it('o vencedor não depende da ordem dos argumentos', () => {
    const a = play('m', 200);
    const b = play('m', 400, a);
    expect(mergeSaves(a, b).save.run).toEqual(mergeSaves(b, a).save.run);
  });

  it('vida diferente nos dois aparelhos: junta o permanente e avisa conflito', () => {
    const root = play('m', 120);
    const [x, y] = ['moon', 'mars', 'venus', 'mercury'].filter((g) => !(g in root.run.build));
    const a: SaveState = {
      ...root,
      run: { ...root.run, build: { ...root.run.build, [x!]: 1 }, picks: root.run.picks + 3 },
      stats: { ...root.stats, picks: root.stats.picks + 3 },
      album: [...root.album, x!],
    };
    const b: SaveState = {
      ...root,
      run: { ...root.run, build: { ...root.run.build, [y!]: 1 }, picks: root.run.picks + 2 },
      stats: { ...root.stats, picks: root.stats.picks + 2 },
      album: [...root.album, y!],
    };
    const r = mergeSaves(a, b);
    expect(r.winner).toBe('a');
    expect(r.conflict).toBe(true);
    expect(r.save.album).toEqual(expect.arrayContaining([x!, y!]));
  });

  it('mais colapsos vence; álbum, conquistas, Atlas e totais são união', () => {
    const lo: SaveState = {
      ...newSave('x', 5),
      album: ['moon', 'mars'],
      achievements: ['a1'],
      storySeen: true,
      playSeconds: 900,
      stats: { ...FRESH_STATS, clicks: 900, objectsCaptured: 9, picks: 9, dustTotal: 1e5 },
    };
    const hi: SaveState = {
      ...newSave('x', 3),
      collapses: 1,
      tutorial: 'done',
      regionId: 'asteroid-belt',
      album: ['venus'],
      achievements: ['b2'],
      sparks: { legacy: 4, spent: 0 },
      stats: { ...FRESH_STATS, clicks: 10, objectsCaptured: 1, picks: 20, dustTotal: 2e8 },
    };
    const r = mergeSaves(lo, hi);
    expect(r.winner).toBe('b');
    expect(r.conflict).toBe(false);
    expect(r.save.collapses).toBe(1);
    expect(r.save.album).toEqual(['venus', 'moon', 'mars']);
    expect(r.save.achievements).toEqual(['b2', 'a1']);
    expect(r.save.storySeen).toBe(true);
    expect(r.save.createdAt).toBe(3);
    expect(r.save.playSeconds).toBe(900);
    expect(r.save.stats).toMatchObject({ clicks: 900, objectsCaptured: 9, picks: 20, dustTotal: 2e8 });
  });

  it('o Cofre junta o maior nível de cada proibido, desde que caiba nos colapsos do save mais avançado', () => {
    const mk = (vault: Record<string, number>, collapses: number): SaveState => ({
      ...newSave('x'),
      collapses,
      tutorial: 'done',
      regionId: 'asteroid-belt',
      album: Object.keys(vault),
      vault,
      sparks: { legacy: 4 * collapses, spent: 0 },
    });
    const a = mk({ m87: 2, 'ton-618': 1 }, 3);
    const b = mk({ m87: 1, 'gaia-bh3': 1 }, 2);
    // Juntos dariam 2 + 1 + 1 = 4 níveis em 3 colapsos: não cabe, fica o do mais avançado.
    expect(mergeSaves(a, b).save.vault).toEqual({ m87: 2, 'ton-618': 1 });
    const c = mk({ m87: 2 }, 3);
    const d = mk({ m87: 1, 'gaia-bh3': 1 }, 3);
    expect(mergeSaves(c, d).save.vault).toEqual({ m87: 2, 'gaia-bh3': 1 });
  });

  it('a árvore fica com o máximo de cada ramo se as Cintilas cobrem', () => {
    const mk = (tree: Record<string, number>, spent: number): SaveState => ({
      ...newSave('x'),
      collapses: 1,
      tutorial: 'done',
      regionId: 'asteroid-belt',
      tree,
      sparks: { legacy: 8, spent },
    });
    const r = mergeSaves(mk({ 'co-02': 1, 'co-05': 1 }, 3), mk({ 'co-01': 1 }, 1));
    expect(r.save.tree).toEqual({ 'co-02': 1, 'co-05': 1, 'co-01': 1 });
    expect(r.save.sparks).toEqual({ legacy: 8, spent: 4 });
    const bad = mergeSaves(mk({ 'co-02': 1, 'co-05': 2, 'co-11': 2 }, 7), mk({ 'co-01': 2, 'co-04': 2 }, 7));
    expect(bad.save.sparks.spent).toBeLessThanOrEqual(bad.save.sparks.legacy);
  });

  it('não muta os dois lados', () => {
    const a = clone(play('m', 100));
    const b = clone(play('n', 150));
    const [ja, jb] = [JSON.stringify(a), JSON.stringify(b)];
    mergeSaves(a, b);
    expect([JSON.stringify(a), JSON.stringify(b)]).toEqual([ja, jb]);
  });
});

describe('validateSave: partida longa de verdade', () => {
  it('nenhum estado de 11 h de jogo, com colapsos, é recusado nem cortado', () => {
    let s = newSave('longa', 0);
    let t = 0;
    while (t < 40_000) {
      s = play('longa', 300, s, true);
      t = s.clock;
      const r = validateSave(clone(s), { nowMs: 1e12, createdAtMs: 1e12 - t * 1000 - 10_000 });
      expect(r.ok, r.ok ? '' : r.errors.join(';')).toBe(true);
      expect(r.ok && r.flagged).toEqual([]);
    }
    expect(s.collapses).toBeGreaterThanOrEqual(1);
  }, 120_000);
});

describe('validateSave: economia v2 (spec 039)', () => {
  const upg = (id: string) => UPGRADES.findIndex((u) => u.id === id);
  const old = 4 * 3600 * 1000;

  it('recusa um save de versão antiga: a economia v2 zerou todos', () => {
    const s = clone(newSave('v1', NOW - old));
    (s as { version: number }).version = 1;
    const r = validateSave(s, { nowMs: NOW, createdAtMs: NOW - old });
    expect(r.ok).toBe(false);
    expect(validateSave(clone(newSave('v2', NOW))).ok).toBe(true);
  });

  it('a lista de melhorias menor é completada com zeros', () => {
    const s = clone(newSave('curta', NOW));
    s.run.upgradeLevels = [1];
    s.run.dustLife = s.stats.dustTotal = 500;
    const r = validateSave(s);
    expect(r.ok && r.save.run.upgradeLevels).toHaveLength(UPGRADES.length);
  });

  it('recusa melhoria fora da prateleira (comprou a 5ª sem as de antes)', () => {
    const s = clone(newSave('fila', NOW));
    s.run.upgradeLevels[upg('hands')] = 1;
    s.run.dustLife = s.stats.dustTotal = 5000;
    expect(rejects(s)).toContain('Melhoria trancada: hands');
    // Com as de antes compradas, a mesma compra é válida.
    const ok = clone(s);
    for (const id of ['lens', 'gloves', 'trained', 'rhythm']) ok.run.upgradeLevels[upg(id)] = 1;
    ok.run.dustLife = ok.stats.dustTotal = 50000;
    expect(validateSave(ok).ok).toBe(true);
  });

  it('recusa a Cadência sem o Ritmo Firme', () => {
    const s = clone(newSave('req', NOW));
    for (const id of ['lens', 'gloves', 'trained', 'magnet', 'hands', 'charged', 'luck', 'cadence']) s.run.upgradeLevels[upg(id)] = 1;
    s.run.dustLife = s.stats.dustTotal = 100000;
    expect(rejects(s)).toContain('Melhoria trancada: cadence');
  });

  it('poeira acima do teto é cortada e marcada, sem recusar o save', () => {
    const s = clone(newSave('rico', NOW - old));
    s.playSeconds = 600;
    s.run.dustLife = s.stats.dustTotal = 5e8;
    s.run.dust = 4e8;
    const r = validateSave(s, { nowMs: NOW, createdAtMs: NOW - old });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.flagged).toContain('dustLife');
      expect(r.save.run.dustLife).toBeLessThan(5e8);
      expect(r.save.run.dust).toBeLessThanOrEqual(r.save.run.dustLife);
      expect(r.save.stats.dustTotal).toBeGreaterThanOrEqual(r.save.run.dustLife);
    }
  });

  it('depois do 1º colapso as melhorias de toque não pedem a fila inteira de novo', () => {
    const s = clone(newSave('colapsada', NOW));
    s.collapses = 1;
    s.sparks = { legacy: 4, spent: 0 };
    s.stats.picks = 1;
    s.regionId = 'asteroid-belt';
    s.run.upgradeLevels[upg('gloves')] = 1;
    s.run.upgradeLevels[upg('lens')] = 1;
    s.run.dustLife = 500;
    s.stats.dustTotal = dustGoal(1) + 500;
    expect(validateSave(s).ok).toBe(true);
  });

  it('o 1º toque do jogo vale exatamente 1 de poeira, com 0 de poeira de partida', () => {
    const fresh = newSave('zero', NOW);
    expect(fresh.run.dust).toBe(0);
    const r = validateSave(press(fresh, 1));
    expect(r.ok && r.save.run.dust).toBe(1);
  });

});

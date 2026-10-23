// Teste de balanço das Cintilas (spec 040, 5.4): a árvore alvo tem que caber nas fontes. Se a conta quebrar, ajuste
// a lista de conquistas, as recompensas ou o custo dos nós NO MESMO commit (a conta está documentada na spec 040).
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { GRIMOIRES } from './catalog';
import { FORBIDDEN } from './forbidden';
import { BALANCE_COLLAPSE, BALANCE_MIN_FINITE, BALANCE_MIN_TOTAL, dustTotalAtCollapse, sparkBalance } from './balance';
import { ALBUM_SPARKS, LEGENDARY_OBJECT_KINDS, RARE_CAPTURE_STEPS, STAR_STEPS, finiteSparksCeiling } from './sparks';
import { TREE_BRANCHES, TREE_NODES, TREE_TIER_COST, TREE_TOTAL_COST } from './tree';

describe('a árvore real (T)', () => {
  it('5 ramos (cosmos com 20 nós, os outros com 24), 116 nós, custo por tier 1, 2, 3, 5 e 8', () => {
    expect(TREE_TIER_COST).toEqual([1, 2, 3, 5, 8]);
    expect(TREE_BRANCHES).toHaveLength(5);
    for (const b of TREE_BRANCHES) expect(TREE_NODES.filter((n) => n.branch === b.id)).toHaveLength(b.id === 'cosmos' ? 20 : 24);
    expect(TREE_NODES).toHaveLength(116);
  });

  it('T bate com a soma dos níveis x custo do tier e fica entre 500 e 600', () => {
    let t = 0;
    for (const n of TREE_NODES) t += n.maxLevel * TREE_TIER_COST[n.tier - 1]!;
    expect(TREE_TOTAL_COST).toBe(t);
    expect(t).toBeGreaterThanOrEqual(500);
    expect(t).toBeLessThanOrEqual(600);
  });
});

describe('fontes finitas (F), calculadas dos dados', () => {
  it('F = conquistas + álbum + raros e degraus + Estrela dos Proibidos', () => {
    const f = finiteSparksCeiling();
    const achievements = ACHIEVEMENTS.filter((a) => !a.retired).reduce((n, a) => n + a.reward, 0);
    const album = GRIMOIRES.reduce((n, g) => n + ALBUM_SPARKS[g.rarity], 0) + FORBIDDEN.length * ALBUM_SPARKS.forbidden;
    const forbidden = FORBIDDEN.length;
    const stars = forbidden * STAR_STEPS.reduce((n, s) => n + s.sparks, 0);
    expect(f.achievements).toBe(achievements);
    expect(f.album).toBe(album);
    expect(f.stars).toBe(stars);
    expect(f.rare).toBe((2 + LEGENDARY_OBJECT_KINDS.length) * 3 + RARE_CAPTURE_STEPS.reduce((n, s) => n + s.sparks, 0));
    expect(f.total).toBe(achievements + album + f.rare + stars);
  });
});

describe('balanço da seção 5.4', () => {
  const b = sparkBalance();

  it('F >= 0,80 x T: a árvore quase toda se alcança só jogando e colecionando', () => {
    expect(b.F, `F=${b.F} T=${b.T}`).toBeGreaterThanOrEqual(BALANCE_MIN_FINITE * b.T);
    expect(b.finiteOk).toBe(true);
  });

  it('F + R25 >= 1,10 x T: a árvore completa cabe, com folga, até o colapso 25', () => {
    expect(b.F + b.R25, `F+R25=${b.F + b.R25} 1,1T=${BALANCE_MIN_TOTAL * b.T}`).toBeGreaterThanOrEqual(BALANCE_MIN_TOTAL * b.T);
    expect(b.totalOk).toBe(true);
  });

  it('R25 vem só das fontes que repetem, no perfil normal até o colapso 25', () => {
    expect(BALANCE_COLLAPSE).toBe(25);
    expect(b.parts.collapseMarks).toBe(8);
    // A poeira total até o colapso 25 passa de 1e6 e de 1e9 mas não chega a 1e12 com as metas de hoje.
    expect(dustTotalAtCollapse(25)).toBeGreaterThan(1e9);
    expect(b.parts.dustMarks).toBeGreaterThanOrEqual(2);
    expect(b.parts.events).toBe(6);
    expect(b.R25).toBe(b.parts.collapseMarks + b.parts.dustMarks + b.parts.events);
    expect(b.R25).toBeLessThan(b.F * 0.1);
  });

  it('o teste pega o desbalanceamento: uma árvore 2x mais cara quebra a regra', () => {
    const big = sparkBalance(2 * TREE_TOTAL_COST);
    expect(big.totalOk).toBe(false);
  });

  it('imprime a conta (ela vai para a spec)', () => {
    const line = `T=${b.T} F=${b.F} (conquistas ${b.parts.achievements}, álbum ${b.parts.album}, raros ${b.parts.rare}, estrelas ${b.parts.stars}) R25=${b.R25}`;
    expect(line).toMatch(/^T=\d+ F=\d+/);
    console.log(line, `F/T=${(b.F / b.T).toFixed(3)} (F+R25)/T=${((b.F + b.R25) / b.T).toFixed(3)}`);
  });
});

import { TREE_NODES } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { branchAngle, computeTreeLayout, neighbor, NODE_GAP, tierRadius } from './tree-layout';

describe('layout da árvore', () => {
  const layout = computeTreeLayout();
  const nodes = Object.values(layout.nodes);

  it('posiciona os 120 nós e uma linha por pré-requisito (inclui as ligações cruzadas)', () => {
    expect(nodes).toHaveLength(120);
    for (const n of TREE_NODES) expect(layout.nodes[n.id], n.id).toBeDefined();
    expect(layout.edges).toHaveLength(TREE_NODES.reduce((s, n) => s + n.parents.length, 0));
    const cross = layout.edges.filter((e) => e.cross);
    expect(cross.length).toBeGreaterThanOrEqual(3);
    expect(cross.length).toBeLessThanOrEqual(8);
  });

  it('nenhum nó encosta em outro (distância mínima) e todos têm números finitos', () => {
    let min = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]!;
      expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true);
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]!;
        min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
    // Vizinhos no mesmo tier ficam a NODE_GAP (as cordas encurtam um pouco o arco).
    expect(min).toBeGreaterThanOrEqual(NODE_GAP - 0.01);
  });

  it('cada tier fica no seu raio e cada ramo na sua fatia', () => {
    for (const n of nodes) {
      expect(Math.hypot(n.x, n.y)).toBeCloseTo(tierRadius(n.tier), 6);
      const d = Math.abs(((n.angle - branchAngle(n.branch) + 540) % 360) - 180);
      expect(d, n.id).toBeLessThanOrEqual(34);
    }
  });

  it('é determinístico e cabe numa caixa finita', () => {
    expect(computeTreeLayout()).toBe(layout);
    expect(layout.bounds.maxX - layout.bounds.minX).toBeGreaterThan(800);
    expect(layout.bounds.maxX - layout.bounds.minX).toBeLessThan(1600);
  });

  it('as setas do teclado andam para o vizinho do lado certo', () => {
    const first = nodes.find((n) => n.tier === 1 && n.branch === 'automation')!;
    const right = neighbor(layout, first.id, 'right');
    if (right) expect(layout.nodes[right]!.x).toBeGreaterThan(first.x);
    const down = neighbor(layout, first.id, 'down');
    if (down) expect(layout.nodes[down]!.y).toBeGreaterThan(first.y);
    expect(neighbor(layout, 'nao-existe', 'up')).toBeNull();
    // Da raiz sempre há para onde ir.
    expect(neighbor(layout, 'root', 'up')).not.toBeNull();
  });
});

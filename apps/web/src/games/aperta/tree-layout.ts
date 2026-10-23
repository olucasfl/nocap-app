import { TREE_BRANCHES, TREE_NODES, type TreeBranchId } from '@nocap/games';

/**
 * Layout da árvore em forma de árvore (spec 040, 6.1): a raiz no centro e cada ramo numa fatia de 72 graus. Os nós de
 * um mesmo tier ficam no mesmo raio; o ângulo vem da média dos pais do ramo (a linha sai reta) e depois um passe
 * separa os que ficaram perto demais. Tudo calculado do grafo, nenhuma posição escrita à mão.
 */

export interface LayoutNode {
  id: string;
  branch: TreeBranchId;
  tier: number;
  x: number;
  y: number;
  /** Ângulo em graus (0 = direita, 90 = embaixo, como no SVG). */
  angle: number;
  radius: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
  /** Ligação entre dois ramos. */
  cross: boolean;
}

export interface TreeLayout {
  nodes: Record<string, LayoutNode>;
  edges: LayoutEdge[];
  /** Caixa que contém todos os nós, com folga. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/** Raio do tier 1 e quanto cada tier seguinte se afasta. */
export const TIER_RADIUS_BASE = 224;
export const TIER_RADIUS_STEP = 96;
/** Distância mínima entre dois nós vizinhos do mesmo tier (px de layout). */
export const NODE_GAP = 52;
/** Metade da largura da fatia de cada ramo, em graus. */
const SECTOR_HALF = 33;
const BRANCH_STEP = 360 / TREE_BRANCHES.length;
const BRANCH_START = -90;

const rad = (deg: number): number => (deg * Math.PI) / 180;
export const tierRadius = (tier: number): number => TIER_RADIUS_BASE + (tier - 1) * TIER_RADIUS_STEP;

/** Ângulo central de um ramo: o primeiro sobe, os outros seguem no sentido horário. */
export function branchAngle(branch: TreeBranchId): number {
  return BRANCH_START + BRANCH_STEP * TREE_BRANCHES.findIndex((b) => b.id === branch);
}

let cached: TreeLayout | null = null;

export function computeTreeLayout(): TreeLayout {
  if (cached) return cached;
  const nodes: Record<string, LayoutNode> = {};
  for (const b of TREE_BRANCHES) {
    const center = branchAngle(b.id);
    const lo = center - SECTOR_HALF;
    const hi = center + SECTOR_HALF;
    for (let tier = 1; tier <= 5; tier++) {
      const row = TREE_NODES.filter((n) => n.branch === b.id && n.tier === tier);
      if (row.length === 0) continue;
      const r = tierRadius(tier);
      const minGap = 2 * Math.asin(NODE_GAP / (2 * r)) * (180 / Math.PI);
      // Ângulo desejado: média dos pais do ramo já posicionados; sem pais (tier 1), espalha pela fatia.
      const wanted = row.map((n, i) => {
        const parents = n.parents.map((p) => nodes[p]).filter((p): p is LayoutNode => !!p && p.branch === b.id);
        if (parents.length > 0) return parents.reduce((s, p) => s + p.angle, 0) / parents.length;
        return row.length === 1 ? center : lo + 4 + ((hi - lo - 8) * i) / (row.length - 1);
      });
      const order = row.map((_, i) => i).sort((a, b2) => (wanted[a] as number) - (wanted[b2] as number) || a - b2);
      const angles = order.map((i) => wanted[i] as number);
      for (let i = 1; i < angles.length; i++) angles[i] = Math.max(angles[i] as number, (angles[i - 1] as number) + minGap);
      const over = (angles[angles.length - 1] as number) - hi;
      if (over > 0) {
        angles[angles.length - 1] = hi;
        for (let i = angles.length - 2; i >= 0; i--) angles[i] = Math.min(angles[i] as number, (angles[i + 1] as number) - minGap);
      }
      order.forEach((idx, k) => {
        const n = row[idx]!;
        const angle = angles[k] as number;
        nodes[n.id] = { id: n.id, branch: n.branch, tier, angle, radius: r, x: Math.cos(rad(angle)) * r, y: Math.sin(rad(angle)) * r };
      });
    }
  }
  const edges: LayoutEdge[] = [];
  for (const n of TREE_NODES) {
    for (const p of n.parents) {
      const parent = TREE_NODES.find((x) => x.id === p);
      edges.push({ from: p, to: n.id, cross: !!parent && parent.branch !== n.branch });
    }
  }
  const xs = Object.values(nodes).map((n) => n.x);
  const ys = Object.values(nodes).map((n) => n.y);
  const pad = 40;
  cached = {
    nodes,
    edges,
    bounds: { minX: Math.min(...xs) - pad, maxX: Math.max(...xs) + pad, minY: Math.min(...ys) - pad, maxY: Math.max(...ys) + pad },
  };
  return cached;
}

/**
 * O vizinho de `id` na direção `dir` (para as setas do teclado): entre os nós que ficam naquele lado, o mais perto,
 * pesando mais o desvio lateral. `null` se não há ninguém daquele lado.
 */
export function neighbor(layout: TreeLayout, id: string, dir: 'up' | 'down' | 'left' | 'right'): string | null {
  const from = id === 'root' ? { x: 0, y: 0 } : layout.nodes[id];
  if (!from) return null;
  const vx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const vy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const n of Object.values(layout.nodes)) {
    if (n.id === id) continue;
    const dx = n.x - from.x;
    const dy = n.y - from.y;
    const along = dx * vx + dy * vy;
    if (along <= 4) continue;
    const side = Math.abs(dx * vy) + Math.abs(dy * vx);
    const score = along + side * 2;
    if (score < bestScore) {
      bestScore = score;
      best = n.id;
    }
  }
  return best;
}

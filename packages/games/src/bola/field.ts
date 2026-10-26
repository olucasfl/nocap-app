import { BOL_FOX_R } from './constants';

/** Uma parede do campo. A normal aponta para dentro. */
export interface BolEdge {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  nx: number;
  nz: number;
  /** Ponto do meio e direção ao longo da parede. */
  mx: number;
  mz: number;
  tx: number;
  tz: number;
  len: number;
  /** Time dono do gol que se abre nesta parede; -1 se é parede lisa. */
  goal: number;
}

export interface BolGoal {
  team: number;
  edge: BolEdge;
  /** Metade da largura da boca do gol. */
  halfW: number;
  /** Distância do centro do campo até esta parede. */
  depth: number;
}

export interface BolSpawn {
  x: number;
  z: number;
  heading: number;
}

export interface BolField {
  teams: number;
  perTeam: number;
  edges: readonly BolEdge[];
  goals: readonly BolGoal[];
  /** Ponto de saída da raposa `index` (de `count`) do time `team`. */
  spawn(team: number, index: number, count: number): BolSpawn;
  /** O ponto está dentro das paredes, com folga `margin`? */
  inside(x: number, z: number, margin?: number): boolean;
}

type Pt = readonly [number, number];

function makeEdges(pts: readonly Pt[], goalOf: (edgeIndex: number) => number): BolEdge[] {
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length] as Pt;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    let nx = -dz / len;
    let nz = dx / len;
    // o centro do campo é a origem: a normal tem de apontar para ele
    if (nx * (0 - a[0]) + nz * (0 - a[1]) < 0) {
      nx = -nx;
      nz = -nz;
    }
    return {
      ax: a[0],
      az: a[1],
      bx: b[0],
      bz: b[1],
      nx,
      nz,
      mx: (a[0] + b[0]) / 2,
      mz: (a[1] + b[1]) / 2,
      tx: dx / len,
      tz: dz / len,
      len,
      goal: goalOf(i),
    };
  });
}

/**
 * Monta o campo de um formato: retângulo com cantos cortados (2 times), hexágono (3) ou quadrado com cantos cortados (4).
 * Os cantos cortados tiram os cantinhos onde a bola ficaria presa. O campo cresce com o tamanho do maior time.
 */
export function buildField(teams: number, perTeam: number): BolField {
  const n = Math.max(2, Math.min(4, Math.round(teams)));
  const k = Math.max(1, Math.round(perTeam));
  let pts: Pt[];
  let goalOf: (i: number) => number;
  if (n === 3) {
    const apothem = 22 + 4.5 * k;
    const radius = apothem / Math.cos(Math.PI / 6);
    pts = Array.from({ length: 6 }, (_, i) => {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      return [Math.cos(a) * radius, Math.sin(a) * radius] as const;
    });
    goalOf = (i) => (i % 2 === 0 ? i / 2 : -1);
  } else {
    const hx = n === 2 ? 16 + 4.5 * k : 22 + 4 * k;
    const hz = n === 2 ? 10 + 3 * k : hx;
    const c = n === 2 ? 4.5 : 8;
    pts = [
      [hx, -(hz - c)],
      [hx, hz - c],
      [hx - c, hz],
      [-(hx - c), hz],
      [-hx, hz - c],
      [-hx, -(hz - c)],
      [-(hx - c), -hz],
      [hx - c, -hz],
    ];
    // lados: 0 leste, 2 norte, 4 oeste, 6 sul
    const table: Record<number, number> = n === 2 ? { 4: 0, 0: 1 } : { 4: 0, 0: 1, 6: 2, 2: 3 };
    goalOf = (i) => table[i] ?? -1;
  }
  const edges = makeEdges(pts, goalOf);
  const goals: BolGoal[] = [];
  for (const e of edges) {
    if (e.goal < 0) continue;
    const width = Math.min((7 + 1 * k) * 1.18, 0.62 * e.len);
    goals[e.goal] = {
      team: e.goal,
      edge: e,
      halfW: width / 2,
      depth: Math.abs((0 - e.mx) * e.nx + (0 - e.mz) * e.nz),
    };
  }
  const inside = (x: number, z: number, margin = 0): boolean =>
    edges.every((e) => (x - e.ax) * e.nx + (z - e.az) * e.nz >= margin);
  const spawn = (team: number, index: number, count: number): BolSpawn => {
    const g = goals[Math.max(0, Math.min(n - 1, team))] as BolGoal;
    const along = g.depth * 0.55;
    const lateral = (index - (Math.max(1, count) - 1) / 2) * 2.4;
    const x = g.edge.mx + g.edge.nx * (g.depth - along) + g.edge.tx * lateral;
    const z = g.edge.mz + g.edge.nz * (g.depth - along) + g.edge.tz * lateral;
    return { x, z, heading: Math.atan2(-x, -z) };
  };
  return { teams: n, perTeam: k, edges, goals, spawn, inside };
}

/** Folga mínima das raposas ao nascer: sempre longe das paredes. */
export const BOL_SPAWN_MARGIN = BOL_FOX_R + 0.5;

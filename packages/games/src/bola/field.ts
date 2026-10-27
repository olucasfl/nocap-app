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
  /** Raio da rampa que liga o chão às paredes (m): a bola e as raposas sobem por ela. */
  rampR: number;
  /** Altura do chão em (x, z): 0 no meio do campo e sobe pela rampa perto das paredes (menos na boca dos gols). */
  floorAt(x: number, z: number): number;
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

/** Raio da rampa entre o chão e as paredes (m). */
export const BOL_RAMP_R = 2.2;

/**
 * Arredonda os cantos de um polígono convexo (sentido anti-horário ou horário) com arcos de raio `r`. Devolve os pontos e,
 * para cada aresta de saída, o índice da aresta ORIGINAL de onde veio (-1 nos arcos): os gols ficam nas arestas retas.
 */
function roundCorners(pts: readonly Pt[], r: number, steps: number): { pts: Pt[]; from: number[] } {
  const n = pts.length;
  const out: Pt[] = [];
  const from: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = pts[i] as Pt;
    const p = pts[(i + n - 1) % n] as Pt;
    const q = pts[(i + 1) % n] as Pt;
    const ux = p[0] - v[0];
    const uz = p[1] - v[1];
    const wx = q[0] - v[0];
    const wz = q[1] - v[1];
    const ul = Math.hypot(ux, uz);
    const wl = Math.hypot(wx, wz);
    const cosT = (ux * wx + uz * wz) / (ul * wl);
    const theta = Math.acos(Math.max(-1, Math.min(1, cosT)));
    const t = r / Math.tan(theta / 2);
    const a: Pt = [v[0] + (ux / ul) * t, v[1] + (uz / ul) * t];
    const b: Pt = [v[0] + (wx / wl) * t, v[1] + (wz / wl) * t];
    const bx = ux / ul + wx / wl;
    const bz = uz / ul + wz / wl;
    const bl = Math.hypot(bx, bz);
    const dist = r / Math.sin(theta / 2);
    const c: Pt = [v[0] + (bx / bl) * dist, v[1] + (bz / bl) * dist];
    let a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
    const a1 = Math.atan2(b[1] - c[1], b[0] - c[0]);
    let d = a1 - a0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    // o arco: o ponto de entrada A, os do meio e o de saída B; as arestas entre eles são do arco
    for (let k = 0; k <= steps; k++) {
      const ang = a0 + (d * k) / steps;
      out.push([c[0] + Math.cos(ang) * r, c[1] + Math.sin(ang) * r]);
      // aresta que sai deste ponto: arco, menos a última (do ponto B até o A do próximo canto, que é reta da original i)
      from.push(k === steps ? i : -1);
    }
  }
  return { pts: out, from };
}

/**
 * Monta o campo de um formato: retângulo (2 times), hexágono (3) ou quadrado (4), com os cantos arredondados (arcos) para a
 * bola não ficar presa, e uma rampa entre o chão e as paredes. O campo cresce com o tamanho do maior time.
 */
export function buildField(teams: number, perTeam: number): BolField {
  const n = Math.max(2, Math.min(4, Math.round(teams)));
  const k = Math.max(1, Math.round(perTeam));
  let base: Pt[];
  let radius: number;
  let goalOfOriginal: (i: number) => number;
  if (n === 3) {
    const apothem = 22 + 4.5 * k;
    const circ = apothem / Math.cos(Math.PI / 6);
    base = Array.from({ length: 6 }, (_, i) => {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      return [Math.cos(a) * circ, Math.sin(a) * circ] as const;
    });
    radius = 5.5;
    goalOfOriginal = (i) => (i % 2 === 0 ? i / 2 : -1);
  } else {
    const hx = n === 2 ? 16 + 4.5 * k : 22 + 4 * k;
    const hz = n === 2 ? 10 + 3 * k : hx;
    base = [
      [hx, -hz],
      [hx, hz],
      [-hx, hz],
      [-hx, -hz],
    ];
    radius = n === 2 ? 6 : 9;
    // lados: 0 leste, 1 norte, 2 oeste, 3 sul
    const table: Record<number, number> = n === 2 ? { 2: 0, 0: 1 } : { 2: 0, 0: 1, 3: 2, 1: 3 };
    goalOfOriginal = (i) => table[i] ?? -1;
  }
  const rounded = roundCorners(base, radius, 6);
  const pts = rounded.pts;
  const goalOf = (i: number) => {
    const o = rounded.from[i] ?? -1;
    return o < 0 ? -1 : goalOfOriginal(o);
  };
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
  const rampR = BOL_RAMP_R;
  const floorAt = (x: number, z: number): number => {
    let h = 0;
    for (const e of edges) {
      const d = (x - e.ax) * e.nx + (z - e.az) * e.nz;
      if (d >= rampR) continue;
      const t = (x - e.mx) * e.tx + (z - e.mz) * e.tz;
      if (Math.abs(t) > e.len / 2 + 0.05) continue;
      // a boca do gol não tem rampa: a raposa e a bola entram no gol
      if (e.goal >= 0) {
        const g = goals[e.goal];
        if (g && Math.abs(t) <= g.halfW) continue;
      }
      const dd = Math.max(0, d);
      const y = rampR - Math.sqrt(Math.max(0, rampR * rampR - (rampR - dd) * (rampR - dd)));
      if (y > h) h = y;
    }
    return h;
  };
  return { teams: n, perTeam: k, edges, goals, spawn, inside, rampR, floorAt };
}

/** Folga mínima das raposas ao nascer: sempre longe das paredes. */
export const BOL_SPAWN_MARGIN = BOL_FOX_R + 0.5;

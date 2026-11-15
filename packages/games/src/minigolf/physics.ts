/**
 * Mini Golf (spec 082): física da bola portada do Open Golf (MIT, Michael Gerdes), `src/golf/game.c` e `src/common/bvh.c`.
 * Pura e determinística, em passo fixo de 120 Hz. Melhorias sobre o original, só no buraco: a bola cai de verdade
 * (o resultado só vale quando ela assenta no fundo) e a velocidade importa na borda.
 */

export type V3 = [number, number, number];

export interface GolfMaterial {
  name: string;
  f: number;
  r: number;
  v: number;
}
export interface GolfMovement {
  type: 'linear' | 'spinner' | 'pendulum' | 'ramp';
  t0: number;
  length: number;
  p0?: V3;
  p1?: V3;
  theta0?: number;
  theta1?: number;
  transition_length?: number;
  axis?: V3;
}
export interface GolfLevelData {
  id: number;
  ballStart: V3;
  holes: { p: V3; r: number }[];
  holeTris: number[][];
  materials: GolfMaterial[];
  solid: { t: number[]; m: number[]; f: number[] };
  moving: { name: string; movement: GolfMovement; base: { p: V3; s: V3; r: [number, number, number, number] }; t: number[]; m: number[]; f: number[] }[];
  waterDirs?: V3[];
}

export const GOLF_DT = 1 / 120;
export const GOLF_BALL_RADIUS = 0.12;
const EPS = 0.001;
const MAX_CONTACTS = 128;
const GRAVITY = -9.8;

// ---- constantes do game.cfg do Open Golf ----
const CFG = {
  holeForceDistance: 0.35,
  holeForce: 0.04,
  inHoleDelta: [0, -0.3, 0] as V3,
  inHoleRadius: 0.35,
  ballRotScale: 0.5,
  waterMaxSpeed: 4,
  waterSpeed: 2.5,
  killY: -10,
};

/** Velocidade inicial da tacada a partir da força (0 a 1), como o `aim_*` do Open Golf. */
export function golfStrokeSpeed(power: number): number {
  const g = 0.4, y = 0.65, r = 0.9;
  const gs = 2, ys = 8, rs = 16, ds = 20;
  const p = Math.max(0, Math.min(1, power));
  if (p < g) return gs + (ys - gs) * (p / g);
  if (p < y) return ys + (rs - ys) * ((p - g) / (y - g));
  if (p < r) return rs + (ds - rs) * ((p - y) / (r - y));
  return ds;
}

// ---- vetores ----
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a);
  return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
};
const dist = (a: V3, b: V3) => len(sub(a, b));

// ---- contato esfera x triângulo (Ericson, como o closest_point_point_triangle do C) ----
type Kind = 'face' | 'ab' | 'ac' | 'bc' | 'a' | 'b' | 'c';
function closestPointTriangle(p: V3, a: V3, b: V3, c: V3): { cp: V3; kind: Kind } {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return { cp: a, kind: 'a' };
  const bp = sub(p, b);
  const d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return { cp: b, kind: 'b' };
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return { cp: add(a, scale(ab, d1 / (d1 - d3))), kind: 'ab' };
  const cpv = sub(p, c);
  const d5 = dot(ab, cpv), d6 = dot(ac, cpv);
  if (d6 >= 0 && d5 <= d6) return { cp: c, kind: 'c' };
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return { cp: add(a, scale(ac, d2 / (d2 - d6))), kind: 'ac' };
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return { cp: add(b, scale(sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6)))), kind: 'bc' };
  const denom = 1 / (va + vb + vc);
  return { cp: add(add(a, scale(ab, vb * denom)), scale(ac, vc * denom)), kind: 'face' };
}

function distSqPointSegment(p: V3, a: V3, b: V3): number {
  const ab = sub(b, a), ac = sub(p, a), bc = sub(p, b);
  const e = dot(ac, ab);
  if (e <= 0) return dot(ac, ac);
  const f = dot(ab, ab);
  if (e >= f) return dot(bc, bc);
  return dot(ac, ac) - (e * e) / f;
}
const pointOnSegment = (p: V3, a: V3, b: V3) => distSqPointSegment(p, a, b) <= EPS * EPS;
function segmentsOnSameLine(a0: V3, a1: V3, b0: V3, b1: V3): boolean {
  const v0 = cross(sub(a0, a1), sub(a0, b0));
  const v1 = cross(sub(a0, a1), sub(a0, b1));
  return dot(v0, v0) < EPS * EPS && dot(v1, v1) < EPS * EPS;
}

// ---- quaternions e movimentos ----
type Q = [number, number, number, number];
const qMul = (a: Q, b: Q): Q => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qAxis = (axis: V3, ang: number): Q => {
  const l = len(axis) || 1;
  const s = Math.sin(ang / 2) / l;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(ang / 2)];
};
function qRot(q: Q, v: V3): V3 {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  const x = q[0] / n, y = q[1] / n, z = q[2] / n, w = q[3] / n;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
interface Tf {
  p: V3;
  s: V3;
  r: Q;
}
const tfApply = (t: Tf, v: V3): V3 => add(qRot(t.r, [v[0] * t.s[0], v[1] * t.s[1], v[2] * t.s[2]]), t.p);
function tfInverse(t: Tf, w: V3): V3 {
  const inv: Q = [-t.r[0], -t.r[1], -t.r[2], t.r[3]];
  const l = qRot(inv, sub(w, t.p));
  return [l[0] / t.s[0], l[1] / t.s[1], l[2] / t.s[2]];
}

/** O movimento da peça no instante `t` (o mesmo do `golf_transform_apply_movement`). */
export function golfApplyMovement(base: Tf, m: GolfMovement, tIn: number): Tf {
  const l = m.length;
  const t = (m.t0 + tIn) % l;
  const out: Tf = { p: base.p, s: base.s, r: base.r };
  switch (m.type) {
    case 'linear': {
      const p0 = m.p0!, p1 = m.p1!;
      const a = t < 0.5 * l ? t / (0.5 * l) : (l - t) / (0.5 * l);
      out.p = add(base.p, add(p0, scale(sub(p1, p0), a)));
      break;
    }
    case 'spinner':
      out.r = qMul(qAxis([0, 1, 0], 2 * Math.PI * (t / l)), base.r);
      break;
    case 'pendulum': {
      let a = 2 * (t / l);
      if (a >= 1) a = 2 - a;
      out.r = qMul(qAxis(m.axis!, m.theta0! * Math.cos(Math.PI * a)), base.r);
      break;
    }
    case 'ramp': {
      const th0 = (2 * Math.PI * m.theta0!) / 360, th1 = (2 * Math.PI * m.theta1!) / 360;
      const tl = m.transition_length!;
      const s1 = tl, s2 = 0.5 * l - tl, s3 = 0.5 * l + tl, s4 = l - tl;
      let th: number;
      if (t < s1) th = th0;
      else if (t < s2) th = th0 + ((t - s1) / (s2 - s1)) * (th1 - th0);
      else if (t < s3) th = th1;
      else if (t < s4) th = th1 + ((t - s3) / (s4 - s3)) * (th0 - th1);
      else th = th0;
      out.r = qMul(qAxis(m.axis!, th), base.r);
      break;
    }
  }
  return out;
}

// ---- fase pronta para simular ----
interface Contact {
  a: V3;
  b: V3;
  c: V3;
  kind: Kind;
  normal: V3;
  velocity: V3;
  restitution: number;
  friction: number;
  velScale: number;
  penetration: number;
  distance: number;
  isWater: boolean;
  waterDir: V3;
  oob: boolean;
  ignored: boolean;
  cullDot: number;
}

const CELL = 1.5;
export class GolfLevel {
  readonly data: GolfLevelData;
  private cells = new Map<number, number[]>();
  private stamp: Int32Array;
  private tick = 0;
  private waterDirOf = new Map<number, V3>();
  /** Triângulos fixos por índice, em coordenadas do mundo. */
  private readonly t: Float64Array;
  private readonly bases: Tf[];
  /** Fundo de cada copo (melhoria sobre o Open Golf: a bola precisa assentar para valer). */
  readonly holeFloors: number[][];
  readonly holeDepth: number[];

  constructor(data: GolfLevelData) {
    // a areia freia, mas sem parar a bola quase na hora (o valor original do Open Golf era forte demais): atrito e perda de velocidade menores
    // copo raso (metade da profundidade do Open Golf): a bola cai à vista e não some num poço
    this.data = {
      ...data,
      holeTris: data.holeTris.map((ht, i) => {
        const hy = data.holes[i]!.p[1];
        return ht.map((v, k) => (k % 3 === 1 ? hy + (v - hy) * 0.5 : v));
      }),
      materials: data.materials.map((m) => (m.name === 'sand' ? { ...m, f: Math.min(m.f, 0.45), v: Math.max(m.v, 0.992) } : m)),
    };
    data = this.data;
    this.t = Float64Array.from(data.solid.t);
    const n = data.solid.m.length;
    this.stamp = new Int32Array(n);
    let wk = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 9;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let k = 0; k < 3; k++) {
        x0 = Math.min(x0, this.t[o + 3 * k]!); x1 = Math.max(x1, this.t[o + 3 * k]!);
        z0 = Math.min(z0, this.t[o + 3 * k + 2]!); z1 = Math.max(z1, this.t[o + 3 * k + 2]!);
      }
      for (let cx = Math.floor((x0 - 0.2) / CELL); cx <= Math.floor((x1 + 0.2) / CELL); cx++)
        for (let cz = Math.floor((z0 - 0.2) / CELL); cz <= Math.floor((z1 + 0.2) / CELL); cz++) {
          const k = cx * 100003 + cz;
          let arr = this.cells.get(k);
          if (!arr) this.cells.set(k, (arr = []));
          arr.push(i);
        }
      if (data.solid.f[i]! & 2) this.waterDirOf.set(i, data.waterDirs?.[wk++] ?? [0, 0, 0]);
    }
    this.holeDepth = data.holes.map((h, i) => {
      const ht = data.holeTris[i]!;
      let minY = Infinity;
      for (let k = 1; k < ht.length; k += 3) minY = Math.min(minY, ht[k]!);
      return h.p[1] - minY;
    });
    this.holeFloors = data.holes.map((h, i) => {
      const ht = data.holeTris[i]!;
      let minY = Infinity;
      for (let k = 1; k < ht.length; k += 3) minY = Math.min(minY, ht[k]!);
      const R = h.r * 0.95;
      const fan: number[] = [];
      const N = 16;
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
        // de cima, no sentido que dá a normal para cima
        fan.push(h.p[0], minY, h.p[2], h.p[0] + Math.cos(a1) * R, minY, h.p[2] + Math.sin(a1) * R, h.p[0] + Math.cos(a0) * R, minY, h.p[2] + Math.sin(a0) * R);
      }
      return fan;
    });
    this.bases = data.moving.map((m) => ({ p: m.base.p, s: m.base.s, r: m.base.r }));
  }

  private tri(i: number): [V3, V3, V3] {
    const o = i * 9, t = this.t;
    return [[t[o]!, t[o + 1]!, t[o + 2]!], [t[o + 3]!, t[o + 4]!, t[o + 5]!], [t[o + 6]!, t[o + 7]!, t[o + 8]!]];
  }

  /** Contatos da bola (posição `bp`, raio `br`) no instante `time`. */
  contacts(bp: V3, br: number, time: number, out: Contact[]): void {
    const d = this.data;
    this.tick++;
    const cx0 = Math.floor((bp[0] - br) / CELL), cx1 = Math.floor((bp[0] + br) / CELL);
    const cz0 = Math.floor((bp[2] - br) / CELL), cz1 = Math.floor((bp[2] + br) / CELL);
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cz = cz0; cz <= cz1; cz++) {
        const arr = this.cells.get(cx * 100003 + cz);
        if (!arr) continue;
        for (const i of arr) {
          if (this.stamp[i] === this.tick) continue;
          this.stamp[i] = this.tick;
          const [a, b, c] = this.tri(i);
          const { cp, kind } = closestPointTriangle(bp, a, b, c);
          const dd = dist(bp, cp);
          if (dd >= br || out.length >= MAX_CONTACTS) continue;
          const mat = d.materials[d.solid.m[i]!]!;
          const fl = d.solid.f[i]!;
          let wd: V3 = [0, 0, 0];
          if (fl & 2) wd = this.waterDirOf.get(i) ?? wd;
          out.push(makeContact(a, b, c, [0, 0, 0], bp, br, cp, dd, mat.r, mat.f, mat.v, kind, !!(fl & 2), wd, !!(fl & 1)));
        }
      }
    d.moving.forEach((mv, k) => {
      const m0 = golfApplyMovement(this.bases[k]!, mv.movement, time);
      const m1 = golfApplyMovement(this.bases[k]!, mv.movement, time + 0.001);
      for (let i = 0; i < mv.m.length; i++) {
        const lo = mv.t.slice(i * 9, i * 9 + 9);
        const a = tfApply(m0, [lo[0]!, lo[1]!, lo[2]!]), b = tfApply(m0, [lo[3]!, lo[4]!, lo[5]!]), c = tfApply(m0, [lo[6]!, lo[7]!, lo[8]!]);
        const { cp, kind } = closestPointTriangle(bp, a, b, c);
        const dd = dist(bp, cp);
        if (dd >= br || out.length >= MAX_CONTACTS) continue;
        const mat = d.materials[mv.m[i]!]!;
        const local = tfInverse(m0, cp);
        const vel = scale(sub(tfApply(m1, local), cp), 1 / 0.001);
        out.push(makeContact(a, b, c, vel, bp, br, cp, dd, mat.r, mat.f, mat.v, kind, !!(mv.f[i]! & 2), [0, 0, 0], !!(mv.f[i]! & 1)));
      }
    });
  }
}

function makeContact(a: V3, b: V3, c: V3, vel: V3, bp: V3, br: number, cp: V3, dd: number, r: number, f: number, v: number, kind: Kind, isWater: boolean, waterDir: V3, oob: boolean): Contact {
  const tn = norm(cross(sub(b, a), sub(c, a)));
  return { a, b, c, kind, normal: kind === 'face' ? tn : norm(sub(bp, cp)), velocity: vel, restitution: r, friction: f, velScale: v, penetration: br - dd, distance: dd, isWater, waterDir, oob, ignored: false, cullDot: 0 };
}

function contactCmp(a: Contact, b: Contact): number {
  if (b.distance > a.distance) return -1;
  if (b.distance < a.distance) return 1;
  if (b.velScale > a.velScale) return 1;
  if (b.velScale < a.velScale) return -1;
  if (b.restitution > a.restitution) return -1;
  if (b.restitution < a.restitution) return 1;
  return 0;
}

// ---- a bola ----
export type GolfBallState = 'resting' | 'rolling' | 'dropping' | 'holed';
export interface GolfBall {
  pos: V3;
  vel: V3;
  moving: boolean;
  slowTime: number;
  rotVel: number;
  rotAxis: V3;
  inHole: boolean;
  /** Tempo (s) desde que a bola entrou no copo. */
  holeTime: number;
  /** A bola assentou no fundo do copo: agora vale como acerto. */
  holed: boolean;
  inWater: boolean;
  outOfBounds: boolean;
  /** Maior impulso do último passo e a velocidade dele (para o som). */
  impact: number;
  /** Houve contato com a borda do copo no último passo (som de aro). */
  rim: boolean;
}

export function golfNewBall(level: GolfLevelData): GolfBall {
  const s = level.ballStart;
  return { pos: [s[0], s[1] + GOLF_BALL_RADIUS, s[2]], vel: [0, 0, 0], moving: false, slowTime: 0, rotVel: 0, rotAxis: [0, 0, 0], inHole: false, holeTime: 0, holed: false, inWater: false, outOfBounds: false, impact: 0, rim: false };
}

/** Dá a tacada: `dir` é a direção no plano (x, z), `power` vai de 0 a 1. */
export function golfHit(ball: GolfBall, dir: [number, number], power: number): void {
  const d = norm([dir[0], 0, dir[1]]);
  ball.vel = scale(d, golfStrokeSpeed(power));
  ball.moving = true;
  ball.slowTime = 0;
  ball.outOfBounds = false;
}

/** Um passo de física (120 Hz). `time` é o relógio da fase (move as peças móveis). */
export function golfStep(level: GolfLevel, ball: GolfBall, time: number, dt = GOLF_DT): void {
  const d = level.data;
  const br = GOLF_BALL_RADIUS;
  let bp = ball.pos;
  let bv = ball.vel;
  const bs = len(bv);
  const bv0 = bv;

  let distToHole = Infinity;
  let dirToHole: V3 = [0, 0, 0];
  let holePos: V3 = [0, 0, 0];
  let closeHole = -1;
  d.holes.forEach((h, i) => {
    const dd = dist(h.p, bp);
    // melhoria: a bola dentro do copo (cilindro) continua "perto" ao descer; no original ela saía do alcance e atravessava o fundo
    const dxz = Math.hypot(h.p[0] - bp[0], h.p[2] - bp[2]);
    const below = h.p[1] - level.holeDepth[i]! - 0.2;
    if (dd <= h.r || (dxz <= h.r && bp[1] <= h.p[1] + 0.4 && bp[1] >= below)) closeHole = i;
    if (dd < distToHole) {
      distToHole = dd;
      dirToHole = norm(sub(h.p, bp));
      holePos = h.p;
    }
  });

  const contacts: Contact[] = [];
  if (closeHole >= 0) {
    const ht = d.holeTris[closeHole]!.concat(level.holeFloors[closeHole]!);
    const nWall = d.holeTris[closeHole]!.length;
    for (let i = 0; i < ht.length; i += 9) {
      const a: V3 = [ht[i]!, ht[i + 1]!, ht[i + 2]!], b: V3 = [ht[i + 3]!, ht[i + 4]!, ht[i + 5]!], c: V3 = [ht[i + 6]!, ht[i + 7]!, ht[i + 8]!];
      const { cp, kind } = closestPointTriangle(bp, a, b, c);
      const dd = dist(bp, cp);
      if (dd >= br) continue;
      let restitution: number, friction: number, velScale: number;
      if (kind === 'ab' || kind === 'ac' || kind === 'bc') {
        restitution = 0.4;
        if (bs > 2) { friction = 1; velScale = 0.95; } else { friction = 0; velScale = 1; }
      } else if (i >= nWall) { restitution = 0.3; friction = 0.6; velScale = 1; } else { restitution = 0.5; friction = 0.5; velScale = 1; }
      if (contacts.length < MAX_CONTACTS) contacts.push(makeContact(a, b, c, [0, 0, 0], bp, br, cp, dd, restitution, friction, velScale, kind, false, [0, 0, 0], false));
    }
    ball.rim = contacts.some((c) => c.kind !== 'face');
  } else {
    level.contacts(bp, br, time, contacts);
    ball.rim = false;
  }
  contacts.sort(contactCmp);

  // puxa a bola para o buraco, mais forte se estiver devagar (melhoria: a bola rápida não é sugada)
  if (distToHole < CFG.holeForceDistance && contacts.length > 0) {
    const k = bs < 3 ? 1 : Math.max(0, 1 - (bs - 3) / 4);
    bv = add(bv, scale(dirToHole, CFG.holeForce * k));
  }

  // filtro de contatos repetidos (borda e ponto já cobertos por uma face)
  const done: V3[] = [];
  for (const c of contacts) if (!c.ignored && c.kind === 'face') done.push(c.a, c.b, c.c);
  for (const c of contacts) {
    if (c.ignored || (c.kind !== 'ab' && c.kind !== 'ac' && c.kind !== 'bc')) continue;
    const [e0, e1] = c.kind === 'ab' ? [c.a, c.b] : c.kind === 'ac' ? [c.a, c.c] : [c.b, c.c];
    for (let j = 0; j < done.length; j += 3) {
      const a = done[j]!, b = done[j + 1]!, cc = done[j + 2]!;
      if (segmentsOnSameLine(a, b, e0, e1) || segmentsOnSameLine(a, cc, e0, e1) || segmentsOnSameLine(b, cc, e0, e1)) { c.ignored = true; break; }
    }
    done.push(c.a, c.b, c.c);
  }
  for (const c of contacts) {
    if (c.ignored || (c.kind !== 'a' && c.kind !== 'b' && c.kind !== 'c')) continue;
    const p = c.kind === 'a' ? c.a : c.kind === 'b' ? c.b : c.c;
    for (let j = 0; j + 2 < done.length; j++) {
      const a = done[j]!, b = done[j + 1]!, cc = done[j + 2]!;
      if (pointOnSegment(p, a, b) || pointOnSegment(p, a, cc) || pointOnSegment(p, b, cc)) { c.ignored = true; break; }
    }
    done.push(c.a, c.b, c.c);
  }

  let maxImp = 0;
  for (const c of contacts) {
    if (c.ignored || c.isWater) continue;
    const n = c.normal;
    const vr = sub(bv, c.velocity);
    c.cullDot = dot(n, norm(vr));
    if (c.cullDot > EPS) { c.ignored = true; continue; }
    const e = c.restitution;
    const imp = -(1 + e) * dot(vr, n);
    bv = add(bv, scale(n, imp));
    bv = scale(bv, c.velScale);
    ball.rotVel = len(bv) / (Math.PI * br);
    ball.rotAxis = norm(cross(n, bv));
    let t = sub(bv, scale(n, dot(bv, n)));
    if (len(t) > EPS) {
      t = norm(t);
      let jt = -dot(vr, t);
      if (Math.abs(jt) > EPS) {
        const fr = c.friction;
        if (jt > imp * fr) jt = imp * fr;
        else if (jt < -imp * fr) jt = -imp * fr;
        bv = add(bv, scale(t, jt));
      }
    }
    if (c.cullDot < -0.15 && imp > maxImp) maxImp = imp;
  }
  ball.impact = maxImp;

  bv = add(bv, [0, GRAVITY * dt, 0]);
  bp = add(bp, scale(bv, dt));
  for (const c of contacts) {
    if (c.ignored || c.isWater) continue;
    bp = add(bp, scale(c.normal, Math.max(c.penetration, 0) * 0.5));
  }

  ball.inWater = false;
  for (const c of contacts) {
    if (c.ignored || !c.isWater) continue;
    bv = add(bv, scale(sub(scale(c.waterDir, CFG.waterMaxSpeed), bv), CFG.waterSpeed * dt));
    ball.inWater = true;
  }

  if (len(bv) < 0.1) ball.slowTime += dt;
  else ball.slowTime = 0;
  if (!ball.moving && len(bv) > 0.1) ball.moving = true;
  if (ball.moving) {
    ball.pos = bp;
    ball.vel = bv;
    ball.rotVel -= dt * ball.rotVel * CFG.ballRotScale;
    if (ball.slowTime > 0.5) ball.moving = false;
  }
  void bv0;

  // o copo: entrou quando passa da borda para dentro; só vale o acerto quando assenta no fundo
  const inHoleP = add(holePos, CFG.inHoleDelta);
  if (!ball.inHole && dist(inHoleP, bp) < CFG.inHoleRadius) ball.inHole = true;
  // passou da borda para dentro do cilindro do copo: já é acerto, a bola não escapa mais
  if (!ball.inHole && closeHole >= 0) {
    const h = d.holes[closeHole]!;
    if (Math.hypot(h.p[0] - bp[0], h.p[2] - bp[2]) < h.r * 0.9 && bp[1] < h.p[1] - 0.05) ball.inHole = true;
  }
  if (ball.inHole && !ball.holed) {
    ball.holeTime += dt;
    const settled = ball.slowTime > 0.2 || ball.holeTime > 0.7;
    if (settled && ball.holeTime > 0.3) ball.holed = true;
  }

  // dentro do copo nada vale como fora: a bola que atravessa o fundo conta como acerto, não como perdida
  if (!ball.inHole) for (const c of contacts) if (c.oob && !c.ignored) ball.outOfBounds = true;
  if (ball.inHole && !ball.holed && closeHole < 0) ball.holed = true;
  if (ball.pos[1] < CFG.killY) ball.outOfBounds = ball.inHole ? false : true;
  if (ball.inHole && ball.pos[1] < CFG.killY) ball.holed = true;
}

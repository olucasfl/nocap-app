/**
 * Motor de física 2D do Block Towers (spec 022): corpos rígidos feitos de caixas orientadas,
 * colisão por eixo separador com recorte (a mesma ideia do Box2D-lite), impulsos sequenciais com
 * atrito e aquecimento a partir do quadro anterior. Só usa soma, subtração, multiplicação, divisão
 * e raiz quadrada, e roda em passo fixo, então o resultado é o mesmo em qualquer aparelho (o
 * servidor poderá refazer partidas no futuro). O eixo y cresce para baixo.
 */

/** Uma caixa de um corpo, com posição e giro locais (em relação ao centro de massa do corpo). */
export interface BoxDef {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  /** Cosseno e seno do giro local da caixa. */
  rc: number;
  rs: number;
  /** Marca livre da caixa (o jogo guarda a peça de origem, para pintar cada uma da sua cor). */
  tag?: number;
}

export interface Contact {
  px: number;
  py: number;
  nx: number;
  ny: number;
  sep: number;
  feature: number;
  r1x: number;
  r1y: number;
  r2x: number;
  r2y: number;
  pn: number;
  pt: number;
  massNormal: number;
  massTangent: number;
  bias: number;
}

export class Body {
  id = 0;
  x = 0;
  y = 0;
  c = 1;
  s = 0;
  vx = 0;
  vy = 0;
  w = 0;
  invM = 0;
  invI = 0;
  mass = 0;
  inertia = 0;
  isStatic = false;
  friction = 0.6;
  /** Controlado pela pessoa: sem gravidade e sem giro (a peça que desce). */
  held = false;
  /** Gravidade própria (1 = normal). */
  gravityScale = 1;
  boxes: BoxDef[] = [];
  /** Raio que envolve todas as caixas, a partir do centro de massa. */
  radius = 0;
  /** Dados do jogo (qual peça é, cor etc.). */
  data: Record<string, unknown> = {};

  /** Monta massa, centro de massa e inércia a partir das caixas (dadas em torno de qualquer origem). */
  setBoxes(boxes: BoxDef[], density = 1, makeStatic = false) {
    let m = 0;
    let mx = 0;
    let my = 0;
    for (const b of boxes) {
      const bm = 4 * b.hw * b.hh * density;
      m += bm;
      mx += bm * b.cx;
      my += bm * b.cy;
    }
    const comx = mx / m;
    const comy = my / m;
    this.boxes = boxes.map((b) => ({ ...b, cx: b.cx - comx, cy: b.cy - comy }));
    let inertia = 0;
    let radius = 0;
    for (const b of this.boxes) {
      const bm = 4 * b.hw * b.hh * density;
      inertia += (bm * (4 * b.hw * b.hw + 4 * b.hh * b.hh)) / 12 + bm * (b.cx * b.cx + b.cy * b.cy);
      radius = Math.max(radius, Math.sqrt(b.cx * b.cx + b.cy * b.cy) + Math.sqrt(b.hw * b.hw + b.hh * b.hh));
    }
    this.mass = m;
    this.inertia = inertia;
    this.radius = radius;
    this.isStatic = makeStatic;
    this.invM = makeStatic ? 0 : 1 / m;
    this.invI = makeStatic ? 0 : 1 / inertia;
    return { comx, comy };
  }

  makeStatic() {
    this.isStatic = true;
    this.invM = 0;
    this.invI = 0;
    this.vx = 0;
    this.vy = 0;
    this.w = 0;
  }
}

/** Posição e giro de uma caixa no mundo. */
interface Pose {
  x: number;
  y: number;
  c: number;
  s: number;
  hw: number;
  hh: number;
}

function poseOf(body: Body, box: BoxDef, out: Pose): Pose {
  out.x = body.x + body.c * box.cx - body.s * box.cy;
  out.y = body.y + body.s * box.cx + body.c * box.cy;
  out.c = body.c * box.rc - body.s * box.rs;
  out.s = body.s * box.rc + body.c * box.rs;
  out.hw = box.hw;
  out.hh = box.hh;
  return out;
}

// --- Colisão caixa x caixa (eixo separador + recorte) -----------------------------------------
const NO_EDGE = 0;
const EDGE1 = 1;
const EDGE2 = 2;
const EDGE3 = 3;
const EDGE4 = 4;

interface Feat {
  in1: number;
  out1: number;
  in2: number;
  out2: number;
}
interface ClipV {
  x: number;
  y: number;
  f: Feat;
}

const packFeature = (f: Feat) => ((f.in1 * 5 + f.out1) * 5 + f.in2) * 5 + f.out2;
const flipFeature = (f: Feat): Feat => ({ in1: f.in2, out1: f.out2, in2: f.in1, out2: f.out1 });
const cloneF = (f: Feat): Feat => ({ in1: f.in1, out1: f.out1, in2: f.in2, out2: f.out2 });

function incidentEdge(hx: number, hy: number, px: number, py: number, c: number, s: number, nx: number, ny: number): ClipV[] {
  // A normal vem da caixa de referência: passa para o quadro da caixa incidente e inverte o sinal.
  const lx = -(c * nx + s * ny);
  const ly = -(-s * nx + c * ny);
  const out: ClipV[] = [
    { x: 0, y: 0, f: { in1: 0, out1: 0, in2: 0, out2: 0 } },
    { x: 0, y: 0, f: { in1: 0, out1: 0, in2: 0, out2: 0 } },
  ];
  const [a, b] = out as [ClipV, ClipV];
  if (Math.abs(lx) > Math.abs(ly)) {
    if (lx > 0) {
      a.x = hx;
      a.y = -hy;
      a.f = { in1: NO_EDGE, out1: NO_EDGE, in2: EDGE3, out2: EDGE4 };
      b.x = hx;
      b.y = hy;
      b.f = { in1: NO_EDGE, out1: NO_EDGE, in2: EDGE4, out2: EDGE1 };
    } else {
      a.x = -hx;
      a.y = hy;
      a.f = { in1: NO_EDGE, out1: NO_EDGE, in2: EDGE1, out2: EDGE2 };
      b.x = -hx;
      b.y = -hy;
      b.f = { in1: NO_EDGE, out1: NO_EDGE, in2: EDGE2, out2: EDGE3 };
    }
  } else if (ly > 0) {
    a.x = hx;
    a.y = hy;
    a.f = { in1: NO_EDGE, out1: NO_EDGE, in2: EDGE4, out2: EDGE1 };
    b.x = -hx;
    b.y = hy;
    b.f = { in1: NO_EDGE, out1: NO_EDGE, in2: EDGE1, out2: EDGE2 };
  } else {
    a.x = -hx;
    a.y = -hy;
    a.f = { in1: NO_EDGE, out1: NO_EDGE, in2: EDGE2, out2: EDGE3 };
    b.x = hx;
    b.y = -hy;
    b.f = { in1: NO_EDGE, out1: NO_EDGE, in2: EDGE3, out2: EDGE4 };
  }
  for (const v of out) {
    const wx = px + c * v.x - s * v.y;
    const wy = py + s * v.x + c * v.y;
    v.x = wx;
    v.y = wy;
  }
  return out;
}

function clipSegment(vIn: ClipV[], nx: number, ny: number, offset: number, clipEdge: number): ClipV[] {
  const out: ClipV[] = [];
  const d0 = nx * vIn[0]!.x + ny * vIn[0]!.y - offset;
  const d1 = nx * vIn[1]!.x + ny * vIn[1]!.y - offset;
  if (d0 <= 0) out.push(vIn[0]!);
  if (d1 <= 0) out.push(vIn[1]!);
  if (d0 * d1 < 0) {
    const t = d0 / (d0 - d1);
    const a = vIn[0]!;
    const b = vIn[1]!;
    const v: ClipV = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), f: cloneF(d0 > 0 ? a.f : b.f) };
    if (d0 > 0) {
      v.f.in1 = clipEdge;
      v.f.in2 = NO_EDGE;
    } else {
      v.f.out1 = clipEdge;
      v.f.out2 = NO_EDGE;
    }
    out.push(v);
  }
  return out;
}

interface Hit {
  px: number;
  py: number;
  nx: number;
  ny: number;
  sep: number;
  feature: number;
}

/** Colide duas caixas. A normal sai de A para B. Devolve até 2 pontos de contato. */
export function collideBoxes(A: Pose, B: Pose): Hit[] {
  const dpx = B.x - A.x;
  const dpy = B.y - A.y;
  const dAx = A.c * dpx + A.s * dpy;
  const dAy = -A.s * dpx + A.c * dpy;
  const dBx = B.c * dpx + B.s * dpy;
  const dBy = -B.s * dpx + B.c * dpy;
  const cd = A.c * B.c + A.s * B.s;
  const sd = A.c * B.s - A.s * B.c;
  const acd = Math.abs(cd);
  const asd = Math.abs(sd);

  const faceAx = Math.abs(dAx) - A.hw - (acd * B.hw + asd * B.hh);
  const faceAy = Math.abs(dAy) - A.hh - (asd * B.hw + acd * B.hh);
  if (faceAx > 0 || faceAy > 0) return [];
  const faceBx = Math.abs(dBx) - (acd * A.hw + asd * A.hh) - B.hw;
  const faceBy = Math.abs(dBy) - (asd * A.hw + acd * A.hh) - B.hh;
  if (faceBx > 0 || faceBy > 0) return [];

  // A melhor face: A.x, A.y, B.x ou B.y (com uma folga que prefere as faces de A)
  const relTol = 0.95;
  const absTol = 0.01;
  let axis = 0;
  let separation = faceAx;
  let nx = dAx > 0 ? A.c : -A.c;
  let ny = dAx > 0 ? A.s : -A.s;
  if (faceAy > relTol * separation + absTol * A.hh) {
    axis = 1;
    separation = faceAy;
    nx = dAy > 0 ? -A.s : A.s;
    ny = dAy > 0 ? A.c : -A.c;
  }
  if (faceBx > relTol * separation + absTol * B.hw) {
    axis = 2;
    separation = faceBx;
    nx = dBx > 0 ? B.c : -B.c;
    ny = dBx > 0 ? B.s : -B.s;
  }
  if (faceBy > relTol * separation + absTol * B.hh) {
    axis = 3;
    separation = faceBy;
    nx = dBy > 0 ? -B.s : B.s;
    ny = dBy > 0 ? B.c : -B.c;
  }

  let frontNx: number;
  let frontNy: number;
  let front: number;
  let sideNx: number;
  let sideNy: number;
  let negSide: number;
  let posSide: number;
  let negEdge: number;
  let posEdge: number;
  let inc: ClipV[];
  if (axis === 0) {
    frontNx = nx;
    frontNy = ny;
    front = A.x * frontNx + A.y * frontNy + A.hw;
    sideNx = -A.s;
    sideNy = A.c;
    const side = A.x * sideNx + A.y * sideNy;
    negSide = -side + A.hh;
    posSide = side + A.hh;
    negEdge = EDGE3;
    posEdge = EDGE1;
    inc = incidentEdge(B.hw, B.hh, B.x, B.y, B.c, B.s, frontNx, frontNy);
  } else if (axis === 1) {
    frontNx = nx;
    frontNy = ny;
    front = A.x * frontNx + A.y * frontNy + A.hh;
    sideNx = A.c;
    sideNy = A.s;
    const side = A.x * sideNx + A.y * sideNy;
    negSide = -side + A.hw;
    posSide = side + A.hw;
    negEdge = EDGE2;
    posEdge = EDGE4;
    inc = incidentEdge(B.hw, B.hh, B.x, B.y, B.c, B.s, frontNx, frontNy);
  } else if (axis === 2) {
    frontNx = -nx;
    frontNy = -ny;
    front = B.x * frontNx + B.y * frontNy + B.hw;
    sideNx = -B.s;
    sideNy = B.c;
    const side = B.x * sideNx + B.y * sideNy;
    negSide = -side + B.hh;
    posSide = side + B.hh;
    negEdge = EDGE3;
    posEdge = EDGE1;
    inc = incidentEdge(A.hw, A.hh, A.x, A.y, A.c, A.s, frontNx, frontNy);
  } else {
    frontNx = -nx;
    frontNy = -ny;
    front = B.x * frontNx + B.y * frontNy + B.hh;
    sideNx = B.c;
    sideNy = B.s;
    const side = B.x * sideNx + B.y * sideNy;
    negSide = -side + B.hw;
    posSide = side + B.hw;
    negEdge = EDGE2;
    posEdge = EDGE4;
    inc = incidentEdge(A.hw, A.hh, A.x, A.y, A.c, A.s, frontNx, frontNy);
  }

  const clip1 = clipSegment(inc, -sideNx, -sideNy, negSide, negEdge);
  if (clip1.length < 2) return [];
  const clip2 = clipSegment(clip1, sideNx, sideNy, posSide, posEdge);
  if (clip2.length < 2) return [];

  const hits: Hit[] = [];
  for (const v of clip2) {
    const sep = frontNx * v.x + frontNy * v.y - front;
    if (sep <= 0) {
      hits.push({
        px: v.x - sep * frontNx,
        py: v.y - sep * frontNy,
        nx,
        ny,
        sep,
        feature: packFeature(axis >= 2 ? flipFeature(v.f) : v.f),
      });
    }
  }
  return hits;
}

// --- Mundo -------------------------------------------------------------------------------------
interface Arbiter {
  a: Body;
  b: Body;
  ia: number;
  ib: number;
  friction: number;
  contacts: Contact[];
  /** O contato é novo neste passo (para o som da batida). */
  fresh: boolean;
  /** A maior velocidade de aproximação vista no contato novo. */
  impact: number;
}

export interface PhysicsOptions {
  gravity: number;
  iterations: number;
  substeps: number;
}

export interface ImpactEvent {
  a: Body;
  b: Body;
  speed: number;
  x: number;
  y: number;
}

const BIAS = 0.2;
const SLOP = 0.01;

export class World {
  bodies: Body[] = [];
  private arbiters = new Map<string, Arbiter>();
  private nextId = 1;
  readonly gravity: number;
  readonly iterations: number;
  readonly substeps: number;
  /** Batidas novas deste passo (o jogo as usa para o som e a poeira). */
  impacts: ImpactEvent[] = [];
  private poseA: Pose = { x: 0, y: 0, c: 1, s: 0, hw: 0, hh: 0 };
  private poseB: Pose = { x: 0, y: 0, c: 1, s: 0, hw: 0, hh: 0 };

  constructor(opts: Partial<PhysicsOptions> = {}) {
    this.gravity = opts.gravity ?? 30;
    this.iterations = opts.iterations ?? 10;
    this.substeps = opts.substeps ?? 2;
  }

  add(body: Body): Body {
    body.id = this.nextId++;
    this.bodies.push(body);
    return body;
  }

  remove(body: Body) {
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
    for (const [k, arb] of this.arbiters) if (arb.a === body || arb.b === body) this.arbiters.delete(k);
  }

  /** Esquece os contatos guardados deste corpo (depois de mudar as caixas dele). */
  clearContacts(body: Body) {
    for (const [k, arb] of this.arbiters) if (arb.a === body || arb.b === body) this.arbiters.delete(k);
  }

  /** Os corpos que encostam neste agora (a menos de `gap` de distância), por geometria. */
  touching(body: Body, gap = 0.06): Body[] {
    const out: Body[] = [];
    for (const other of this.bodies) {
      if (other === body || other.held) continue;
      const dx = other.x - body.x;
      const dy = other.y - body.y;
      const r = other.radius + body.radius + gap * 2;
      if (!other.isStatic && dx * dx + dy * dy > r * r) continue;
      let hit = false;
      for (const ba of body.boxes) {
        const pa = poseOf(body, ba, { x: 0, y: 0, c: 1, s: 0, hw: 0, hh: 0 });
        pa.hw += gap;
        pa.hh += gap;
        for (const bb of other.boxes) {
          const pb = poseOf(other, bb, { x: 0, y: 0, c: 1, s: 0, hw: 0, hh: 0 });
          const dd = Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y);
          if (dd > pa.hw + pa.hh + pb.hw + pb.hh + 1) continue;
          if (collideBoxes(pa, pb).length > 0) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (hit) out.push(other);
    }
    return out;
  }

  /** Contatos de apoio por baixo (normal quase vertical) deste corpo: usado para saber se pousou. */
  restingOn(body: Body): boolean {
    for (const arb of this.arbiters.values()) {
      if (arb.a !== body && arb.b !== body) continue;
      for (const c of arb.contacts) {
        // A normal sai de A para B. Em y para baixo, "B embaixo de A" tem ny > 0.
        const ny = arb.a === body ? c.ny : -c.ny;
        if (ny > 0.6 && c.sep <= 0.05) return true;
      }
    }
    return false;
  }

  /** Alguma caixa deste corpo (na pose dada) penetra em outro corpo? Usado para validar giros. */
  overlaps(body: Body, tolerance = 0.12): boolean {
    for (const other of this.bodies) {
      if (other === body) continue;
      const dx = other.x - body.x;
      const dy = other.y - body.y;
      const r = other.radius + body.radius;
      if (!other.isStatic && dx * dx + dy * dy > r * r) continue;
      for (const ba of body.boxes) {
        const pa = poseOf(body, ba, { x: 0, y: 0, c: 1, s: 0, hw: 0, hh: 0 });
        for (const bb of other.boxes) {
          const pb = poseOf(other, bb, { x: 0, y: 0, c: 1, s: 0, hw: 0, hh: 0 });
          const dd = Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y);
          if (dd > pa.hw + pa.hh + pb.hw + pb.hh + 1) continue;
          for (const h of collideBoxes(pa, pb)) if (h.sep < -tolerance) return true;
        }
      }
    }
    return false;
  }

  step(dt: number) {
    this.impacts = [];
    const h = dt / this.substeps;
    for (let i = 0; i < this.substeps; i++) this.substep(h);
  }

  private collideAll() {
    const seen = new Set<string>();
    const bodies = this.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const A = bodies[i]!;
      for (let j = i + 1; j < bodies.length; j++) {
        const B = bodies[j]!;
        if (A.invM === 0 && B.invM === 0) continue;
        // A peça que a pessoa segura não colide no motor: ela se move por conta própria e para ao
        // encostar (ver `TowersGame.moveActive`), então nunca empurra a torre.
        if (A.held || B.held) continue;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const r = A.radius + B.radius + 0.1;
        // O chão é enorme: só testa se o centro estiver "perto" pelo raio (corpos estáticos grandes passam sempre)
        if (!(A.isStatic || B.isStatic) && dx * dx + dy * dy > r * r) continue;
        for (let ia = 0; ia < A.boxes.length; ia++) {
          const pa = poseOf(A, A.boxes[ia]!, this.poseA);
          for (let ib = 0; ib < B.boxes.length; ib++) {
            const pb = poseOf(B, B.boxes[ib]!, this.poseB);
            const dd = Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y);
            if (dd > pa.hw + pa.hh + pb.hw + pb.hh + 0.2) continue;
            const hits = collideBoxes(pa, pb);
            const key = `${A.id}:${ia}|${B.id}:${ib}`;
            seen.add(key);
            if (hits.length === 0) {
              this.arbiters.delete(key);
              continue;
            }
            this.updateArbiter(key, A, B, ia, ib, hits);
          }
        }
      }
    }
    for (const k of this.arbiters.keys()) if (!seen.has(k)) this.arbiters.delete(k);
  }

  private updateArbiter(key: string, A: Body, B: Body, ia: number, ib: number, hits: Hit[]) {
    const old = this.arbiters.get(key);
    const contacts: Contact[] = hits.map((h) => ({
      px: h.px,
      py: h.py,
      nx: h.nx,
      ny: h.ny,
      sep: h.sep,
      feature: h.feature,
      r1x: 0,
      r1y: 0,
      r2x: 0,
      r2y: 0,
      pn: 0,
      pt: 0,
      massNormal: 0,
      massTangent: 0,
      bias: 0,
    }));
    if (old) {
      for (const c of contacts) {
        const prev = old.contacts.find((o) => o.feature === c.feature);
        if (prev) {
          c.pn = prev.pn;
          c.pt = prev.pt;
        }
      }
    }
    let impact = 0;
    if (!old) {
      // Contato novo: a velocidade com que as caixas se aproximam é a batida.
      for (const c of contacts) {
        const r1x = c.px - A.x;
        const r1y = c.py - A.y;
        const r2x = c.px - B.x;
        const r2y = c.py - B.y;
        const dvx = B.vx - B.w * r2y - (A.vx - A.w * r1y);
        const dvy = B.vy + B.w * r2x - (A.vy + A.w * r1x);
        impact = Math.max(impact, -(dvx * c.nx + dvy * c.ny));
      }
    }
    const arb: Arbiter = {
      a: A,
      b: B,
      ia,
      ib,
      friction: Math.sqrt(A.friction * B.friction),
      contacts,
      fresh: !old,
      impact,
    };
    this.arbiters.set(key, arb);
    if (!old && impact > 0.8) {
      const c = contacts[0]!;
      this.impacts.push({ a: A, b: B, speed: impact, x: c.px, y: c.py });
    }
  }

  private substep(dt: number) {
    const invDt = 1 / dt;
    const g = this.gravity;
    for (const b of this.bodies) {
      if (b.invM === 0 || b.held) continue;
      b.vy += g * b.gravityScale * dt;
    }
    this.collideAll();

    // Pré-passo: massas efetivas, viés e aquecimento
    for (const arb of this.arbiters.values()) {
      const { a, b } = arb;
      for (const c of arb.contacts) {
        c.r1x = c.px - a.x;
        c.r1y = c.py - a.y;
        c.r2x = c.px - b.x;
        c.r2y = c.py - b.y;
        const rn1 = c.r1x * c.nx + c.r1y * c.ny;
        const rn2 = c.r2x * c.nx + c.r2y * c.ny;
        const kn =
          a.invM + b.invM + a.invI * (c.r1x * c.r1x + c.r1y * c.r1y - rn1 * rn1) + b.invI * (c.r2x * c.r2x + c.r2y * c.r2y - rn2 * rn2);
        c.massNormal = 1 / kn;
        const tx = c.ny;
        const ty = -c.nx;
        const rt1 = c.r1x * tx + c.r1y * ty;
        const rt2 = c.r2x * tx + c.r2y * ty;
        const kt =
          a.invM + b.invM + a.invI * (c.r1x * c.r1x + c.r1y * c.r1y - rt1 * rt1) + b.invI * (c.r2x * c.r2x + c.r2y * c.r2y - rt2 * rt2);
        c.massTangent = 1 / kt;
        c.bias = -BIAS * invDt * Math.min(0, c.sep + SLOP);
        // aquecimento
        const px = c.pn * c.nx + c.pt * tx;
        const py = c.pn * c.ny + c.pt * ty;
        a.vx -= a.invM * px;
        a.vy -= a.invM * py;
        a.w -= a.invI * (c.r1x * py - c.r1y * px);
        b.vx += b.invM * px;
        b.vy += b.invM * py;
        b.w += b.invI * (c.r2x * py - c.r2y * px);
      }
    }

    for (let it = 0; it < this.iterations; it++) {
      for (const arb of this.arbiters.values()) {
        const { a, b } = arb;
        for (const c of arb.contacts) {
          let dvx = b.vx - b.w * c.r2y - a.vx + a.w * c.r1y;
          let dvy = b.vy + b.w * c.r2x - a.vy - a.w * c.r1x;
          const vn = dvx * c.nx + dvy * c.ny;
          let dPn = c.massNormal * (-vn + c.bias);
          const pn0 = c.pn;
          c.pn = Math.max(pn0 + dPn, 0);
          dPn = c.pn - pn0;
          let px = dPn * c.nx;
          let py = dPn * c.ny;
          a.vx -= a.invM * px;
          a.vy -= a.invM * py;
          a.w -= a.invI * (c.r1x * py - c.r1y * px);
          b.vx += b.invM * px;
          b.vy += b.invM * py;
          b.w += b.invI * (c.r2x * py - c.r2y * px);

          dvx = b.vx - b.w * c.r2y - a.vx + a.w * c.r1y;
          dvy = b.vy + b.w * c.r2x - a.vy - a.w * c.r1x;
          const tx = c.ny;
          const ty = -c.nx;
          const vt = dvx * tx + dvy * ty;
          let dPt = c.massTangent * -vt;
          const maxPt = arb.friction * c.pn;
          const pt0 = c.pt;
          c.pt = Math.max(-maxPt, Math.min(maxPt, pt0 + dPt));
          dPt = c.pt - pt0;
          px = dPt * tx;
          py = dPt * ty;
          a.vx -= a.invM * px;
          a.vy -= a.invM * py;
          a.w -= a.invI * (c.r1x * py - c.r1y * px);
          b.vx += b.invM * px;
          b.vy += b.invM * py;
          b.w += b.invI * (c.r2x * py - c.r2y * px);
        }
      }
    }

    for (const b of this.bodies) {
      if (b.invM === 0 || b.held) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.invI === 0) continue;
      const damp = 1 / (1 + dt * 0.35);
      b.w *= damp;
      const th = b.w * dt;
      const t2 = th * th;
      const cd = 1 - t2 / 2 + (t2 * t2) / 24;
      const sd = th * (1 - t2 / 6 + (t2 * t2) / 120);
      const nc = b.c * cd - b.s * sd;
      const ns = b.s * cd + b.c * sd;
      const inv = 1 / Math.sqrt(nc * nc + ns * ns);
      b.c = nc * inv;
      b.s = ns * inv;
    }
  }
}

/** Funde corpos soltos num só (a vinha): vira um corpo rígido com as caixas de todos. */
export function mergeBodies(world: World, bodies: Body[], friction = 0.6): Body {
  const boxes: BoxDef[] = [];
  let m = 0;
  let mvx = 0;
  let mvy = 0;
  for (const b of bodies) {
    m += b.mass;
    mvx += b.mass * b.vx;
    mvy += b.mass * b.vy;
    for (const box of b.boxes) {
      const p = poseOf(b, box, { x: 0, y: 0, c: 1, s: 0, hw: 0, hh: 0 });
      boxes.push({ cx: p.x, cy: p.y, hw: box.hw, hh: box.hh, rc: p.c, rs: p.s, tag: box.tag });
    }
  }
  const merged = new Body();
  merged.friction = friction;
  const { comx, comy } = merged.setBoxes(boxes);
  merged.x = comx;
  merged.y = comy;
  merged.vx = mvx / m;
  merged.vy = mvy / m;
  merged.w = 0;
  for (const b of bodies) world.remove(b);
  world.add(merged);
  return merged;
}

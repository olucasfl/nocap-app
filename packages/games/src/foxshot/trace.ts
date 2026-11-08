import { fsDamage, type FsDamage, type FsZone } from './damage';
import { fsBoxesAlongRay, type FsBox } from './map';
import type { FsWeapon } from './weapons';

export type Vec3 = [number, number, number];

/** Alvo para o raio: raposa de pé (pés em `pos`). */
export interface FsBody {
  id: string;
  pos: Vec3;
  alive: boolean;
  armor: number;
  helmet: boolean;
  /** Agachado (0 de pé, 1 agachado): a cabeça e o corpo descem junto com a raposa. */
  crouch?: number;
  /** Para onde olha no plano (x, z): usado pela facada nas costas. */
  facing?: [number, number];
}

/** Medidas da raposa (m): cabeça é esfera; corpo, três cilindros verticais. */
/** Quanto o corpo encolhe agachado (altura 0,95 m contra 1,3 m de pé). */
export const FS_CROUCH_K = 0.95 / 1.3;
export const FS_BODY = { headY: 1.17, headR: 0.15, chestY0: 0.76, chestY1: 1.04, chestR: 0.22, bellyY0: 0.5, bellyY1: 0.76, bellyR: 0.2, legR: 0.16, top: 1.4 };

/** Entra/sai de uma caixa pelo método das lâminas; devolve null se o raio não encontra. */
function rayBox(o: Vec3, d: Vec3, box: FsBox, maxT: number): { t0: number; t1: number } | null {
  let t0 = 0;
  let t1 = maxT;
  for (let i = 0; i < 3; i++) {
    const di = d[i]!;
    if (Math.abs(di) < 1e-9) {
      if (o[i]! < box.min[i]! || o[i]! > box.max[i]!) return null;
    } else {
      let a = (box.min[i]! - o[i]!) / di;
      let b = (box.max[i]! - o[i]!) / di;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) return null;
    }
  }
  return { t0, t1 };
}

function raySphere(o: Vec3, d: Vec3, c: Vec3, r: number): number | null {
  const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : cc <= 0 ? 0 : null;
}

/** Cilindro vertical (eixo Y) entre y0 e y1: primeira interseção com a lateral. */
function rayCyl(o: Vec3, d: Vec3, cx: number, cz: number, r: number, y0: number, y1: number): number | null {
  const ox = o[0] - cx, oz = o[2] - cz;
  const a = d[0] * d[0] + d[2] * d[2];
  if (a < 1e-12) return null;
  const b = ox * d[0] + oz * d[2];
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  for (const t of [(-b - sq) / a, (-b + sq) / a]) {
    if (t < 0) continue;
    const y = o[1] + d[1] * t;
    if (y >= y0 && y <= y1) return t;
  }
  return null;
}

/** Primeira região do corpo que o raio toca, com a distância. */
export function fsRayBody(o: Vec3, d: Vec3, body: FsBody, maxT: number): { t: number; zone: FsZone } | null {
  const [x, y, z] = body.pos;
  // agachado: tudo desce na mesma proporção (a esfera da cabeça mantém o tamanho)
  const k = 1 + ((body.crouch ?? 0) * (FS_CROUCH_K - 1));
  const H = (v: number) => v * k;
  const cands: { t: number; zone: FsZone }[] = [];
  const th = raySphere(o, d, [x, y + H(FS_BODY.headY), z], FS_BODY.headR);
  if (th !== null) cands.push({ t: th, zone: 'head' });
  const tc = rayCyl(o, d, x, z, FS_BODY.chestR, y + H(FS_BODY.chestY0), y + H(FS_BODY.chestY1));
  if (tc !== null) cands.push({ t: tc, zone: 'chest' });
  const tb = rayCyl(o, d, x, z, FS_BODY.bellyR, y + H(FS_BODY.bellyY0), y + H(FS_BODY.bellyY1));
  if (tb !== null) cands.push({ t: tb, zone: 'belly' });
  const tl = rayCyl(o, d, x, z, FS_BODY.legR, y, y + H(FS_BODY.bellyY0));
  if (tl !== null) cands.push({ t: tl, zone: 'legs' });
  const best = cands.filter((c) => c.t <= maxT).sort((a, b) => a.t - b.t)[0];
  return best ?? null;
}

export interface FsTrace {
  kind: 'player' | 'world' | 'none';
  point: Vec3;
  dist: number;
  /** Fração do dano que sobrou depois de atravessar paredes. */
  wall: number;
  targetId?: string;
  zone?: FsZone;
  damage?: FsDamage;
}

/**
 * Tiro instantâneo (hitscan): anda o raio pelas caixas e corpos em ordem. Parede maciça para o tiro; madeira fina deixa passar
 * com dano reduzido (`pen × poder de penetração da arma`). O primeiro corpo vivo atingido recebe o dano.
 */
export function fsTrace(w: FsWeapon, o: Vec3, d: Vec3, boxes: readonly FsBox[], bodies: readonly FsBody[], maxDist = 200): FsTrace {
  type Ev = { t: number; kind: 'box'; box: FsBox } | { t: number; kind: 'body'; body: FsBody; zone: FsZone };
  const evs: Ev[] = [];
  // mapas grandes: só as caixas na faixa do raio
  const reach = fsBoxesAlongRay(boxes, o[0], o[2], d[0], d[2], maxDist);
  for (const box of reach) {
    const h = rayBox(o, d, box, maxDist);
    if (h && h.t0 > 1e-6) evs.push({ t: h.t0, kind: 'box', box });
  }
  for (const body of bodies) {
    if (!body.alive) continue;
    const h = fsRayBody(o, d, body, maxDist);
    if (h) evs.push({ t: h.t, kind: 'body', body, zone: h.zone });
  }
  // o chão (y = 0)
  let tGround = maxDist;
  if (d[1] < -1e-9) tGround = Math.min(maxDist, -o[1] / d[1]);
  evs.sort((a, b) => a.t - b.t);
  let wall = 1;
  const at = (t: number): Vec3 => [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
  for (const e of evs) {
    if (e.t > tGround) break;
    if (e.kind === 'box') {
      const pass = e.box.pen * w.penPower;
      if (e.box.pen <= 0 || pass <= 0) return { kind: 'world', point: at(e.t), dist: e.t, wall };
      wall *= Math.min(1, pass);
    } else {
      const dmg = fsDamage(w, { zone: e.zone, dist: e.t, armor: e.body.armor, helmet: e.body.helmet, wall });
      return { kind: 'player', point: at(e.t), dist: e.t, wall, targetId: e.body.id, zone: e.zone, damage: dmg };
    }
  }
  if (tGround < maxDist) return { kind: 'world', point: at(tGround), dist: tGround, wall };
  return { kind: 'none', point: at(maxDist), dist: maxDist, wall };
}

/** Direção a partir de yaw/pitch (graus): X para a frente quando yaw = 0, Z positivo para trás da câmera padrão. */
export function fsDir(yawDeg: number, pitchDeg: number): Vec3 {
  const y = (yawDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  const c = Math.cos(p);
  // yaw 0 olha para -Z (como a câmera do Three.js); yaw positivo gira para a esquerda
  return [-Math.sin(y) * c, Math.sin(p), -Math.cos(y) * c];
}

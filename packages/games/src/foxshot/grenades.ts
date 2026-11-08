import { fsTrace, type Vec3 } from './trace';
import { FS_WEAPONS } from './weapons';
import { fsBoxesInRect, type FsBox } from './map';

export type FsGrenadeId = 'frag' | 'flash';

/** Granadas: explosiva (dano em área) e de luz (cega e ensurdece). Tempos em s, distâncias em m. */
export const FS_GRENADES: Record<FsGrenadeId, { name: string; fuse: number; radius: number; max: number; maxDamage: number }> = {
  frag: { name: 'Granada explosiva', fuse: 1.6, radius: 9, max: 2, maxDamage: 98 },
  flash: { name: 'Granada de luz', fuse: 1.5, radius: 22, max: 2, maxDamage: 0 },
};

export interface FsGrenadeBody {
  kind: FsGrenadeId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Tempo de voo (s); explode quando passa de `fuse`. */
  age: number;
  fuse: number;
  bounces: number;
}

const G_RADIUS = 0.07;
const GRAVITY = 17;

/**
 * Lança a granada de `pos` na direção `dir` (unitária). `power` vai de 0 a 1: o clique rápido sai com força média; segurar e soltar
 * lança mais forte. A velocidade de quem joga soma, e a granada sai levemente para cima.
 */
export function fsGrenadeLaunch(kind: FsGrenadeId, pos: Vec3, dir: Vec3, power: number, carry: [number, number] = [0, 0]): FsGrenadeBody {
  const p = Math.min(1, Math.max(0, power));
  const speed = 5 + 14 * p;
  return {
    kind,
    x: pos[0],
    y: pos[1],
    z: pos[2],
    vx: dir[0] * speed + carry[0] * 0.5,
    vy: dir[1] * speed + 2.2 + 2.2 * p,
    vz: dir[2] * speed + carry[1] * 0.5,
    age: 0,
    fuse: FS_GRENADES[kind].fuse,
    bounces: 0,
  };
}

/** Um passo do voo: gravidade, quique nas caixas e no chão (perde força a cada quique). Devolve true quando chega a hora de explodir. */
export function fsGrenadeStep(g: FsGrenadeBody, dt: number, boxes: readonly FsBox[]): boolean {
  g.age += dt;
  g.vy -= GRAVITY * dt;
  const hits = (x: number, y: number, z: number) =>
    fsBoxesInRect(boxes, x - 1, z - 1, x + 1, z + 1).find((b) => x > b.min[0] - G_RADIUS && x < b.max[0] + G_RADIUS && y > b.min[1] - G_RADIUS && y < b.max[1] + G_RADIUS && z > b.min[2] - G_RADIUS && z < b.max[2] + G_RADIUS);
  // x
  let nx = g.x + g.vx * dt;
  if (hits(nx, g.y, g.z)) {
    g.vx *= -0.45;
    g.vz *= 0.85;
    g.bounces++;
    nx = g.x;
  }
  g.x = nx;
  // z
  let nz = g.z + g.vz * dt;
  if (hits(g.x, g.y, nz)) {
    g.vz *= -0.45;
    g.vx *= 0.85;
    g.bounces++;
    nz = g.z;
  }
  g.z = nz;
  // y (chão e topo de caixas)
  let ny = g.y + g.vy * dt;
  const hb = hits(g.x, ny, g.z);
  if (hb || ny < G_RADIUS) {
    const floor = hb ? hb.max[1] + G_RADIUS : G_RADIUS;
    if (g.vy < 0) {
      ny = floor;
      g.vy *= -0.4;
      g.vx *= 0.8;
      g.vz *= 0.8;
      g.bounces++;
      if (Math.abs(g.vy) < 0.7) g.vy = 0;
    } else {
      g.vy *= -0.3;
      ny = g.y;
    }
  }
  g.y = ny;
  return g.age >= g.fuse;
}

/** Dano da explosão por distância ao centro: cheio no centro (98, como a HE do CS:GO), cai em linha reta até 0 na borda do raio (9 m). */
export function fsFragDamage(dist: number, radius = FS_GRENADES.frag.radius, max = FS_GRENADES.frag.maxDamage): number {
  if (dist >= radius) return 0;
  return Math.max(0, Math.round(max * (1 - dist / radius)));
}

/** Há linha livre (sem parede) entre os dois pontos? Usa o mesmo raio dos tiros, sem poder de penetração. */
export function fsClearLine(boxes: readonly FsBox[], from: Vec3, to: Vec3): boolean {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-6) return true;
  const t = fsTrace({ ...FS_WEAPONS.ak, penPower: 0 }, from, [dx / d, dy / d, dz / d], boxes, [], d);
  return t.kind === 'none';
}

export interface FsFlashResult {
  /** Segundos de tela branca (cega). */
  blind: number;
  /** Segundos de zumbido nos ouvidos. */
  deaf: number;
}

/**
 * O que a granada de luz faz em quem está em `eye` olhando para `dir`: só cega se enxerga a granada (linha livre) e olha para
 * ela (de costas não cega); quem não vê só ouve o estouro e fica um pouco zonzo. Perto cega mais; o efeito vai passando aos poucos.
 */
export function fsFlashEffect(eye: Vec3, dir: Vec3, flash: Vec3, clear: boolean, radius = FS_GRENADES.flash.radius): FsFlashResult {
  const dx = flash[0] - eye[0];
  const dy = flash[1] - eye[1];
  const dz = flash[2] - eye[2];
  const d = Math.hypot(dx, dy, dz);
  if (d > radius) return { blind: 0, deaf: 0 };
  const near = 1 - d / radius;
  const cos = d < 1e-6 ? 1 : (dx * dir[0] + dy * dir[1] + dz * dir[2]) / d;
  // olhando de frente (até ~70 graus) cega por inteiro; de lado (periferia) só um pouco; de costas não cega
  const face = cos >= 0.34 ? 1 : cos >= -0.2 ? 0.3 : 0;
  const blind = clear ? 4.6 * face * (0.3 + 0.7 * near) : 0;
  const deaf = (clear || d < 9) ? 6 * (0.25 + 0.75 * near) : 1.2 * near;
  return { blind: Math.round(blind * 100) / 100, deaf: Math.round(deaf * 100) / 100 };
}

/** Força do arremesso como no CS: botão esquerdo lança longe (1), o direito joga perto por baixo (0,22), os dois juntos média distância. */
export function fsThrowPower(style: 'far' | 'mid' | 'near'): number {
  return style === 'far' ? 1 : style === 'mid' ? 0.55 : 0.1;
}

import type { Shape } from './geometry';

/** Tamanhos de colisão lidos dos prefabs do Slash (nó raiz com escala 2: tamanho e deslocamento já multiplicados por 2). */
export interface NhBoxDef {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

export const ENEMY_BOX: Record<string, NhBoxDef> = {
  Barbarian: { w: 44, h: 50.2, ox: 0, oy: 0.8 },
  Bat: { w: 38.8, h: 21.4, ox: -0.8, oy: 7.6 },
  BossOrcKing: { w: 83.8, h: 87, ox: 2.2, oy: -12 },
  BossStoneGolem: { w: 89.8, h: 100.2, ox: -1.8, oy: -5.4 },
  DarkRaven: { w: 55.8, h: 74, ox: 0, oy: 0 },
  FlyWorm: { w: 44.4, h: 32.6, ox: -3.2, oy: 6.8 },
  Goblin: { w: 54, h: 54.8, ox: 0, oy: 0 },
  Runner: { w: 56, h: 40.4, ox: 0, oy: 0 },
  Shark: { w: 70.8, h: 66.4, ox: 0, oy: 0 },
  Skeleton: { w: 44, h: 60, ox: 0, oy: 0 },
};

/** Colisor do jogador (escala 1). */
export const PLAYER_BOX: NhBoxDef = { w: 37.3, h: 49.9, ox: 0.3, oy: 2.1 };

/** Os 6 colisores da espada (escala 2): comprimento e deslocamento já ao dobro. A espada gira em torno de (0, 4). */
export const SWORD_BOXES: readonly NhBoxDef[] = [
  { w: 60, h: 20, ox: -59.8, oy: 0 },
  { w: 80, h: 20, ox: -70, oy: 0 },
  { w: 100, h: 20, ox: -80, oy: 0 },
  { w: 120, h: 20, ox: -90, oy: 0 },
  { w: 140, h: 20, ox: -100, oy: 0 },
  { w: 160, h: 20, ox: -110, oy: 0 },
];
export const SWORD_PIVOT_Y = 4;
export const SWORD_ANIM_DURATION = 1.3;

/** Rotação da espada (graus) pela animação do Slash: segura em 170 até 0,4667 s, gira até 363,1 em 1 s e termina em 370 (Hermite). */
export function swordAngleDeg(t: number): number {
  const k = [
    { t: 0, v: 170, m: 0 },
    { t: 0.4666666666666667, v: 170, m: 54.7520637512207 },
    { t: 1, v: 363.0973205566406, m: 262.77978515625, ml: 372.1603698730469 },
    { t: 1.3, v: 370, m: 0, ml: 0 },
  ];
  if (t <= 0.4666666666666667) return 170;
  if (t >= 1.3) return 370;
  const i = t < 1 ? 1 : 2;
  const a = k[i]!;
  const b = k[i + 1]!;
  const dt = b.t - a.t;
  const s = (t - a.t) / dt;
  const m0 = a.m * dt;
  const m1 = (b.ml ?? 0) * dt;
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * a.v + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b.v + (s3 - s2) * m1
  );
}

export interface NhItemDef {
  shape: 'circle' | 'box';
  r?: number;
  w?: number;
  h?: number;
  ox: number;
  oy: number;
}
export type ItemType = 'xp' | 'gold' | 'health' | 'magnet' | 'chest';
export const ITEM_SHAPES: Record<ItemType, NhItemDef> = {
  xp: { shape: 'circle', r: 16, ox: 0, oy: 0 },
  gold: { shape: 'box', w: 36, h: 40, ox: 0, oy: 8 },
  health: { shape: 'circle', r: 16, ox: 1, oy: -6.8 },
  magnet: { shape: 'circle', r: 16, ox: 0, oy: 0 },
  chest: { shape: 'box', w: 36, h: 36, ox: 2.2, oy: 0 },
};
export const MAGNET_RADIUS = 260;
export const ITEM_ATTRACT_ACCEL = 100;

export type ProjectileKind = 'horizontal' | 'diagonal' | 'halo' | 'axe' | 'orb';
export const PROJECTILE_SHAPE: Record<
  ProjectileKind,
  (x: number, y: number, rot: number) => Shape
> = {
  horizontal: (x, y) => ({ kind: 'circle', cx: x, cy: y, r: 26 }),
  diagonal: (x, y) => ({ kind: 'circle', cx: x, cy: y, r: 26 }),
  halo: (x, y, rot) => ({ kind: 'box', cx: x, cy: y, w: 16, h: 8, rot }),
  axe: (x, y) => ({ kind: 'box', cx: x, cy: y, w: 25.2, h: 25.2 }),
  orb: (x, y) => ({ kind: 'box', cx: x, cy: y, w: 16, h: 16 }),
};

export const VIEW_WIDTH = 510;
export const VIEW_HEIGHT = 680;

export type UpgradeId =
  'weaponLength' | 'weaponDamage' | 'horizontal' | 'diagonal' | 'halo' | 'regeneration';
export const UPGRADE_IDS: readonly UpgradeId[] = [
  'weaponLength',
  'weaponDamage',
  'horizontal',
  'diagonal',
  'halo',
  'regeneration',
];

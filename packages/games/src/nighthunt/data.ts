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
/** Objetos quebráveis do cenário: uma grade de células, cada uma com chance de ter um objeto (hash da seed). */
export const BREAKABLE_CELL = 420;
export const BREAKABLE_CHANCE = 0.62;
export const BREAKABLE_HP = 3;
export const BREAKABLE_RADIUS = 22;
export const ITEM_ATTRACT_ACCEL = 100;

export type ProjectileKind =
  | 'horizontal'
  | 'halo'
  | 'axe'
  | 'orb'
  | 'pAxe'
  | 'wand'
  | 'cross'
  | 'bone'
  | 'rune'
  | 'bomb'
  | 'spark';
export const PROJECTILE_SHAPE: Record<
  ProjectileKind,
  (x: number, y: number, rot: number, big?: boolean) => Shape
> = {
  horizontal: (x, y) => ({ kind: 'circle', cx: x, cy: y, r: 26 }),
  halo: (x, y, rot) => ({ kind: 'box', cx: x, cy: y, w: 16, h: 8, rot }),
  axe: (x, y) => ({ kind: 'box', cx: x, cy: y, w: 25.2, h: 25.2 }),
  orb: (x, y) => ({ kind: 'box', cx: x, cy: y, w: 16, h: 16 }),
  pAxe: (x, y, _rot, big) => ({ kind: 'circle', cx: x, cy: y, r: big ? 36 : 24 }),
  wand: (x, y, _rot, big) => ({ kind: 'circle', cx: x, cy: y, r: big ? 16 : 12 }),
  cross: (x, y, _rot, big) => ({ kind: 'circle', cx: x, cy: y, r: big ? 30 : 22 }),
  bone: (x, y) => ({ kind: 'circle', cx: x, cy: y, r: 16 }),
  rune: (x, y, _rot, big) => ({ kind: 'circle', cx: x, cy: y, r: big ? 28 : 20 }),
  bomb: (x, y) => ({ kind: 'circle', cx: x, cy: y, r: 8 }),
  spark: (x, y) => ({ kind: 'circle', cx: x, cy: y, r: 10 }),
};

export const VIEW_WIDTH = 510;
export const VIEW_HEIGHT = 680;

export type UpgradeId =
  | 'whip'
  | 'wand'
  | 'garlic'
  | 'magma'
  | 'embers'
  | 'cross'
  | 'bone'
  | 'runes'
  | 'pentagram'
  | 'bomb'
  | 'duration'
  | 'amount'
  | 'curse'
  | 'sword'
  | 'growth'
  | 'greed'
  | 'swift'
  | 'weaponLength'
  | 'weaponDamage'
  | 'horizontal'
  | 'halo'
  | 'regeneration'
  | 'axe'
  | 'orbit'
  | 'lightning'
  | 'armor'
  | 'boots'
  | 'magnet'
  | 'heart'
  | 'clover'
  | 'tome';
export const UPGRADE_IDS: readonly UpgradeId[] = [
  'whip',
  'wand',
  'garlic',
  'magma',
  'embers',
  'cross',
  'bone',
  'runes',
  'pentagram',
  'bomb',
  'duration',
  'amount',
  'curse',
  'sword',
  'growth',
  'greed',
  'swift',
  'weaponLength',
  'weaponDamage',
  'horizontal',
  'halo',
  'axe',
  'orbit',
  'lightning',
  'regeneration',
  'armor',
  'boots',
  'magnet',
  'heart',
  'clover',
  'tome',
];
/** Armas (a espada conta como uma só: Lâmina Longa e Lâmina Afiada) e passivos, como nos slots do Vampire Survivors. */
export const WEAPON_IDS: readonly UpgradeId[] = [
  'sword',
  'horizontal',
  'halo',
  'axe',
  'orbit',
  'lightning',
  'whip',
  'wand',
  'garlic',
  'magma',
  'embers',
  'cross',
  'bone',
  'runes',
  'pentagram',
  'bomb',
];
/** Passivos: só beneficiam (dano, alcance, vida, velocidade...), nunca atacam. Os globais valem para todas as armas. */
export const PASSIVE_IDS: readonly UpgradeId[] = [
  'weaponDamage',
  'weaponLength',
  'regeneration',
  'armor',
  'boots',
  'magnet',
  'heart',
  'clover',
  'tome',
  'growth',
  'greed',
  'swift',
  'duration',
  'amount',
  'curse',
];
export const MAX_WEAPON_SLOTS = 6;
export const MAX_PASSIVE_SLOTS = 6;
export const UPGRADE_MAX: Record<UpgradeId, number> = {
  whip: 6,
  wand: 6,
  garlic: 6,
  magma: 6,
  embers: 6,
  cross: 6,
  bone: 6,
  runes: 6,
  pentagram: 6,
  bomb: 6,
  duration: 5,
  amount: 2,
  curse: 5,
  sword: 6,
  growth: 5,
  greed: 5,
  swift: 5,
  weaponLength: 5,
  weaponDamage: 5,
  horizontal: 6,
  halo: 6,
  regeneration: 6,
  axe: 6,
  orbit: 6,
  lightning: 6,
  armor: 5,
  boots: 5,
  magnet: 5,
  heart: 5,
  clover: 5,
  tome: 5,
};
/** Identificador do "espaço" que o item ocupa (a espada é um espaço só). */
export const slotOf = (id: UpgradeId): string => id;

export type EvoId =
  | 'evoHorizontal'
  | 'evoHalo'
  | 'evoAxe'
  | 'evoOrbit'
  | 'evoLightning'
  | 'evoSword'
  | 'evoWhip'
  | 'evoWand'
  | 'evoGarlic'
  | 'evoMagma'
  | 'evoEmbers'
  | 'evoCross'
  | 'evoBone'
  | 'evoRunes'
  | 'evoPentagram'
  | 'evoBomb';
export type ChoiceId = UpgradeId | EvoId;
export interface Evolution {
  id: EvoId;
  /** Itens que precisam estar no nível máximo. */
  maxed: UpgradeId[];
  /** Passivo exigido (qualquer nível). */
  passive: UpgradeId;
}
/** Arma no máximo + passivo certo + abrir um baú = evolução (regra do Vampire Survivors). */
export const EVOLUTIONS: readonly Evolution[] = [
  { id: 'evoHorizontal', maxed: ['horizontal'], passive: 'boots' },
  { id: 'evoHalo', maxed: ['halo'], passive: 'heart' },
  { id: 'evoAxe', maxed: ['axe'], passive: 'armor' },
  { id: 'evoOrbit', maxed: ['orbit'], passive: 'magnet' },
  { id: 'evoLightning', maxed: ['lightning'], passive: 'clover' },
  { id: 'evoSword', maxed: ['sword'], passive: 'weaponDamage' },
  { id: 'evoWhip', maxed: ['whip'], passive: 'heart' },
  { id: 'evoWand', maxed: ['wand'], passive: 'tome' },
  { id: 'evoGarlic', maxed: ['garlic'], passive: 'regeneration' },
  { id: 'evoMagma', maxed: ['magma'], passive: 'magnet' },
  { id: 'evoEmbers', maxed: ['embers'], passive: 'swift' },
  { id: 'evoCross', maxed: ['cross'], passive: 'clover' },
  { id: 'evoBone', maxed: ['bone'], passive: 'armor' },
  { id: 'evoRunes', maxed: ['runes'], passive: 'duration' },
  { id: 'evoPentagram', maxed: ['pentagram'], passive: 'growth' },
  { id: 'evoBomb', maxed: ['bomb'], passive: 'amount' },
];

export interface HeroDef {
  id: string;
  hp: number;
  speed: number;
  damage: number;
  cooldown: number;
  armor: number;
  gold: number;
  xp: number;
  /** Arma inicial (no lugar da Espada, que só o Kael tem). */
  start?: UpgradeId;
  /** Giro de matiz (graus) aplicado aos sprites do guerreiro para diferenciar os heróis. */
  hue: number;
  /** Preço em ouro para liberar. */
  price: number;
  /** Só o Kael começa com a Espada; os outros começam com a arma própria. */
  sword?: boolean;
  /** Bônus próprios: velocidade de projétil, duração e alcance de atração (fração). */
  swift?: number;
  dur?: number;
  attract?: number;
}
export const HEROES: Record<string, HeroDef> = {
  kael: {
    id: 'kael',
    hp: 1,
    speed: 1,
    damage: 1,
    cooldown: 1,
    armor: 0,
    gold: 1,
    xp: 1.2,
    hue: 0,
    price: 0,
    sword: true,
  },
  vesper: {
    id: 'vesper',
    hp: 1.2,
    speed: 1,
    damage: 1.05,
    cooldown: 1,
    armor: 0,
    gold: 1,
    xp: 1,
    start: 'whip',
    hue: 330,
    price: 300,
  },
  mara: {
    id: 'mara',
    hp: 0.9,
    speed: 1,
    damage: 1,
    cooldown: 1,
    armor: 0,
    gold: 1,
    xp: 1,
    start: 'wand',
    hue: 300,
    price: 900,
    swift: 0.15,
  },
  brann: {
    id: 'brann',
    hp: 1.25,
    speed: 0.92,
    damage: 1,
    cooldown: 1,
    armor: 0,
    gold: 1,
    xp: 1,
    start: 'garlic',
    hue: 110,
    price: 1200,
  },
  dorian: {
    id: 'dorian',
    hp: 1,
    speed: 1,
    damage: 1,
    cooldown: 1,
    armor: 0,
    gold: 1,
    xp: 1,
    start: 'magma',
    hue: 20,
    price: 2000,
    dur: 0.15,
    attract: 0.2,
  },
  selene: {
    id: 'selene',
    hp: 0.85,
    speed: 1,
    damage: 1.12,
    cooldown: 1,
    armor: 0,
    gold: 1,
    xp: 1,
    start: 'embers',
    hue: 170,
    price: 3000,
  },
  ysolde: {
    id: 'ysolde',
    hp: 0.8,
    speed: 1,
    damage: 1,
    cooldown: 0.88,
    armor: 0,
    gold: 1,
    xp: 1,
    start: 'lightning',
    hue: 250,
    price: 3600,
  },
  rurik: {
    id: 'rurik',
    hp: 1.1,
    speed: 1,
    damage: 1.18,
    cooldown: 1,
    armor: 0,
    gold: 1.15,
    xp: 1,
    start: 'axe',
    hue: 40,
    price: 4200,
  },
};
export const HERO_IDS = Object.keys(HEROES);

export interface MapDef {
  id: string;
  enemyHp: number;
  enemySpeed: number;
  gold: number;
  xp: number;
  /** Cor do chão (r, g, b). */
  ground: [number, number, number];
  /** Matiz e saturação aplicados à decoração do fundo. */
  hue: number;
}
export const MAPS: Record<string, MapDef> = {
  campo: { id: 'campo', enemyHp: 1, enemySpeed: 1, gold: 1, xp: 1, ground: [75, 109, 59], hue: 0 },
  deserto: {
    id: 'deserto',
    enemyHp: 1,
    enemySpeed: 1.1,
    gold: 1.3,
    xp: 1,
    ground: [156, 126, 76],
    hue: 70,
  },
  gelo: {
    id: 'gelo',
    enemyHp: 1.25,
    enemySpeed: 1,
    gold: 1,
    xp: 1.2,
    ground: [150, 178, 196],
    hue: 190,
  },
};
/** Mapas jogáveis. O gelo (Planície Gelada) voltou ao jogo a pedido do Lucas em 16/11/2026 (tinha sido guardado em 15/11). */
export const MAP_IDS: readonly string[] = ['campo', 'deserto', 'gelo'];

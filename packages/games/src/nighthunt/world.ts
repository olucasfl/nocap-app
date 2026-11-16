import { createRng } from '../core/rng';
import {
  FINAL_BOSS,
  HORDE_EVENTS,
  MAP_EVENTS,
  MAX_ENEMIES,
  bossHp,
  dripWeights,
  gemValue,
  hpScale,
  minPopulation,
  type HordeEvent,
} from './hordes';
import { ALL_ENEMIES, MONSTER_BY_ID } from './monsters';
import { BOMB, BONE, CROSS, EMBERS, GARLIC, MAGMA, PENTAGRAM, RUNES, WAND, WHIP } from './weapons';
import { overlaps, type Shape } from './geometry';
import {
  ENEMY_BOX,
  EVOLUTIONS,
  HEROES,
  ITEM_ATTRACT_ACCEL,
  ITEM_SHAPES,
  BREAKABLE_CELL,
  BREAKABLE_CHANCE,
  BREAKABLE_HP,
  BREAKABLE_RADIUS,
  MAGNET_RADIUS,
  MAPS,
  MAX_PASSIVE_SLOTS,
  MAX_WEAPON_SLOTS,
  PASSIVE_IDS,
  PLAYER_BOX,
  PROJECTILE_SHAPE,
  SWORD_ANIM_DURATION,
  SWORD_BOXES,
  SWORD_PIVOT_Y,
  UPGRADE_IDS,
  UPGRADE_MAX,
  WEAPON_IDS,
  slotOf,
  swordAngleDeg,
  type ChoiceId,
  type EvoId,
  type ItemType,
  type ProjectileKind,
  type UpgradeId,
} from './data';
import {
  AXE_LAUNCHER,
  ITEM_SETTINGS,
  MAGIC_ORB_LAUNCHER,
  META_SETTINGS,
  PERIODIC_FOLLOW,
  PLAYER_SETTINGS,
  xpToNext,
  haloCooldown,
  type EnemySettings,
} from './settings';

/** Passo fixo da simulação. O cliente acumula tempo real e chama step() quantas vezes couber. */
export const STEP = 1 / 60;

export interface MetaLevels {
  health: number;
  overallDamage: number;
  projectilePiercing: number;
  movementSpeed: number;
  xpGatherer: number;
  goldGatherer: number;
  /** Extras do Night Hunt (estilo Vampire Survivors): quantos rerolls, pulos e banimentos a mais por partida. */
  reroll: number;
  skip: number;
  banish: number;
}
export const NO_META: MetaLevels = {
  health: 0,
  overallDamage: 0,
  projectilePiercing: 0,
  movementSpeed: 0,
  xpGatherer: 0,
  goldGatherer: 0,
  reroll: 0,
  skip: 0,
  banish: 0,
};

export interface NhInput {
  x: number;
  y: number;
}
export interface NhOptions {
  hero?: string;
  map?: string;
  /** Modo infinito do mapa (só depois de concluir o mapa): sem chefe final, com recordes. */
  infinite?: boolean;
}

/** Obstáculo sólido do cenário (indestrutível): trava o jogador e os inimigos, mas não as armas. */
export interface Obstacle {
  x: number;
  y: number;
  r: number;
  kind: number;
  cell: string;
}

export interface Enemy {
  uid: number;
  s: EnemySettings;
  x: number;
  y: number;
  hp: number;
  speedX: number;
  speedY: number;
  life: number;
  faceX: number;
  flash: number;
  follow: boolean;
  stateLeft: number;
  dirX: number;
  dirY: number;
  shootTimer: number;
  dead: boolean;
  /** Empurrão em andamento (px/s), que some rápido. */
  pushX?: number;
  pushY?: number;
  /** Vida inicial (para as regras que dependem da metade da vida). */
  maxHp: number;
  /** Relógio e estado da regra própria do monstro (modo 0 seguindo, 1 avisando, 2 em disparo). */
  aux: number;
  mode: number;
}
export interface Item {
  uid: number;
  type: ItemType;
  x: number;
  y: number;
  attracted: boolean;
  speed: number;
  born: number;
  /** Valor do cristal de XP (sobe com o tempo). */
  value?: number;
}
/** Objeto do cenário que se quebra (e solta item). A aparência depende do mapa; a regra é a mesma em todos. */
export interface Breakable {
  uid: number;
  x: number;
  y: number;
  hp: number;
  /** 0 ou 1: qual dos dois modelos do mapa. */
  kind: number;
  flash: number;
  cell: string;
}
export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Gravidade (só o machado giratório). */
  gy: number;
  kind: ProjectileKind;
  expire: number;
  damage: number;
  pierces: number;
  angle: number;
  hostile: boolean;
  big: boolean;
  hit: Set<number>;
  /** Comportamento especial das armas novas. */
  mode?: 'cross' | 'bone' | 'rune' | 'bomb' | 'wand' | 'spark';
  born?: number;
  life?: number;
  /** Origem, direção e velocidade de saída (bumerangue). */
  ox?: number;
  oy?: number;
  v0?: number;
  /** Quicadas que sobram (osso), ciclos (cruz), fase/relógio (cruz, runas), geração (bomba). */
  n?: number;
  aux?: number;
  /** Para onde a bomba vai e o raio da explosão. */
  tx?: number;
  ty?: number;
  r?: number;
  evo?: boolean;
}

/** Estados de desenho e de dano das armas novas (o desenho lê daqui). */
export interface Cut {
  born: number;
  side: number;
  len: number;
  evo: boolean;
  at: number;
  /** Inimigos e objetos já atingidos por este corte (o golpe acompanha o jogador e acerta cada um uma vez). */
  hit?: Set<number>;
}
export interface Pool {
  x: number;
  y: number;
  r: number;
  born: number;
  dur: number;
  tick: number;
  vx: number;
  vy: number;
  evo: boolean;
}
export interface Blast {
  x: number;
  y: number;
  r: number;
  born: number;
}

/** Eventos que o desenho e o som consomem (não afetam a simulação). */
export type NhEvent =
  | { k: 'swing' }
  | { k: 'enemyHit'; x: number; y: number; dmg: number }
  | { k: 'enemyDeath'; x: number; y: number }
  | { k: 'playerHit'; dmg: number }
  | { k: 'playerDeath' }
  | { k: 'pickup'; type: ItemType; x: number; y: number }
  | { k: 'levelUp' }
  | { k: 'fire'; kind: 'horizontal' | 'diagonal' | 'halo' | 'axe' }
  | { k: 'bolt'; x: number; y: number }
  | { k: 'victory' }
  | { k: 'finalBoss' }
  | { k: 'breakHit'; x: number; y: number }
  | { k: 'break'; x: number; y: number; kind: number }
  | { k: 'evolve'; id: EvoId }
  | { k: 'maxedLevel'; gold: number };

export type Pending = { kind: 'levelUp' | 'chest'; options: ChoiceId[] };

export interface RunResult {
  score: number;
  kills: number;
  broken: number;
  gold: number;
  level: number;
  upgrades: Partial<Record<UpgradeId, number>>;
  evolutions: EvoId[];
  hero: string;
  map: string;
  bossKills: number;
  finalBossKills: number;
  chests: number;
  magnets: number;
  damageTaken: number;
  banishesUsed: number;
  rerollsUsed: number;
  won: boolean;
  infinite: boolean;
  /** Inimigos vistos e abates por tipo nesta partida (alimenta o bestiário). */
  seenIds: string[];
  killsById: Record<string, number>;
}

const BY_ID = new Map(ALL_ENEMIES.map((e) => [e.id, e]));
const PERIODIC = new Map<string, { followTime: number; waitTime: number }>(
  PERIODIC_FOLLOW.map((p) => [p.enemyIdToAffect, p]),
);
const r1 = (n: number) => Math.round(n * 10) / 10;
/**
 * Chance de baú dos chefes. No Slash só os chefes difíceis soltam baú (e pouco); no Night Hunt toda evolução vem de um baú,
 * então TODO chefe solta um baú, sempre (pedido do Lucas, 16/11/2026: matou dois chefes e nenhum baú veio, com 60 a 70%).
 */
const BOSS_CHEST: Record<string, number> = {
  BasicBoss: 1,
  StandardBoss: 1,
  HardBoss: 1,
  HarderBoss: 1,
  HardestBoss: 1,
  FinalBoss: 1,
  DragaoDouradoBoss: 1,
};

export const EXTRA_META = {
  reroll: { costs: [350, 900, 1800], bonuses: [1, 2, 3] },
  skip: { costs: [350, 900, 1800], bonuses: [1, 2, 3] },
  banish: { costs: [450, 1100, 2200], bonuses: [1, 2, 3] },
} as const;
type SlimMetaKey = keyof typeof META_SETTINGS | keyof typeof EXTRA_META;
const metaTable = (key: SlimMetaKey) =>
  key in EXTRA_META
    ? EXTRA_META[key as keyof typeof EXTRA_META]
    : META_SETTINGS[key as keyof typeof META_SETTINGS];
export function metaCost(key: SlimMetaKey, level: number): number | null {
  return (metaTable(key).costs as readonly number[])[level] ?? null;
}
export function metaBonus(key: SlimMetaKey, level: number): number {
  return level <= 0 ? 0 : ((metaTable(key).bonuses as readonly number[])[level - 1] ?? 0);
}

/** Aumenta o tamanho de uma forma mantendo o centro (o passivo Alcance). */
function scaleShape(sh: Shape, k: number): Shape {
  if (k === 1) return sh;
  return sh.kind === 'circle' ? { ...sh, r: sh.r * k } : { ...sh, w: sh.w * k, h: sh.h * k };
}

const MAX_ITEMS = 400;

/** Alcance de coleta (o item é pego) e alcance de atração base (o item começa a voar até você). */
export const PICK_RADIUS = 26;
export const ATTRACT_BASE = 70;
const PLAYER_R = 16;
/** Obstáculos do cenário: células de 520 px com 30% de chance de ter um, raio de cada modelo. */
const OBSTACLE_CELL = 520;
const OBSTACLE_CHANCE = 0.3;
const OBSTACLE_R = [30, 26] as const;
const ROOT_RADIUS = 115;
const SHOOT_CD = { orb: 3.2, spread: 4, ring: 5, scythe: 3.6 } as const;
/** Bote (Naja), mergulho (Grifo) e avanço (Lobo de Gelo): alcance, espera, aviso, duração do disparo e multiplicador de velocidade. */
const CHARGE_CFG = {
  lunge: { range: 240, cd: 3, tele: 0.45, dash: 0.5, mult: 4 },
  dive: { range: 9999, cd: 4.5, tele: 0.5, dash: 0.8, mult: 3.2 },
  charge: { range: 340, cd: 3.5, tele: 0.35, dash: 0.55, mult: 3.4 },
} as const;

export class NhWorld {
  readonly rng: () => number;
  readonly heroId: string;
  readonly mapId: string;
  /** Semente da partida (para guardar e continuar depois). */
  readonly seedId: string;
  t = 0;
  tick = 0;
  alive = true;
  player = { x: 0, y: 0, hp: 0, maxHp: 0, speed: 0, face: -1, moving: false };
  level = 0;
  xp = 0;
  xpMult = 1;
  regen = { amount: 0, timer: 0, delay: PLAYER_SETTINGS.regenerationDelay };
  weapon = {
    timer: 0,
    active: false,
    t: 0,
    damage: 0,
    lengthLevel: 0,
    inContact: new Set<number>(),
  };
  magnet = { active: false, left: 0 };
  levels: Record<UpgradeId, number> = Object.fromEntries(UPGRADE_IDS.map((u) => [u, 0])) as Record<
    UpgradeId,
    number
  >;
  evolved = new Set<EvoId>();
  launchers = {
    horizontal: { timer: 0, waves: 0, burstLeft: 0, burstTimer: 0 },
    halo: { timer: 0, cooldown: 0 },
    axe: { timer: 0 },
    lightning: { timer: 0 },
  };
  orbAngle = 0;
  orbHit = new Map<number, number>();
  enemies: Enemy[] = [];
  items: Item[] = [];
  projectiles: Projectile[] = [];
  gold = 0;
  kills = 0;
  bossKills = 0;
  finalBossKills = 0;
  chests = 0;
  magnets = 0;
  damageTaken = 0;
  /** Reroll, pular e banir (estilo Vampire Survivors). */
  rerolls = 0;
  skips = 0;
  banishes = 0;
  rerollsUsed = 0;
  banishesUsed = 0;
  banished = new Set<UpgradeId>();
  pending: Pending | null = null;
  queue: Pending[] = [];
  events: NhEvent[] = [];
  private nextUid = 1;
  private collisionTimer = 0;
  private playerContacts = new Set<number>();
  private spawnerTime = 0;
  private waveLastPos: { x: number; y: number } | null = null;
  private waveLastDir = { x: 0, y: 0 };
  private projDamage: number;
  private projPierces: number;
  private heroDmg: number;
  private heroSwift = 0;
  private heroDur = 0;
  private heroAttract = 0;
  private heroCd: number;
  private heroArmor: number;
  private heroGold: number;
  /** Zona visível (metade da largura e da altura, em unidades do mundo): o cliente informa, os inimigos nascem fora dela. */
  private viewHW = 460;
  private viewHH = 620;
  private spawnClock = 0;
  private quietUntil = 0;
  private hordeEvents: readonly HordeEvent[] = HORDE_EVENTS;
  private eventNext: number[] = HORDE_EVENTS.map((e) => e.from);
  private baseHp: number;
  private baseSpeed: number;
  private mapDef;
  /** Armas novas: cortes do chicote, poças de magma, anel de brasas, explosões e o pentagrama (o desenho lê daqui). */
  cuts: Cut[] = [];
  pools: Pool[] = [];
  blasts: Blast[] = [];
  emb = { cd: 0, left: 0, dur: 0, ang: 0 };
  pent: { born: number } | null = null;
  garlicHits = 0;
  private wTimers: Record<string, number> = {};
  /** Recarga do Pentagrama até o próximo uso (sorteada entre 40 e 80 s a cada uso). */
  private pentCd = 0;
  private embHit = new Map<number, number>();
  private aimX = 1;
  private aimY = 0;
  breakables: Breakable[] = [];
  obstacles: Obstacle[] = [];
  private obsCells = new Set<string>();
  infinite = false;
  victory = false;
  seenIds = new Set<string>();
  killsById: Record<string, number> = {};
  private finalSpawned = false;
  private brkCells = new Set<string>();
  private brkDone = new Set<string>();
  private brkSeed: number;
  private brkRng: () => number;
  private brkSwing = new Set<number>();
  brokenCount = 0;

  constructor(
    seed: string,
    private meta: MetaLevels = NO_META,
    opts: NhOptions = {},
  ) {
    this.seedId = seed;
    this.infinite = !!opts.infinite;
    this.rng = createRng('nighthunt:' + seed);
    // fluxo próprio: os objetos do cenário não mexem na sorte dos inimigos
    this.brkRng = createRng('nighthunt:brk:' + seed);
    this.brkSeed = [...seed].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
    const hero = HEROES[opts.hero ?? 'kael'] ?? HEROES.kael!;
    this.heroId = hero.id;
    this.mapDef = MAPS[opts.map ?? 'campo'] ?? MAPS.campo!;
    this.mapId = this.mapDef.id;
    this.hordeEvents = [...HORDE_EVENTS, ...(MAP_EVENTS[this.mapId] ?? [])];
    this.eventNext = this.hordeEvents.map((e) => e.from);
    const b = (key: SlimMetaKey, lv: number) => metaBonus(key, lv);
    this.baseHp = Math.round((PLAYER_SETTINGS.defaultHP + b('health', meta.health)) * hero.hp);
    this.baseSpeed = (PLAYER_SETTINGS.speed + b('movementSpeed', meta.movementSpeed)) * hero.speed;
    this.player.maxHp = this.baseHp;
    this.player.hp = this.baseHp;
    this.player.speed = this.baseSpeed;
    this.xpMult = (1 + b('xpGatherer', meta.xpGatherer)) * hero.xp * this.mapDef.xp;
    this.heroDmg = hero.damage;
    this.heroCd = hero.cooldown;
    this.heroArmor = hero.armor;
    this.heroGold = hero.gold * this.mapDef.gold;
    this.weapon.damage = PLAYER_SETTINGS.weapon.damage + b('overallDamage', meta.overallDamage);
    this.projDamage = 1 + b('overallDamage', meta.overallDamage);
    this.projPierces = 1 + b('projectilePiercing', meta.projectilePiercing);
    this.rerolls = 1 + b('reroll', meta.reroll);
    this.skips = 1 + b('skip', meta.skip);
    this.banishes = 1 + b('banish', meta.banish);
    this.launchers.halo.cooldown = PLAYER_SETTINGS.haloLauncher.launcher.cooldown;
    // só o Kael começa com a Espada; os outros começam com a arma própria (a Espada pode aparecer depois)
    this.levels.sword = hero.sword ? 1 : 0;
    this.heroSwift = hero.swift ?? 0;
    this.heroDur = hero.dur ?? 0;
    this.heroAttract = hero.attract ?? 0;
    if (hero.start) this.applyUpgrade(hero.start);
  }

  // ---- guardar e continuar depois ----
  /**
   * Guarda a partida inteira num texto compacto (inimigos, itens, tiros, objetos, níveis...). Ao continuar, os sorteios seguintes
   * usam uma sequência nova (a partida não é reproduzida igual, só retomada do mesmo ponto).
   */
  snapshot(maxEnemies = 320): string {
    const skip = new Set([
      'rng',
      'brkRng',
      'events',
      'meta',
      'mapDef',
      'hordeEvents',
      'enemies',
      'items',
      'projectiles',
      'breakables',
    ]);
    const state: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this))
      if (!skip.has(k) && typeof v !== 'function') state[k] = v;
    const near = (x: number, y: number) => Math.hypot(x - this.player.x, y - this.player.y) < 1100;
    const out = {
      v: 1,
      seed: this.seedId,
      hero: this.heroId,
      map: this.mapId,
      state,
      enemies: this.enemies
        .filter((e) => !e.dead && near(e.x, e.y))
        .slice(0, maxEnemies)
        .map((e) => [
          ALL_ENEMIES.findIndex((q) => q.id === e.s.id),
          e.x,
          e.y,
          e.hp,
          e.speedX,
          e.speedY,
          e.life,
          e.faceX,
          e.follow ? 1 : 0,
          e.stateLeft,
          e.dirX,
          e.dirY,
          e.shootTimer,
        ]),
      items: this.items
        .filter((i) => i.speed !== -1)
        .map((i) => [i.type, i.x, i.y, i.attracted ? 1 : 0, i.value ?? 1]),
      projectiles: this.projectiles
        .filter((q) => q.pierces > 0)
        .map((q) => [
          q.x,
          q.y,
          q.vx,
          q.vy,
          q.gy,
          q.kind,
          q.expire,
          q.damage,
          q.pierces,
          q.angle,
          q.hostile ? 1 : 0,
          q.big ? 1 : 0,
        ]),
      breakables: this.breakables.map((b) => [b.x, b.y, b.hp, b.kind, b.cell]),
    };
    return JSON.stringify(out, (_k, v: unknown) => {
      if (v instanceof Set) return { $s: [...v] };
      if (v instanceof Map) return { $m: [...v] };
      if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
      return v;
    });
  }

  /** Reconstrói uma partida guardada por `snapshot()`; devolve null se o texto não servir. */
  static restore(text: string, meta: MetaLevels = NO_META): NhWorld | null {
    try {
      const o = JSON.parse(text, (_k, v: unknown) => {
        if (v && typeof v === 'object') {
          const r = v as { $s?: unknown[]; $m?: [unknown, unknown][] };
          if (Array.isArray(r.$s)) return new Set(r.$s);
          if (Array.isArray(r.$m)) return new Map(r.$m);
        }
        return v;
      }) as {
        v: number;
        seed: string;
        hero: string;
        map: string;
        state: Record<string, unknown>;
        enemies: number[][];
        items: [ItemType, number, number, number, number][];
        projectiles: [
          number,
          number,
          number,
          number,
          number,
          ProjectileKind,
          number,
          number,
          number,
          number,
          number,
          number,
        ][];
        breakables: [number, number, number, number, string][];
      };
      if (o.v !== 1) return null;
      const w = new NhWorld(o.seed, meta, { hero: o.hero, map: o.map });
      Object.assign(w, o.state);
      w.enemies = o.enemies.map((a) => {
        const s = ALL_ENEMIES[a[0]!]!;
        return {
          uid: w.nextUid++,
          s,
          x: a[1]!,
          y: a[2]!,
          hp: a[3]!,
          speedX: a[4]!,
          speedY: a[5]!,
          life: a[6]!,
          faceX: a[7]!,
          flash: 0,
          follow: a[8] === 1,
          stateLeft: a[9]!,
          dirX: a[10]!,
          dirY: a[11]!,
          shootTimer: a[12]!,
          dead: false,
        } as Enemy;
      });
      w.items = o.items.map((a) => ({
        uid: w.nextUid++,
        type: a[0],
        x: a[1],
        y: a[2],
        attracted: a[3] === 1,
        speed: a[3] === 1 ? 200 : 0,
        born: -10,
        value: a[4],
      }));
      w.projectiles = o.projectiles.map((a) => ({
        x: a[0],
        y: a[1],
        vx: a[2],
        vy: a[3],
        gy: a[4],
        kind: a[5],
        expire: a[6],
        damage: a[7],
        pierces: a[8],
        angle: a[9],
        hostile: a[10] === 1,
        big: a[11] === 1,
        hit: new Set<number>(),
      }));
      w.breakables = o.breakables.map((a) => ({
        uid: w.nextUid++,
        x: a[0],
        y: a[1],
        hp: a[2],
        kind: a[3],
        flash: 0,
        cell: a[4],
      }));
      // sorteios novos a partir deste ponto
      (w as { rng: () => number }).rng = createRng(`nighthunt:${o.seed}:r${w.tick}`);
      (w as unknown as { brkRng: () => number }).brkRng = createRng(
        `nighthunt:brk:${o.seed}:r${w.tick}`,
      );
      w.events = [];
      return w;
    } catch {
      return null;
    }
  }

  // ---- API do cliente ----
  get requiredXp(): number {
    return xpToNext(this.level);
  }
  /** Dano de tudo: herói x Poder (+12% por nível). */
  get dmgMult(): number {
    return this.heroDmg * (1 + 0.12 * this.levels.weaponDamage);
  }
  /** Tamanho de tudo: Alcance (+10% por nível) aumenta espada, projéteis, orbes e área dos raios. */
  get area(): number {
    return 1 + 0.1 * this.levels.weaponLength;
  }
  /** Duração das zonas, poças, anéis e bumerangues: passivo Duração, +15% por nível. */
  get durMult(): number {
    return 1 + 0.15 * this.levels.duration + this.heroDur;
  }
  /** Projéteis, bombas e golpes a mais (passivo Quantidade, só 2 níveis). */
  get amountBonus(): number {
    return this.levels.amount;
  }
  /** Maldição: inimigos mais fortes, em troca de XP e ouro. */
  get curseXp(): number {
    return 1 + 0.1 * this.levels.curse;
  }
  /** Alcance de atração dos itens: base 70, +40% por nível do passivo Imã. */
  get attractRadius(): number {
    return ATTRACT_BASE * (1 + 0.4 * this.levels.magnet + this.heroAttract);
  }
  get goldMult(): number {
    return this.heroGold * (1 + 0.1 * this.levels.greed) * this.curseXp;
  }
  /** Velocidade dos projéteis e dos orbes. */
  get swiftMult(): number {
    return 1 + 0.1 * this.levels.swift + this.heroSwift;
  }
  /** Informa a zona visível da câmera (o cliente chama a cada quadro). */
  setView(halfW: number, halfH: number): void {
    this.viewHW = halfW;
    this.viewHH = halfH;
  }
  get cdMult(): number {
    return Math.max(0.4, this.heroCd * (1 - 0.08 * this.levels.tome));
  }
  get armor(): number {
    return this.heroArmor + this.levels.armor;
  }
  drainEvents(): NhEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
  get weaponAngle(): number {
    return swordAngleDeg(this.weapon.t);
  }
  has(id: UpgradeId): boolean {
    return this.levels[id] > 0;
  }
  private slots(list: readonly UpgradeId[]): Set<string> {
    return new Set(list.filter((u) => this.levels[u] > 0).map(slotOf));
  }
  /** Melhorias que ainda podem ser escolhidas (respeita o máximo, os espaços 6+6 e os itens banidos). */
  availableUpgrades(): UpgradeId[] {
    const w = this.slots(WEAPON_IDS);
    const p = this.slots(PASSIVE_IDS);
    return UPGRADE_IDS.filter((u) => {
      if (this.levels[u] >= UPGRADE_MAX[u] || this.banished.has(u)) return false;
      if (this.levels[u] > 0) return true;
      const slot = slotOf(u);
      if (WEAPON_IDS.includes(u)) return w.has(slot) || w.size < MAX_WEAPON_SLOTS;
      return p.has(slot) || p.size < MAX_PASSIVE_SLOTS;
    });
  }
  availableEvolutions(): EvoId[] {
    return EVOLUTIONS.filter(
      (e) =>
        !this.evolved.has(e.id) &&
        e.maxed.every((u) => this.levels[u] >= UPGRADE_MAX[u]) &&
        this.levels[e.passive] > 0,
    ).map((e) => e.id);
  }

  /** O jogador escolheu uma opção da janela de nível ou do baú. */
  choose(id: ChoiceId): void {
    if (!this.pending || !this.pending.options.includes(id)) return;
    if (id.startsWith('evo')) this.applyEvolution(id as EvoId);
    else {
      // nunca passa de 6 armas e 6 passivos, mesmo que a janela tenha sido sorteada antes de encher
      if (!this.availableUpgrades().includes(id as UpgradeId)) return;
      this.applyUpgrade(id as UpgradeId);
    }
    this.nextPending();
  }

  /** Passa para a próxima janela da fila, sorteando de novo (a lista pode ter mudado: espaços cheios, itens no máximo). */
  private nextPending(): void {
    const next = this.queue.shift() ?? null;
    if (next) {
      if (next.kind === 'levelUp') next.options = this.drawOptions(next.options.length);
      else {
        const evo = this.availableEvolutions();
        const avail = this.availableUpgrades();
        next.options = evo.length
          ? [evo[0]!]
          : avail.length
            ? [avail[Math.floor(this.rng() * avail.length)]!]
            : [];
      }
      if (next.options.length === 0) return this.nextPending();
    }
    this.pending = next;
  }

  /** Sorteia de novo as opções da janela de nível. */
  reroll(): boolean {
    if (!this.pending || this.pending.kind !== 'levelUp' || this.rerolls <= 0) return false;
    this.rerolls--;
    this.rerollsUsed++;
    this.pending.options = this.drawOptions(this.pending.options.length);
    return true;
  }
  /** Fecha a janela de nível sem escolher (rende um pouco de ouro). */
  skip(): boolean {
    if (!this.pending || this.pending.kind !== 'levelUp' || this.skips <= 0) return false;
    this.skips--;
    this.gold += 5;
    this.nextPending();
    return true;
  }
  /** Recusa o prêmio do baú: nada muda, e uma evolução recusada volta a aparecer no próximo baú. */
  decline(): boolean {
    if (!this.pending || this.pending.kind !== 'chest') return false;
    this.nextPending();
    return true;
  }
  /** Tira um item do jogo até o fim da partida. */
  banish(id: UpgradeId): boolean {
    if (
      !this.pending ||
      this.pending.kind !== 'levelUp' ||
      this.banishes <= 0 ||
      !this.pending.options.includes(id)
    )
      return false;
    this.banishes--;
    this.banishesUsed++;
    this.banished.add(id);
    const n = this.pending.options.length;
    this.pending.options = this.drawOptions(n);
    return true;
  }

  result(won = false): RunResult {
    return {
      score: this.t,
      kills: this.kills,
      broken: this.brokenCount,
      gold: this.gold,
      level: this.level,
      upgrades: { ...this.levels },
      evolutions: [...this.evolved],
      hero: this.heroId,
      map: this.mapId,
      bossKills: this.bossKills,
      finalBossKills: this.finalBossKills,
      chests: this.chests,
      magnets: this.magnets,
      damageTaken: this.damageTaken,
      banishesUsed: this.banishesUsed,
      rerollsUsed: this.rerollsUsed,
      won: won || this.victory,
      infinite: this.infinite,
      seenIds: [...this.seenIds],
      killsById: { ...this.killsById },
    };
  }

  // ---- passo ----
  step(input: NhInput, dt = STEP): void {
    if (!this.alive || this.pending) return;
    this.tick++;
    this.movePlayer(input, dt);
    this.tickObstacles();
    this.tickWeapon(dt);
    this.tickMagnet(dt);
    this.tickRegen(dt);
    this.collisionTimer += dt;
    this.tickSpawners(dt);
    this.moveEnemies(dt);
    // a separação roda em quadros alternados (com o dobro do passo): metade do custo, mesmo resultado
    if (this.tick % 2 === 0) this.separateEnemies(dt * 2);
    else for (const e of this.enemies) if (!e.dead) this.applyPush(e, dt);
    this.solveObstacles();
    this.tickLaunchers(dt);
    this.tickNewWeapons(dt);
    this.tickWeapons2(dt);
    this.tickEnemyLaunchers(dt);
    this.tickBreakables();
    this.moveItems(dt);
    this.resolveContacts();
    this.t += dt;
    for (const e of this.enemies) if (e.flash > 0) e.flash -= dt;
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  // ---- jogador ----
  private movePlayer(input: NhInput, dt: number): void {
    const p = this.player;
    const len = Math.hypot(input.x, input.y);
    p.moving = len > 0;
    if (!p.moving) return;
    const k = len > 1 ? 1 / len : 1;
    // raízes do Ent Ancião: quem chega perto anda 40% mais devagar
    const rooted = this.enemies.some(
      (e) => !e.dead && e.s.trait === 'roots' && Math.hypot(e.x - p.x, e.y - p.y) < ROOT_RADIUS,
    );
    const sp = p.speed * (1 + 0.08 * this.levels.boots) * (rooted ? 0.6 : 1);
    p.x += input.x * k * dt * sp;
    p.y += input.y * k * dt * sp;
    if (input.x < 0) p.face = -1;
    else if (input.x > 0) p.face = 1;
    this.aimX = input.x / len;
    this.aimY = input.y / len;
  }

  private strikeDelay(): number {
    return (
      PLAYER_SETTINGS.weapon.strikeDelay * this.cdMult * (this.evolved.has('evoSword') ? 0.6 : 1)
    );
  }
  private swordDamage(): number {
    return this.weapon.damage * this.dmgMult * (this.evolved.has('evoSword') ? 2 : 1);
  }

  private tickWeapon(dt: number): void {
    const w = this.weapon;
    if (this.levels.sword <= 0) return; // sem a Espada (só o Kael começa com ela)
    w.timer += dt;
    if (w.timer >= this.strikeDelay()) {
      w.timer = 0;
      w.active = true;
      w.t = 0;
      w.inContact.clear();
      this.events.push({ k: 'swing' });
    } else if (w.active) {
      w.t += dt;
      if (w.t >= SWORD_ANIM_DURATION) {
        w.active = false;
        w.inContact.clear();
      }
    }
  }

  private swordShape(): Shape {
    const b = SWORD_BOXES[this.weapon.lengthLevel]!;
    const a = (this.weaponAngle * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const px = this.player.x;
    const py = this.player.y + SWORD_PIVOT_Y;
    return {
      kind: 'box',
      cx: px + b.ox * this.area * c - b.oy * this.area * s,
      cy: py + b.ox * this.area * s + b.oy * this.area * c,
      w: b.w * this.area,
      h: b.h * this.area,
      rot: a,
    };
  }

  private tickMagnet(dt: number): void {
    if (!this.magnet.active) return;
    this.magnet.left -= dt;
    if (this.magnet.left <= 0) this.magnet.active = false;
  }

  private tickRegen(dt: number): void {
    const r = this.regen;
    if (r.amount <= 0) return;
    r.timer += dt;
    if (r.timer >= r.delay / r.amount) {
      r.timer = 0;
      this.heal(1);
    }
  }

  private heal(n: number): void {
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + n);
  }

  private hurtPlayer(dmg: number): void {
    if (!this.alive) return;
    const d = Math.max(1, dmg - this.armor);
    this.player.hp -= d;
    this.damageTaken += d;
    this.events.push({ k: 'playerHit', dmg: d });
    if (this.player.hp <= 0) {
      this.alive = false;
      this.events.push({ k: 'playerDeath' });
    }
  }

  // ---- níveis e melhorias ----
  private addXp(points: number): void {
    // nos níveis 20 e 40 (índice 19 e 39) o XP dobra até passar de nível: compensa o salto da curva, como no Vampire Survivors
    const spike = this.level === 19 || this.level === 39 ? 2 : 1;
    this.xp += points * this.xpMult * (1 + 0.08 * this.levels.growth) * this.curseXp * spike;
    while (this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level++;
      this.events.push({ k: 'levelUp' });
      this.openModal('levelUp');
    }
  }

  private shuffled(list: UpgradeId[]): UpgradeId[] {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }

  /** O Trevo da Lua dá 10% por nível de chance de uma 4ª opção. */
  private optionCount(): number {
    return 3 + (this.rng() < 0.1 * this.levels.clover ? 1 : 0);
  }

  private drawOptions(n: number): ChoiceId[] {
    // sorteio com peso: o que você já tem sai mais (peso 3) que o item novo (peso 1), sem repetir na mesma janela
    const pool: UpgradeId[] = [...this.availableUpgrades()];
    const base: ChoiceId[] = [];
    while (base.length < n && pool.length) {
      const wt = pool.map((id) => (this.levels[id] > 0 ? 3 : 1));
      let r = this.rng() * wt.reduce((a, b) => a + b, 0);
      let k = 0;
      for (; k < pool.length - 1; k++) {
        r -= wt[k]!;
        if (r < 0) break;
      }
      base.push(pool.splice(k, 1)[0]!);
    }
    // arma no máximo + passivo certo: a evolução vem na próxima janela, no lugar de uma das melhorias
    const evo = this.availableEvolutions()[0];
    if (evo) return [evo, ...base.slice(0, Math.max(0, n - 1))];
    return base;
  }

  /**
   * Parceiro de combinação que a pessoa já tem: para uma arma, o passivo que a evolui; para um passivo, a arma que ele evolui.
   * A carta mostra "Combina com ..." quando isto não é nulo.
   */
  comboHint(id: ChoiceId): UpgradeId | null {
    if (id.startsWith('evo')) return null;
    const u = id as UpgradeId;
    for (const e of EVOLUTIONS) {
      if (this.evolved.has(e.id)) continue;
      if (e.maxed.includes(u) && this.levels[e.passive] > 0) return e.passive;
      if (e.passive === u) {
        const w = e.maxed.find((m) => this.levels[m] > 0);
        if (w) return w;
      }
    }
    return null;
  }

  private openModal(kind: 'levelUp' | 'chest'): void {
    let options: ChoiceId[];
    if (kind === 'levelUp') {
      options = this.drawOptions(this.optionCount());
    } else {
      const evo = this.availableEvolutions();
      if (evo.length) options = [evo[0]!];
      else {
        const avail = this.availableUpgrades();
        options = avail.length ? [avail[Math.floor(this.rng() * avail.length)]!] : [];
      }
    }
    if (options.length === 0) {
      // tudo no máximo: o nível vira ouro e um pouco de vida (como o frango e as moedas do Vampire Survivors)
      if (kind === 'levelUp') {
        const gold = 20 + Math.floor(this.level / 2);
        this.gold += gold;
        this.heal(Math.round(this.player.maxHp * 0.15));
        this.events.push({ k: 'maxedLevel', gold });
      }
      return;
    }
    const p: Pending = { kind, options };
    if (this.pending) this.queue.push(p);
    else this.pending = p;
  }

  private applyUpgrade(id: UpgradeId): void {
    this.levels[id]++;
    const L = PLAYER_SETTINGS;
    switch (id) {
      case 'sword':
        if (this.levels.sword > 1) this.weapon.damage++;
        this.weapon.lengthLevel = Math.min(SWORD_BOXES.length - 1, this.levels.sword - 1);
        this.weapon.inContact.clear();
        break;
      case 'horizontal':
        this.launchers.horizontal.waves += L.horizontalLauncher.wavesToShootPerUpgrade;
        break;
      case 'halo':
        this.launchers.halo.timer = 0;
        this.launchers.halo.cooldown = haloCooldown(this.levels.halo);
        break;
      case 'regeneration':
        this.regen.amount++;
        this.regen.timer = 0;
        break;
      case 'heart': {
        const old = this.player.maxHp;
        this.player.maxHp = Math.round(this.baseHp * (1 + 0.2 * this.levels.heart));
        this.player.hp += this.player.maxHp - old;
        break;
      }
      default:
        break; // as demais armas e os passivos agem pelo nível
    }
  }

  private applyEvolution(id: EvoId): void {
    this.evolved.add(id);
    this.events.push({ k: 'evolve', id });
    if (id === 'evoHalo') this.launchers.halo.timer = 0;
    if (id === 'evoHorizontal') this.launchers.horizontal.waves += 1;
  }

  // ---- inimigos ----
  private spawnEnemy(dx: number, dy: number, id: string, hp?: number): Enemy {
    const s = BY_ID.get(id);
    if (!s) throw new Error('inimigo desconhecido ' + id);
    const per = PERIODIC.get(id);
    const lo = s.speed / 2;
    // chefes (todos soltam baú): 12% mais lentos, só um pouco (pedido do Lucas, 16/11/2026)
    const slow = id.endsWith('Boss') ? 0.88 : 1;
    const e: Enemy = {
      uid: this.nextUid++,
      s,
      x: this.player.x + dx,
      y: this.player.y + dy,
      hp: Math.max(
        1,
        Math.round(
          (hp ?? s.health * hpScale(this.spawnerTime)) *
            this.mapDef.enemyHp *
            (1 + 0.08 * this.levels.curse),
        ),
      ),
      speedX:
        (lo + this.rng() * (s.speed - lo)) *
        this.mapDef.enemySpeed *
        slow *
        (1 + 0.05 * this.levels.curse),
      speedY:
        (lo + this.rng() * (s.speed - lo)) *
        this.mapDef.enemySpeed *
        slow *
        (1 + 0.05 * this.levels.curse),
      life: s.lifetime,
      faceX: 1,
      flash: 0,
      follow: true,
      stateLeft: per ? per.followTime : 0,
      dirX: 0,
      dirY: 0,
      shootTimer: 0,
      dead: false,
      maxHp: 0,
      aux: 0.8 + this.rng() * 1.6,
      mode: 0,
    };
    e.maxHp = e.hp;
    this.seenIds.add(id);
    if (s.moveType === 'Launch') {
      let dir: { x: number; y: number };
      const lp = this.waveLastPos;
      if (lp && Math.abs(lp.x - this.player.x) < 1e-6 && Math.abs(lp.y - this.player.y) < 1e-6) {
        dir = this.waveLastDir;
      } else {
        const dxp = this.player.x - e.x;
        const dyp = this.player.y - e.y;
        const l = Math.hypot(dxp, dyp) || 1;
        dir = { x: dxp / l, y: dyp / l };
        this.waveLastDir = dir;
        this.waveLastPos = { x: this.player.x, y: this.player.y };
      }
      e.dirX = dir.x;
      e.dirY = dir.y;
    }
    this.enemies.push(e);
    return e;
  }

  /** Ponto fora da tela (retângulo da câmera mais uma margem) na direção `angle`, relativo ao jogador. */
  private edgeOffset(angle: number, margin: number): [number, number] {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const d = Math.min(
      this.viewHW / Math.max(1e-3, Math.abs(c)),
      this.viewHH / Math.max(1e-3, Math.abs(s)),
    );
    return [c * (d + margin), s * (d + margin)];
  }

  /** Hordas no estilo Vampire Survivors: fluxo contínuo por população mínima, eventos com pausa e chefes (ver hordes.ts). */
  private tickSpawners(dt: number): void {
    this.spawnerTime += dt;
    const now = this.spawnerTime;
    // chefe final do mapa: só na partida normal (no modo infinito não aparece)
    const fin = FINAL_BOSS[this.mapId];
    if (!this.infinite && fin && !this.finalSpawned && now >= fin.at) {
      this.finalSpawned = true;
      const [dx, dy] = this.edgeOffset(this.rng() * Math.PI * 2, 90);
      this.spawnEnemy(dx, dy, fin.id, bossHp(BY_ID.get(fin.id)!.health, now));
      this.events.push({ k: 'finalBoss' });
    }
    // eventos (enxame, anel, muralha, manada, chefe)
    this.hordeEvents.forEach((ev, i) => {
      if (now < (this.eventNext[i] ?? Infinity)) return;
      this.eventNext[i] = now + ev.every;
      const id = ev.enemy(now);
      const n = ev.count(now);
      if (this.enemies.length + n > MAX_ENEMIES + 120) return;
      const base = this.rng() * Math.PI * 2;
      if (ev.shape === 'swarm') {
        // arco denso de um lado só, em duas fileiras
        const arc = Math.min(2.4, 0.5 + n * 0.035);
        for (let k = 0; k < n; k++) {
          const a = base + (k / Math.max(1, n - 1) - 0.5) * arc;
          const [dx, dy] = this.edgeOffset(a, 50 + (k % 2) * 40 + this.rng() * 20);
          this.spawnEnemy(dx, dy, id);
        }
      } else if (ev.shape === 'ring') {
        for (let k = 0; k < n; k++) {
          const [dx, dy] = this.edgeOffset(base + (k / n) * Math.PI * 2, 60);
          this.spawnEnemy(dx, dy, id);
        }
      } else if (ev.shape === 'wall') {
        // fila de quem atravessa a tela em linha reta (todos pegam a mesma direção)
        const [cx, cy] = this.edgeOffset(base, 60);
        const l = Math.hypot(cx, cy) || 1;
        const px = -cy / l;
        const py = cx / l;
        for (let k = 0; k < n; k++) {
          const o = (k - (n - 1) / 2) * 44;
          this.spawnEnemy(cx + px * o, cy + py * o, id);
        }
      } else {
        for (let k = 0; k < n; k++) {
          const [dx, dy] = this.edgeOffset(base + k * 2.4, 80);
          this.spawnEnemy(dx, dy, id, bossHp(BY_ID.get(id)!.health, now));
        }
      }
      this.quietUntil = Math.max(this.quietUntil, now + ev.quiet);
    });
    // fluxo contínuo: repõe a população mínima aos poucos
    this.spawnClock += dt;
    if (this.spawnClock < 0.25) return;
    this.spawnClock = 0;
    if (now < this.quietUntil) return;
    const deficit = minPopulation(now) - this.enemies.length;
    if (deficit <= 0 || this.enemies.length >= MAX_ENEMIES) return;
    const weights = dripWeights(now, this.mapId);
    const total = weights.reduce((acc, [, w]) => acc + w, 0);
    const batch = Math.min(deficit, 2 + Math.ceil(deficit / 8));
    for (let k = 0; k < batch; k++) {
      let r = this.rng() * total;
      let id = weights[0]![0];
      for (const [eid, w] of weights) {
        r -= w;
        if (r <= 0) {
          id = eid;
          break;
        }
      }
      const [dx, dy] = this.edgeOffset(this.rng() * Math.PI * 2, 40 + this.rng() * 80);
      this.spawnEnemy(dx, dy, id);
    }
  }

  private moveEnemies(dt: number): void {
    const p = this.player;
    const order: Enemy['s']['moveType'][] = ['Follow', 'Launch', 'PeriodicFollow'];
    const howlers = this.enemies.filter((e) => !e.dead && e.s.trait === 'howl');
    for (const mt of order) {
      for (const e of this.enemies) {
        if (e.dead || e.s.moveType !== mt) continue;
        let mx = 0;
        let my = 0;
        const chase = () => {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const l = Math.hypot(dx, dy);
          if (l > 0) {
            mx = dx / l;
            my = dy / l;
          }
        };
        let sm = 1;
        if (mt === 'Follow') {
          chase();
          sm = this.traitMove(
            e,
            dt,
            howlers,
            () => chase(),
            (x, y) => {
              mx = x;
              my = y;
            },
            [mx, my],
          );
        } else if (mt === 'Launch') {
          mx = e.dirX;
          my = e.dirY;
        } else {
          const per = PERIODIC.get(e.s.id);
          if (per) {
            e.stateLeft -= dt;
            if (e.stateLeft <= 0) {
              e.follow = !e.follow;
              e.stateLeft = e.follow ? per.followTime : per.waitTime;
            }
          }
          if (e.follow) chase();
        }
        e.x += mx * e.speedX * sm * dt;
        e.y += my * e.speedY * sm * dt;
        if (mx < 0) e.faceX = -1;
        else if (mx > 0) e.faceX = 1;
        if (e.life > 0) {
          e.life -= dt;
          if (e.life <= 0) e.dead = true; // some sem soltar nada
        }
      }
    }
  }

  /**
   * Regras próprias dos monstros novos no movimento. Devolve o multiplicador de velocidade do quadro e pode trocar a direção
   * (zigue-zague, bote, mergulho, avanço). Quem não tem regra anda normal.
   */
  private traitMove(
    e: Enemy,
    dt: number,
    howlers: Enemy[],
    _chase: () => void,
    setDir: (x: number, y: number) => void,
    cur: [number, number],
  ): number {
    const t = e.s.trait;
    let mult = 1;
    // uivo do Lobo de Gelo
    if (
      howlers.length &&
      t !== 'howl' &&
      howlers.some((h) => Math.hypot(h.x - e.x, h.y - e.y) < 230)
    )
      mult *= 1.25;
    if (!t) return mult;
    const p = this.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (t === 'zigzag') {
      const a = Math.sin(this.t * 7 + e.uid) * 0.9;
      const c = Math.cos(a);
      const s = Math.sin(a);
      setDir(cur[0] * c - cur[1] * s, cur[0] * s + cur[1] * c);
    } else if (t === 'enrage') {
      if (e.hp <= e.maxHp / 2) mult *= 1.5;
    } else if (t === 'phase') {
      e.aux += dt;
      if (this.isGhost(e)) mult *= 1.3;
    } else if (t === 'lunge' || t === 'dive' || t === 'charge' || t === 'howl') {
      const cfg = CHARGE_CFG[t === 'howl' ? 'charge' : t];
      if (e.mode === 0) {
        e.aux -= dt;
        if (e.aux <= 0 && dist < cfg.range) {
          e.mode = 1;
          e.aux = cfg.tele;
          e.dirX = dx / dist;
          e.dirY = dy / dist;
        }
      } else if (e.mode === 1) {
        e.aux -= dt;
        setDir(0, 0);
        if (e.aux <= 0) {
          e.mode = 2;
          e.aux = cfg.dash;
          e.dirX = dx / dist;
          e.dirY = dy / dist;
        }
      } else {
        e.aux -= dt;
        setDir(e.dirX, e.dirY);
        mult *= cfg.mult;
        if (e.aux <= 0) {
          e.mode = 0;
          e.aux = cfg.cd;
        }
      }
    }
    return mult;
  }

  // ---- armas novas (spec 084) ----
  private lv<T extends readonly number[]>(table: T, level: number): number {
    return table[Math.min(table.length, Math.max(1, level)) - 1]!;
  }

  /** Inimigos vivos perto de (x, y), do mais perto ao mais longe. */
  private nearestEnemies(x: number, y: number, range: number): Enemy[] {
    return this.enemies
      .filter((e) => !e.dead && Math.hypot(e.x - x, e.y - y) <= range)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  }

  /** Dá dano numa área (círculo) a inimigos e objetos do cenário. */
  private blast(x: number, y: number, r: number, dmg: number, knock: number): void {
    this.blasts.push({ x, y, r, born: this.t });
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - x, e.y - y) <= r + 14) {
        this.damageEnemy(e, dmg);
        if (knock > 0) this.knock(e, x, y, 160 * knock);
      }
    }
    for (const b of this.breakables)
      if (b.hp > 0 && Math.hypot(b.x - x, b.y - y) <= r + BREAKABLE_RADIUS)
        this.damageBreakable(b, dmg);
  }

  private explodeBomb(q: Projectile): void {
    const lv = this.levels.bomb;
    const gen = q.n ?? 0;
    const r = (q.r ?? this.lv(BOMB.r, lv)) * this.area;
    this.blast(q.x, q.y, r, q.damage, 0.6);
    q.pierces = 0;
    const shards = gen > 0 ? 0 : this.lv(BOMB.shards, lv);
    for (let i = 0; i < shards; i++) {
      const a = (i / shards) * Math.PI * 2 + 0.4;
      if (q.evo) {
        // Bomba Cerejão: cada estilhaço vira uma bomba menor
        this.throwBomb(
          q.x,
          q.y,
          q.x + Math.cos(a) * 90,
          q.y + Math.sin(a) * 90,
          q.damage * 0.5,
          45,
          1,
          true,
        );
      } else {
        this.fire(
          'spark',
          q.x,
          q.y,
          [[Math.cos(a), Math.sin(a)]],
          210,
          0.6,
          this.dmgMult,
          1,
          false,
        );
        const sp = this.projectiles[this.projectiles.length - 1]!;
        sp.mode = 'spark';
      }
    }
  }

  private throwBomb(
    x: number,
    y: number,
    tx: number,
    ty: number,
    dmg: number,
    r: number,
    gen: number,
    evo: boolean,
  ): void {
    this.projectiles.push({
      x,
      y,
      vx: (tx - x) / BOMB.fly,
      vy: (ty - y) / BOMB.fly,
      gy: 0,
      kind: 'bomb',
      expire: this.t + BOMB.fuse,
      damage: dmg,
      pierces: 99,
      angle: 0,
      hostile: false,
      big: false,
      hit: new Set(),
      mode: 'bomb',
      born: this.t,
      tx,
      ty,
      r,
      n: gen,
      evo,
    });
  }

  /** Osso: depois de acertar, vai para o inimigo mais perto que ainda não levou. */
  private boneBounce(q: Projectile, e: Enemy): void {
    q.n = (q.n ?? 0) - 1;
    if ((q.n ?? 0) < 0) {
      q.pierces = 0;
      return;
    }
    const next = this.nearestEnemies(e.x, e.y, 300).find((o) => o !== e && !q.hit.has(o.uid));
    if (!next) {
      q.pierces = 0;
      return;
    }
    const dx = next.x - q.x;
    const dy = next.y - q.y;
    const l = Math.hypot(dx, dy) || 1;
    const sp = Math.hypot(q.vx, q.vy) || BONE.speed;
    q.vx = (dx / l) * sp;
    q.vy = (dy / l) * sp;
    q.expire = this.t + 1.6;
  }

  private tickWeapons2(dt: number): void {
    const px = this.player.x;
    const py = this.player.y;
    const dm = this.dmgMult;
    const L = this.levels;
    const t = this.t;
    const tick = (key: string, cd: number): boolean => {
      this.wTimers[key] = (this.wTimers[key] ?? 0) + dt;
      if ((this.wTimers[key] ?? 0) >= cd) {
        this.wTimers[key] = 0;
        return true;
      }
      return false;
    };
    const amt = this.amountBonus;

    // Chicote: cortes em sequência, frente e trás
    if (L.whip > 0) {
      const evo = this.evolved.has('evoWhip');
      if (tick('whip', WHIP.cd * this.lv(WHIP.cdLv, L.whip) * this.cdMult * (evo ? 0.6 : 1))) {
        const n = this.lv(WHIP.cuts, L.whip) + amt;
        const dir = this.player.face === 0 ? 1 : this.player.face;
        for (let i = 0; i < n; i++)
          this.cuts.push({
            born: 0,
            at: t + i * WHIP.gap,
            side: i % 2 === 0 ? dir : -dir,
            len: 0,
            evo,
          });
      }
    }
    for (const c of this.cuts) {
      if (t < c.at) continue;
      if (c.born === 0) {
        c.born = t;
        c.len = this.lv(WHIP.len, L.whip) * this.area * (c.evo ? 2 : 1);
        c.hit = new Set();
        this.events.push({ k: 'swing' });
      }
      // o golpe dura pouco e acompanha o jogador: quem entra na área enquanto ele estala leva o dano uma vez
      if (t - c.born > WHIP.life) continue;
      const h = WHIP.height * this.area;
      const shape: Shape = {
        kind: 'box',
        cx: px + c.side * (c.len / 2 + 8),
        cy: py + 8,
        w: c.len,
        h,
      };
      const base = this.lv(WHIP.dmg, L.whip) * dm * (c.evo ? 1.3 : 1);
      for (const e of this.enemies) {
        if (e.dead || c.hit!.has(e.uid) || !overlaps(shape, this.enemyShape(e))) continue;
        c.hit!.add(e.uid);
        const crit = c.evo && this.rng() < 0.15;
        const d = base * (crit ? 2 : 1);
        this.damageEnemy(e, d);
        this.knock(e, px, py, 90);
        if (c.evo) this.heal(Math.max(0, Math.round(d * 0.01 * 10) / 10));
      }
      for (const b of this.breakables) {
        const key = -1 - b.uid;
        if (b.hp > 0 && !c.hit!.has(key) && overlaps(shape, this.breakableShape(b))) {
          c.hit!.add(key);
          this.damageBreakable(b, base);
        }
      }
    }
    this.cuts = this.cuts.filter((c) => c.born === 0 || t - c.born < WHIP.life + 0.04);

    // Varinha Arcana: alvos aleatórios por perto
    if (L.wand > 0) {
      const evo = this.evolved.has('evoWand');
      const cd = Math.max(
        evo ? 0.35 : 0.5,
        this.lv(WAND.cd, L.wand) * this.cdMult * (evo ? 0.5 : 1),
      );
      this.wTimers.wand = (this.wTimers.wand ?? 0) + dt;
      if ((this.wTimers.wand ?? 0) >= cd) {
        const pool = this.nearestEnemies(px, py, WAND.range);
        if (pool.length) {
          this.wTimers.wand = 0;
          const n = this.lv(WAND.n, L.wand) + amt;
          const chosen: Enemy[] = [];
          const bag = pool.slice();
          for (let i = 0; i < n; i++) {
            if (bag.length === 0) bag.push(...pool);
            const k = Math.floor(this.rng() * bag.length);
            chosen.push(bag.splice(k, 1)[0]!);
          }
          for (const e of chosen) {
            this.fire(
              'wand',
              px,
              py,
              [[e.x - px, e.y - py]],
              380,
              1.4,
              this.lv(WAND.dmg, L.wand) * dm * (evo ? 1.3 : 1),
              this.lv(WAND.pierce, L.wand) + (evo ? 2 : 0),
              false,
              { big: evo },
            );
            this.projectiles[this.projectiles.length - 1]!.mode = 'wand';
          }
          this.events.push({ k: 'fire', kind: 'diagonal' });
        } else this.wTimers.wand = cd;
      }
    }

    // Aura de Alho: dano contínuo e empurrão
    if (L.garlic > 0) {
      const evo = this.evolved.has('evoGarlic');
      if (tick('garlic', this.lv(GARLIC.every, L.garlic))) {
        const r = this.garlicRadius;
        const d = this.lv(GARLIC.dmg, L.garlic) * dm * (evo ? 2 : 1);
        for (const e of this.enemies) {
          if (e.dead || Math.hypot(e.x - px, e.y - py) > r + 14) continue;
          this.damageEnemy(e, d);
          this.knock(e, px, py, this.lv(GARLIC.knock, L.garlic));
          if (evo && ++this.garlicHits % 5 === 0) this.heal(1);
        }
        for (const b of this.breakables)
          if (b.hp > 0 && Math.hypot(b.x - px, b.y - py) <= r + BREAKABLE_RADIUS)
            this.damageBreakable(b, d);
      }
    }

    // Poças de Magma
    if (L.magma > 0) {
      const evo = this.evolved.has('evoMagma');
      if (tick('magma', MAGMA.cd * this.cdMult)) {
        const n = this.lv(MAGMA.n, L.magma) + amt;
        for (let i = 0; i < n; i++) {
          const a = this.rng() * Math.PI * 2;
          const d = Math.sqrt(this.rng()) * MAGMA.spread;
          this.pools.push({
            x: px + Math.cos(a) * d,
            y: py + Math.sin(a) * d,
            r: this.lv(MAGMA.r, L.magma) * this.area,
            born: t,
            dur: this.lv(MAGMA.dur, L.magma) * this.durMult * (evo ? 2 : 1),
            tick: 0,
            vx: evo ? (this.rng() - 0.5) * 36 : 0,
            vy: evo ? (this.rng() - 0.5) * 36 : 0,
            evo,
          });
        }
        this.events.push({ k: 'fire', kind: 'axe' });
      }
    }
    for (const p of this.pools) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.evo) p.r += 4 * dt;
      if (t - p.born < 0.35) continue; // o frasco ainda está no ar
      p.tick += dt;
      if (p.tick >= MAGMA.tick) {
        p.tick = 0;
        const d = this.lv(MAGMA.dmg, L.magma) * dm;
        for (const e of this.enemies)
          if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= p.r + 10) this.damageEnemy(e, d);
        for (const b of this.breakables)
          if (b.hp > 0 && Math.hypot(b.x - p.x, b.y - p.y) <= p.r + BREAKABLE_RADIUS)
            this.damageBreakable(b, d);
      }
    }
    this.pools = this.pools.filter((p) => t - p.born < p.dur);

    // Círculo de Brasas: anel que nasce, gira e some
    if (L.embers > 0) {
      const evo = this.evolved.has('evoEmbers');
      const E = this.emb;
      if (E.left > 0) {
        E.left -= dt;
        E.ang += dt * 3.2 * this.swiftMult * (evo ? 1.2 : 1);
        for (const b of this.embersBalls()) {
          for (const e of this.enemies) {
            if (e.dead || (this.embHit.get(e.uid) ?? 0) > t) continue;
            if (Math.hypot(e.x - b.x, e.y - b.y) <= b.r + 16) {
              this.embHit.set(e.uid, t + EMBERS.hit);
              this.damageEnemy(e, this.lv(EMBERS.dmg, L.embers) * dm);
            }
          }
          for (const o of this.breakables)
            if (o.hp > 0 && Math.hypot(o.x - b.x, o.y - b.y) <= b.r + BREAKABLE_RADIUS)
              this.damageBreakable(o, this.lv(EMBERS.dmg, L.embers) * dm);
        }
        if (this.tick % 600 === 0)
          for (const [k, v] of this.embHit) if (v < t) this.embHit.delete(k);
      } else {
        E.cd += dt;
        if (E.cd >= EMBERS.cd * this.cdMult) {
          E.cd = 0;
          E.dur = this.lv(EMBERS.dur, L.embers) * this.durMult;
          E.left = E.dur;
          E.ang = this.rng() * Math.PI * 2;
          this.events.push({ k: 'fire', kind: 'halo' });
        }
      }
    }

    // Cruz: bumerangue
    if (L.cross > 0) {
      const evo = this.evolved.has('evoCross');
      if (tick('cross', CROSS.cd * this.cdMult)) {
        const n = this.lv(CROSS.n, L.cross) + amt;
        const tg = this.nearestEnemies(px, py, 420)[0];
        const base = tg ? Math.atan2(tg.y - py, tg.x - px) : Math.atan2(this.aimY, this.aimX);
        for (let i = 0; i < n; i++) {
          const off = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 0.55;
          const a = base + off;
          this.fire(
            'cross',
            px,
            py,
            [[Math.cos(a), Math.sin(a)]],
            CROSS.base * this.lv(CROSS.speed, L.cross),
            CROSS.life * this.durMult * (evo ? 2 : 1),
            this.lv(CROSS.dmg, L.cross) * dm * (evo ? 1.6 : 1),
            99,
            false,
            { big: evo },
          );
          const q = this.projectiles[this.projectiles.length - 1]!;
          q.mode = 'cross';
          q.born = t;
          q.life = CROSS.life * this.durMult * (evo ? 2 : 1);
          q.ox = px;
          q.oy = py;
          q.v0 = Math.hypot(q.vx, q.vy);
          q.n = evo ? 2 : 1;
          q.aux = 0;
        }
        this.events.push({ k: 'fire', kind: 'axe' });
      }
    }

    // Osso: quica entre inimigos
    if (L.bone > 0) {
      const evo = this.evolved.has('evoBone');
      if (tick('bone', BONE.cd * this.cdMult)) {
        const list = this.nearestEnemies(px, py, BONE.range);
        if (list.length) {
          const n = this.lv(BONE.n, L.bone) + amt;
          for (let i = 0; i < n; i++) {
            const e = list[i % list.length]!;
            this.fire(
              'bone',
              px,
              py,
              [[e.x - px, e.y - py]],
              BONE.speed,
              3,
              this.lv(BONE.dmg, L.bone) * dm * (evo ? 1.5 : 1),
              99,
              false,
            );
            const q = this.projectiles[this.projectiles.length - 1]!;
            q.mode = 'bone';
            q.n = this.lv(BONE.bounces, L.bone) + (evo ? 2 : 0);
            q.evo = evo;
          }
          this.events.push({ k: 'fire', kind: 'diagonal' });
        }
      }
    }

    // Rastreador de Runas: ricochete nas bordas da tela
    if (L.runes > 0) {
      const evo = this.evolved.has('evoRunes');
      if (tick('runes', RUNES.cd * this.cdMult)) {
        const n = this.lv(RUNES.n, L.runes) + amt;
        for (let i = 0; i < n; i++) {
          const a = this.rng() * Math.PI * 2;
          this.fire(
            'rune',
            px,
            py,
            [[Math.cos(a), Math.sin(a)]],
            RUNES.base * this.lv(RUNES.speed, L.runes),
            this.lv(RUNES.dur, L.runes) * this.durMult,
            this.lv(RUNES.dmg, L.runes) * dm * (evo ? 1.3 : 1),
            99,
            false,
            { big: evo },
          );
          const q = this.projectiles[this.projectiles.length - 1]!;
          q.mode = 'rune';
          q.evo = evo;
          q.aux = 0;
        }
        this.events.push({ k: 'fire', kind: 'halo' });
      }
    }

    // Bomba de Cereja
    if (L.bomb > 0) {
      const evo = this.evolved.has('evoBomb');
      if (tick('bomb', BOMB.cd * this.cdMult)) {
        const n = this.lv(BOMB.n, L.bomb) + amt;
        for (let i = 0; i < n; i++) {
          const a = this.rng() * Math.PI * 2;
          const d = 80 + Math.sqrt(this.rng()) * BOMB.spread;
          this.throwBomb(
            px,
            py,
            px + Math.cos(a) * d,
            py + Math.sin(a) * d,
            this.lv(BOMB.dmg, L.bomb) * dm * (evo ? 1.2 : 1),
            this.lv(BOMB.r, L.bomb),
            0,
            evo,
          );
        }
        this.events.push({ k: 'fire', kind: 'axe' });
      }
    }

    // Pentagrama: varre a tela com dano grande (não puxa itens). A recarga é sorteada a cada uso entre 40 e 80 s;
    // os níveis e a evolução encurtam só um pouco.
    if (L.pentagram > 0) {
      const evo = this.evolved.has('evoPentagram');
      const roll = (): number =>
        (PENTAGRAM.cdMin + this.rng() * (PENTAGRAM.cdMax - PENTAGRAM.cdMin)) *
        this.lv(PENTAGRAM.cdFactor, L.pentagram) *
        (evo ? 0.9 : 1);
      if (this.pentCd <= 0) this.pentCd = roll();
      if (tick('pentagram', this.pentCd)) {
        this.pentCd = roll();
        const sc = this.lv(PENTAGRAM.scale, L.pentagram);
        const d = this.lv(PENTAGRAM.dmg, L.pentagram) * dm * (evo ? 1.5 : 1);
        this.pent = { born: t };
        for (const e of this.enemies) {
          if (e.dead || e.s.id === 'FinalBoss' || e.s.id.endsWith('FinalBoss')) continue;
          if (Math.abs(e.x - px) <= this.viewHW * sc && Math.abs(e.y - py) <= this.viewHH * sc)
            this.damageEnemy(e, d);
        }
        this.events.push({ k: 'levelUp' });
      }
    }
    if (this.pent && t - this.pent.born > 1.2) this.pent = null;
    this.blasts = this.blasts.filter((b) => t - b.born < 0.8);
  }

  /** Raio atual da Aura de Alho (0 se a pessoa não tem a arma). */
  get garlicRadius(): number {
    if (this.levels.garlic <= 0) return 0;
    return (
      this.lv(GARLIC.radius, this.levels.garlic) *
      this.area *
      (this.evolved.has('evoGarlic') ? 1.6 : 1)
    );
  }

  /** Posições das bolas de fogo do Círculo de Brasas (para o desenho e a colisão). */
  embersBalls(): { x: number; y: number; r: number }[] {
    const E = this.emb;
    if (E.left <= 0 || this.levels.embers <= 0) return [];
    const evo = this.evolved.has('evoEmbers');
    const n = this.lv(EMBERS.n, this.levels.embers) + this.amountBonus;
    const prog = 1 - E.left / Math.max(0.01, E.dur);
    const radius = (EMBERS.radius + prog * EMBERS.grow) * this.area;
    const out: { x: number; y: number; r: number }[] = [];
    const ring = (count: number, rad: number, dir: number, off: number) => {
      for (let i = 0; i < count; i++) {
        const a = off + dir * E.ang + (i * Math.PI * 2) / count;
        out.push({
          x: this.player.x + Math.cos(a) * rad,
          y: this.player.y + 6 + Math.sin(a) * rad,
          r: 12 * this.area,
        });
      }
    };
    ring(n, radius, 1, 0);
    if (evo) ring(Math.max(3, Math.floor(n / 2)), radius * 0.6, -1, 0.5);
    return out;
  }

  // ---- empurrão, separação e obstáculos ----
  /** Quanto o inimigo se deixa empurrar (0 = nada: chefes). */
  private pushWeight(e: Enemy): number {
    if (e.s.id.endsWith('Boss')) return 0;
    if (e.s.trait === 'roots' || e.s.trait === 'shards') return 0.3;
    return 1;
  }

  /** Empurra um inimigo para longe de (fx, fy) com a força dada (px/s). */
  knock(e: Enemy, fx: number, fy: number, force: number): void {
    const w = this.pushWeight(e);
    if (w <= 0 || e.dead) return;
    const dx = e.x - fx;
    const dy = e.y - fy;
    const l = Math.hypot(dx, dy) || 1;
    e.pushX = (e.pushX ?? 0) + (dx / l) * force * w;
    e.pushY = (e.pushY ?? 0) + (dy / l) * force * w;
  }

  /** Aplica e apaga o empurrão (some em cerca de 0,25 s). */
  private applyPush(e: Enemy, dt: number): void {
    if (e.pushX === undefined || e.pushY === undefined) return;
    e.x += e.pushX * dt;
    e.y += e.pushY * dt;
    const k = Math.max(0, 1 - 7 * dt);
    e.pushX *= k;
    e.pushY *= k;
    if (Math.abs(e.pushX) + Math.abs(e.pushY) < 4) {
      e.pushX = undefined;
      e.pushY = undefined;
    }
  }

  /** Separação: inimigos muito perto se afastam, e a horda cerca o jogador em vez de virar um bolo (grade de 48 px). */
  private separateEnemies(dt: number): void {
    const list = this.enemies;
    for (const e of list) if (!e.dead) this.applyPush(e, dt / 2);
    if (list.length < 2) return;
    const cell = 48;
    const grid = new Map<number, Enemy[]>();
    const key = (cx: number, cy: number) => cx * 73856093 + cy * 19349663;
    for (const e of list) {
      if (e.dead) continue;
      const k = key(Math.floor(e.x / cell), Math.floor(e.y / cell));
      const b = grid.get(k);
      if (b) b.push(e);
      else grid.set(k, [e]);
    }
    const minD = 30;
    for (const e of list) {
      if (e.dead) continue;
      const cx = Math.floor(e.x / cell);
      const cy = Math.floor(e.y / cell);
      const boss = e.s.id.endsWith('Boss');
      let ox = 0;
      let oy = 0;
      let seen = 0;
      for (let gx = cx - 1; gx <= cx + 1 && seen < 8; gx++)
        for (let gy = cy - 1; gy <= cy + 1 && seen < 8; gy++) {
          const b = grid.get(key(gx, gy));
          if (!b) continue;
          for (const o of b) {
            if (o === e || seen >= 8) continue;
            let dx = e.x - o.x;
            let dy = e.y - o.y;
            if (dx * dx + dy * dy < 1) {
              // no mesmo ponto: cada um sai para um lado (pelo uid)
              dx = Math.cos(e.uid * 2.4);
              dy = Math.sin(e.uid * 2.4);
            }
            const d2 = dx * dx + dy * dy;
            const lim = boss || o.s.id.endsWith('Boss') ? 56 : minD;
            if (d2 >= lim * lim) continue;
            seen++;
            const d = Math.sqrt(d2) || 0.01;
            const f = ((lim - d) / lim) * (o.s.id.endsWith('Boss') && !boss ? 2 : 1);
            ox += (dx / d) * f;
            oy += (dy / d) * f;
          }
        }
      if (boss) continue; // chefes não são empurrados por bichos pequenos
      e.x += ox * 70 * dt;
      e.y += oy * 70 * dt;
    }
  }

  /** Gera os obstáculos do cenário ao redor do jogador (por hash da célula) e solta os que ficaram longe. */
  private tickObstacles(): void {
    if (this.tick % 20 !== 2) return;
    const px = this.player.x;
    const py = this.player.y;
    const ci = Math.floor(px / OBSTACLE_CELL);
    const cj = Math.floor(py / OBSTACLE_CELL);
    for (let j = cj - 2; j <= cj + 2; j++)
      for (let i = ci - 2; i <= ci + 2; i++) {
        const key = i + ',' + j;
        if (this.obsCells.has(key)) continue;
        this.obsCells.add(key);
        if (this.cellHash(i, j, 11) > OBSTACLE_CHANCE) continue;
        const x = (i + 0.2 + this.cellHash(i, j, 12) * 0.6) * OBSTACLE_CELL;
        const y = (j + 0.2 + this.cellHash(i, j, 13) * 0.6) * OBSTACLE_CELL;
        if (Math.hypot(x, y) < 190) continue;
        const kind = this.cellHash(i, j, 14) < 0.5 ? 0 : 1;
        this.obstacles.push({ x, y, r: OBSTACLE_R[kind]!, kind, cell: key });
      }
    this.obstacles = this.obstacles.filter((o) => {
      const far = Math.hypot(o.x - px, o.y - py) > OBSTACLE_CELL * 3.2;
      if (far) this.obsCells.delete(o.cell);
      return !far;
    });
  }

  /** Tira o jogador e os inimigos de dentro dos obstáculos (eles deslizam pela borda). Armas e projéteis passam por cima. */
  private solveObstacles(): void {
    const obs = this.obstacles;
    if (obs.length === 0) return;
    const push = (o: Obstacle, x: number, y: number, r: number): [number, number] => {
      const dx = x - o.x;
      const dy = y - o.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const min = o.r + r;
      if (d >= min) return [x, y];
      return [o.x + (dx / d) * min, o.y + (dy / d) * min];
    };
    const p = this.player;
    for (const o of obs) [p.x, p.y] = push(o, p.x, p.y, PLAYER_R);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const r = e.s.id.endsWith('Boss') ? 30 : 16;
      for (const o of obs) {
        if (Math.abs(e.x - o.x) > o.r + r + 2 || Math.abs(e.y - o.y) > o.r + r + 2) continue;
        [e.x, e.y] = push(o, e.x, e.y, r);
      }
    }
  }

  /** Espectro: parte do ciclo fica fantasma, sem sofrer nem causar dano. */
  isGhost(e: Enemy): boolean {
    return e.s.trait === 'phase' && e.aux % 4 > 2.4;
  }

  private damageEnemy(e: Enemy, dmg: number): void {
    if (e.dead || this.isGhost(e)) return;
    e.hp -= dmg;
    e.flash = 0.1;
    this.events.push({ k: 'enemyHit', x: e.x, y: e.y, dmg });
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    e.dead = true;
    this.kills++;
    this.killsById[e.s.id] = (this.killsById[e.s.id] ?? 0) + 1;
    if (e.s.id.endsWith('Boss')) this.bossKills++;
    if (e.s.id.endsWith('FinalBoss') || e.s.id === 'FinalBoss') {
      this.finalBossKills++;
      if (!this.victory && !this.infinite) {
        this.victory = true;
        this.events.push({ k: 'victory' });
      }
    }
    this.events.push({ k: 'enemyDeath', x: e.x, y: e.y });
    const s = e.s;
    if (s.trait === 'split') {
      for (const o of [-16, 16])
        this.spawnEnemy(e.x + o - this.player.x, e.y - this.player.y, 'Gosminha');
    } else if (s.trait === 'shards') {
      const dirs: [number, number][] = Array.from({ length: 8 }, (_, i) => [
        Math.cos((i / 8) * Math.PI * 2),
        Math.sin((i / 8) * Math.PI * 2),
      ]);
      this.fire('orb', e.x, e.y, dirs, 150, 3, 1, 1, true);
    }
    const jitter = (): [number, number] => [e.x - 15 + this.rng() * 30, e.y - 15 + this.rng() * 30];
    for (let i = 0; i < s.xpReward; i++) this.dropItem('xp', ...jitter());
    if (s.goldReward > 0) {
      if (s.goldReward < 1) {
        if (this.rng() < s.goldReward * this.goldMult) this.dropItem('gold', e.x, e.y);
      } else {
        for (let i = 0; i < s.goldReward * this.goldMult; i++) this.dropItem('gold', ...jitter());
      }
    }
    // poções e ímãs só saem dos objetos do cenário (decisão do Lucas em 15/11/2026): aqui os rolls seguem consumidos para não mudar a sorte da partida
    this.rng();
    this.rng();
    if (this.rng() < Math.max(s.chestRewardChance, BOSS_CHEST[s.id] ?? 0))
      this.dropItem('chest', ...jitter());
  }

  private dropItem(type: ItemType, x: number, y: number): void {
    // teto de itens no chão (como o Vampire Survivors): os cristais mais antigos viram um só, sem perder XP
    if (this.items.length >= MAX_ITEMS) {
      const first = this.items.findIndex((i) => i.type === 'xp');
      const second = first < 0 ? -1 : this.items.findIndex((i, k) => k > first && i.type === 'xp');
      if (first >= 0 && second >= 0) {
        this.items[second]!.value =
          (this.items[second]!.value ?? 1) + (this.items[first]!.value ?? 1);
        this.items.splice(first, 1);
      }
    }
    this.items.push({
      uid: this.nextUid++,
      type,
      x,
      y,
      attracted: false,
      speed: 0,
      born: this.t,
      value: type === 'xp' ? gemValue(this.t) : undefined,
    });
  }

  // ---- projéteis ----
  private fire(
    kind: ProjectileKind,
    x: number,
    y: number,
    dirs: [number, number][],
    speed: number,
    life: number,
    damage: number,
    pierces: number,
    hostile: boolean,
    extra: { gy?: number; big?: boolean } = {},
  ): void {
    for (const [dx, dy] of dirs) {
      const l = Math.hypot(dx, dy) || 1;
      const sp = hostile ? speed : speed * this.swiftMult;
      this.projectiles.push({
        x,
        y,
        vx: (dx / l) * sp,
        vy: (dy / l) * sp,
        gy: extra.gy ?? 0,
        kind,
        expire: this.t + life,
        damage,
        pierces,
        angle: Math.atan2(dy, dx),
        hostile,
        big: extra.big ?? false,
        hit: new Set(),
      });
    }
  }

  private tickLaunchers(dt: number): void {
    const P = PLAYER_SETTINGS;
    const px = this.player.x;
    const py = this.player.y;
    const dm = this.dmgMult;
    type WaveCfg = {
      launcher: {
        projectileLifetime: number;
        projectileSpeed: number;
        wavesDelayMs: number;
        cooldown: number;
      };
    };
    const wave = (
      key: 'horizontal',
      cfg: WaveCfg,
      dirs: [number, number][],
      cdScale: number,
      pierceBonus: number,
    ) => {
      const l = this.launchers[key];
      if (this.levels[key] === 0) return;
      l.timer += dt;
      if (l.timer >= cfg.launcher.cooldown * this.cdMult * cdScale) {
        l.timer = 0;
        l.burstLeft = l.waves;
        l.burstTimer = 0;
      }
      if (l.burstLeft > 0) {
        l.burstTimer -= dt;
        if (l.burstTimer <= 0) {
          l.burstLeft--;
          l.burstTimer = cfg.launcher.wavesDelayMs / 1000;
          this.fire(
            key,
            px,
            py,
            dirs,
            cfg.launcher.projectileSpeed,
            cfg.launcher.projectileLifetime,
            this.projDamage * dm,
            this.projPierces + pierceBonus,
            false,
          );
          this.events.push({ k: 'fire', kind: key });
        }
      }
    };
    const evoH = this.evolved.has('evoHorizontal');
    wave(
      'horizontal',
      P.horizontalLauncher,
      evoH
        ? [
            [0, 1],
            [-0.1, 0.8],
            [0.1, 0.8],
            [-0.28, 0.7],
            [0.28, 0.7],
          ]
        : [
            [0, 1],
            [-0.1, 0.8],
            [0.1, 0.8],
          ],
      evoH ? 0.75 : 1,
      evoH ? 2 : 0,
    );
    const h = this.launchers.halo;
    if (this.levels.halo > 0) {
      const evo = this.evolved.has('evoHalo');
      h.timer += dt;
      if (h.timer >= h.cooldown * this.cdMult * (evo ? 0.5 : 1)) {
        h.timer = 0;
        const n = evo ? P.haloLauncher.projectilesToSpawn * 2 : P.haloLauncher.projectilesToSpawn;
        const a = (2 * Math.PI) / n;
        const dirs: [number, number][] = [];
        for (let i = 0; i < n; i++) dirs.push([r1(Math.sin(a * i)), r1(Math.cos(a * i))]);
        this.fire(
          'halo',
          px,
          py,
          dirs,
          P.haloLauncher.launcher.projectileSpeed,
          P.haloLauncher.launcher.projectileLifetime * (evo ? 1.6 : 1),
          this.projDamage * dm * (evo ? 1.5 : 1),
          this.projPierces + (evo ? 2 : 0),
          false,
        );
        this.events.push({ k: 'fire', kind: 'halo' });
      }
    }
    for (const q of this.projectiles) {
      if (q.mode === 'cross') {
        // bumerangue: vai, desacelera, volta (e repete nos ciclos); a cada meia volta acerta de novo
        const T = (q.life ?? 2) / (q.n ?? 1);
        const age = this.t - (q.born ?? 0);
        const ph = age % T;
        const out = ((q.v0 ?? 300) * T) / Math.PI;
        const u = Math.sin((Math.PI * ph) / T) * out;
        const dx = q.vx / (Math.hypot(q.vx, q.vy) || 1);
        const dy = q.vy / (Math.hypot(q.vx, q.vy) || 1);
        q.x = (q.ox ?? 0) + dx * u;
        q.y = (q.oy ?? 0) + dy * u;
        const half = Math.floor((age / T) * 2);
        if (half !== q.aux) {
          q.aux = half;
          q.hit.clear();
        }
        q.angle += dt * 12;
        continue;
      }
      if (q.mode === 'bomb') {
        const age = this.t - (q.born ?? 0);
        if (age >= BOMB.fly) {
          q.vx = 0;
          q.vy = 0;
        }
      }
      if (q.mode === 'rune') {
        // ricocheteia nas bordas da tela e só acerta o mesmo inimigo de novo depois de um instante
        const px = this.player.x;
        const py = this.player.y;
        if (q.x - px > this.viewHW) q.vx = -Math.abs(q.vx);
        else if (q.x - px < -this.viewHW) q.vx = Math.abs(q.vx);
        if (q.y - py > this.viewHH) q.vy = -Math.abs(q.vy);
        else if (q.y - py < -this.viewHH) q.vy = Math.abs(q.vy);
        q.aux = (q.aux ?? 0) + dt;
        if (q.aux >= RUNES.hit) {
          q.aux = 0;
          q.hit.clear();
        }
        q.angle += dt * 5;
      }
      q.vy += q.gy * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    // bombas e runas evoluídas explodem ao fim do tempo
    for (const q of this.projectiles) {
      if (q.expire > this.t || q.pierces <= 0) continue;
      if (q.mode === 'bomb') this.explodeBomb(q);
      else if (q.mode === 'rune' && q.evo)
        this.blast(q.x, q.y, 90 * this.area, (q.damage ?? 2) * 2, 1.0);
    }
    this.projectiles = this.projectiles.filter((q) => q.expire > this.t && q.pierces > 0);
  }

  // ---- armas novas (Machado giratório, Orbes guardiões, Raio lunar) ----
  /** Posições dos orbes guardiões (para o desenho e a colisão). */
  orbs(): { x: number; y: number; r: number }[] {
    const lv = this.levels.orbit;
    if (lv <= 0) return [];
    const evo = this.evolved.has('evoOrbit');
    const n = 1 + lv + (evo ? 3 : 0);
    const radius = (evo ? 112 : 78 + lv * 3) * this.area;
    const out: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = this.orbAngle + (i * Math.PI * 2) / n;
      out.push({
        x: this.player.x + Math.cos(a) * radius,
        y: this.player.y + 6 + Math.sin(a) * radius,
        r: (evo ? 24 : 17) * this.area,
      });
    }
    return out;
  }

  private tickNewWeapons(dt: number): void {
    const dm = this.dmgMult;
    const px = this.player.x;
    const py = this.player.y;
    // Machado giratório: sobe em arco e cai, atravessando quem estiver no caminho
    const ax = this.levels.axe;
    if (ax > 0) {
      const l = this.launchers.axe;
      l.timer += dt;
      const evo = this.evolved.has('evoAxe');
      if (l.timer >= 2.8 * this.cdMult) {
        l.timer = 0;
        const n = 1 + Math.floor(ax / 2) + (evo ? 3 : 0);
        for (let i = 0; i < n; i++) {
          const vx = (this.rng() * 2 - 1) * 120;
          this.fire(
            'pAxe',
            px,
            py + 10,
            [[vx, 360 + this.rng() * 60]],
            Math.hypot(vx, 380),
            3.4,
            (4 + ax) * dm * (evo ? 2 : 1),
            99,
            false,
            { gy: -760, big: evo },
          );
        }
        this.events.push({ k: 'fire', kind: 'axe' });
      }
    }
    // Orbes guardiões
    if (this.levels.orbit > 0) {
      const evo = this.evolved.has('evoOrbit');
      this.orbAngle += dt * (2.6 + this.levels.orbit * 0.25) * this.swiftMult;
      for (const o of this.orbs()) {
        const shape: Shape = { kind: 'circle', cx: o.x, cy: o.y, r: o.r };
        for (const e of this.enemies) {
          if (e.dead || (this.orbHit.get(e.uid) ?? 0) > this.t) continue;
          if (overlaps(shape, this.enemyShape(e))) {
            this.orbHit.set(e.uid, this.t + 0.45);
            this.damageEnemy(e, (2 + this.levels.orbit * 0.7) * dm * (evo ? 2 : 1));
          }
        }
        for (const b of this.breakables) {
          if ((this.orbHit.get(b.uid) ?? 0) > this.t) continue;
          if (overlaps(shape, this.breakableShape(b))) {
            this.orbHit.set(b.uid, this.t + 0.45);
            this.damageBreakable(b, (2 + this.levels.orbit * 0.7) * dm);
          }
        }
      }
      if (this.tick % 600 === 0)
        for (const [k, v] of this.orbHit) if (v < this.t) this.orbHit.delete(k);
    }
    // Raio lunar: cai sobre inimigos da tela
    const lg = this.levels.lightning;
    if (lg > 0) {
      const l = this.launchers.lightning;
      l.timer += dt;
      const evo = this.evolved.has('evoLightning');
      if (l.timer >= 2.4 * this.cdMult) {
        l.timer = 0;
        const view = this.enemies.filter(
          (e) => !e.dead && Math.abs(e.x - px) < 255 && Math.abs(e.y - py) < 340,
        );
        const n = 1 + Math.floor(lg / 2) + (evo ? 2 : 0);
        for (let i = 0; i < n && view.length; i++) {
          const idx = Math.floor(this.rng() * view.length);
          const t = view.splice(idx, 1)[0]!;
          const dmg = (8 + lg * 2) * dm * (evo ? 1.5 : 1);
          this.events.push({ k: 'bolt', x: t.x, y: t.y });
          if (evo) {
            for (const o of this.enemies)
              if (o !== t && !o.dead && Math.hypot(o.x - t.x, o.y - t.y) < 90 * this.area)
                this.damageEnemy(o, dmg * 0.6);
          }
          this.damageEnemy(t, dmg);
        }
      }
    }
  }

  private tickEnemyLaunchers(dt: number): void {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (
        e.s.trait === 'orb' ||
        e.s.trait === 'spread' ||
        e.s.trait === 'ring' ||
        e.s.trait === 'scythe'
      ) {
        const cd = SHOOT_CD[e.s.trait];
        e.shootTimer += dt;
        if (e.shootTimer >= cd) {
          e.shootTimer = 0;
          const ax = this.player.x - e.x;
          const ay = this.player.y - e.y;
          if (e.s.trait === 'scythe')
            this.fire('axe', e.x, e.y, [[ax, ay]], AXE_LAUNCHER.projectileSpeed, 7, 1, 1, true);
          else if (e.s.trait === 'orb') this.fire('orb', e.x, e.y, [[ax, ay]], 125, 8, 1, 1, true);
          else if (e.s.trait === 'spread') {
            const base = Math.atan2(ay, ax);
            this.fire(
              'orb',
              e.x,
              e.y,
              [-0.35, 0, 0.35].map(
                (o) => [Math.cos(base + o), Math.sin(base + o)] as [number, number],
              ),
              125,
              8,
              1,
              1,
              true,
            );
          } else {
            const dirs: [number, number][] = Array.from({ length: 12 }, (_, i) => [
              Math.cos((i / 12) * Math.PI * 2),
              Math.sin((i / 12) * Math.PI * 2),
            ]);
            this.fire('orb', e.x, e.y, dirs, 120, 6, 1, 1, true);
          }
        }
        continue;
      }
      const cfg = (AXE_LAUNCHER.enemyIds as readonly string[]).includes(e.s.id)
        ? ('axe' as const)
        : (MAGIC_ORB_LAUNCHER.enemyIds as readonly string[]).includes(e.s.id)
          ? ('orb' as const)
          : null;
      if (!cfg) continue;
      const L = cfg === 'axe' ? AXE_LAUNCHER : MAGIC_ORB_LAUNCHER;
      e.shootTimer += dt;
      if (e.shootTimer >= L.cooldown) {
        e.shootTimer = 0;
        this.fire(
          cfg,
          e.x,
          e.y,
          [[this.player.x - e.x, this.player.y - e.y]],
          L.projectileSpeed,
          L.projectileLifetime,
          L.projectileDamage,
          1,
          true,
        );
      }
    }
  }

  // ---- itens ----
  // ---- objetos do cenário ----
  private cellHash(i: number, j: number, salt: number): number {
    let h = (this.brkSeed ^ Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ salt) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /** Gera objetos nas células ao redor do jogador (por hash da célula, sempre iguais para a mesma seed) e solta os que ficaram longe. */
  private tickBreakables(): void {
    if (this.tick % 15 !== 1) return;
    const px = this.player.x;
    const py = this.player.y;
    const ci = Math.floor(px / BREAKABLE_CELL);
    const cj = Math.floor(py / BREAKABLE_CELL);
    for (let j = cj - 2; j <= cj + 2; j++)
      for (let i = ci - 2; i <= ci + 2; i++) {
        const key = i + ',' + j;
        if (this.brkCells.has(key) || this.brkDone.has(key)) continue;
        this.brkCells.add(key);
        if (this.cellHash(i, j, 1) > BREAKABLE_CHANCE) continue;
        const x = (i + 0.15 + this.cellHash(i, j, 2) * 0.7) * BREAKABLE_CELL;
        const y = (j + 0.15 + this.cellHash(i, j, 3) * 0.7) * BREAKABLE_CELL;
        if (Math.hypot(x, y) < 130) continue; // nada em cima do ponto de partida
        this.breakables.push({
          uid: this.nextUid++,
          x,
          y,
          hp: BREAKABLE_HP,
          kind: 0,
          flash: 0,
          cell: key,
        });
      }
    this.breakables = this.breakables.filter((b) => {
      const far = Math.hypot(b.x - px, b.y - py) > BREAKABLE_CELL * 3.2;
      if (far) this.brkCells.delete(b.cell);
      return !far;
    });
  }

  private breakableShape(b: Breakable): Shape {
    return { kind: 'circle', cx: b.x, cy: b.y, r: BREAKABLE_RADIUS };
  }

  private damageBreakable(b: Breakable, dmg: number): void {
    if (b.hp <= 0) return;
    b.hp -= dmg;
    b.flash = 0.1;
    this.events.push({ k: 'breakHit', x: b.x, y: b.y });
    if (b.hp > 0) return;
    this.brokenCount++;
    this.brkDone.add(b.cell);
    this.events.push({ k: 'break', x: b.x, y: b.y, kind: b.kind });
    const r = this.brkRng();
    const at = (): [number, number] => [
      b.x - 14 + this.brkRng() * 28,
      b.y - 14 + this.brkRng() * 28,
    ];
    if (r < 0.3) {
      const n = Math.max(1, Math.round((1 + Math.floor(this.brkRng() * 3)) * this.goldMult));
      for (let i = 0; i < n; i++) this.dropItem('gold', ...at());
    } else if (r < 0.62) this.dropItem('health', b.x, b.y);
    else if (r < 0.74) this.dropItem('magnet', b.x, b.y);
    else for (let i = 0; i < 4; i++) this.dropItem('xp', ...at());
  }

  private moveItems(dt: number): void {
    for (const it of this.items) {
      if (!it.attracted) continue;
      const dx = this.player.x - it.x;
      const dy = this.player.y - it.y;
      const l = Math.hypot(dx, dy) || 1;
      it.x += (dx / l) * it.speed * dt;
      it.y += (dy / l) * it.speed * dt;
      it.speed += ITEM_ATTRACT_ACCEL * dt;
    }
  }

  private itemShape(it: Item): Shape {
    const d = ITEM_SHAPES[it.type];
    return d.shape === 'circle'
      ? { kind: 'circle', cx: it.x + d.ox, cy: it.y + d.oy, r: d.r! }
      : { kind: 'box', cx: it.x + d.ox, cy: it.y + d.oy, w: d.w!, h: d.h! };
  }

  private pickup(it: Item): void {
    this.events.push({ k: 'pickup', type: it.type, x: it.x, y: it.y });
    switch (it.type) {
      case 'xp':
        this.addXp(it.value ?? 1);
        break;
      case 'gold':
        this.gold++;
        break;
      case 'health':
        this.heal(ITEM_SETTINGS.healthPerPotion);
        break;
      case 'magnet':
        // o ímã puxa tudo que estiver no mapa, não só o que está perto
        for (const o of this.items)
          if (!o.attracted && o !== it) {
            o.attracted = true;
            o.speed = 320;
          }
        this.magnets++;
        this.magnet.active = true;
        this.magnet.left = PLAYER_SETTINGS.magnetDuration;
        break;
      case 'chest':
        this.chests++;
        this.openModal('chest');
        break;
    }
  }

  // ---- contatos ----
  private playerShape(): Shape {
    return {
      kind: 'box',
      cx: this.player.x + PLAYER_BOX.ox,
      cy: this.player.y + PLAYER_BOX.oy,
      w: PLAYER_BOX.w,
      h: PLAYER_BOX.h,
    };
  }
  enemyShape(e: Enemy): Shape {
    const b = MONSTER_BY_ID.get(e.s.id)?.box ?? ENEMY_BOX[e.s.graphicsType] ?? ENEMY_BOX.Skeleton!;
    return { kind: 'box', cx: e.x + b.ox, cy: e.y + b.oy, w: b.w, h: b.h };
  }

  private resolveContacts(): void {
    const ps = this.playerShape();
    // espada x inimigos (acerta no começo do contato)
    if (this.weapon.active) {
      const sw = this.swordShape();
      for (const e of this.enemies) {
        if (e.dead) continue;
        const hit = overlaps(sw, this.enemyShape(e));
        if (hit && !this.weapon.inContact.has(e.uid)) {
          this.weapon.inContact.add(e.uid);
          this.damageEnemy(e, this.swordDamage());
          this.knock(e, this.player.x, this.player.y, 150);
        } else if (!hit) this.weapon.inContact.delete(e.uid);
      }
    }
    if (this.weapon.active) {
      const sw = this.swordShape();
      for (const b of this.breakables) {
        const hit = overlaps(sw, this.breakableShape(b));
        if (hit && !this.brkSwing.has(b.uid)) {
          this.brkSwing.add(b.uid);
          this.damageBreakable(b, this.swordDamage());
        } else if (!hit) this.brkSwing.delete(b.uid);
      }
    }
    // projéteis do jogador x inimigos
    for (const q of this.projectiles) {
      if (q.pierces <= 0 || q.hostile || q.mode === 'bomb') continue;
      const qs = scaleShape(PROJECTILE_SHAPE[q.kind](q.x, q.y, q.angle, q.big), this.area);
      for (const e of this.enemies) {
        if (e.dead || q.pierces <= 0 || q.hit.has(e.uid)) continue;
        if (overlaps(qs, this.enemyShape(e))) {
          q.hit.add(e.uid);
          this.damageEnemy(e, e.s.trait === 'shell' ? q.damage * 0.5 : q.damage);
          if (q.mode === 'bone') this.boneBounce(q, e);
          else if (q.mode === 'cross' || q.mode === 'rune') this.knock(e, q.x, q.y, 40);
          else q.pierces--;
        }
      }
      for (const b of this.breakables) {
        if (b.hp <= 0 || q.hit.has(b.uid)) continue;
        if (overlaps(qs, this.breakableShape(b))) {
          q.hit.add(b.uid);
          this.damageBreakable(b, q.damage);
        }
      }
    }
    this.breakables = this.breakables.filter((b) => b.hp > 0);
    for (const b of this.breakables) if (b.flash > 0) b.flash -= STEP;
    // jogador x inimigos (no começo do contato e a cada 0,5 s) e x projéteis inimigos
    const now = new Set<number>();
    const resolveAll = this.collisionTimer >= PLAYER_SETTINGS.collisionDelay;
    if (resolveAll) this.collisionTimer = 0;
    const damageNow: Array<() => void> = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (!this.isGhost(e) && overlaps(ps, this.enemyShape(e))) {
        now.add(e.uid);
        if (!this.playerContacts.has(e.uid) || resolveAll)
          damageNow.push(() => {
            this.hurtPlayer(e.s.damage);
            // Verme Cerebral: drena XP
            if (e.s.trait === 'drain') this.xp = Math.max(0, this.xp - 3);
          });
      }
    }
    this.playerContacts = now;
    for (const q of this.projectiles) {
      if (!q.hostile || q.pierces <= 0) continue;
      if (overlaps(ps, PROJECTILE_SHAPE[q.kind](q.x, q.y, q.angle, false))) {
        q.pierces--;
        damageNow.push(() => this.hurtPlayer(q.damage));
      }
    }
    for (const d of damageNow) d();
    // itens: duas distâncias. Dentro do alcance de coleta (curto) o item é pego; dentro do alcance de atração (maior, cresce com o
    // passivo Imã) ele começa a voar até o jogador; o item Ímã de chão puxa tudo que estiver em MAGNET_RADIUS enquanto dura.
    const attractR = this.attractRadius;
    const px0 = this.player.x;
    const py0 = this.player.y;
    for (const it of this.items) {
      const d = Math.hypot(it.x - px0, it.y - py0);
      if (this.alive && d <= PICK_RADIUS + (it.type === 'chest' ? 8 : 0)) {
        it.speed = -1; // marca coletado
        this.pickup(it);
      } else if (!it.attracted && (d <= attractR || (this.magnet.active && d <= MAGNET_RADIUS))) {
        it.attracted = true;
      }
    }
    this.items = this.items.filter((it) => it.speed !== -1);
  }
}

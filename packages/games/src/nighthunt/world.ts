import { createRng } from '../core/rng';
import { overlaps, type Shape } from './geometry';
import {
  ITEM_ATTRACT_ACCEL,
  ITEM_SHAPES,
  MAGNET_RADIUS,
  PLAYER_BOX,
  PROJECTILE_SHAPE,
  SWORD_ANIM_DURATION,
  SWORD_BOXES,
  SWORD_PIVOT_Y,
  UPGRADE_IDS,
  swordAngleDeg,
  ENEMY_BOX,
  type ItemType,
  type ProjectileKind,
  type UpgradeId,
} from './data';
import {
  AXE_LAUNCHER,
  CIRCULAR_SPAWNERS,
  ENEMIES,
  INDIVIDUAL_SPAWNERS,
  ITEM_SETTINGS,
  MAGIC_ORB_LAUNCHER,
  META_SETTINGS,
  PERIODIC_FOLLOW,
  PLAYER_SETTINGS,
  UPGRADE_LIMITS,
  WAVE_SPAWNERS,
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
}
export const NO_META: MetaLevels = {
  health: 0,
  overallDamage: 0,
  projectilePiercing: 0,
  movementSpeed: 0,
  xpGatherer: 0,
  goldGatherer: 0,
};

export interface NhInput {
  x: number;
  y: number;
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
}
export interface Item {
  uid: number;
  type: ItemType;
  x: number;
  y: number;
  attracted: boolean;
  speed: number;
  born: number;
}
export interface Projectile {
  x: number;
  y: number;
  dx: number;
  dy: number;
  kind: ProjectileKind;
  speed: number;
  expire: number;
  damage: number;
  pierces: number;
  angle: number;
  hostile: boolean;
  hit: Set<number>;
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
  | { k: 'fire'; kind: 'horizontal' | 'diagonal' | 'halo' };

export type Pending = { kind: 'levelUp' | 'chest'; options: UpgradeId[] };

export interface RunResult {
  score: number;
  kills: number;
  gold: number;
  level: number;
  upgrades: Partial<Record<UpgradeId, number>>;
  bossKills: number;
  finalBossKills: number;
  chests: number;
  magnets: number;
  damageTaken: number;
  won: boolean;
}

const BY_ID = new Map(ENEMIES.map((e) => [e.id, e]));
const PERIODIC = new Map<string, { followTime: number; waitTime: number }>(
  PERIODIC_FOLLOW.map((p) => [p.enemyIdToAffect, p]),
);
const r1 = (n: number) => Math.round(n * 10) / 10;

export class NhWorld {
  readonly rng: () => number;
  t = 0;
  tick = 0;
  alive = true;
  player = { x: 0, y: 0, hp: 0, maxHp: 0, speed: 0, face: -1, moving: false, damageMult: 0 };
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
  magnet = { active: false, left: 0, inRange: new Set<number>() };
  levels: Record<UpgradeId, number> = {
    weaponLength: 0,
    weaponDamage: 0,
    horizontal: 0,
    diagonal: 0,
    halo: 0,
    regeneration: 0,
  };
  launchers = {
    horizontal: { timer: 0, waves: 0, burst: 0, burstLeft: 0, burstTimer: 0 },
    diagonal: { timer: 0, waves: 0, burst: 0, burstLeft: 0, burstTimer: 0 },
    halo: { timer: 0, cooldown: 0 },
  };
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
  pending: Pending | null = null;
  queue: Pending[] = [];
  events: NhEvent[] = [];
  private nextUid = 1;
  private collisionTimer = 0;
  private playerContacts = new Set<number>();
  private projContacts = new Set<string>();
  private spawnerTime = 0;
  private spawnTimers: number[];
  private waveLastPos: { x: number; y: number } | null = null;
  private waveLastDir = { x: 0, y: 0 };
  private projPierceDamage: number;
  private projPierces: number;

  constructor(
    seed: string,
    private meta: MetaLevels = NO_META,
  ) {
    this.rng = createRng('nighthunt:' + seed);
    const bonus = (levels: number, key: keyof typeof META_SETTINGS) =>
      levels <= 0 ? 0 : ((META_SETTINGS[key].bonuses as readonly number[])[levels - 1] ?? 0);
    this.player.maxHp = PLAYER_SETTINGS.defaultHP + bonus(meta.health, 'health');
    this.player.hp = this.player.maxHp;
    this.player.speed = PLAYER_SETTINGS.speed + bonus(meta.movementSpeed, 'movementSpeed');
    this.xpMult = 1 + bonus(meta.xpGatherer, 'xpGatherer');
    this.weapon.damage = PLAYER_SETTINGS.weapon.damage + bonus(meta.overallDamage, 'overallDamage');
    this.projPierceDamage = 1 + bonus(meta.overallDamage, 'overallDamage');
    this.projPierces = 1 + bonus(meta.projectilePiercing, 'projectilePiercing');
    this.weapon.timer = 0;
    this.spawnTimers = [
      ...INDIVIDUAL_SPAWNERS.map(() => 0),
      ...CIRCULAR_SPAWNERS.map(() => 0),
      ...WAVE_SPAWNERS.map(() => 0),
    ];
    this.launchers.halo.cooldown = PLAYER_SETTINGS.haloLauncher.launcher.cooldown;
    this.launchers.horizontal.timer = 0;
  }

  // ---- API do cliente ----
  get requiredXp(): number | null {
    return (PLAYER_SETTINGS.requiredXP as readonly number[])[this.level] ?? null;
  }
  drainEvents(): NhEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
  get weaponAngle(): number {
    return swordAngleDeg(this.weapon.t);
  }
  availableUpgrades(): UpgradeId[] {
    const max: Record<UpgradeId, number> = {
      weaponLength: UPGRADE_LIMITS.maxWeaponLengthUpgrades,
      weaponDamage: UPGRADE_LIMITS.maxWeaponDamageUpgrades,
      horizontal: UPGRADE_LIMITS.maxHorizontalProjectileUpgrades,
      diagonal: UPGRADE_LIMITS.maxDiagonalProjectileUpgrades,
      halo: UPGRADE_LIMITS.maxHaloProjectileUpgrades,
      regeneration: UPGRADE_LIMITS.maxRegenerationUpgrades,
    };
    return UPGRADE_IDS.filter((u) => this.levels[u] < max[u]);
  }

  /** O jogador escolheu uma opção da janela de nível ou do baú. */
  choose(id: UpgradeId): void {
    if (!this.pending || !this.pending.options.includes(id)) return;
    this.applyUpgrade(id);
    this.pending = this.queue.shift() ?? null;
  }

  result(won = false): RunResult {
    return {
      score: this.t,
      kills: this.kills,
      gold: this.gold,
      level: this.level,
      upgrades: { ...this.levels },
      bossKills: this.bossKills,
      finalBossKills: this.finalBossKills,
      chests: this.chests,
      magnets: this.magnets,
      damageTaken: this.damageTaken,
      won,
    };
  }

  // ---- passo ----
  step(input: NhInput, dt = STEP): void {
    if (!this.alive || this.pending) return;
    this.tick++;
    this.movePlayer(input, dt);
    this.tickWeapon(dt);
    this.tickMagnet(dt);
    this.tickRegen(dt);
    this.collisionTimer += dt;
    this.tickSpawners(dt);
    this.moveEnemies(dt);
    this.tickLaunchers(dt);
    this.tickEnemyLaunchers(dt);
    this.moveItems(dt);
    this.resolveContacts(dt);
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
    p.x += input.x * k * dt * p.speed;
    p.y += input.y * k * dt * p.speed;
    if (input.x < 0) p.face = -1;
    else if (input.x > 0) p.face = 1;
  }

  private tickWeapon(dt: number): void {
    const w = this.weapon;
    w.timer += dt;
    if (w.timer >= PLAYER_SETTINGS.weapon.strikeDelay) {
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
      cx: px + b.ox * c - b.oy * s,
      cy: py + b.ox * s + b.oy * c,
      w: b.w,
      h: b.h,
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
    this.player.hp -= dmg;
    this.damageTaken += dmg;
    this.events.push({ k: 'playerHit', dmg });
    if (this.player.hp <= 0) {
      this.alive = false;
      this.events.push({ k: 'playerDeath' });
    }
  }

  // ---- níveis e melhorias ----
  private addXp(points: number): void {
    this.xp += points * this.xpMult;
    const req = PLAYER_SETTINGS.requiredXP as readonly number[];
    while (this.level < req.length && this.xp >= req[this.level]!) {
      this.xp -= req[this.level]!;
      this.level++;
      this.events.push({ k: 'levelUp' });
      this.openModal('levelUp');
    }
  }

  private openModal(kind: 'levelUp' | 'chest'): void {
    const avail = this.availableUpgrades();
    if (avail.length === 0) return;
    let options: UpgradeId[];
    if (kind === 'levelUp') {
      const a = avail.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [a[i], a[j]] = [a[j]!, a[i]!];
      }
      options = a.slice(0, 3);
    } else {
      options = [avail[Math.floor(this.rng() * avail.length)]!];
    }
    const p: Pending = { kind, options };
    if (this.pending) this.queue.push(p);
    else this.pending = p;
  }

  private applyUpgrade(id: UpgradeId): void {
    this.levels[id]++;
    const L = PLAYER_SETTINGS;
    switch (id) {
      case 'weaponLength':
        this.weapon.lengthLevel++;
        this.weapon.inContact.clear();
        break;
      case 'weaponDamage':
        this.weapon.damage++;
        break;
      case 'horizontal':
        this.launchers.horizontal.waves += L.horizontalLauncher.wavesToShootPerUpgrade;
        break;
      case 'diagonal':
        this.launchers.diagonal.waves += L.diagonalLauncher.wavesToShootPerUpgrade;
        break;
      case 'halo':
        this.launchers.halo.timer = 0;
        this.launchers.halo.cooldown =
          L.haloLauncher.launcher.cooldown /
          (L.haloLauncher.cooldownDivisorPerUpgrade * this.levels.halo);
        break;
      case 'regeneration':
        this.regen.amount++;
        this.regen.timer = 0;
        break;
    }
  }

  // ---- inimigos ----
  private spawnEnemy(dx: number, dy: number, id: string): Enemy {
    const s = BY_ID.get(id);
    if (!s) throw new Error('inimigo desconhecido ' + id);
    const per = PERIODIC.get(id);
    const lo = s.speed / 2;
    const e: Enemy = {
      uid: this.nextUid++,
      s,
      x: this.player.x + dx,
      y: this.player.y + dy,
      hp: s.health,
      speedX: lo + this.rng() * (s.speed - lo),
      speedY: lo + this.rng() * (s.speed - lo),
      life: s.lifetime,
      faceX: 1,
      flash: 0,
      follow: true,
      stateLeft: per ? per.followTime : 0,
      dirX: 0,
      dirY: 0,
      shootTimer: 0,
      dead: false,
    };
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
    if ((AXE_LAUNCHER.enemyIds as readonly string[]).includes(id)) e.shootTimer = 0;
    this.enemies.push(e);
    return e;
  }

  private tickSpawners(dt: number): void {
    this.spawnerTime += dt;
    const now = this.spawnerTime;
    let n = 0;
    const active = (start: number, stop: number) =>
      start <= now && now <= (stop === -1 ? Infinity : stop);
    for (const sp of INDIVIDUAL_SPAWNERS) {
      const i = n++;
      const c = sp.common;
      if (!active(c.startDelay, c.stopDelay)) continue;
      this.spawnTimers[i] = (this.spawnTimers[i] ?? 0) + dt;
      if ((this.spawnTimers[i] ?? 0) >= c.cooldown) {
        this.spawnTimers[i] = 0;
        const sx = this.rng() < 0.5 ? 1 : -1;
        const sy = this.rng() < 0.5 ? 1 : -1;
        this.spawnEnemy((300 + this.rng() * 300) * sx, (300 + this.rng() * 300) * sy, c.enemyId);
      }
    }
    for (const sp of CIRCULAR_SPAWNERS) {
      const i = n++;
      const c = sp.common;
      if (!active(c.startDelay, c.stopDelay)) continue;
      this.spawnTimers[i] = (this.spawnTimers[i] ?? 0) + dt;
      if ((this.spawnTimers[i] ?? 0) >= c.cooldown) {
        this.spawnTimers[i] = 0;
        const angle = (2 * Math.PI) / sp.enemiesToSpawn;
        for (let k = 0; k < sp.enemiesToSpawn; k++)
          this.spawnEnemy(r1(Math.sin(angle * k)) * 600, r1(Math.cos(angle * k)) * 600, c.enemyId);
      }
    }
    for (const sp of WAVE_SPAWNERS) {
      const i = n++;
      const c = sp.common;
      if (!active(c.startDelay, c.stopDelay)) continue;
      this.spawnTimers[i] = (this.spawnTimers[i] ?? 0) + dt;
      if ((this.spawnTimers[i] ?? 0) >= c.cooldown) {
        this.spawnTimers[i] = 0;
        const bx = (500 + this.rng() * 100) * (this.rng() < 0.5 ? 1 : -1);
        const by = this.rng() * 500 * (this.rng() < 0.5 ? 1 : -1);
        const side = Math.ceil(Math.sqrt(sp.enemiesToSpawn));
        for (let k = 0; k < sp.enemiesToSpawn; k++) {
          const ox = -20 + this.rng() * 40;
          const oy = -20 + this.rng() * 40;
          this.spawnEnemy(
            bx + ox + 50 * (k % side),
            by + oy + 50 * Math.floor(k / side),
            c.enemyId,
          );
        }
      }
    }
  }

  private moveEnemies(dt: number): void {
    const p = this.player;
    const order: Enemy['s']['moveType'][] = ['Follow', 'Launch', 'PeriodicFollow'];
    for (const mt of order) {
      for (const e of this.enemies) {
        if (e.dead || e.s.moveType !== mt) continue;
        let mx = 0;
        let my = 0;
        if (mt === 'Follow') {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const l = Math.hypot(dx, dy);
          if (l > 0) {
            mx = dx / l;
            my = dy / l;
          }
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
          if (e.follow) {
            const dx = p.x - e.x;
            const dy = p.y - e.y;
            const l = Math.hypot(dx, dy);
            if (l > 0) {
              mx = dx / l;
              my = dy / l;
            }
          }
        }
        e.x += mx * e.speedX * dt;
        e.y += my * e.speedY * dt;
        if (mx < 0) e.faceX = -1;
        else if (mx > 0) e.faceX = 1;
        if (e.life > 0) {
          e.life -= dt;
          if (e.life <= 0) e.dead = true; // some sem soltar nada
        }
      }
    }
  }

  private damageEnemy(e: Enemy, dmg: number): void {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.1;
    this.events.push({ k: 'enemyHit', x: e.x, y: e.y, dmg });
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    e.dead = true;
    this.kills++;
    if (e.s.id.endsWith('Boss')) this.bossKills++;
    if (e.s.id === 'FinalBoss') this.finalBossKills++;
    this.events.push({ k: 'enemyDeath', x: e.x, y: e.y });
    const s = e.s;
    const jitter = (): [number, number] => [e.x - 15 + this.rng() * 30, e.y - 15 + this.rng() * 30];
    for (let i = 0; i < s.xpReward; i++) this.dropItem('xp', ...jitter());
    if (s.goldReward > 0) {
      if (s.goldReward < 1) {
        if (this.rng() < s.goldReward) this.dropItem('gold', e.x, e.y);
      } else {
        for (let i = 0; i < s.goldReward; i++) this.dropItem('gold', ...jitter());
      }
    }
    if (this.rng() < s.healthPotionRewardChance) this.dropItem('health', ...jitter());
    if (this.rng() < s.magnetRewardChance) this.dropItem('magnet', ...jitter());
    if (this.rng() < s.chestRewardChance) this.dropItem('chest', ...jitter());
  }

  private dropItem(type: ItemType, x: number, y: number): void {
    this.items.push({ uid: this.nextUid++, type, x, y, attracted: false, speed: 0, born: this.t });
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
  ): void {
    for (const [dx, dy] of dirs) {
      const l = Math.hypot(dx, dy) || 1;
      this.projectiles.push({
        x,
        y,
        dx: dx / l,
        dy: dy / l,
        kind,
        speed,
        expire: this.t + life,
        damage,
        pierces,
        angle: Math.atan2(dy, dx),
        hostile,
        hit: new Set(),
      });
    }
  }

  private tickLaunchers(dt: number): void {
    const P = PLAYER_SETTINGS;
    const px = this.player.x;
    const py = this.player.y;
    type WaveCfg = {
      launcher: {
        projectileLifetime: number;
        projectileSpeed: number;
        wavesDelayMs: number;
        cooldown: number;
      };
    };
    const wave = (key: 'horizontal' | 'diagonal', cfg: WaveCfg, dirs: [number, number][]) => {
      const l = this.launchers[key];
      if (this.levels[key] === 0) return;
      l.timer += dt;
      if (l.timer >= cfg.launcher.cooldown) {
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
            this.projPierceDamage,
            this.projPierces,
            false,
          );
          this.events.push({ k: 'fire', kind: key });
        }
      }
    };
    wave('horizontal', P.horizontalLauncher, [
      [0, 1],
      [-0.1, 0.8],
      [0.1, 0.8],
    ]);
    wave('diagonal', P.diagonalLauncher, [
      [-0.5, -0.5],
      [0.5, -0.5],
    ]);
    const h = this.launchers.halo;
    if (this.levels.halo > 0) {
      h.timer += dt;
      if (h.timer >= h.cooldown) {
        h.timer = 0;
        const n = P.haloLauncher.projectilesToSpawn;
        const a = (2 * Math.PI) / n;
        const dirs: [number, number][] = [];
        for (let i = 0; i < n; i++) dirs.push([r1(Math.sin(a * i)), r1(Math.cos(a * i))]);
        this.fire(
          'halo',
          px,
          py,
          dirs,
          P.haloLauncher.launcher.projectileSpeed,
          P.haloLauncher.launcher.projectileLifetime,
          this.projPierceDamage,
          this.projPierces,
          false,
        );
        this.events.push({ k: 'fire', kind: 'halo' });
      }
    }
    for (const q of this.projectiles) {
      q.x += q.dx * q.speed * dt;
      q.y += q.dy * q.speed * dt;
    }
    this.projectiles = this.projectiles.filter((q) => q.expire > this.t && q.pierces > 0);
  }

  private tickEnemyLaunchers(dt: number): void {
    for (const e of this.enemies) {
      if (e.dead) continue;
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
        this.addXp(1);
        break;
      case 'gold':
        this.gold++;
        break;
      case 'health':
        this.heal(ITEM_SETTINGS.healthPerPotion);
        break;
      case 'magnet':
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
    const b = ENEMY_BOX[e.s.graphicsType] ?? ENEMY_BOX.Skeleton!;
    return { kind: 'box', cx: e.x + b.ox, cy: e.y + b.oy, w: b.w, h: b.h };
  }

  private resolveContacts(_dt: number): void {
    const ps = this.playerShape();
    // espada x inimigos (hit no início do contato)
    if (this.weapon.active) {
      const sw = this.swordShape();
      for (const e of this.enemies) {
        if (e.dead) continue;
        const hit = overlaps(sw, this.enemyShape(e));
        if (hit && !this.weapon.inContact.has(e.uid)) {
          this.weapon.inContact.add(e.uid);
          this.damageEnemy(e, this.weapon.damage);
        } else if (!hit) this.weapon.inContact.delete(e.uid);
      }
    }
    // projéteis do jogador x inimigos; projéteis inimigos x jogador
    for (const q of this.projectiles) {
      if (q.pierces <= 0) continue;
      const qs = PROJECTILE_SHAPE[q.kind](q.x, q.y, q.angle);
      if (!q.hostile) {
        for (const e of this.enemies) {
          if (e.dead || q.pierces <= 0 || q.hit.has(e.uid)) continue;
          if (overlaps(qs, this.enemyShape(e))) {
            q.hit.add(e.uid);
            this.damageEnemy(e, q.damage);
            q.pierces--;
          }
        }
      }
    }
    // jogador x (inimigos, projéteis inimigos, itens)
    const now = new Set<number>();
    const begin: Array<() => void> = [];
    const resolveAll = this.collisionTimer >= PLAYER_SETTINGS.collisionDelay;
    if (resolveAll) this.collisionTimer = 0;
    const damageNow: Array<() => void> = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (overlaps(ps, this.enemyShape(e))) {
        now.add(e.uid);
        if (!this.playerContacts.has(e.uid) || resolveAll)
          damageNow.push(() => this.hurtPlayer(e.s.damage));
      }
    }
    this.playerContacts = now;
    for (const q of this.projectiles) {
      if (!q.hostile || q.pierces <= 0) continue;
      if (overlaps(ps, PROJECTILE_SHAPE[q.kind](q.x, q.y, q.angle))) {
        q.pierces--;
        damageNow.push(() => this.hurtPlayer(q.damage));
      }
    }
    for (const d of damageNow) d();
    void begin;
    // itens: o contato com o jogador coleta na hora; o ímã atrai
    for (const it of this.items) {
      const sh = this.itemShape(it);
      if (this.alive && overlaps(ps, sh)) {
        it.speed = -1; // marca coletado
        this.pickup(it);
        if (this.pending) {
          // janela aberta: o resto do passo continua só para limpar o que já foi coletado
        }
      } else if (
        this.magnet.active &&
        !it.attracted &&
        overlaps({ kind: 'circle', cx: this.player.x, cy: this.player.y, r: MAGNET_RADIUS }, sh)
      ) {
        it.attracted = true;
      }
    }
    this.items = this.items.filter((it) => it.speed !== -1);
  }
}

export function metaCost(key: keyof typeof META_SETTINGS, level: number): number | null {
  return (META_SETTINGS[key].costs as readonly number[])[level] ?? null;
}
export function metaBonus(key: keyof typeof META_SETTINGS, level: number): number {
  return level <= 0 ? 0 : ((META_SETTINGS[key].bonuses as readonly number[])[level - 1] ?? 0);
}

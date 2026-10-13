import { createRng } from '../core/rng';
import {
  AUTO_ROTATE_EVERY,
  BAD_DURATION,
  BAD_SPELLS,
  BIG_SCALE,
  COLLAPSE_COUNT,
  COLLAPSE_WINDOW,
  FALL_BASE,
  FALL_MAX,
  FALL_PER_PIECE,
  FAST_FACTOR,
  FIELD_HALF,
  GOOD_CHANCE,
  GOOD_SPELLS,
  ICE_FRICTION,
  KILL_Y,
  LAND_TIME,
  LAND_TIME_FAST,
  MAX_HELD_SPELLS,
  MAX_LIVES,
  MOVE_FIRST_DELAY,
  MOVE_REPEAT,
  MOVE_STEP,
  NORMAL_FRICTION,
  OVER_DELAY,
  PLATFORM_H,
  PLATFORM_W,
  SETTLE_SPEED,
  SETTLE_SPIN,
  SETTLE_TIME,
  SOFT_DROP,
  SPAWN_DELAY,
  SPAWN_GAP,
  SPELL_EVERY,
  TOWERS_DT,
  TOWER_KINDS,
  type BadSpell,
  type GoodSpell,
} from './constants';
import { Body, World, mergeBodies, type BoxDef } from './physics';

/** O que a pessoa está apertando agora. */
export interface TowersInput {
  left: boolean;
  right: boolean;
  down: boolean;
}

export type TowersEvent =
  | { type: 'spawn'; kind: number }
  | { type: 'move'; dir: number }
  | { type: 'rotate' }
  | { type: 'blocked' }
  | { type: 'land'; x: number; y: number; speed: number }
  | { type: 'release'; x: number; y: number; kind: number }
  | { type: 'settle'; x: number; y: number; stacked: number; kind: number }
  | { type: 'fall'; x: number; y: number; kind: number }
  | { type: 'life'; lives: number; delta: number }
  | { type: 'collapse'; count: number }
  | { type: 'spell'; good: boolean; name: GoodSpell | BadSpell }
  | { type: 'cast'; name: GoodSpell; x: number; y: number }
  | { type: 'ivy'; x: number; y: number; count: number }
  | { type: 'petrify'; x: number; y: number }
  | { type: 'over' };

export interface TowerPiece {
  id: number;
  kind: number;
  scale: number;
  /** Casas já giradas, com a primeira linha e coluna em 0. */
  cells: [number, number][];
  /** Largura e altura da caixa que envolve a peça, em casas. */
  w: number;
  h: number;
  body: Body;
  /** Onde fica o centro de massa em relação ao canto de cima à esquerda (em unidades). */
  comx: number;
  comy: number;
  phase: 'active' | 'free';
  settled: boolean;
  restTimer: number;
  ivy: boolean;
  stone: boolean;
  ice: boolean;
  noRotate: boolean;
  autoRotate: boolean;
  fast: boolean;
  dead: boolean;
  /** invI de verdade, guardado enquanto a pessoa segura a peça (sem giro). */
  realInvI: number;
}

export interface TowersEffects {
  gelo: number;
  grande: number;
  rapida: number;
  nevoa: number;
  gira: number;
  semgiro: number;
}

export interface TowersResult {
  /** O maior número de peças empilhadas. */
  score: number;
  pieces: number;
  lives: number;
  time: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function rotateCw(cells: readonly (readonly [number, number])[]): [number, number][] {
  let maxY = 0;
  for (const [, y] of cells) maxY = Math.max(maxY, y);
  const out = cells.map(([x, y]): [number, number] => [maxY - y, x]);
  return out;
}

function normalize(cells: [number, number][]): [number, number][] {
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of cells) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
  }
  return cells.map(([x, y]): [number, number] => [x - minX, y - minY]);
}

/** O alto de um corpo no mundo (o menor y de todas as caixas). */
export function bodyTop(body: Body): number {
  let top = Infinity;
  for (const b of body.boxes) {
    const wy = body.y + body.s * b.cx + body.c * b.cy;
    const rc = body.c * b.rc - body.s * b.rs;
    const rs = body.s * b.rc + body.c * b.rs;
    top = Math.min(top, wy - (Math.abs(rc) * b.hh + Math.abs(rs) * b.hw));
  }
  return top;
}

/**
 * O Block Towers, modo das 3 vidas (spec 022): a peça desce, a pessoa a encaixa na torre, a física
 * decide o resto. Cada peça que cai custa uma vida; a nota é o máximo de peças empilhadas.
 * Tudo sai da seed e das entradas, em passo fixo.
 */
export class TowersGame {
  readonly seed: string;
  readonly world = new World({ gravity: 30, iterations: 10, substeps: 2 });
  readonly platform: Body;
  pieces: TowerPiece[] = [];
  active: TowerPiece | null = null;
  lives = MAX_LIVES;
  /** Peças soltas e ainda na torre. */
  stacked = 0;
  /** O maior `stacked` visto: é a nota. */
  peak = 0;
  /** Peças que já nasceram. */
  spawned = 0;
  /** Peças que já foram soltas. */
  releasedCount = 0;
  time = 0;
  over = false;
  held: GoodSpell[] = [];
  fx: TowersEffects = { gelo: 0, grande: 0, rapida: 0, nevoa: 0, gira: 0, semgiro: 0 };
  /** As próximas peças (índices do catálogo). */
  queue: number[] = [];
  events: TowersEvent[] = [];

  private rng: () => number;
  private nextPieceId = 1;
  private spawnTimer = 0.5;
  private endTimer = -1;
  private targetTl = 0;
  private moveDir = 0;
  private moveTimer = 0;
  /** Toques na esquerda/direita ainda não aplicados (cada um é uma casa, na hora). */
  private presses: number[] = [];
  /** A peça que desce já pousou em cima de algo: daí em diante não anda nem gira mais. */
  private touched = false;
  /** Velocidade pedida para a peça que desce neste passo (ela se move sem empurrar ninguém). */
  private cmdVx = 0;
  private cmdVy = 0;
  /** A descida da peça foi barrada neste passo por algo que não a apoia por baixo (uma peça torta ao lado). */
  private blockedY = false;
  private stuckTimer = 0;
  private landTimer = 0;
  private autoTimer = 0;
  private fallTimes: number[] = [];
  private lastCollapse = -10;
  private releasedOrder: TowerPiece[] = [];
  private spellsGiven = 0;
  private goodBag: GoodSpell[] = [];
  private badBag: BadSpell[] = [];

  constructor(seed: string) {
    this.seed = seed;
    this.rng = createRng(`towers:${seed}`);
    const plat = new Body();
    plat.friction = NORMAL_FRICTION;
    plat.setBoxes([{ cx: 0, cy: PLATFORM_H / 2, hw: PLATFORM_W / 2, hh: PLATFORM_H / 2, rc: 1, rs: 0 }], 1, true);
    plat.x = 0;
    plat.y = PLATFORM_H / 2;
    this.platform = this.world.add(plat);
    this.fillQueue();
  }

  /** A sacola de 7: todas as peças aparecem antes de qualquer repetir. */
  private fillQueue() {
    while (this.queue.length < 6) {
      const bag = TOWER_KINDS.map((k) => k.id);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [bag[i], bag[j]] = [bag[j]!, bag[i]!];
      }
      this.queue.push(...bag);
    }
  }

  drainEvents(): TowersEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  get result(): TowersResult {
    return { score: this.peak, pieces: this.releasedCount, lives: this.lives, time: this.time };
  }

  /** O topo da torre (menor y), contando a plataforma. */
  towerTop(): number {
    let top = 0;
    for (const p of this.pieces) {
      if (p.dead || p.phase === 'active') continue;
      top = Math.min(top, bodyTop(p.body));
    }
    return top;
  }

  /**
   * Quanto a peça que desce ainda cai em linha reta até bater em algo (para o guia da tela). Anda
   * em passos e refina; não mexe no jogo.
   */
  dropDistance(): number {
    const p = this.active;
    if (!p) return 0;
    const body = p.body;
    const y0 = body.y;
    const MAX = 40;
    let d = 0;
    while (d < MAX) {
      body.y = y0 + d + 0.5;
      if (this.world.overlaps(body, 0.02)) break;
      d += 0.5;
    }
    let a = d;
    let b = Math.min(d + 0.5, MAX);
    for (let i = 0; i < 5; i++) {
      const m = (a + b) / 2;
      body.y = y0 + m;
      if (this.world.overlaps(body, 0.02)) b = m;
      else a = m;
    }
    body.y = y0;
    return a;
  }

  private fallSpeed(p: TowerPiece): number {
    const base = Math.min(FALL_BASE + this.releasedCount * FALL_PER_PIECE, FALL_MAX);
    return p.fast ? base * FAST_FACTOR : base;
  }

  // --- Montar o corpo da peça -------------------------------------------------------------
  private buildBoxes(cells: readonly (readonly [number, number])[], scale: number, tag: number): BoxDef[] {
    return cells.map(([x, y]) => ({
      cx: (x + 0.5) * scale,
      cy: (y + 0.5) * scale,
      hw: 0.5 * scale,
      hh: 0.5 * scale,
      rc: 1,
      rs: 0,
      tag,
    }));
  }

  /** (Re)monta o corpo com estas casas, com o canto de cima à esquerda em (tlx, tly). */
  private shape(p: TowerPiece, cells: [number, number][], tlx: number, tly: number) {
    const body = p.body;
    let maxX = 0;
    let maxY = 0;
    for (const [x, y] of cells) {
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    p.cells = cells;
    p.w = maxX + 1;
    p.h = maxY + 1;
    const { comx, comy } = body.setBoxes(this.buildBoxes(cells, p.scale, p.kind));
    p.comx = comx;
    p.comy = comy;
    p.realInvI = body.invI;
    if (p.phase === 'active') body.invI = 0;
    body.c = 1;
    body.s = 0;
    body.x = tlx + comx;
    body.y = tly + comy;
    this.world.clearContacts(body);
  }

  private spawn() {
    this.fillQueue();
    const kind = this.queue.shift()!;
    const def = TOWER_KINDS[kind]!;
    const scale = this.fx.grande > 0 ? BIG_SCALE : 1;
    if (this.fx.grande > 0) this.fx.grande--;
    const ice = this.fx.gelo > 0;
    if (ice) this.fx.gelo--;
    const fast = this.fx.rapida > 0;
    if (fast) this.fx.rapida--;
    const autoRotate = this.fx.gira > 0;
    if (autoRotate) this.fx.gira--;
    const noRotate = this.fx.semgiro > 0;
    if (noRotate) this.fx.semgiro--;

    const body = new Body();
    body.friction = ice ? ICE_FRICTION : NORMAL_FRICTION;
    body.held = true;
    const piece: TowerPiece = {
      id: this.nextPieceId++,
      kind,
      scale,
      cells: [],
      w: 0,
      h: 0,
      body,
      comx: 0,
      comy: 0,
      phase: 'active',
      settled: false,
      restTimer: 0,
      ivy: false,
      stone: false,
      ice,
      noRotate,
      autoRotate,
      fast,
      dead: false,
      realInvI: 0,
    };
    body.data = { pieces: [piece] };
    const cells = normalize(def.cells.map(([x, y]): [number, number] => [x, y]));
    let maxX = 0;
    let maxY = 0;
    for (const [x, y] of cells) {
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const w = (maxX + 1) * scale;
    const h = (maxY + 1) * scale;
    const tlx = Math.round(-w / 2);
    const tly = this.towerTop() - SPAWN_GAP - h;
    this.presses = [];
    this.world.add(body);
    this.shape(piece, cells, tlx, tly);
    body.vx = 0;
    body.vy = this.fallSpeed(piece);
    body.w = 0;
    this.targetTl = tlx;
    this.moveDir = 0;
    this.moveTimer = 0;
    this.touched = false;
    this.blockedY = false;
    this.stuckTimer = 0;
    this.landTimer = 0;
    this.autoTimer = AUTO_ROTATE_EVERY;
    this.pieces.push(piece);
    this.active = piece;
    this.spawned++;
    this.events.push({ type: 'spawn', kind });
  }

  // --- Controles --------------------------------------------------------------------------
  /**
   * Um toque para o lado: a peça anda UMA casa na hora, sem esperar o toque anterior terminar.
   * Vale mesmo que o toque seja mais curto que um quadro (a fila é aplicada no próximo passo).
   */
  press(dir: number) {
    if (dir === 0 || this.over) return;
    this.presses.push(dir < 0 ? -1 : 1);
    if (this.presses.length > 8) this.presses.shift();
  }

  /** Anda uma casa para o lado, agora. Falso se algo trava (a torre, a borda) ou a peça já encostou. */
  private nudge(p: TowerPiece, dir: number): boolean {
    if (this.touched) return false;
    const body = p.body;
    const tl = body.x - p.comx;
    const next = clamp(Math.round(tl) + dir * MOVE_STEP, -FIELD_HALF, FIELD_HALF - p.w * p.scale);
    const dx = next - tl;
    if (Math.abs(dx) < 0.001) return false;
    body.x += dx;
    if (this.world.overlaps(body, 0.02)) {
      body.x -= dx;
      return false;
    }
    this.targetTl = next;
    this.events.push({ type: 'move', dir: Math.sign(dx) });
    return true;
  }

  /** Gira a peça que desce, 90 graus. Tenta uma folga para o lado se bater em algo. */
  rotate(): boolean {
    const p = this.active;
    if (!p || this.over || p.noRotate) return false;
    // Encostou em algo: a peça está travada, só desce.
    if (this.touched) {
      this.events.push({ type: 'blocked' });
      return false;
    }
    return this.doRotate(p);
  }

  private doRotate(p: TowerPiece): boolean {
    const body = p.body;
    const tlx = body.x - p.comx;
    const tly = body.y - p.comy;
    const cx = tlx + (p.w * p.scale) / 2;
    const cy = tly + (p.h * p.scale) / 2;
    const old = { cells: p.cells, tlx, tly };
    const next = normalize(rotateCw(p.cells));
    const nw = Math.max(...next.map(([x]) => x)) + 1;
    const nh = Math.max(...next.map(([, y]) => y)) + 1;
    const baseX = Math.round(cx - (nw * p.scale) / 2);
    const baseY = cy - (nh * p.scale) / 2;
    for (const [dx, dy] of [
      [0, 0],
      [MOVE_STEP, 0],
      [-MOVE_STEP, 0],
      [2 * MOVE_STEP, 0],
      [-2 * MOVE_STEP, 0],
      [0, -1],
      [MOVE_STEP, -1],
      [-MOVE_STEP, -1],
    ] as const) {
      const x = clamp(baseX + dx, -FIELD_HALF, FIELD_HALF - nw * p.scale);
      this.shape(p, next, x, baseY + dy);
      if (!this.world.overlaps(body, 0.02)) {
        this.targetTl = x;
        this.events.push({ type: 'rotate' });
        return true;
      }
    }
    this.shape(p, old.cells, old.tlx, old.tly);
    this.events.push({ type: 'blocked' });
    return false;
  }

  /** Usa a primeira magia boa guardada. */
  castSpell(): boolean {
    if (this.over || this.held.length === 0) return false;
    const name = this.held[0]!;
    const p = this.active;
    if (name === 'vinha') {
      if (!p || p.ivy) return false;
      p.ivy = true;
    } else if (name === 'cimento') {
      if (!p || p.stone) return false;
      p.stone = true;
    } else if (name === 'desfazer') {
      if (!this.undoLast()) return false;
    } else if (name === 'vida') {
      if (this.lives >= MAX_LIVES) return false;
      this.lives++;
      this.events.push({ type: 'life', lives: this.lives, delta: 1 });
    }
    this.held.shift();
    const at = p ? { x: p.body.x, y: p.body.y } : { x: 0, y: this.towerTop() };
    this.events.push({ type: 'cast', name, x: at.x, y: at.y });
    return true;
  }

  private undoLast(): boolean {
    for (let i = this.releasedOrder.length - 1; i >= 0; i--) {
      const p = this.releasedOrder[i]!;
      if (p.dead || p.body.isStatic) continue;
      const list = (p.body.data.pieces as TowerPiece[]).slice();
      for (const q of list) q.dead = true;
      this.world.remove(p.body);
      this.recount();
      return true;
    }
    return false;
  }

  private recount() {
    this.stacked = this.pieces.filter((p) => !p.dead && p.phase === 'free').length;
  }

  // --- Passo ------------------------------------------------------------------------------
  step(input: TowersInput, dt = TOWERS_DT) {
    if (this.over) return;
    this.time += dt;

    if (!this.active && this.lives > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) this.spawn();
    }
    if (this.active) {
      this.control(this.active, input, dt);
      this.moveActive(this.active, dt);
    }

    this.world.step(dt);

    // batidas
    let hit: { speed: number; x: number; y: number } | null = null;
    for (const im of this.world.impacts) {
      if (!hit || im.speed > hit.speed) hit = { speed: im.speed, x: im.x, y: im.y };
    }
    if (hit) this.events.push({ type: 'land', ...hit });

    if (this.active && !this.touched && this.world.supportedBelow(this.active.body)) {
      // A peça pousou em cima de algo (a torre ou a plataforma): trava os movimentos e dá o "toc".
      // Encostar só de lado, descendo ao lado da torre, NÃO trava: dá para deslizar para um vão.
      this.touched = true;
      this.targetTl = this.active.body.x - this.active.comx;
      this.events.push({ type: 'land', x: this.active.body.x, y: this.active.body.y, speed: Math.max(1.6, this.cmdVy) });
    }
    if (this.active) this.checkLanding(this.active, input, dt);
    this.trackPieces(dt);
    this.checkFalls();

    if (this.lives <= 0 && this.endTimer < 0) this.endTimer = OVER_DELAY;
    if (this.endTimer >= 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        this.over = true;
        this.events.push({ type: 'over' });
      }
    }
  }

  private control(p: TowerPiece, input: TowersInput, dt: number) {
    const body = p.body;
    // Anda de bloco em bloco, NA HORA: cada toque é uma casa inteira e a troca de direção é
    // instantânea. Primeiro os toques que chegaram (mesmo os mais curtos que um quadro)...
    let pressed = 0;
    for (const d of this.presses) {
      this.nudge(p, d);
      pressed = d;
    }
    this.presses = [];
    // ...depois, segurar o botão repete as casas, devagar.
    const dir = this.touched ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      if (dir !== this.moveDir) {
        // Começou a segurar agora: se o toque já andou uma casa, só arma a repetição.
        if (pressed !== dir) this.nudge(p, dir);
        this.moveTimer = MOVE_FIRST_DELAY;
      } else {
        this.moveTimer -= dt;
        if (this.moveTimer <= 0) {
          this.nudge(p, dir);
          this.moveTimer = MOVE_REPEAT;
        }
      }
    }
    this.moveDir = dir;
    this.cmdVx = 0;
    const speed = input.down ? Math.max(SOFT_DROP, this.fallSpeed(p)) : this.fallSpeed(p);
    this.cmdVy = this.landTimer > 0 ? 0 : speed;
    body.vx = 0;
    body.vy = 0;
    body.w = 0;
    if (p.autoRotate && !this.touched) {
      this.autoTimer -= dt;
      if (this.autoTimer <= 0) {
        this.autoTimer = AUTO_ROTATE_EVERY;
        this.doRotate(p);
      }
    }
  }

  /**
   * A peça que a pessoa segura se move sozinha, sem passar pelo motor: anda o que o controle pede e,
   * se bater em algo, para antes (aproxima até encostar). Assim ela NUNCA empurra a torre; só a
   * física depois de solta (o peso dela) pode derrubar alguma coisa.
   */
  private moveActive(p: TowerPiece, dt: number) {
    const body = p.body;
    const slide = (axis: 'x' | 'y', d: number) => {
      if (d === 0) return;
      body[axis] += d;
      if (!this.world.overlaps(body, 0.02)) return;
      body[axis] -= d;
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        body[axis] += d * mid;
        const bad = this.world.overlaps(body, 0.02);
        body[axis] -= d * mid;
        if (bad) hi = mid;
        else lo = mid;
      }
      body[axis] += d * lo;
    };
    slide('x', this.cmdVx * dt);
    const before = body.y;
    const want = this.cmdVy * dt;
    slide('y', want);
    this.blockedY = want > 0 && body.y - before < want - 1e-6;
  }

  private checkLanding(p: TowerPiece, input: TowersInput, dt: number) {
    const supported = this.world.supportedBelow(p.body);
    // Presa no ar (algo torto a barra sem apoiar por baixo) por muito tempo: solta e vira física.
    if (this.blockedY && !supported) this.stuckTimer += dt;
    else this.stuckTimer = 0;
    if (this.stuckTimer >= 0.6) {
      this.release(p);
      return;
    }
    if (supported) this.landTimer += dt;
    else this.landTimer = Math.max(0, this.landTimer - dt * 2);
    const need = input.down ? LAND_TIME_FAST : LAND_TIME;
    if (this.landTimer >= need) this.release(p);
  }

  /** A peça deixa de ser da pessoa e vira parte da torre. */
  private release(p: TowerPiece) {
    const body = p.body;
    p.phase = 'free';
    body.held = false;
    body.invI = p.realInvI;
    body.vx = 0;
    body.vy = 0;
    this.active = null;
    this.landTimer = 0;
    this.spawnTimer = SPAWN_DELAY;
    this.releasedCount++;
    this.releasedOrder.push(p);
    this.recount();
    this.events.push({ type: 'release', x: body.x, y: body.y, kind: p.kind });
    if (this.fx.nevoa > 0) this.fx.nevoa--;

    if (p.ivy) {
      const near = this.world.touching(body, 0.1);
      const groupBodies = [body, ...near.filter((b) => !b.isStatic)];
      const touchesGround = near.some((b) => b.isStatic);
      const merged = mergeBodies(this.world, groupBodies, Math.min(...groupBodies.map((b) => b.friction)));
      const all: TowerPiece[] = [];
      for (const b of groupBodies) for (const q of (b.data.pieces as TowerPiece[] | undefined) ?? []) all.push(q);
      merged.data = { pieces: all, ivy: true };
      for (const q of all) q.body = merged;
      if (touchesGround) merged.makeStatic();
      this.events.push({ type: 'ivy', x: merged.x, y: merged.y, count: groupBodies.length });
    }
    if (p.stone && !p.body.isStatic) {
      p.body.makeStatic();
      this.events.push({ type: 'petrify', x: p.body.x, y: p.body.y });
    }

    // Uma magia a cada tantas peças
    if (this.releasedCount % SPELL_EVERY === 0) this.grantSpell();
  }

  /**
   * As magias saem de "sacolas" embaralhadas (uma de boas, outra de ruins): nenhuma repete até todas
   * as outras do mesmo tipo terem saído. A primeira magia da partida é sempre boa, para começar
   * com um presente.
   */
  private drawFrom<T extends string>(bag: T[], all: readonly T[], ok: (x: T) => boolean = () => true): T {
    if (bag.length === 0) {
      const fresh = [...all];
      for (let i = fresh.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [fresh[i], fresh[j]] = [fresh[j]!, fresh[i]!];
      }
      bag.push(...fresh);
    }
    const at = bag.findIndex(ok);
    return bag.splice(at >= 0 ? at : 0, 1)[0]!;
  }

  private grantSpell() {
    const good = this.spellsGiven === 0 || this.rng() < GOOD_CHANCE;
    this.spellsGiven++;
    if (good) {
      const name = this.drawFrom(
        this.goodBag,
        GOOD_SPELLS,
        (x) => (x !== 'vida' || this.lives < MAX_LIVES) && (x !== 'desfazer' || this.stacked > 0),
      );
      this.held.push(name);
      while (this.held.length > MAX_HELD_SPELLS) this.held.shift();
      this.events.push({ type: 'spell', good: true, name });
    } else {
      const name = this.drawFrom(this.badBag, BAD_SPELLS);
      this.fx[name] += BAD_DURATION[name];
      this.events.push({ type: 'spell', good: false, name });
    }
  }

  private trackPieces(dt: number) {
    let settledNow = false;
    for (const p of this.pieces) {
      if (p.dead || p.phase !== 'free') continue;
      const b = p.body;
      const calm = b.isStatic || (Math.hypot(b.vx, b.vy) < SETTLE_SPEED && Math.abs(b.w) < SETTLE_SPIN);
      if (calm) {
        p.restTimer += dt;
        if (!p.settled && p.restTimer >= SETTLE_TIME) {
          p.settled = true;
          settledNow = true;
          this.recount();
          this.peak = Math.max(this.peak, this.stacked);
          this.events.push({ type: 'settle', x: b.x, y: b.y, stacked: this.stacked, kind: p.kind });
        }
      } else {
        p.restTimer = 0;
        if (p.settled && Math.hypot(b.vx, b.vy) > 1.5) p.settled = false;
      }
    }
    void settledNow;
  }

  private checkFalls() {
    const fallen: Body[] = [];
    for (const b of this.world.bodies) if (!b.isStatic && b.y > KILL_Y) fallen.push(b);
    for (const b of fallen) {
      const list = ((b.data.pieces as TowerPiece[] | undefined) ?? []).filter((q) => !q.dead);
      this.world.remove(b);
      let lost = 0;
      for (const q of list) {
        q.dead = true;
        lost++;
        if (q === this.active) {
          this.active = null;
          this.landTimer = 0;
          this.spawnTimer = SPAWN_DELAY;
        }
        this.events.push({ type: 'fall', x: b.x, y: KILL_Y, kind: q.kind });
        this.fallTimes.push(this.time);
      }
      if (lost > 0 && this.lives > 0) {
        const before = this.lives;
        this.lives = Math.max(0, this.lives - lost);
        this.events.push({ type: 'life', lives: this.lives, delta: this.lives - before });
      }
      this.recount();
    }
    this.fallTimes = this.fallTimes.filter((t) => this.time - t <= COLLAPSE_WINDOW);
    if (this.fallTimes.length >= COLLAPSE_COUNT && this.time - this.lastCollapse > 3) {
      this.lastCollapse = this.time;
      this.events.push({ type: 'collapse', count: this.fallTimes.length });
    }
  }
}

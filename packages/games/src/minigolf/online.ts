import { createRng } from '../core/rng';
import { GOLF_LEVELS, GOLF_FAIL_STROKES, GOLF_STROKE_LIMIT, GOLF_TIERS, golfCountedStrokes, type GolfTier } from './rules';
import { GOLF_BALL_RADIUS, GOLF_DT, GolfLevel, golfHit, golfNewBall, golfStep, type GolfBall, type GolfLevelData, type V3 } from './physics';

/** Mini Golf online (spec 082): constantes, sorteio das fases e a simulação de um buraco com várias bolas. */
export const GOLF_ROOM_MAX = 8;
/** Contagem antes de cada buraco e pausa mostrando o resultado, em ms. */
export const GOLF_INTRO_MS = 3500;
export const GOLF_CLEARED_MS = 3800;
/** Quantos buracos a sala aceita, quais dificuldades e quanto tempo cada buraco dura (s). */
export const GOLF_ROOM_HOLES = [3, 6, 9, 12, 18, 30, 40] as const;
export const GOLF_ROOM_TIERS = ['mix', 'easy', 'medium', 'hard'] as const;
export type GolfRoomTier = (typeof GOLF_ROOM_TIERS)[number];
export const GOLF_ROOM_DEFAULTS = { holes: 9, tier: 'mix' as GolfRoomTier, seconds: 180, collide: true };

/** As fases da partida: sorteadas pela seed (sempre as mesmas para todos), sem repetir, da dificuldade escolhida. */
export function golfPickLevels(seed: string, count: number, tier: GolfRoomTier): number[] {
  const pool = tier === 'mix' ? Array.from({ length: GOLF_LEVELS }, (_, i) => i + 1) : [...GOLF_TIERS[tier as GolfTier]];
  const rng = createRng(`golf:${seed}`);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

/** Colisão entre duas bolas (massas iguais, quase elástica). Devolve a força do choque, ou 0 se não encostaram. */
export function golfBallCollide(a: GolfBall, b: GolfBall): number {
  const dx = a.pos[0] - b.pos[0], dy = a.pos[1] - b.pos[1], dz = a.pos[2] - b.pos[2];
  const d = Math.hypot(dx, dy, dz);
  const min = GOLF_BALL_RADIUS * 2;
  if (d >= min || d === 0) return 0;
  const nx = dx / d, ny = dy / d, nz = dz / d;
  const push = (min - d) / 2;
  a.pos = [a.pos[0] + nx * push, a.pos[1] + ny * push, a.pos[2] + nz * push];
  b.pos = [b.pos[0] - nx * push, b.pos[1] - ny * push, b.pos[2] - nz * push];
  const vn = (a.vel[0] - b.vel[0]) * nx + (a.vel[1] - b.vel[1]) * ny + (a.vel[2] - b.vel[2]) * nz;
  if (vn >= 0) return 0;
  const j = (-(1 + 0.92) * vn) / 2;
  a.vel = [a.vel[0] + j * nx, a.vel[1] + j * ny, a.vel[2] + j * nz];
  b.vel = [b.vel[0] - j * nx, b.vel[1] - j * ny, b.vel[2] - j * nz];
  for (const x of [a, b]) {
    if (Math.hypot(...x.vel) > 0.1) {
      x.moving = true;
      x.slowTime = 0;
    }
  }
  return -vn;
}

export type GolfStatus = 'aim' | 'roll' | 'holed' | 'failed';
export interface GolfPlayer {
  id: string;
  ball: GolfBall;
  strokes: number;
  status: GolfStatus;
  start: V3;
  stoppedFor: number;
  inWaterFor: number;
  lastRim: boolean;
  lastBounce: number;
}
/** Acontecimentos que viram som e animação nos aparelhos. `v` é a força, quando faz sentido. */
export interface GolfEvent {
  type: 'hit' | 'bounce' | 'rim' | 'drop' | 'plop' | 'splash' | 'holed' | 'failed' | 'reset' | 'clack';
  id: string;
  v?: number;
  /** Quantas tacadas valeu o buraco (em `holed`). */
  strokes?: number;
}

/** Um buraco com várias bolas: a mesma física do offline, mais colisão entre bolas, limite de tacadas e de tempo. */
export class GolfHoleSim {
  readonly level: GolfLevel;
  t = 0;
  readonly players = new Map<string, GolfPlayer>();
  events: GolfEvent[] = [];

  constructor(
    data: GolfLevelData,
    ids: string[],
    readonly opts: { collide: boolean; seconds: number },
  ) {
    this.level = new GolfLevel(data);
    for (const id of ids) {
      const ball = golfNewBall(data);
      this.players.set(id, { id, ball, strokes: 0, status: 'aim', start: [...ball.pos] as V3, stoppedFor: 0, inWaterFor: 0, lastRim: false, lastBounce: -1 });
    }
  }

  /** A tacada de `id`. Só vale com a bola parada, no buraco ainda aberto e abaixo do limite. */
  shoot(id: string, dir: [number, number], power: number): boolean {
    const p = this.players.get(id);
    if (!p || p.status !== 'aim' || p.ball.moving || p.strokes >= GOLF_STROKE_LIMIT) return false;
    if (!Number.isFinite(dir[0]) || !Number.isFinite(dir[1]) || !Number.isFinite(power)) return false;
    if (Math.hypot(dir[0], dir[1]) < 1e-6) return false;
    const pw = Math.max(0, Math.min(1, power));
    golfHit(p.ball, dir, pw);
    p.strokes++;
    p.stoppedFor = 0;
    p.status = 'roll';
    this.events.push({ type: 'hit', id, v: pw });
    return true;
  }

  /** Todos terminaram (acertaram ou estouraram). */
  get finished(): boolean {
    for (const p of this.players.values()) if (p.status === 'aim' || p.status === 'roll') return false;
    return true;
  }

  /** Tira alguém do buraco (saiu da sala ou caiu): conta como estourou. */
  forceFail(id: string) {
    const p = this.players.get(id);
    if (p && (p.status === 'aim' || p.status === 'roll')) this.fail(p);
  }

  private fail(p: GolfPlayer) {
    p.status = 'failed';
    this.events.push({ type: 'failed', id: p.id });
  }

  /** Um passo de 1/120 s. */
  step() {
    const dt = GOLF_DT;
    this.t += dt;
    const live: GolfPlayer[] = [];
    for (const p of this.players.values()) {
      if (p.status === 'holed' || p.status === 'failed') continue;
      const b = p.ball;
      golfStep(this.level, b, this.t);
      live.push(p);
      if (p.status === 'aim' && b.moving) p.status = 'roll'; // empurrada por outra bola
      if (b.impact > 1 && this.t - p.lastBounce > 0.08) {
        p.lastBounce = this.t;
        this.events.push({ type: b.inHole ? 'plop' : 'bounce', id: p.id, v: b.impact });
      }
      if (b.rim && !p.lastRim) this.events.push({ type: 'rim', id: p.id });
      p.lastRim = b.rim;
      if (b.inHole && p.status === 'roll' && b.holeTime === dt) this.events.push({ type: 'drop', id: p.id });
      if (b.holed) {
        p.status = 'holed';
        b.moving = false;
        b.vel = [0, 0, 0];
        this.events.push({ type: 'holed', id: p.id, strokes: p.strokes });
        continue;
      }
      if (b.inWater) {
        p.inWaterFor += dt;
        if (p.inWaterFor > 0.1 && p.inWaterFor < 0.1 + dt) this.events.push({ type: 'splash', id: p.id });
      } else p.inWaterFor = 0;
      if (b.outOfBounds || p.inWaterFor > 2.5) {
        // fora do campo ou preso na água: volta para onde deu a tacada
        b.pos = [...p.start] as V3;
        b.vel = [0, 0, 0];
        b.moving = false;
        b.outOfBounds = false;
        b.inWater = false;
        p.inWaterFor = 0;
        p.status = 'aim';
        this.events.push({ type: 'reset', id: p.id });
        continue;
      }
      if (p.status === 'roll' && !b.moving) {
        p.stoppedFor += dt;
        if (p.stoppedFor > 0.15) {
          if (p.strokes >= GOLF_STROKE_LIMIT) this.fail(p);
          else {
            p.status = 'aim';
            p.start = [...b.pos] as V3;
            b.vel = [0, 0, 0];
          }
        }
      } else p.stoppedFor = 0;
    }
    if (this.opts.collide && live.length > 1) {
      for (let i = 0; i < live.length; i++)
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i]!, c = live[j]!;
          if (a.ball.inHole || c.ball.inHole) continue;
          const f = golfBallCollide(a.ball, c.ball);
          if (f > 0.6) this.events.push({ type: 'clack', id: a.id, v: f });
        }
    }
    if (this.t >= this.opts.seconds) for (const p of this.players.values()) if (p.status === 'aim' || p.status === 'roll') this.fail(p);
  }

  /** Quanto cada um somou neste buraco (quem não encaçapou conta o limite mais 2). */
  counted(id: string): number {
    const p = this.players.get(id);
    return p ? golfCountedStrokes(p.strokes, p.status === 'holed') : GOLF_FAIL_STROKES;
  }
}

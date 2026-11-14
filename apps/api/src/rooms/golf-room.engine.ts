import {
  GOLF_BALL_DEFAULT,
  GOLF_CLEARED_MS,
  GOLF_DT,
  GOLF_FAIL_STROKES,
  GOLF_HOLE_SECONDS,
  GOLF_INTRO_MS,
  GOLF_ROOM_DEFAULTS,
  GOLF_ROOM_HOLES,
  GOLF_ROOM_MAX,
  GOLF_ROOM_TIERS,
  GolfHoleSim,
  golfParOf,
  golfPickLevels,
  golfScoreName,
  golfServerLevel,
  parseGolfBall,
  type GolfBallLook,
  type GolfEvent,
  type GolfRoomTier,
} from '@nocap/games';
import { ColorRoomEngine, RoomError, type EngineOptions, type FinalRow } from './color-room.engine';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const STATUS = { aim: 0, roll: 1, holed: 2, failed: 3 } as const;

/** Resultado de um buraco para o placar: tacadas feitas e se encaçapou. */
interface HoleRow {
  level: number;
  par: number;
  rows: Record<string, { s: number; h: boolean }>;
}

/** Quadro de posições a enviar (`gb`): `[vaga, x, y, z, vx, vy, vz, estado]` por bola, mais o relógio do buraco. */
export interface GolfFrame {
  t: number;
  balls: number[][];
}
/** Evento com a vaga no lugar do id (cabe numa mensagem curta). */
export type GolfWireEvent = { type: GolfEvent['type']; slot: number; v?: number; strokes?: number };

/**
 * O Mini Golf em sala (spec 082). O servidor é o árbitro e simula TODAS as bolas (a mesma física do offline, mais colisão
 * entre elas); os aparelhos mandam só a tacada ("gshot") e recebem quadros de posição, que interpolam. Cada buraco tem
 * contagem, jogo (todos ao mesmo tempo; quem encaçapa espera) e uma pausa com o resultado; acabando todos, o próximo.
 */
export class GolfRoomEngine extends ColorRoomEngine {
  override readonly game = 'golf' as const;
  override readonly persistable = false;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ['classico'];

  private looks = new Map<string, GolfBallLook>();
  private slots = new Map<string, number>();
  private levels: number[] = [];
  private holeIdx = 0;
  private stage: 'intro' | 'play' | 'cleared' = 'intro';
  private stageEndsAt = 0;
  private sim: GolfHoleSim | null = null;
  private simAt = 0;
  private acc = 0;
  private results: HoleRow[] = [];
  private scoreSum = new Map<string, number>();
  private dirty = false;
  private wireEvents: GolfWireEvent[] = [];

  constructor(opts: EngineOptions) {
    super({ ...opts, maxPlayers: GOLF_ROOM_MAX });
    this.mode = 'classico';
    this.settings = { rounds: 1, ...GOLF_ROOM_DEFAULTS } as unknown as typeof this.settings;
  }

  protected override validSettings(merged: Record<string, unknown>, mode: string): boolean {
    return (
      mode === 'classico' &&
      (GOLF_ROOM_HOLES as readonly unknown[]).includes(merged.holes) &&
      (GOLF_ROOM_TIERS as readonly unknown[]).includes(merged.tier) &&
      (GOLF_HOLE_SECONDS as readonly unknown[]).includes(merged.seconds) &&
      typeof merged.collide === 'boolean'
    );
  }

  private get cfg() {
    const s = this.settings as unknown as { holes?: number; tier?: GolfRoomTier; seconds?: number; collide?: boolean };
    return {
      holes: (GOLF_ROOM_HOLES as readonly number[]).includes(s.holes ?? 0) ? s.holes! : GOLF_ROOM_DEFAULTS.holes,
      tier: (GOLF_ROOM_TIERS as readonly string[]).includes(s.tier ?? '') ? s.tier! : GOLF_ROOM_DEFAULTS.tier,
      seconds: (GOLF_HOLE_SECONDS as readonly number[]).includes(s.seconds ?? 0) ? s.seconds! : GOLF_ROOM_DEFAULTS.seconds,
      collide: s.collide !== false,
    };
  }

  // ---- pessoas e bolas ----

  override join(id: string, username: string) {
    super.join(id, username);
    if (!this.looks.has(id)) this.looks.set(id, GOLF_BALL_DEFAULT);
  }

  /** A bola de cada pessoa (vem do aparelho, validada aqui). Só no lobby. */
  setLook(id: string, v: unknown) {
    this.requirePhase('lobby');
    if (!this.members.has(id)) throw new RoomError('Você não está na sala');
    this.looks.set(id, parseGolfBall(v));
  }

  override leave(id: string) {
    this.sim?.forceFail(id);
    super.leave(id);
  }

  override disconnect(id: string) {
    super.disconnect(id);
    // quem caiu no meio do buraco não segura os outros: conta como estourou
    if (this.phase === 'play') this.sim?.forceFail(id);
  }

  // ---- partida ----

  protected override beginRound() {
    const c = this.cfg;
    this.roundIndex = 0;
    this.rounds[0] = {};
    this.levels = golfPickLevels(this.seed, c.holes, c.tier);
    this.holeIdx = 0;
    this.results = [];
    this.scoreSum.clear();
    this.slots.clear();
    [...this.members.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .forEach((m, i) => {
        this.slots.set(m.id, i);
        this.scoreSum.set(m.id, 0);
      });
    this.phase = 'play';
    this.phaseEndsAt = null;
    this.startIntro();
  }

  private startIntro() {
    this.stage = 'intro';
    this.stageEndsAt = this.gnow() + GOLF_INTRO_MS;
    this.sim = null;
    this.acc = 0;
    this.dirty = true;
  }

  private startHole() {
    const level = this.levels[this.holeIdx]!;
    const ids = [...this.slots.keys()].filter((id) => this.members.get(id)?.connected !== false);
    this.sim = new GolfHoleSim(golfServerLevel(level), ids, { collide: this.cfg.collide, seconds: this.cfg.seconds });
    this.simAt = this.gnow();
    this.acc = 0;
    this.stage = 'play';
    this.stageEndsAt = this.gnow() + this.cfg.seconds * 1000;
    this.dirty = true;
  }

  /** "Dei esta tacada": direção `(x, z)` e força `p` (0 a 1). Inválida ou fora de hora é ignorada. */
  shoot(id: string, v: unknown) {
    if (this.phase !== 'play' || this.stage !== 'play' || !this.sim) return;
    const m = v as { x?: unknown; z?: unknown; p?: unknown } | null;
    if (!m || !finite(m.x) || !finite(m.z) || !finite(m.p)) return;
    if (this.sim.shoot(id, [m.x, m.z], m.p)) this.dirty = true;
  }

  private closeHole() {
    const sim = this.sim!;
    const level = this.levels[this.holeIdx]!;
    const row: HoleRow = { level, par: golfParOf(level), rows: {} };
    for (const [id, p] of sim.players) {
      row.rows[id] = { s: sim.counted(id), h: p.status === 'holed' };
      this.scoreSum.set(id, (this.scoreSum.get(id) ?? 0) + sim.counted(id));
    }
    // quem estava fora deste buraco (entrou depois ou caiu antes) conta o máximo
    for (const id of this.slots.keys()) {
      if (!row.rows[id]) {
        row.rows[id] = { s: GOLF_FAIL_STROKES, h: false };
        this.scoreSum.set(id, (this.scoreSum.get(id) ?? 0) + GOLF_FAIL_STROKES);
      }
    }
    this.results.push(row);
    this.stage = 'cleared';
    this.stageEndsAt = this.gnow() + GOLF_CLEARED_MS;
    this.dirty = true;
  }

  private flushEvents() {
    if (!this.sim) return;
    for (const e of this.sim.events) {
      const slot = this.slots.get(e.id);
      if (slot === undefined) continue;
      this.wireEvents.push({ type: e.type, slot, ...(e.v !== undefined ? { v: r3(e.v) } : {}), ...(e.strokes !== undefined ? { strokes: e.strokes } : {}) });
      if (e.type === 'hit' || e.type === 'holed' || e.type === 'failed' || e.type === 'reset') this.dirty = true;
    }
    this.sim.events = [];
  }

  override tick(): boolean {
    if (this.phase !== 'play') return false;
    const now = this.gnow();
    if (this.stage === 'intro') {
      if (now >= this.stageEndsAt) this.startHole();
    } else if (this.stage === 'play' && this.sim) {
      // anda no relógio real, em passos de 1/120 s (com teto, para uma pausa longa não virar rajada)
      this.acc += Math.min(0.08, Math.max(0, (now - this.simAt) / 1000));
      this.simAt = now;
      while (this.acc >= GOLF_DT) {
        this.acc -= GOLF_DT;
        this.sim.step();
      }
      this.flushEvents();
      if (this.sim.finished) this.closeHole();
    } else if (this.stage === 'cleared' && now >= this.stageEndsAt) {
      this.holeIdx++;
      if (this.holeIdx >= this.levels.length) this.finish();
      else this.startIntro();
    }
    const changed = this.dirty;
    this.dirty = false;
    return changed;
  }

  /** O líder encerra a partida agora; o que falta conta o máximo. */
  endNow(id: string) {
    this.requireHost(id);
    this.requirePhase('play');
    if (this.sim && this.stage === 'play') {
      for (const p of this.sim.players.values()) this.sim.forceFail(p.id);
      this.closeHole();
    }
    this.finish();
  }

  private finish() {
    this.phase = 'final';
    this.phaseEndsAt = null;
    this.sim = null;
    this.dirty = true;
  }

  protected override maybeAdvanceFromPick() {}
  protected override toReveal() {
    this.finish();
  }

  protected override reset() {
    super.reset();
    this.sim = null;
    this.results = [];
    this.scoreSum.clear();
    this.levels = [];
    this.wireEvents = [];
  }

  // ---- o que vai aos aparelhos ----

  /** Posições de todas as bolas (a cada ~33 ms enquanto se joga). `null` fora do buraco. */
  frame(): GolfFrame | null {
    if (!this.sim || this.stage !== 'play') return null;
    const balls: number[][] = [];
    for (const [id, p] of this.sim.players) {
      const slot = this.slots.get(id);
      if (slot === undefined) continue;
      const b = p.ball;
      balls.push([slot, r3(b.pos[0]), r3(b.pos[1]), r3(b.pos[2]), r3(b.vel[0]), r3(b.vel[1]), r3(b.vel[2]), STATUS[p.status]]);
    }
    return { t: r3(this.sim.t), balls };
  }

  drainEvents(): GolfWireEvent[] {
    const out = this.wireEvents;
    this.wireEvents = [];
    return out;
  }

  /** Colocação: menos tacadas ganha; empate divide a posição. */
  override finalRows(): FinalRow[] {
    const rows = [...this.members.values()]
      .map((m) => ({ m, total: this.scoreSum.get(m.id) ?? 0 }))
      .sort((a, b) => a.total - b.total || a.m.joinedAt - b.m.joinedAt);
    let placement = 0;
    return rows.map((r, i) => {
      if (i === 0 || r.total !== rows[i - 1]!.total) placement = i + 1;
      return { userId: r.m.id, username: r.m.username, totalTenths: r.total, placement, answers: [] };
    });
  }

  protected override extraSnapshot(viewerId?: string): Record<string, unknown> {
    const started = this.phase !== 'lobby';
    const level = started ? this.levels[this.holeIdx] : undefined;
    const strokes: Record<string, number> = {};
    const status: Record<string, number> = {};
    if (this.sim) for (const [id, p] of this.sim.players) {
      strokes[id] = p.strokes;
      status[id] = STATUS[p.status];
    }
    return {
      golf: {
        me: viewerId ?? null,
        looks: Object.fromEntries(this.looks),
        slots: started ? Object.fromEntries(this.slots) : {},
        levels: started ? this.levels : [],
        hole: started ? this.holeIdx : 0,
        level: level ?? null,
        par: level ? golfParOf(level) : null,
        stage: started ? this.stage : null,
        stageEndsAt: started ? this.stageEndsAt : null,
        seconds: this.cfg.seconds,
        strokes,
        status,
        totals: started ? Object.fromEntries(this.scoreSum) : {},
        results: started ? this.results : [],
        names: this.stage === 'cleared' && this.results.length
          ? Object.fromEntries(Object.entries(this.results[this.results.length - 1]!.rows).map(([id, r]) => [id, golfScoreName(r.s, this.results[this.results.length - 1]!.par, r.h)]))
          : {},
      },
    };
  }
}

export { RoomError };

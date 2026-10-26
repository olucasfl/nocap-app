import {
  BOL_ACCEL,
  BOL_AIR_ACCEL,
  BOL_AIR_DRAG,
  BOL_AIR_JUMP,
  BOL_BALL_MAX,
  BOL_BALL_R,
  BOL_BAR_R,
  BOL_CEILING,
  BOL_COUNTDOWN,
  BOL_DURATION,
  BOL_FLIP_KICK,
  BOL_FLIP_KICK_CARRY,
  BOL_BOUNCE_GRIP,
  BOL_ROLL_DECEL,
  BOL_FLIP_KICK_LIFT,
  BOL_FLIP_LIFT,
  BOL_FLIP_REACH,
  BOL_FLIP_SEC,
  BOL_FLIP_SPEED,
  BOL_FLIP_WINDOW,
  BOL_FLOOR_E,
  BOL_FOX_E,
  BOL_FOX_GRAVITY,
  BOL_FOX_H,
  BOL_FOX_R,
  BOL_GOAL_H,
  BOL_GOAL_PAUSE,
  BOL_GOLDEN_MAX,
  BOL_GRAVITY,
  BOL_JUMP,
  BOL_POST_R,
  BOL_REST_SPEED,
  BOL_ROLL_DRAG,
  BOL_SPEED,
  BOL_STILL_SEC,
  BOL_SUBSTEPS,
  BOL_TOUCH_MIN,
  BOL_WALL_E,
  BOL_WARN_LEFT,
} from './constants';
import { buildField, type BolField } from './field';

export interface BolInfo {
  id: string;
  name: string;
  /** Cor do pelo, 0xRRGGBB. */
  color: number;
  /** Índice do time (0 vermelho, 1 azul, 2 amarelo, 3 verde). */
  team: number;
  bot?: boolean;
}

/** `jump` é um aperto (vale uma vez por passo em que vem verdadeiro), não "segurar". */
export interface BolInput {
  mx: number;
  mz: number;
  jump: boolean;
}

/** O que cada raposa fez na partida (aparece na tabela do Tab). */
export interface BolStats {
  goals: number;
  assists: number;
  /** Gols contra (a bola entrou no gol do próprio time depois de um toque seu). */
  ownGoals: number;
  /** Toques na bola (uma sequência de contatos seguidos conta uma vez). */
  touches: number;
  /** Mortais que chutaram a bola. */
  kicks: number;
}

export const emptyBolStats = (): BolStats => ({
  goals: 0,
  assists: 0,
  ownGoals: 0,
  touches: 0,
  kicks: 0,
});

/** Passe para gol: o toque anterior de um companheiro vale assistência se veio até tanto tempo antes do gol (s). */
export const BOL_ASSIST_WINDOW = 6;

export interface BolPlayer extends BolInfo {
  stats: BolStats;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  grounded: boolean;
  /** Já usou o pulo duplo neste voo. */
  airJumped: boolean;
  /** Segundos que faltam do mortal; 0 = fora dele. */
  flipT: number;
  flipDx: number;
  flipDz: number;
  /** O mortal atual já chutou a bola (um chute por mortal). */
  flipHit: boolean;
}

export interface BolBall {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface BolTouch {
  id: string;
  team: number;
  /** Hora da partida (s) do último toque. */
  t: number;
}

export type BolPhase = 'countdown' | 'play' | 'goal' | 'over';

export type BolEvent =
  | { type: 'jump'; id: string }
  | { type: 'airjump'; id: string; flip: boolean }
  | { type: 'land'; id: string }
  | { type: 'touch'; id: string; power: number }
  | { type: 'kick'; id: string }
  | { type: 'bounce'; power: number }
  | { type: 'wall'; power: number }
  /** `noTouch`: ninguém tocou na bola; com 2 times o gol vai para o outro time (gol contra do dono do gol). */
  | {
      type: 'goal';
      goalTeam: number;
      /** Quem marcou (gol normal); nulo no gol contra e sem toque. */
      scorerId: string | null;
      /** Time que leva o ponto. */
      scorerTeam: number;
      /** Gol contra: o último toque foi do time que levou o gol (ou ninguém tocou). */
      own: boolean;
      /** Quem fez o gol contra (último toque do time que levou o gol). */
      ownerId: string | null;
      noTouch: boolean;
      assistId: string | null;
    }
  /** Sem toque e com 3 ou 4 times não há como decidir: ninguém pontua e a bola volta ao centro. */
  | { type: 'nogoal'; goalTeam: number; ownerId: string | null }
  | { type: 'start'; golden: boolean }
  | { type: 'warn'; left: number }
  | { type: 'golden' }
  | { type: 'ballreset' }
  | { type: 'over'; winner: number };

export interface BolOptions {
  teams: number;
  /** Tamanho do formato (o "2" de 2x2): define o tamanho do campo. */
  perTeam: number;
  /** Duração em segundos; ao fim, quem tem mais gols ganha (empate vai para o gol de ouro). */
  durationSec?: number;
}

const NO_INPUT: BolInput = { mx: 0, mz: 0, jump: false };

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export class BolWorld {
  readonly field: BolField;
  readonly players: BolPlayer[] = [];
  readonly ball: BolBall = { x: 0, y: BOL_BALL_R, z: 0, vx: 0, vy: 0, vz: 0 };
  readonly scores: number[];
  readonly durationSec: number;
  phase: BolPhase = 'countdown';
  /** Segundos que faltam para a bola entrar em jogo (countdown) ou para recomeçar (goal). */
  timer = BOL_COUNTDOWN;
  /** Relógio da partida, só anda em jogo (cresce). */
  clock = 0;
  golden = false;
  /** Último toque real na bola desde o último recomeço. */
  lastTouch: BolTouch | null = null;
  /** O toque mais recente de cada time desde o recomeço (decide o ponto do gol contra). */
  lastByTeam: (BolTouch | null)[] = [];
  /** Time que comemora na pausa depois do gol (-1 = ninguém). */
  celebrating = -1;
  /** O toque anterior, de outra raposa (para a assistência). */
  prevTouch: BolTouch | null = null;
  /** Segundos de posse de bola por time (o time do último toque). */
  readonly possession: number[];
  /** Time vencedor; -1 = empate; só vale com `phase === 'over'`. */
  winner = -1;
  private events: BolEvent[] = [];
  private still = 0;
  private warned = new Set<number>();
  /** Relógio da partida (s) em que a prorrogação começou. */
  goldenStart = 0;

  constructor(infos: readonly BolInfo[], opts: BolOptions) {
    this.field = buildField(opts.teams, opts.perTeam);
    this.scores = Array.from({ length: this.field.teams }, () => 0);
    this.possession = Array.from({ length: this.field.teams }, () => 0);
    this.durationSec = opts.durationSec ?? BOL_DURATION;
    for (const info of infos) this.players.push(this.spawnBody(info));
    this.kickoff();
  }

  drainEvents(): BolEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private teamCount(team: number): number {
    return this.players.filter((p) => p.team === team).length;
  }

  private spawnBody(info: BolInfo): BolPlayer {
    const idx = this.players.filter((p) => p.team === info.team).length;
    const s = this.field.spawn(info.team, idx, Math.max(idx + 1, this.field.perTeam));
    return {
      ...info,
      stats: emptyBolStats(),
      x: s.x,
      y: 0,
      z: s.z,
      vx: 0,
      vy: 0,
      vz: 0,
      heading: s.heading,
      grounded: true,
      airJumped: false,
      flipT: 0,
      flipDx: 0,
      flipDz: 0,
      flipHit: false,
    };
  }

  player(id: string): BolPlayer | undefined {
    return this.players.find((p) => p.id === id);
  }

  /** Entrada de alguém no meio da partida (ou de um bot): nasce no ponto do time. */
  addPlayer(info: BolInfo): BolPlayer {
    const p = this.spawnBody(info);
    this.players.push(p);
    this.layoutTeam(info.team);
    return p;
  }

  removePlayer(id: string): void {
    const i = this.players.findIndex((p) => p.id === id);
    if (i < 0) return;
    this.players.splice(i, 1);
  }

  /** Uma pessoa assume o corpo de um bot (o corpo continua onde está). */
  takeOver(botId: string, info: BolInfo): boolean {
    const p = this.player(botId);
    if (!p || !p.bot) return false;
    p.id = info.id;
    p.name = info.name;
    p.color = info.color;
    p.bot = info.bot;
    p.team = info.team;
    if (this.lastTouch?.id === botId)
      this.lastTouch = { ...this.lastTouch, id: info.id, team: info.team };
    if (this.prevTouch?.id === botId)
      this.prevTouch = { ...this.prevTouch, id: info.id, team: info.team };
    this.lastByTeam = this.lastByTeam.map((c) =>
      c?.id === botId ? { ...c, id: info.id, team: info.team } : c,
    );
    return true;
  }

  /** Quem sai (ou cai) deixa o corpo para um bot: o corpo fica onde está, com outro id. */
  becomeBot(id: string, newId: string, name: string): boolean {
    const p = this.player(id);
    if (!p) return false;
    p.id = newId;
    p.name = name;
    p.bot = true;
    if (this.lastTouch?.id === id) this.lastTouch = { ...this.lastTouch, id: newId };
    if (this.prevTouch?.id === id) this.prevTouch = { ...this.prevTouch, id: newId };
    this.lastByTeam = this.lastByTeam.map((c) => (c?.id === id ? { ...c, id: newId } : c));
    return true;
  }

  /** Troca de time no meio da partida: vai para o ponto do novo time. */
  setTeam(id: string, team: number): void {
    const p = this.player(id);
    if (!p || p.team === team) return;
    p.team = team;
    const s = this.field.spawn(
      team,
      this.teamCount(team) - 1,
      Math.max(this.teamCount(team), this.field.perTeam),
    );
    Object.assign(p, {
      x: s.x,
      z: s.z,
      y: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      heading: s.heading,
      grounded: true,
      flipT: 0,
      airJumped: false,
    });
  }

  /** Reparte o time pelos pontos de saída. */
  private layoutTeam(team: number): void {
    const mates = this.players.filter((p) => p.team === team);
    const count = Math.max(mates.length, this.field.perTeam);
    mates.forEach((p, i) => {
      const s = this.field.spawn(team, i, count);
      Object.assign(p, {
        x: s.x,
        z: s.z,
        y: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        heading: s.heading,
        grounded: true,
        flipT: 0,
        airJumped: false,
        flipHit: false,
      });
    });
  }

  /** Bola no centro, todos nas posições padrão, contagem de 3 s. */
  kickoff(): void {
    Object.assign(this.ball, { x: 0, y: BOL_BALL_R, z: 0, vx: 0, vy: 0, vz: 0 });
    for (let t = 0; t < this.field.teams; t++) this.layoutTeam(t);
    this.lastTouch = null;
    this.prevTouch = null;
    this.lastByTeam = Array.from({ length: this.field.teams }, () => null);
    this.still = 0;
    this.phase = 'countdown';
    this.timer = BOL_COUNTDOWN;
  }

  /** O líder encerra: vale o placar de agora, sem gol de ouro. */
  endNow(): void {
    this.finish(this.leader());
  }

  private leader(): number {
    const top = Math.max(...this.scores);
    const best = this.scores.map((s, i) => (s === top ? i : -1)).filter((i) => i >= 0);
    return best.length === 1 ? (best[0] as number) : -1;
  }

  private finish(winner: number): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.winner = winner;
    this.events.push({ type: 'over', winner });
  }

  step(dt: number, inputs: Readonly<Record<string, BolInput>> = {}): void {
    if (this.phase === 'over') return;
    const frozen = this.phase === 'countdown';
    if (this.phase === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.phase = 'play';
        this.events.push({ type: 'start', golden: this.golden });
      }
    } else if (this.phase === 'goal') {
      this.timer -= dt;
      if (this.timer <= 0) this.kickoff();
    }
    for (const p of this.players)
      this.control(p, frozen ? NO_INPUT : (inputs[p.id] ?? NO_INPUT), dt);
    const h = dt / BOL_SUBSTEPS;
    for (let i = 0; i < BOL_SUBSTEPS; i++) {
      for (const p of this.players) this.moveFox(p, h);
      this.separateFoxes();
      if (this.phase === 'play') this.moveBall(h);
    }
    if (this.phase === 'play') this.tickMatch(dt);
  }

  private tickMatch(dt: number): void {
    this.clock += dt;
    if (this.lastTouch)
      this.possession[this.lastTouch.team] = (this.possession[this.lastTouch.team] ?? 0) + dt;
    const left = this.durationSec - this.clock;
    for (const w of BOL_WARN_LEFT) {
      if (!this.golden && this.durationSec > w * 2 && left <= w && !this.warned.has(w)) {
        this.warned.add(w);
        this.events.push({ type: 'warn', left: w });
      }
    }
    const b = this.ball;
    const slow = Math.hypot(b.vx, b.vy, b.vz) < BOL_REST_SPEED && b.y <= BOL_BALL_R + 0.05;
    this.still = slow ? this.still + dt : 0;
    if (this.still >= BOL_STILL_SEC) {
      this.events.push({ type: 'ballreset' });
      this.kickoff();
      return;
    }
    if (!this.golden && this.clock >= this.durationSec) {
      const w = this.leader();
      if (w >= 0) this.finish(w);
      else {
        this.golden = true;
        this.goldenStart = this.clock;
        this.events.push({ type: 'golden' });
        this.kickoff();
      }
    } else if (this.golden && this.clock - this.goldenStart >= BOL_GOLDEN_MAX) {
      this.finish(-1);
    }
  }

  /** Aperto de pulo, mortal e aceleração. */
  private control(p: BolPlayer, input: BolInput, dt: number): void {
    const mag = Math.hypot(input.mx, input.mz);
    const ix = mag > 1 ? input.mx / mag : input.mx;
    const iz = mag > 1 ? input.mz / mag : input.mz;
    if (input.jump) {
      if (p.grounded) {
        p.vy = BOL_JUMP;
        p.grounded = false;
        this.events.push({ type: 'jump', id: p.id });
      } else if (!p.airJumped) {
        p.airJumped = true;
        if (mag > 0.3) {
          p.flipT = BOL_FLIP_SEC;
          p.flipHit = false;
          p.flipDx = input.mx / mag;
          p.flipDz = input.mz / mag;
          p.vx = p.flipDx * BOL_FLIP_SPEED;
          p.vz = p.flipDz * BOL_FLIP_SPEED;
          p.vy = BOL_FLIP_LIFT;
          p.heading = Math.atan2(p.flipDx, p.flipDz);
          this.events.push({ type: 'airjump', id: p.id, flip: true });
        } else {
          p.vy = BOL_AIR_JUMP;
          this.events.push({ type: 'airjump', id: p.id, flip: false });
        }
      }
    }
    if (p.flipT > 0) {
      p.flipT = Math.max(0, p.flipT - dt);
      return;
    }
    const a = (p.grounded ? BOL_ACCEL : BOL_AIR_ACCEL) * dt;
    const dx = ix * BOL_SPEED - p.vx;
    const dz = iz * BOL_SPEED - p.vz;
    const d = Math.hypot(dx, dz);
    if (d <= a) {
      p.vx = ix * BOL_SPEED;
      p.vz = iz * BOL_SPEED;
    } else {
      p.vx += (dx / d) * a;
      p.vz += (dz / d) * a;
    }
    if (mag > 0.1) p.heading = Math.atan2(ix, iz);
  }

  private moveFox(p: BolPlayer, h: number): void {
    p.vy -= BOL_FOX_GRAVITY * h;
    p.x += p.vx * h;
    p.y += p.vy * h;
    p.z += p.vz * h;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      if (!p.grounded) {
        p.grounded = true;
        p.airJumped = false;
        p.flipT = 0;
        this.events.push({ type: 'land', id: p.id });
      }
    } else {
      p.grounded = false;
    }
    for (const e of this.field.edges) {
      const d = (p.x - e.ax) * e.nx + (p.z - e.az) * e.nz;
      if (d >= BOL_FOX_R) continue;
      p.x += e.nx * (BOL_FOX_R - d);
      p.z += e.nz * (BOL_FOX_R - d);
      const vn = p.vx * e.nx + p.vz * e.nz;
      if (vn < 0) {
        p.vx -= vn * e.nx;
        p.vz -= vn * e.nz;
      }
    }
  }

  /** Raposas não se atravessam: empurram-se de leve para os lados. */
  private separateFoxes(): void {
    const ps = this.players;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i] as BolPlayer;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j] as BolPlayer;
        if (Math.abs(a.y - b.y) >= BOL_FOX_H) continue;
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        let d = Math.hypot(dx, dz);
        const min = BOL_FOX_R * 2;
        if (d >= min) continue;
        if (d < 1e-4) {
          dx = Math.cos(i + j);
          dz = Math.sin(i + j);
          d = 1;
        }
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.z -= (dz / d) * push;
        b.x += (dx / d) * push;
        b.z += (dz / d) * push;
      }
    }
  }

  private moveBall(h: number): void {
    const b = this.ball;
    const rolling = b.y <= BOL_BALL_R + 0.02 && Math.abs(b.vy) < 0.5;
    if (rolling) {
      // rolando no chão: freio proporcional mais um freio fixo, para a bola parar de verdade
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > 0) {
        const k = Math.max(0, sp - (BOL_ROLL_DRAG * sp + BOL_ROLL_DECEL) * h) / sp;
        b.vx *= k;
        b.vz *= k;
      }
    } else {
      const drag = Math.exp(-BOL_AIR_DRAG * h);
      b.vx *= drag;
      b.vz *= drag;
    }
    b.vy -= BOL_GRAVITY * h;
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.z += b.vz * h;
    if (b.y < BOL_BALL_R) {
      b.y = BOL_BALL_R;
      if (b.vy < 0) {
        if (-b.vy > 4) {
          this.events.push({ type: 'bounce', power: -b.vy });
          b.vx *= BOL_BOUNCE_GRIP;
          b.vz *= BOL_BOUNCE_GRIP;
        }
        b.vy = -b.vy * BOL_FLOOR_E;
        if (b.vy < 1.2) b.vy = 0;
      }
    }
    if (b.y > BOL_CEILING - BOL_BALL_R) {
      b.y = BOL_CEILING - BOL_BALL_R;
      if (b.vy > 0) b.vy = -b.vy * BOL_WALL_E;
    }
    if (this.wallsAndGoals()) return;
    for (const p of this.players) this.touchFox(p);
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    if (sp > BOL_BALL_MAX) {
      const k = BOL_BALL_MAX / sp;
      b.vx *= k;
      b.vy *= k;
      b.vz *= k;
    }
  }

  /** Devolve `true` se saiu gol neste passo. */
  private wallsAndGoals(): boolean {
    const b = this.ball;
    for (const e of this.field.edges) {
      const d = (b.x - e.ax) * e.nx + (b.z - e.az) * e.nz;
      if (e.goal >= 0) {
        const g = this.field.goals[e.goal];
        if (g) {
          const t = (b.x - e.mx) * e.tx + (b.z - e.mz) * e.tz;
          if (Math.abs(t) <= g.halfW && b.y < BOL_GOAL_H) {
            // só é gol com a bola inteira para lá da linha (o centro precisa passar do raio)
            if (d < -BOL_BALL_R) {
              this.scoreGoal(e.goal);
              return true;
            }
            continue;
          }
        }
      }
      if (d >= BOL_BALL_R) continue;
      b.x += e.nx * (BOL_BALL_R - d);
      b.z += e.nz * (BOL_BALL_R - d);
      const vn = b.vx * e.nx + b.vz * e.nz;
      if (vn < 0) {
        if (-vn > 5) this.events.push({ type: 'wall', power: -vn });
        b.vx -= (1 + BOL_WALL_E) * vn * e.nx;
        b.vz -= (1 + BOL_WALL_E) * vn * e.nz;
      }
    }
    // traves: cilindros finos nas duas pontas da boca do gol
    for (const g of this.field.goals) {
      if (b.y > BOL_GOAL_H + BOL_BALL_R) continue;
      for (const s of [-1, 1]) {
        const px = g.edge.mx + g.edge.tx * g.halfW * s;
        const pz = g.edge.mz + g.edge.tz * g.halfW * s;
        const dx = b.x - px;
        const dz = b.z - pz;
        const d = Math.hypot(dx, dz);
        const min = BOL_BALL_R + BOL_POST_R;
        if (d >= min || d < 1e-6) continue;
        const nx = dx / d;
        const nz = dz / d;
        b.x = px + nx * min;
        b.z = pz + nz * min;
        const vn = b.vx * nx + b.vz * nz;
        if (vn < 0) {
          b.vx -= (1 + BOL_WALL_E) * vn * nx;
          b.vz -= (1 + BOL_WALL_E) * vn * nz;
        }
      }
    }
    // travessão: cilindro na altura do gol; a bola quica nele
    for (const g of this.field.goals) {
      const e = g.edge;
      const t = (b.x - e.mx) * e.tx + (b.z - e.mz) * e.tz;
      if (Math.abs(t) > g.halfW + BOL_BALL_R) continue;
      const d = (b.x - e.mx) * e.nx + (b.z - e.mz) * e.nz;
      const dy = b.y - BOL_GOAL_H;
      const dist = Math.hypot(d, dy);
      const min = BOL_BALL_R + BOL_BAR_R;
      if (dist >= min || dist < 1e-6) continue;
      const nd = d / dist;
      const ny = dy / dist;
      const push = min - dist;
      b.x += e.nx * nd * push;
      b.z += e.nz * nd * push;
      b.y += ny * push;
      const vd = b.vx * e.nx + b.vz * e.nz;
      const vn = vd * nd + b.vy * ny;
      if (vn < 0) {
        const j = (1 + BOL_WALL_E) * vn;
        b.vx -= j * nd * e.nx;
        b.vz -= j * nd * e.nz;
        b.vy -= j * ny;
        this.events.push({ type: 'wall', power: -vn });
      }
    }
    return false;
  }

  /**
   * Quem leva o ponto (spec 046, seção 4.2): o time de quem tocou por último na bola, desde que não seja o time que
   * levou o gol. Se quem tocou por último foi do time que levou o gol (gol contra), o ponto vai para o time que tocou
   * na bola por último entre os outros. Sem ninguém assim: com 2 times o ponto vai para o outro time; com 3 ou 4 não dá
   * para decidir, então ninguém pontua e a bola volta ao centro com a contagem.
   */
  private scoreGoal(goalTeam: number): void {
    const last = this.lastTouch;
    // gol contra: o último toque foi do time que levou o gol
    const ownerId = last && last.team === goalTeam ? last.id : null;
    let credit: BolTouch | null = last && last.team !== goalTeam ? last : null;
    if (!credit) {
      for (let t = 0; t < this.lastByTeam.length; t++) {
        const c = this.lastByTeam[t];
        if (t !== goalTeam && c && (!credit || c.t > credit.t)) credit = c;
      }
    }
    let scorerTeam = credit ? credit.team : -1;
    if (scorerTeam < 0) {
      if (this.field.teams > 2) {
        if (ownerId) {
          const owner = this.player(ownerId);
          if (owner) owner.stats.ownGoals += 1;
        }
        this.events.push({ type: 'nogoal', goalTeam, ownerId });
        this.kickoff();
        return;
      }
      scorerTeam = 1 - goalTeam;
    }
    this.scores[scorerTeam] = (this.scores[scorerTeam] ?? 0) + 1;
    const noTouch = !last;
    const own = ownerId !== null || noTouch;
    let assistId: string | null = null;
    if (ownerId) {
      const owner = this.player(ownerId);
      if (owner) owner.stats.ownGoals += 1;
    } else if (last) {
      const who = this.player(last.id);
      if (who) who.stats.goals += 1;
      const prev = this.prevTouch;
      if (
        prev &&
        prev.team === last.team &&
        prev.id !== last.id &&
        last.t - prev.t <= BOL_ASSIST_WINDOW
      ) {
        const mate = this.player(prev.id);
        if (mate) {
          mate.stats.assists += 1;
          assistId = mate.id;
        }
      }
    }
    this.events.push({
      type: 'goal',
      goalTeam,
      scorerId: ownerId ? null : (last?.id ?? null),
      scorerTeam,
      own,
      ownerId,
      noTouch,
      assistId,
    });
    if (this.golden) {
      this.finish(scorerTeam);
      return;
    }
    this.celebrating = scorerTeam;
    this.phase = 'goal';
    this.timer = BOL_GOAL_PAUSE;
  }

  /** Contato bola-raposa. Só conta como toque se os corpos realmente se sobrepõem e se aproximam. */
  private touchFox(p: BolPlayer): void {
    const b = this.ball;
    const flipping = p.flipT > 0 && BOL_FLIP_SEC - p.flipT <= BOL_FLIP_WINDOW && !p.flipHit;
    const reach = BOL_FOX_R + (flipping ? BOL_FLIP_REACH : 0);
    const cy = clamp(b.y, p.y + BOL_FOX_R, p.y + BOL_FOX_H - BOL_FOX_R);
    let nx = b.x - p.x;
    let ny = b.y - cy;
    let nz = b.z - p.z;
    const dist = Math.hypot(nx, ny, nz);
    const min = BOL_BALL_R + reach;
    if (dist >= min) return;
    if (dist < 1e-6) {
      // centros colados: empurra para onde a raposa olha
      nx = Math.sin(p.heading);
      ny = 0;
      nz = Math.cos(p.heading);
    } else {
      nx /= dist;
      ny /= dist;
      nz /= dist;
    }
    const push = min - (dist < 1e-6 ? 0 : dist);
    b.x += nx * push;
    b.y += ny * push;
    b.z += nz * push;
    const vn = (b.vx - p.vx) * nx + (b.vy - p.vy) * ny + (b.vz - p.vz) * nz;
    let power = 0;
    if (vn < 0) {
      b.vx -= (1 + BOL_FOX_E) * vn * nx;
      b.vy -= (1 + BOL_FOX_E) * vn * ny;
      b.vz -= (1 + BOL_FOX_E) * vn * nz;
      power = -vn;
    }
    let touched = power > BOL_TOUCH_MIN;
    if (flipping) {
      // o mortal que encosta na bola chuta: uma vez por mortal
      p.flipHit = true;
      // o chute leva a bola, no mínimo, à velocidade do mortal (sem somar em cima de um contato já forte)
      const along = b.vx * p.flipDx + b.vz * p.flipDz;
      const want = BOL_FLIP_KICK + Math.hypot(p.vx, p.vz) * BOL_FLIP_KICK_CARRY;
      if (along < want) {
        b.vx += p.flipDx * (want - along);
        b.vz += p.flipDz * (want - along);
      }
      b.vy = Math.max(b.vy, BOL_FLIP_KICK_LIFT);
      touched = true;
      power = Math.max(power, BOL_FLIP_KICK);
      p.stats.kicks += 1;
      this.events.push({ type: 'kick', id: p.id });
    }
    if (touched) {
      const last = this.lastTouch;
      if (!last || last.id !== p.id) {
        this.prevTouch = last;
        p.stats.touches += 1;
      } else if (this.clock - last.t > 0.4) p.stats.touches += 1;
      this.lastTouch = { id: p.id, team: p.team, t: this.clock };
      this.lastByTeam[p.team] = this.lastTouch;
      this.events.push({ type: 'touch', id: p.id, power });
    }
  }
}

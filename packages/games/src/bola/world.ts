import {
  BOL_ACCEL,
  BOL_AIR_ACCEL,
  BOL_AIR_DRAG,
  BOL_AIR_JUMP,
  BOL_BALL_MAX,
  BOL_BALL_R,
  BOL_CEILING,
  BOL_COUNTDOWN,
  BOL_DURATION,
  BOL_FLIP_KICK,
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

export interface BolPlayer extends BolInfo {
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
  | { type: 'goal'; goalTeam: number; scorerId: string | null; scorerTeam: number; own: boolean }
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
  /** Time vencedor; -1 = empate; só vale com `phase === 'over'`. */
  winner = -1;
  private events: BolEvent[] = [];
  private still = 0;
  private warned = new Set<number>();
  private goldenStart = 0;

  constructor(infos: readonly BolInfo[], opts: BolOptions) {
    this.field = buildField(opts.teams, opts.perTeam);
    this.scores = Array.from({ length: this.field.teams }, () => 0);
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
    if (this.lastTouch?.id === botId) this.lastTouch = { ...this.lastTouch, id: info.id };
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
    const onGround = b.y <= BOL_BALL_R + 0.02;
    const drag = Math.exp(-(onGround ? BOL_ROLL_DRAG : BOL_AIR_DRAG) * h);
    b.vx *= drag;
    b.vz *= drag;
    b.vy -= BOL_GRAVITY * h;
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.z += b.vz * h;
    if (b.y < BOL_BALL_R) {
      b.y = BOL_BALL_R;
      if (b.vy < 0) {
        if (-b.vy > 4) this.events.push({ type: 'bounce', power: -b.vy });
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
            if (d < 0) {
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
    return false;
  }

  /** O gol vale para o time de quem tocou por último, mesmo se a bola entrou no gol dele (spec 046, seção 4.2). */
  private scoreGoal(goalTeam: number): void {
    const t = this.lastTouch;
    const scorerTeam = t ? t.team : -1;
    if (scorerTeam >= 0) this.scores[scorerTeam] = (this.scores[scorerTeam] ?? 0) + 1;
    this.events.push({
      type: 'goal',
      goalTeam,
      scorerId: t ? t.id : null,
      scorerTeam,
      own: scorerTeam === goalTeam,
    });
    if (this.golden) {
      this.finish(scorerTeam);
      return;
    }
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
      b.vx += p.flipDx * BOL_FLIP_KICK;
      b.vz += p.flipDz * BOL_FLIP_KICK;
      b.vy += BOL_FLIP_KICK_LIFT;
      touched = true;
      power = Math.max(power, BOL_FLIP_KICK);
      this.events.push({ type: 'kick', id: p.id });
    }
    if (touched) {
      this.lastTouch = { id: p.id, team: p.team, t: this.clock };
      this.events.push({ type: 'touch', id: p.id, power });
    }
  }
}

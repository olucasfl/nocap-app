import {
  PP_EV_FLOOR,
  PP_EV_NET,
  PP_EV_TABLE,
  ppCopyBall,
  ppNewBall,
  ppNewStepOut,
  ppStepBall,
  type PpBall,
} from './ball';
import {
  PP_L,
  PP_PAD_R,
  PP_PAD_SPEED,
  PP_PAD_STIFF,
  PP_PAD_X,
  PP_PAD_Y_MAX,
  PP_PAD_Y_MIN,
  PP_PAD_Z,
  PP_POINT_PAUSE,
  PP_POINTS,
  PP_R,
  PP_RALLY_MAX,
  PP_SERVE_AUTO,
  PP_SUB,
  PP_TICK,
  PP_TOSS_V,
  PP_TOSS_Y,
} from './constants';
import { ppPaddleHit, type PpHitQuality } from './paddle';

/** O que cada jogador manda por tick: para onde a raquete vai (plano x, y), smash e saque (borda de subida). */
export interface PpInput {
  x: number;
  y: number;
  smash: boolean;
  serve: boolean;
}

export const ppIdleInput = (): PpInput => ({ x: 0, y: 1.3, smash: false, serve: false });

export interface PpPaddle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0 a 1: animação da batida (só para desenhar). */
  swing: number;
}

export type PpPhase = 'serve' | 'toss' | 'rally' | 'point' | 'over';
export type PpReason = 'miss' | 'own' | 'out' | 'net' | 'serve';

export type PpEvent =
  | { type: 'toss'; p: number }
  | {
      type: 'hit';
      p: number;
      /** km/h (a bola tem escala de jogo; o número é o que a pessoa lê). */
      kmh: number;
      smash: boolean;
      quality: PpHitQuality;
      assisted: boolean;
      spin: number;
      serve: boolean;
    }
  | { type: 'bounce'; side: number; x: number; z: number; impact: number }
  | { type: 'net' }
  | { type: 'fault'; p: number }
  | {
      type: 'point';
      winner: number;
      reason: PpReason;
      score: [number, number];
      rally: number;
      best: number;
    }
  | { type: 'game'; winner: number; score: [number, number] };

/** Hora do saque: 2 pontos cada um; a partir de 10-10 cada ponto troca. */
export function ppServerFor(first: number, a: number, b: number): number {
  const total = a + b;
  if (a >= PP_POINTS - 1 && b >= PP_POINTS - 1) return first ^ ((total - 2 * (PP_POINTS - 1)) & 1);
  return first ^ (Math.floor(total / 2) & 1);
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** m/s do jogo em km/h do número que se mostra (a bola é maior que a real, então multiplica). */
export const ppKmh = (ms: number) => Math.round(ms * 3.6 * 1.7);

/**
 * A partida: raquetes, bola, regras e placar (Ping Fox!, spec 055). Um `tick` = 1/60 s com 4 subpassos de física.
 * Determinística: mesma sequência de entradas, mesmo resultado.
 */
export class PpMatch {
  readonly ball: PpBall = ppNewBall();
  readonly pads: [PpPaddle, PpPaddle] = [
    { x: 0, y: 1.3, vx: 0, vy: 0, swing: 0 },
    { x: 0, y: 1.3, vx: 0, vy: 0, swing: 0 },
  ];
  readonly score: [number, number] = [0, 0];
  phase: PpPhase = 'serve';
  firstServer: number;
  server: number;
  /** Quem bateu por último (-1 = ninguém ainda). */
  lastHitter = -1;
  /** Quiques na mesa de cada lado desde a última batida. */
  bounces: [number, number] = [0, 0];
  /** Faltas de saque seguidas de quem saca. */
  serveFaults = 0;
  rally = 0;
  /** Melhor velocidade (km/h) do ponto atual. */
  bestKmh = 0;
  /** Tempo do estado atual (s). */
  t = 0;
  tick = 0;
  winner = -1;
  events: PpEvent[] = [];
  /** 0 a 1: força da ajuda de mira de cada jogador. */
  assist: [number, number] = [1, 1];
  private out = ppNewStepOut();
  private prev = ppNewBall();
  private smashHeld: [boolean, boolean] = [false, false];
  private serveWas: [boolean, boolean] = [false, false];

  constructor(firstServer = 0) {
    this.firstServer = firstServer;
    this.server = firstServer;
    this.holdBall();
  }

  /** A raquete de um jogador (0 ou 1). */
  pad(p: number): PpPaddle {
    return p === 0 ? this.pads[0] : this.pads[1];
  }

  /** Lado (sinal de z) de cada jogador: 0 = perto da câmera (z > 0). */
  static sign(p: number): number {
    return p === 0 ? 1 : -1;
  }

  /** Quem deve rebater agora. */
  get expect(): number {
    return this.lastHitter < 0 ? this.server : 1 - this.lastHitter;
  }

  /** Posição da mão de quem saca (a bola pousa aqui antes do lançamento). */
  handZ(p: number): number {
    return PpMatch.sign(p) * (PP_L / 2 + 0.2);
  }

  private holdBall(): void {
    const b = this.ball;
    const p = this.server;
    b.x = this.pad(p).x;
    b.y = PP_TOSS_Y;
    b.z = this.handZ(p);
    b.vx = b.vy = b.vz = 0;
    b.wx = b.wy = b.wz = 0;
  }

  private movePad(p: number, inp: PpInput): void {
    const pad = this.pad(p);
    const tx = clamp(inp.x, -PP_PAD_X, PP_PAD_X);
    const ty = clamp(inp.y, PP_PAD_Y_MIN, PP_PAD_Y_MAX);
    // mola amortecida com velocidade limitada: a raquete segue o ponteiro sem "teletransportar"
    let vx = (tx - pad.x) * PP_PAD_STIFF;
    let vy = (ty - pad.y) * PP_PAD_STIFF;
    const sp = Math.hypot(vx, vy);
    if (sp > PP_PAD_SPEED) {
      vx *= PP_PAD_SPEED / sp;
      vy *= PP_PAD_SPEED / sp;
    }
    pad.vx = vx;
    pad.vy = vy;
    pad.x += vx * PP_TICK;
    pad.y += vy * PP_TICK;
    pad.swing = Math.max(0, pad.swing - PP_TICK * 6);
  }

  /** Um tick (1/60 s) com as entradas dos dois jogadores. */
  step(inputs: [PpInput, PpInput]): void {
    this.tick++;
    this.t += PP_TICK;
    for (let p = 0; p < 2; p++) {
      const inp = p === 0 ? inputs[0] : inputs[1];
      this.smashHeld[p === 0 ? 0 : 1] = inp.smash;
      this.movePad(p, inp);
    }
    if (this.phase === 'point') {
      this.ballFall();
      if (this.t >= PP_POINT_PAUSE) this.nextServe();
      return;
    }
    if (this.phase === 'over') {
      this.ballFall();
      return;
    }
    if (this.phase === 'serve') {
      this.holdBall();
      const sv = this.server === 0 ? 0 : 1;
      const inp = inputs[sv];
      const press = inp.serve && !this.serveWas[sv];
      this.serveWas[0] = inputs[0].serve;
      this.serveWas[1] = inputs[1].serve;
      if (press || this.t >= PP_SERVE_AUTO) {
        this.phase = 'toss';
        this.t = 0;
        this.ball.vy = PP_TOSS_V;
        this.events.push({ type: 'toss', p: this.server });
      }
      return;
    }
    this.serveWas[0] = inputs[0].serve;
    this.serveWas[1] = inputs[1].serve;
    for (let i = 0; i < PP_SUB; i++) {
      if (this.phase !== 'toss' && this.phase !== 'rally') break;
      this.subStep();
    }
    if (this.phase === 'rally' && this.t > PP_RALLY_MAX) this.letReplay();
    if (this.phase === 'toss' && this.t > 4) this.serveFault(this.server);
  }

  /** Depois do ponto a bola só cai (para a cena ficar viva). */
  private ballFall(): void {
    for (let i = 0; i < PP_SUB; i++) {
      this.out.ev = 0;
      ppStepBall(this.ball, this.out);
    }
  }

  private subStep(): void {
    const b = this.ball;
    ppCopyBall(b, this.prev);
    this.out.ev = 0;
    ppStepBall(b, this.out);
    const o = this.out;
    if (o.ev & PP_EV_NET) this.events.push({ type: 'net' });
    if (o.ev & PP_EV_TABLE) {
      this.events.push({ type: 'bounce', side: o.side, x: o.bx, z: o.bz, impact: o.impact });
      this.onBounce(o.side);
      if (this.phase !== 'toss' && this.phase !== 'rally') return;
    }
    if (o.ev & PP_EV_FLOOR || Math.abs(b.z) > 9 || Math.abs(b.x) > 7 || b.y > 8) {
      this.onDead();
      return;
    }
    if (this.phase === 'toss') this.tryServeHit();
    else this.tryReturn();
  }

  /** O saque: a bola que desce cruza a altura da raquete de quem saca, perto dela. */
  private tryServeHit(): void {
    const b = this.ball;
    const p = this.server;
    const pad = this.pad(p);
    if (b.vy >= 0) return;
    if (this.prev.y - PP_R < pad.y || b.y - PP_R >= pad.y) {
      // só dispara quando passa por pad.y descendo
      if (!(this.prev.y >= pad.y && b.y < pad.y)) return;
    }
    const dx = b.x - pad.x;
    if (Math.abs(dx) > PP_PAD_R + PP_R * 0.5) return;
    this.hit(p, true);
  }

  /** A devolução: a bola cruza o plano da raquete de quem deve rebater, depois de 1 quique do seu lado. */
  private tryReturn(): void {
    const p = this.expect;
    const s = PpMatch.sign(p);
    if ((this.bounces[p] ?? 0) < 1) return;
    const b = this.ball;
    const pr = this.prev;
    const plane = s * PP_PAD_Z;
    if (!((pr.z - plane) * s < 0 && (b.z - plane) * s >= 0)) return;
    const k = (plane - pr.z) / (b.z - pr.z);
    const cx = pr.x + (b.x - pr.x) * k;
    const cy = pr.y + (b.y - pr.y) * k;
    const pad = this.pad(p);
    if (Math.hypot(cx - pad.x, cy - pad.y) > PP_PAD_R + PP_R * 0.5) return;
    b.x = cx;
    b.y = cy;
    b.z = plane;
    this.hit(p, false);
  }

  private hit(p: number, serve: boolean): void {
    const pad = this.pad(p);
    const smash = p === 0 ? this.smashHeld[0] : this.smashHeld[1];
    const info = ppPaddleHit(
      this.ball,
      p,
      pad,
      smash && !serve,
      p === 0 ? this.assist[0] : this.assist[1],
      serve,
    );
    pad.swing = 1;
    this.lastHitter = p;
    this.bounces = [0, 0];
    this.rally++;
    const kmh = ppKmh(info.speed);
    if (kmh > this.bestKmh) this.bestKmh = kmh;
    if (this.phase === 'toss') {
      this.phase = 'rally';
      this.t = 0;
    }
    this.events.push({
      type: 'hit',
      p,
      kmh,
      smash,
      quality: info.quality,
      assisted: info.assisted,
      spin: info.spin,
      serve,
    });
  }

  private onBounce(side: number): void {
    if (this.phase === 'toss') {
      // quicou antes de bater no saque
      this.serveFault(this.server);
      return;
    }
    const h = this.lastHitter;
    if (side === h) {
      // quicou na própria mesa depois de bater
      this.awardPoint(1 - h, this.rally <= 1 ? 'serve' : 'own');
      return;
    }
    const n = (this.bounces[side] ?? 0) + 1;
    this.bounces[side === 0 ? 0 : 1] = n;
    if (n >= 2) this.awardPoint(h, 'miss');
  }

  /** A bola morreu (chão ou longe demais). */
  private onDead(): void {
    if (this.phase === 'toss') {
      this.serveFault(this.server);
      return;
    }
    const h = this.lastHitter;
    const r = 1 - h;
    if ((this.bounces[r] ?? 0) >= 1) this.awardPoint(h, 'miss');
    else this.awardPoint(r, this.rally <= 1 ? 'serve' : 'out');
  }

  /** Falta de saque: a primeira repete, a segunda dá o ponto ao adversário. */
  private serveFault(p: number): void {
    this.serveFaults++;
    this.events.push({ type: 'fault', p });
    if (this.serveFaults >= 2) {
      this.awardPoint(1 - p, 'serve');
      return;
    }
    this.phase = 'serve';
    this.t = 0;
    this.lastHitter = -1;
    this.bounces = [0, 0];
    this.rally = 0;
    this.holdBall();
  }

  private letReplay(): void {
    this.phase = 'serve';
    this.t = 0;
    this.lastHitter = -1;
    this.bounces = [0, 0];
    this.rally = 0;
    this.holdBall();
  }

  private awardPoint(winner: number, reason: PpReason): void {
    if (this.phase === 'point' || this.phase === 'over') return;
    this.score[winner as 0 | 1]++;
    const [a, b] = this.score;
    this.events.push({
      type: 'point',
      winner,
      reason,
      score: [a, b],
      rally: this.rally,
      best: this.bestKmh,
    });
    this.serveFaults = 0;
    this.t = 0;
    const done = Math.max(a, b) >= PP_POINTS && Math.abs(a - b) >= 2;
    if (done) {
      this.phase = 'over';
      this.winner = a > b ? 0 : 1;
      this.events.push({ type: 'game', winner: this.winner, score: [a, b] });
    } else {
      this.phase = 'point';
    }
  }

  private nextServe(): void {
    this.server = ppServerFor(this.firstServer, this.score[0], this.score[1]);
    this.phase = 'serve';
    this.t = 0;
    this.lastHitter = -1;
    this.bounces = [0, 0];
    this.rally = 0;
    this.bestKmh = 0;
    this.holdBall();
  }

  /** Esvazia a fila de eventos (a cena e o som leem daqui). */
  drain(): PpEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}

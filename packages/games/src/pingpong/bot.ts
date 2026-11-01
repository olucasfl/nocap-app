import { ppCopyBall, ppNewBall } from './ball';
import { ppLanding } from './assist';
import { PP_PAD_R, PP_W } from './constants';
import { ppPredictCross, type PpCrossing } from './predict';
import { PpMatch, ppIdleInput, type PpInput } from './match';
import { ppPaddleHit } from './paddle';

/** Jeito de jogar de cada dificuldade. */
export interface PpBotLevel {
  /** Tempo (s) depois da batida do adversário até o bot "enxergar" a bola. */
  reaction: number;
  /** Velocidade do cursor do bot (m/s). */
  speed: number;
  /** Erro de posição (m, desvio) ao esperar a bola. */
  err: number;
  /** Chance de dar smash numa bola alta. */
  smash: number;
  /** 0 a 1: o quanto mira longe do adversário (1 = sempre no canto livre). */
  aim: number;
  /** Espera (s) antes de sacar. */
  serveWait: number;
}

export type PpBotName = 'facil' | 'medio' | 'dificil';

export const PP_BOT_LEVELS: Record<PpBotName, PpBotLevel> = {
  facil: { reaction: 0.42, speed: 4.4, err: 0.2, smash: 0, aim: 0.2, serveWait: 1.2 },
  medio: { reaction: 0.26, speed: 6.4, err: 0.09, smash: 0.25, aim: 0.55, serveWait: 1 },
  dificil: { reaction: 0.15, speed: 9, err: 0.035, smash: 0.55, aim: 0.9, serveWait: 0.8 },
};

/** Um jogador de mentira: manda as mesmas entradas que uma pessoa mandaria (cursor, smash, saque). */
export class PpBot {
  private cx = 0;
  private cy = 1.3;
  private seen = -1;
  private pred: PpCrossing | null = null;
  private goalX = 0;
  private goalY = 1.3;
  private errX = 0;
  private errY = 0;
  private ox = 0;
  private wantSmash = false;
  private serveOx = 0;
  private serveTick = -1;

  constructor(
    readonly level: PpBotLevel,
    private readonly rng: () => number,
  ) {}

  private gauss(): number {
    const u = Math.max(1e-9, this.rng());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.rng());
  }

  /** As entradas deste tick para o jogador `p` da partida `m`. */
  input(m: PpMatch, p: number, dt = 1 / 60): PpInput {
    const lv = this.level;
    const inp = ppIdleInput();
    let gx = 0;
    let gy = 1.3;
    let speed = lv.speed * 0.6;

    if (m.phase === 'serve' && m.server === p) {
      gx = this.cx;
      gy = 1.4;
      if (this.serveTick < 0) {
        this.serveTick = m.tick;
        this.serveOx = (this.rng() - 0.5) * 1.1;
      }
      if (m.t >= lv.serveWait) {
        inp.serve = true;
      }
    } else if (m.phase === 'toss' && m.server === p) {
      this.serveTick = -1;
      gx = m.ball.x - this.serveOx * PP_PAD_R;
      gy = 1.35;
      speed = 12;
    } else if (m.phase === 'rally' && m.expect === p) {
      this.serveTick = -1;
      // a bola vem: depois do tempo de reação, prevê onde ela cruza e corre para lá
      if (m.rally !== this.seen) {
        this.seen = m.rally;
        this.pred = null;
        this.errX = this.gauss() * lv.err;
        this.errY = this.gauss() * lv.err;
        this.wantSmash = false;
      }
      if (!this.pred && m.t >= lv.reaction) {
        this.pred = ppPredictCross(m.ball, p);
        if (this.pred) this.plan(m, p, this.pred);
      }
      if (this.pred) {
        gx = this.goalX + this.errX;
        gy = this.goalY + this.errY;
        speed = lv.speed;
        // perto da hora, o smash vale
        inp.smash = this.wantSmash;
      } else {
        gx = this.cx;
        gy = this.cy;
      }
    } else {
      this.serveTick = -1;
      if (m.phase === 'point' || m.phase === 'over') this.pred = null;
    }

    const dx = gx - this.cx;
    const dy = gy - this.cy;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d <= step || d < 1e-9) {
      this.cx = gx;
      this.cy = gy;
    } else {
      this.cx += (dx / d) * step;
      this.cy += (dy / d) * step;
    }
    inp.x = this.cx;
    inp.y = this.cy;
    return inp;
  }

  /** Escolhe o ponto de contato (para onde a bola vai) e o smash para esta bola. */
  private plan(m: PpMatch, p: number, c: PpCrossing): void {
    const lv = this.level;
    const opp = m.pad(1 - p);
    // quer mandar para o lado oposto de onde o adversário está, com mais ou menos capricho
    const free = opp.x >= 0 ? -1 : 1;
    const aimX = free * (0.15 + 0.55 * lv.aim) * (PP_W / 2) * (0.6 + 0.4 * this.rng());
    this.wantSmash = c.y > 1.45 && this.rng() < lv.smash;
    let best = 0;
    let bestScore = Infinity;
    for (let ox = -0.8; ox <= 0.8001; ox += 0.2) {
      const t = ppCopyBall(c.ball, ppNewBall());
      ppPaddleHit(t, p, { x: c.x - ox * PP_PAD_R, y: c.y, vx: 0, vy: 0 }, this.wantSmash, 1);
      const land = ppLanding(t, p);
      const score = (land.ok ? 0 : 5) + Math.abs(land.x - aimX) * (0.4 + lv.aim);
      if (score < bestScore) {
        bestScore = score;
        best = ox;
      }
    }
    this.ox = best;
    this.goalX = c.x - best * PP_PAD_R;
    this.goalY = c.y;
  }
}

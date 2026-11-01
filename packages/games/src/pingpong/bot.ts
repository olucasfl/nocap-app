import { ppCopyBall, ppNewBall } from './ball';
import { ppLanding } from './assist';
import { PP_PAD_R, PP_SERVE_FRONT, PP_TOSS_V, PP_TOSS_Y, PP_W } from './constants';
import { PpMatch, ppIdleInput, type PpInput, type PpSwing } from './match';
import { ppPaddleHit } from './paddle';
import { ppPredictCross, type PpCrossing } from './predict';

/** Jeito de jogar de cada dificuldade. */
export interface PpBotLevel {
  /** Tempo (s) depois da batida do adversário até o bot "enxergar" a bola. */
  reaction: number;
  /** Velocidade do cursor do bot (m/s). */
  speed: number;
  /** Erro de posição (m, desvio) ao esperar a bola. */
  err: number;
  /** Erro da velocidade da batida (fração): quanto a força varia. */
  swingErr: number;
  /** 0 a 1: o quanto mira longe do adversário (1 = sempre no canto livre). */
  aim: number;
  /** Maior velocidade de bola (m/s) que o bot aceita mandar: o fácil não "bate forte". */
  power: number;
  /** Espera (s) antes de sacar. */
  serveWait: number;
}

export type PpBotName = 'facil' | 'medio' | 'dificil';

export const PP_BOT_LEVELS: Record<PpBotName, PpBotLevel> = {
  facil: {
    reaction: 0.4,
    speed: 4.4,
    err: 0.18,
    swingErr: 0.3,
    aim: 0.15,
    power: 6.2,
    serveWait: 1.2,
  },
  medio: {
    reaction: 0.25,
    speed: 6.4,
    err: 0.08,
    swingErr: 0.15,
    aim: 0.5,
    power: 8,
    serveWait: 1,
  },
  dificil: {
    reaction: 0.15,
    speed: 9,
    err: 0.03,
    swingErr: 0.06,
    aim: 0.9,
    power: 10,
    serveWait: 0.8,
  },
};

/** As batidas que o bot sabe dar: velocidade da mão para cima/baixo, para o lado e para a frente. */
const VY = [-4, -2.5, -1, 0, 1, 2, 3, 4, 5.5, 7];
const VX = [-2, -1, 0, 1, 2];
const VZ = [1, 2, 3, 4, 5, 6, 7.5];
const OFFS = [-0.4, 0, 0.4];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Um jogador de mentira: manda as mesmas entradas que uma pessoa mandaria (cursor e saque), mais a batida pronta. */
export class PpBot {
  private cx = 0;
  private cy = 1.3;
  private seen = -1;
  private pred: PpCrossing | null = null;
  private goalX = 0;
  private goalY = 1.3;
  private errX = 0;
  private errY = 0;
  private swing: PpSwing = { vx: 0, vy: 0, vz: 0 };
  private serveSwing: PpSwing | null = null;
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
    let swing: PpSwing = { vx: 0, vy: 0, vz: 0 };

    if (m.phase === 'serve' && m.server === p) {
      gx = this.cx;
      gy = 1.65;
      if (this.serveTick < 0) {
        this.serveTick = m.tick;
        this.serveSwing = null;
      }
      if (m.t >= lv.serveWait) inp.serve = true;
    } else if (m.phase === 'toss' && m.server === p) {
      // a bola sobe e desce na frente da raquete: o bot espera na altura dela e bate para a frente quando passa
      const b = m.ball;
      gx = b.x;
      gy = 1.65;
      speed = 12;
      if (!this.serveSwing) this.serveSwing = this.planServe(m, p);
      swing = this.serveSwing;
      if (b.vy < 0 && b.y <= this.cy + 0.04) swing = { ...swing, reach: PP_SERVE_FRONT + 0.08 };
    } else if (m.phase === 'rally' && m.expect === p) {
      this.serveTick = -1;
      // a bola vem: depois do tempo de reação, prevê onde ela cruza, escolhe a batida e corre para lá
      if (m.rally !== this.seen) {
        this.seen = m.rally;
        this.pred = null;
        this.errX = this.gauss() * lv.err;
        this.errY = this.gauss() * lv.err;
        this.swing = { vx: 0, vy: 0, vz: 0 };
      }
      if (!this.pred && m.t >= lv.reaction) {
        this.pred = ppPredictCross(m.ball, p);
        if (this.pred) this.plan(m, p, this.pred);
      }
      if (this.pred) {
        gx = this.goalX + this.errX;
        gy = this.goalY + this.errY;
        speed = lv.speed;
        swing = this.swing;
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
    inp.swing = swing;
    return inp;
  }

  /** O saque: escolhe a batida que põe a bola na mesa do adversário (a bola desce até a altura da raquete). */
  private planServe(m: PpMatch, p: number): PpSwing {
    const lv = this.level;
    const b = ppNewBall();
    const s = PpMatch.sign(p);
    // a bola na altura da raquete: sai do lançamento e desce com a velocidade da queda
    b.x = m.ball.x;
    b.y = 1.65;
    b.z = s * (2.45 - PP_SERVE_FRONT);
    b.vy = -Math.sqrt(
      Math.max(0.5, 2 * 8 * (PP_TOSS_Y + (PP_TOSS_V * PP_TOSS_V) / (2 * 8) - 1.65)),
    );
    const choice = this.best(b, p, Math.max(lv.power, 8.5), (this.rng() - 0.5) * 0.9 * lv.aim);
    return { vx: choice.vx, vy: choice.vy, vz: choice.vz };
  }

  /** Escolhe a batida e o ponto de contato para a bola que vem (mesma física do jogo). */
  private plan(m: PpMatch, p: number, c: PpCrossing): void {
    const opp = m.pad(1 - p);
    const free = opp.x >= 0 ? -1 : 1;
    const aimX = free * (0.15 + 0.55 * this.level.aim) * (PP_W / 2) * (0.6 + 0.4 * this.rng());
    const choice = this.best(c.ball, p, this.level.power, aimX, c.x, c.y);
    this.swing = { vx: choice.vx, vy: choice.vy, vz: choice.vz };
    this.goalX = c.x - choice.off * PP_PAD_R;
    this.goalY = c.y;
  }

  /** A melhor batida entre as que o bot conhece: cai na mesa do outro lado, perto do alvo, sem passar da força dele. */
  private best(
    ball: ReturnType<typeof ppNewBall>,
    p: number,
    power: number,
    aimX: number,
    padX = ball.x,
    padY = ball.y,
  ): PpSwing & { off: number } {
    let pick: (PpSwing & { off: number }) | null = null;
    let bestScore = Infinity;
    const trial = ppNewBall();
    for (const off of OFFS) {
      for (const vz of VZ) {
        for (const vy of VY) {
          for (const vx of VX) {
            ppCopyBall(ball, trial);
            const info = ppPaddleHit(trial, p, { x: padX - off * PP_PAD_R, y: padY, vx, vy, vz });
            if (info.speed > power) continue;
            const land = ppLanding(trial, p);
            if (!land.ok) continue;
            // prefere cair no alvo, com folga sobre a rede e sem bolas esquisitas (muito altas ou muito fortes)
            const score =
              Math.abs(land.x - aimX) * (0.4 + this.level.aim) +
              Math.abs(info.speed - power * 0.7) * 0.05 +
              Math.max(0, 0.12 - land.clear) * 4 +
              this.rng() * (0.25 - 0.2 * this.level.aim);
            if (score < bestScore) {
              bestScore = score;
              pick = { vx, vy, vz, off };
            }
          }
        }
      }
    }
    const ch = pick ?? { vx: 0, vy: 2.5, vz: 4.5, off: 0 };
    // a mão nunca é exata: a força varia conforme o nível
    const k = 1 + this.gauss() * this.level.swingErr * 0.5;
    return { vx: ch.vx, vy: ch.vy * k, vz: clamp(ch.vz * k, 0.5, 8), off: ch.off };
  }
}

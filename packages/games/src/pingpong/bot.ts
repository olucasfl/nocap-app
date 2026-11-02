import { ppCopyBall, ppNewBall } from './ball';
import { ppLanding } from './assist';
import {
  PP_PAD_R,
  PP_PAD_Z,
  PP_SERVE_FRONT,
  PP_SERVE_Y,
  PP_TOSS_DEFAULT,
  PP_W,
  ppTossSpeed,
} from './constants';
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
  /** Erro (na barra do smash, 0 a 1) de quem aperta para o smash: menor = acerta mais o verde. */
  smashErr: number;
}

/** O bot estende a raquete até aqui para encontrar a bola (alcança também bolas que morrem curtas). */
const BOT_REACH = 0.2;
/** Para bola curta, que morre na mesa antes do plano normal: o bot avança a raquete por cima da mesa. */
const BOT_REACH_DEEP = 1.3;

export type PpBotName = 'facil' | 'medio' | 'dificil';

export const PP_BOT_LEVELS: Record<PpBotName, PpBotLevel> = {
  facil: {
    reaction: 0.4,
    speed: 4.4,
    err: 0.5,
    swingErr: 0.3,
    aim: 0.15,
    power: 10,
    serveWait: 1.2,
    smashErr: 0.32,
  },
  medio: {
    reaction: 0.25,
    speed: 6.4,
    err: 0.17,
    swingErr: 0.15,
    aim: 0.5,
    power: 14,
    serveWait: 1,
    smashErr: 0.16,
  },
  // difícil: reage cedo, corre mais, quase não erra a posição, devolve forte para o canto livre e acerta o smash
  dificil: {
    reaction: 0.1,
    speed: 11,
    err: 0.04,
    swingErr: 0.04,
    aim: 1,
    power: 19,
    serveWait: 0.6,
    smashErr: 0.03,
  },
};

/** As batidas que o bot sabe dar: velocidade da mão para cima/baixo, para o lado e para a frente. */
const VY = [-4, -2.5, -1, 0, 1, 2, 3, 4, 5.5, 7];
const VX = [-2, -1, 0, 1, 2];
const VZ = [1, 2, 3, 4, 5, 6, 7.5, 9, 10.5];
const OFFS = [-0.4, 0, 0.4];

/** O que o bot quer fazer com a bola: cada intenção é um jeito diferente de bater (força, efeito, altura). */
type Intent = 'empurrar' | 'topspin' | 'drive' | 'curva' | 'bloquear';
const INTENT: Record<
  Intent,
  { speed: number; stroke: readonly string[]; vz: readonly number[]; vx: readonly number[] }
> = {
  // empurrada com corte, devagar
  empurrar: { speed: 0.34, stroke: ['corte'], vz: [1, 2, 3], vx: [-2, -1, 0, 1, 2] },
  // topspin de arco, médio
  topspin: { speed: 0.6, stroke: ['topspin'], vz: [4, 5, 6, 7.5], vx: [-2, -1, 0, 1, 2] },
  // drive: forte e reto, com topspin pesado
  drive: { speed: 0.95, stroke: ['drive', 'smash'], vz: [8.4, 9, 10.5, 12], vx: [-2, -1, 0, 1, 2] },
  // curva: varrendo para o lado, efeito de lado
  curva: { speed: 0.7, stroke: ['curva'], vz: [4, 6, 7.5], vx: [-7, -6, 6, 7] },
  // bloqueio: mão mansa contra bola forte, sobe em arco
  bloquear: { speed: 0.4, stroke: ['bloqueio', 'lob'], vz: [0.4, 1], vx: [-1, 0, 1] },
};
/** Pesos de cada intenção por nível (o difícil ataca mais, o fácil empurra). */
const INTENT_WEIGHTS: Record<PpBotName, Record<Intent, number>> = {
  facil: { empurrar: 0.45, topspin: 0.35, drive: 0.1, curva: 0.05, bloquear: 0.05 },
  medio: { empurrar: 0.22, topspin: 0.33, drive: 0.25, curva: 0.15, bloquear: 0.05 },
  dificil: { empurrar: 0.1, topspin: 0.28, drive: 0.37, curva: 0.2, bloquear: 0.05 },
};

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
  private predReach = BOT_REACH;
  private intent: Intent = 'topspin';
  private popAt = -1;
  private popTapped = false;
  private popTarget = 0.5;
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

    // bola mal pegada do outro lado: o bot também aperta a barra do smash, mais ou menos certo conforme o nível
    if (m.popup && m.expect === p) {
      if (this.popAt !== m.rally) {
        this.popAt = m.rally;
        this.popTapped = false;
        this.popTarget = 0.5 + this.gauss() * lv.smashErr;
      }
      if (
        !this.popTapped &&
        m.popupTicks > lv.reaction * 60 &&
        Math.abs(m.smashCursor() - this.popTarget) < 0.04
      ) {
        m.smashTap(p);
        this.popTapped = true;
      }
    }

    if (m.phase === 'serve' && m.server === p) {
      gx = this.cx;
      gy = PP_SERVE_Y;
      this.serveSwing = null;
      inp.tossV = PP_TOSS_DEFAULT;
      if (m.t >= lv.serveWait) inp.serve = true;
    } else if (m.phase === 'toss' && m.server === p) {
      // a bola subiu: o bot espera na altura da raquete e a rebate para a frente quando ela desce
      const b = m.ball;
      gx = b.x;
      gy = 1.65;
      speed = 12;
      if (!this.serveSwing) this.serveSwing = this.planServe(m, p);
      swing = this.serveSwing;
      if (b.vy < 0 && b.y <= this.cy + 0.04) swing = { ...swing, reach: PP_SERVE_FRONT + 0.1 };
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
        this.predReach = BOT_REACH;
        this.pred = ppPredictCross(m.ball, p, BOT_REACH, m.bounces[p] ?? 0);
        if (!this.pred) {
          this.predReach = BOT_REACH_DEEP;
          this.pred = ppPredictCross(m.ball, p, BOT_REACH_DEEP, m.bounces[p] ?? 0);
        }
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
    // a bola na altura da raquete, descendo com a velocidade da queda do lançamento
    b.x = m.ball.x;
    b.y = 1.65;
    b.z = s * (PP_PAD_Z - PP_SERVE_FRONT);
    b.vy = -Math.sqrt(Math.max(1, ppTossSpeed(PP_TOSS_DEFAULT) ** 2 - 2 * 8 * (1.65 - PP_SERVE_Y)));
    const choice = this.best(b, p, Math.max(lv.power, 8.5), (this.rng() - 0.5) * 0.9 * lv.aim);
    return { vx: choice.vx, vy: choice.vy, vz: choice.vz };
  }

  /** Sorteia o que fazer com esta bola: bola forte que chega pede bloqueio; bola mansa e alta pede ataque. */
  private pickIntent(c: PpCrossing): Intent {
    const name =
      (Object.keys(PP_BOT_LEVELS) as PpBotName[]).find((k) => PP_BOT_LEVELS[k] === this.level) ??
      'medio';
    const w = { ...INTENT_WEIGHTS[name] };
    const vin = Math.hypot(c.ball.vx, c.ball.vy, c.ball.vz);
    if (vin > 13) {
      w.bloquear += 0.4;
      w.drive *= 0.5;
    } else if (vin < 6) {
      w.drive *= 1.4;
      w.topspin *= 1.2;
    }
    if (c.y > 1.9) w.drive += 0.4; // bola alta: ataque
    let t = this.rng() * (w.empurrar + w.topspin + w.drive + w.curva + w.bloquear);
    for (const k of ['empurrar', 'topspin', 'drive', 'curva', 'bloquear'] as Intent[]) {
      t -= w[k];
      if (t <= 0) return k;
    }
    return 'topspin';
  }

  /** Escolhe a batida e o ponto de contato para a bola que vem (mesma física do jogo). */
  private plan(m: PpMatch, p: number, c: PpCrossing): void {
    const opp = m.pad(1 - p);
    const free = opp.x >= 0 ? -1 : 1;
    const aimX = free * (0.15 + 0.55 * this.level.aim) * (PP_W / 2) * (0.6 + 0.4 * this.rng());
    this.intent = this.pickIntent(c);
    const choice = this.best(c.ball, p, this.level.power, aimX, c.x, c.y, this.predReach);
    this.swing = { vx: choice.vx, vy: choice.vy, vz: choice.vz, reach: this.predReach };
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
    reachNow = BOT_REACH,
  ): PpSwing & { off: number } {
    let pick: (PpSwing & { off: number }) | null = null;
    let bestScore = Infinity;
    const trial = ppNewBall();
    const it = INTENT[this.intent];
    const serving = ball.vx === 0 && ball.vy === 0 && ball.vz === 0;
    const vzs = serving ? VZ : it.vz;
    const vxs = serving ? VX : it.vx;
    const tryList = (vzList: readonly number[], vxList: readonly number[], want: boolean) => {
      for (const off of OFFS) {
        for (const vz of vzList) {
          for (const vy of VY) {
            for (const vx of vxList) {
              ppCopyBall(ball, trial);
              const info = ppPaddleHit(
                trial,
                p,
                { x: padX - off * PP_PAD_R, y: padY, vx, vy, vz, reach: reachNow },
                false,
              );
              if (info.speed > power) continue;
              const land = ppLanding(trial, p);
              if (!land.ok) continue;
              // prefere o que a intenção pede (força, tipo de golpe), cair no alvo, com folga sobre a rede e sem bolas esquisitas
              const score =
                Math.abs(land.x - aimX) * (0.2 + this.level.aim * 0.6) +
                Math.abs(info.speed - power * it.speed) * 0.3 +
                (want && !it.stroke.includes(info.stroke) ? 1.2 : 0) +
                Math.max(0, 0.12 - land.clear) * 4 +
                Math.max(0, trial.vy - 1.5) * 0.25 +
                this.rng() * (0.25 - 0.2 * this.level.aim);
              if (score < bestScore) {
                bestScore = score;
                pick = { vx, vy, vz, off };
              }
            }
          }
        }
      }
    };
    tryList(vzs, vxs, !serving);
    // a intenção não coube nesta bola (ex.: drive de uma bola que morre curta): cai para a grade geral
    if (!pick) tryList(VZ, VX, false);
    const ch = pick ?? { vx: 0, vy: 2.5, vz: 4.5, off: 0 };
    // a mão nunca é exata: a força varia conforme o nível
    const k = 1 + this.gauss() * this.level.swingErr * 0.5;
    return { vx: ch.vx, vy: ch.vy * k, vz: clamp(ch.vz * k, 0.5, 8), off: ch.off };
  }
}

import { GOLF_BALL_RADIUS, GOLF_DT, golfHit, golfNewBall, golfStep, type GolfBall, type GolfLevel, type V3 } from './physics';
import { golfBallCollide } from './online';

/**
 * O mundo do buraco no aparelho (spec 082): a MESMA física do servidor rodando aqui para TODAS as bolas, corrigida pelos
 * quadros dele. Assim a minha tacada responde na hora e bate nas outras bolas no ponto certo (a outra bola reage no
 * mesmo instante, em vez de a minha atravessar uma bola parada e o servidor empurrar depois), e nada precisa ser
 * interpolado no passado. O servidor continua o árbitro: quem erra é puxado de volta aos poucos, e o que passa de
 * `SNAP` metros salta de uma vez (volta ao ponto da tacada, por exemplo).
 */
export const GOLF_PREDICT = {
  /** Erro (m) a partir do qual a bola salta para o servidor em vez de deslizar. */
  SNAP: 1.5,
  /** Erro (m) abaixo do qual nada é corrigido (evita tremor). */
  DEAD: 0.012,
  /** Parte do erro corrigida a cada quadro do servidor (~31 por segundo). */
  PULL: 0.3,
  /** Depois de uma batida local, o quadro do servidor ainda não sabe dela: a bola atingida é poupada por este tempo (s). */
  HIT_HOLD: 0.4,
  /** Depois da minha tacada, o servidor só vale como "parada" depois deste tempo (s): antes o quadro pode ser de antes dela. */
  TRUST: 1.2,
  /** Quanto o quadro do servidor já está velho ao chegar (s), além do jitter medido: a ida pela rede. */
  LATENCY: 0.04,
  /** Teto da extrapolação de um quadro velho (s). */
  MAX_AGE: 0.25,
} as const;

/** Estado enviado pelo servidor: 0 pronta, 1 rolando, 2 no buraco, 3 sem tacadas. */
export interface GolfNetBall {
  pos: V3;
  vel: V3;
  st: number;
  /** Idade do quadro ao chegar (s). */
  age: number;
}

interface Entry {
  ball: GolfBall;
  /** Último estado do servidor. */
  st: number;
  /** No buraco ou sem tacadas: parada, não simula. */
  held: boolean;
  /** Minha tacada ainda em previsão: o caminho (para comparar sem contar o atraso da rede) e quando começou. */
  pred: { start: number; hist: { at: number; x: number; z: number }[]; seen: boolean } | null;
  /** Até quando (tempo local) a bola está poupada da correção por causa de uma batida local. */
  hold: number;
}

const speedXZ = (v: V3) => Math.hypot(v[0], v[2]);

export class GolfPredictWorld {
  private readonly balls = new Map<number, Entry>();
  /** Tempo local da simulação (s). */
  private lt = 0;
  private acc = 0;
  private stepN = 0;
  /** Relógio da fase (move as peças móveis), em segundos do servidor. */
  clock = 0;

  constructor(
    readonly level: GolfLevel,
    readonly collide: boolean,
  ) {}

  has(slot: number): boolean {
    return this.balls.has(slot);
  }
  pos(slot: number): V3 | null {
    return this.balls.get(slot)?.ball.pos ?? null;
  }
  vel(slot: number): V3 | null {
    return this.balls.get(slot)?.ball.vel ?? null;
  }
  /** Último estado do servidor para esta bola (0 se ainda não veio nenhum). */
  status(slot: number): number {
    return this.balls.get(slot)?.st ?? 0;
  }
  /** A minha tacada está sendo prevista aqui? */
  predicting(slot: number): boolean {
    return !!this.balls.get(slot)?.pred;
  }
  /** Todas as bolas (a ordem é a de chegada). */
  slots(): number[] {
    return [...this.balls.keys()];
  }

  private fresh(b: GolfNetBall): Entry {
    const ball = golfNewBall(this.level.data);
    const e: Entry = { ball, st: b.st, held: b.st >= 2, pred: null, hold: 0 };
    this.snap(e, b);
    return e;
  }

  private snap(e: Entry, b: GolfNetBall) {
    const age = Math.min(GOLF_PREDICT.MAX_AGE, Math.max(0, b.age));
    e.ball.pos = [b.pos[0] + b.vel[0] * age, b.pos[1], b.pos[2] + b.vel[2] * age];
    e.ball.vel = [b.vel[0], b.vel[1], b.vel[2]];
    e.ball.moving = b.st === 1 || speedXZ(b.vel) > 0.1;
    e.ball.slowTime = 0;
    e.ball.outOfBounds = false;
    e.ball.inWater = false;
  }

  /** Um quadro do servidor para a bola `slot`. */
  apply(slot: number, b: GolfNetBall): void {
    const e = this.balls.get(slot);
    if (!e) {
      this.balls.set(slot, this.fresh(b));
      return;
    }
    e.st = b.st;
    if (b.st >= 2) {
      // no buraco ou sem tacadas: a posição do servidor é a final
      e.held = true;
      e.pred = null;
      this.snap(e, { ...b, age: 0 });
      e.ball.vel = [0, 0, 0];
      e.ball.moving = false;
      return;
    }
    e.held = false;
    const age = Math.min(GOLF_PREDICT.MAX_AGE, Math.max(0, b.age));
    const ex = b.pos[0] + b.vel[0] * age;
    const ez = b.pos[2] + b.vel[2] * age;

    if (e.pred) {
      if (b.st === 1) e.pred.seen = true;
      // o servidor já vê a bola parada depois do tempo de confiança: a tacada foi recusada ou a bola voltou ao ponto
      if (b.st !== 1 && this.lt - e.pred.start > GOLF_PREDICT.TRUST) {
        e.pred = null;
        this.pull(e, b, ex, ez, true);
        return;
      }
      if (b.st !== 1 || e.pred.hist.length < 4) return;
      // compara com o PONTO MAIS PERTO do caminho previsto: o atraso da rede (a bola do servidor começou depois) não conta,
      // só o desvio de verdade (uma batida que a previsão não viu)
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < e.pred.hist.length; i++) {
        const h = e.pred.hist[i]!;
        const d = Math.hypot(h.x - ex, h.z - ez);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      if (this.lt < e.hold) return;
      if (bd > GOLF_PREDICT.SNAP) {
        e.pred = null;
        this.snap(e, b);
      } else if (bd > GOLF_PREDICT.DEAD) {
        const h = e.pred.hist[bi]!;
        e.ball.pos = [e.ball.pos[0] + (ex - h.x) * GOLF_PREDICT.PULL, e.ball.pos[1], e.ball.pos[2] + (ez - h.z) * GOLF_PREDICT.PULL];
      }
      return;
    }
    this.pull(e, b, ex, ez, false);
  }

  /** Aproxima a bola do estado estimado do servidor. */
  private pull(e: Entry, b: GolfNetBall, ex: number, ez: number, force: boolean) {
    const ball = e.ball;
    // a bola que acabei de bater aqui: o servidor ainda não soube, não a puxe de volta
    if (!force && this.lt < e.hold) {
      if (Math.hypot(ex - ball.pos[0], ez - ball.pos[2]) < 2.5) return;
    }
    const dx = ex - ball.pos[0];
    const dy = b.pos[1] - ball.pos[1];
    const dz = ez - ball.pos[2];
    const d = Math.hypot(dx, dz);
    if (d > GOLF_PREDICT.SNAP || Math.abs(dy) > 1.2) {
      this.snap(e, b);
      return;
    }
    if (d > GOLF_PREDICT.DEAD) {
      const k = GOLF_PREDICT.PULL;
      ball.pos = [ball.pos[0] + dx * k, ball.pos[1] + dy * k, ball.pos[2] + dz * k];
    }
    // a velocidade acompanha o servidor (a direção de uma batida de outra bola vem daqui)
    const k = GOLF_PREDICT.PULL;
    ball.vel = [ball.vel[0] + (b.vel[0] - ball.vel[0]) * k, ball.vel[1] + (b.vel[1] - ball.vel[1]) * k, ball.vel[2] + (b.vel[2] - ball.vel[2]) * k];
    if (b.st === 1 || speedXZ(b.vel) > 0.1) {
      ball.moving = true;
      ball.slowTime = 0;
    }
  }

  /** A minha tacada: sai na hora, igual ao servidor, e fica em previsão até a bola parar. */
  shoot(slot: number, dir: [number, number], power: number): boolean {
    const e = this.balls.get(slot);
    if (!e || e.held) return false;
    golfHit(e.ball, dir, Math.max(0, Math.min(1, power)));
    e.pred = { start: this.lt, hist: [], seen: false };
    return true;
  }

  /** Avança `dt` segundos reais (em passos fixos de 1/120 s). `serverClock` é o relógio da fase no servidor, em segundos. */
  advance(dt: number, serverClock: number): void {
    this.clock = serverClock;
    this.acc += Math.min(0.1, Math.max(0, dt));
    while (this.acc >= GOLF_DT) {
      this.acc -= GOLF_DT;
      this.stepOnce();
    }
  }

  private stepOnce() {
    this.lt += GOLF_DT;
    this.clock += GOLF_DT;
    this.stepN++;
    const live: Entry[] = [];
    for (const e of this.balls.values()) {
      if (e.held) continue;
      golfStep(this.level, e.ball, this.clock);
      if (e.ball.holed || e.ball.inHole) continue;
      live.push(e);
      if (e.pred) {
        if (this.stepN % 4 === 0) {
          e.pred.hist.push({ at: this.lt, x: e.ball.pos[0], z: e.ball.pos[2] });
          while (e.pred.hist.length > 0 && this.lt - e.pred.hist[0]!.at > 2.5) e.pred.hist.shift();
        }
        // parou aqui: a previsão acabou, o servidor assume (já deve estar perto)
        if (!e.ball.moving && this.lt - e.pred.start > 0.2) e.pred = null;
      }
    }
    if (this.collide && live.length > 1) {
      for (let i = 0; i < live.length; i++)
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i]!;
          const c = live[j]!;
          if (golfBallCollide(a.ball, c.ball) > 0) {
            // as duas bolas acabaram de mudar: o quadro do servidor ainda não sabe e não pode desfazer a batida
            a.hold = c.hold = this.lt + GOLF_PREDICT.HIT_HOLD;
          }
        }
    }
  }

  /** Há algo desenhado em cima de outra bola? (diagnóstico e testes) */
  minGap(): number {
    let m = Infinity;
    const arr = [...this.balls.values()].filter((e) => !e.held);
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i]!.ball.pos;
        const b = arr[j]!.ball.pos;
        m = Math.min(m, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
      }
    return m - GOLF_BALL_RADIUS * 2;
  }
}

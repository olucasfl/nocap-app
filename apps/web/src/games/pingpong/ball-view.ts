import { PP_PAD_Z, type PpMatch } from '@nocap/games';

/** Quem guarda os estados da partida por tick (a `PpNetSim`). */
export interface BallHistory {
  tick: number;
  ballAt(t: number): { x: number; y: number; z: number } | null;
}

/** Os números que decidem como a bola desenhada alcança a da partida (afinados na simulação de rede). */
export interface BallViewTuning {
  /** Quanto tempo (s) a bola espera na raquete dele pela batida que ainda não chegou. */
  holdMax: number;
  /** Pressa mínima e máxima (ticks por segundo) para a bola desenhada alcançar a da partida. */
  catchMin: number;
  catchMax: number;
  /** Fração do tempo até a bola chegar em você usada para alcançar (menor = mais pressa). */
  catchFrac: number;
  /** Quão rápido (por segundo) o deslize do erro visual some. */
  errDecay: number;
  /** Maior atraso (ticks) que a bola desenhada aceita ter. */
  maxLag: number;
}

export const DEFAULT_BALL_VIEW: BallViewTuning = {
  holdMax: 0.3,
  catchMin: 4,
  catchMax: 24,
  catchFrac: 0.8,
  errDecay: 3,
  maxLag: 18,
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * A bola como aparece na tela numa partida em sala. A partida (idêntica nos aparelhos) é a verdade, mas a batida do outro
 * chega atrasada e a partida volta no tempo: sem cuidado a bola pularia. Aqui a bola desenhada (1) espera na raquete dele
 * um instante pela batida que não chegou, (2) recomeça de onde ele bateu e alcança a da partida sem correr e (3) desliza
 * o que sobrou do erro. Sem THREE: dá para simular a rede e medir os saltos.
 */
export class PpBallView {
  shown = { x: 0, y: 1.25, z: 2.5 };
  private err = { x: 0, y: 0, z: 0 };
  lag = 0;
  private hold: { t: number; x: number; y: number; z: number; released: boolean } | null = null;
  sim: BallHistory | null = null;
  /** Só para diagnóstico: quanto tempo a bola está esperando na raquete dele (-1 = não espera). */
  get holdT(): number {
    return this.hold ? this.hold.t : -1;
  }

  constructor(
    private match: PpMatch,
    private me: number,
    readonly tune: BallViewTuning = DEFAULT_BALL_VIEW,
  ) {}

  /** A bola da partida `lag` ticks atrás (interpolada entre dois ticks). `a` é a fração do tick de agora. */
  private delayed(a: number): { x: number; y: number; z: number } {
    const c = this.match.ball;
    const n = this.sim;
    if (!n || this.lag <= 0.01) return { x: c.x, y: c.y, z: c.z };
    const pos = n.tick + a - this.lag;
    const lo = n.ballAt(pos);
    const hi = n.ballAt(pos + 1);
    if (!lo || !hi) return { x: c.x, y: c.y, z: c.z };
    const f = pos - Math.floor(pos);
    return {
      x: lo.x + (hi.x - lo.x) * f,
      y: lo.y + (hi.y - lo.y) * f,
      z: lo.z + (hi.z - lo.z) * f,
    };
  }

  /** Chamar logo depois de a partida refazer o passado: guarda a diferença entre a tela e o novo estado. */
  absorb(lateTicks = 0) {
    this.lag = clamp(lateTicks, 0, this.tune.maxLag);
    const c = this.delayed(1);
    const e = this.err;
    e.x = this.shown.x - c.x;
    e.y = this.shown.y - c.y;
    e.z = this.shown.z - c.z;
    if (Math.hypot(e.x, e.y, e.z) > 5) e.x = e.y = e.z = 0;
    this.hold = null;
  }

  /** A sua própria batida: a bola sai da sua raquete agora, então a bola desenhada para de "chegar atrasada" e desliza para a da partida. */
  localHit() {
    const c = this.match.ball;
    const e = this.err;
    e.x = this.shown.x - c.x;
    e.y = this.shown.y - c.y;
    e.z = this.shown.z - c.z;
    if (Math.hypot(e.x, e.y, e.z) > 5) e.x = e.y = e.z = 0;
    this.lag = 0;
    this.hold = null;
  }

  /** Um quadro: `base` é a bola da partida já interpolada entre os dois últimos ticks. Devolve onde desenhar. */
  update(dt: number, base: { x: number; y: number; z: number }, a: number) {
    const m = this.match;
    const cur = m.ball;
    const tn = this.tune;
    let sx = base.x;
    let sy = base.y;
    let sz = base.z;
    if (this.lag > 0) {
      const toMe = Math.abs(PP_PAD_Z - Math.abs(cur.z));
      const remain = Math.max(0.2, toMe / Math.max(2, Math.abs(cur.vz)));
      const rate = clamp(this.lag / (tn.catchFrac * remain), tn.catchMin, tn.catchMax);
      this.lag = Math.max(0, this.lag - dt * rate);
      const d = this.delayed(a);
      sx = d.x;
      sy = d.y;
      sz = d.z;
    }
    const opp = 1 - this.me;
    const so = opp === 0 ? 1 : -1;
    const past =
      m.phase === 'rally' &&
      m.expect === opp &&
      (m.bounces[opp] ?? 0) >= 1 &&
      (cur.z - so * (PP_PAD_Z - m.pad(opp).reach)) * so > 0;
    if (past) {
      if (!this.hold)
        this.hold = {
          t: 0,
          x: this.shown.x - this.err.x,
          y: this.shown.y - this.err.y,
          z: this.shown.z - this.err.z,
          released: false,
        };
      this.hold.t += dt;
      if (this.hold.t < tn.holdMax) {
        sx = this.hold.x;
        sy = this.hold.y;
        sz = this.hold.z;
      } else if (!this.hold.released) {
        // a batida não veio (ele errou ou a rede demorou): a bola sai da espera deslizando, sem pulo
        this.hold.released = true;
        this.err.x = this.hold.x - sx;
        this.err.y = this.hold.y - sy;
        this.err.z = this.hold.z - sz;
      }
    } else this.hold = null;
    const k = Math.exp(-dt * tn.errDecay);
    this.err.x *= k;
    this.err.y *= k;
    this.err.z *= k;
    sx += this.err.x;
    sy += this.err.y;
    sz += this.err.z;
    this.shown.x = sx;
    this.shown.y = sy;
    this.shown.z = sz;
    return this.shown;
  }
}

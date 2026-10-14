import {
  ATR_CROC_OPEN,
  ATR_CROC_PERIOD,
  ATR_CROC_WARN,
  ATR_FLOW_HALF,
  ATR_SIGNAL_X,
  ATR_TPS,
  ATR_TURTLE_DOWN,
  ATR_TURTLE_PERIOD,
  ATR_TURTLE_UP,
  ATR_TURTLE_WARN,
  type FlowKind,
} from './constants';

/**
 * O que anda numa faixa (spec 029): cada veículo, tora, crocodilo ou grupo de tartarugas é um item com
 * a **sua própria velocidade**. Os itens entram pela borda, atravessam e saem; a posição de cada um é
 * uma conta simples do instante (sem estado), então o servidor e a tela chegam sempre ao mesmo lugar.
 * O vão entre dois itens é calculado na hora de criar: um rápido atrás de um lento só entra depois
 * que o vão é grande o bastante para ele não alcançar o outro antes de sair da tela.
 */

export interface FlowItem {
  id: number;
  kind: FlowKind;
  len: number;
  /** Casas por segundo. */
  speed: number;
  /** Tick em que o centro do item entra pela borda. */
  t0: number;
  /** Quantos ticks ele leva para atravessar até a outra borda. */
  dur: number;
  /** Para variar o desenho (cor, modelo). */
  variant: number;
  /** Fase do ciclo do crocodilo e da tartaruga (ticks). */
  phase: number;
  /** Passa pelo sinal fechado (a ambulância). */
  bypass: boolean;
}

export interface FlowPick {
  kind: FlowKind;
  len: number;
  speed: number;
  variant: number;
  bypass?: boolean;
}

/** O sinal de trânsito de uma faixa: verde e vermelho em janelas de tempo sorteadas da seed. */
export class Signal {
  private windows: { from: number; to: number; green: boolean }[] = [];
  private rng: () => number;

  constructor(rng: () => number, start = -4000) {
    this.rng = rng;
    this.windows.push(this.makeWindow(start, rng() < 0.5));
  }

  private makeWindow(from: number, green: boolean) {
    const len = green ? 120 + Math.floor(this.rng() * 181) : 90 + Math.floor(this.rng() * 121);
    return { from, to: from + len, green };
  }

  private extend(until: number) {
    let last = this.windows[this.windows.length - 1]!;
    while (last.to <= until) {
      last = this.makeWindow(last.to, !last.green);
      this.windows.push(last);
    }
  }

  private at(t: number) {
    this.extend(t);
    let lo = 0;
    let hi = this.windows.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.windows[mid]!.from <= t) lo = mid;
      else hi = mid - 1;
    }
    return this.windows[lo]!;
  }

  isGreen(t: number): boolean {
    return this.at(t).green;
  }

  /** O primeiro instante a partir de `t` em que o sinal está verde. */
  nextGreenStart(t: number): number {
    const w = this.at(t);
    if (w.green) return t;
    return w.to;
  }

  /** Quantos ticks faltam para o sinal mudar (a tela usa para piscar o amarelo no fim do verde). */
  untilChange(t: number): number {
    return this.at(t).to - t;
  }
}

export interface FlowCfg {
  dir: 1 | -1;
  /** Vão mínimo (casas, borda a borda) entre dois itens seguidos. */
  minGap: number;
  /** Média (s) da folga sorteada além do vão mínimo, e o máximo. */
  extraMean: number;
  extraMax: number;
  pick: (rng: () => number) => FlowPick;
  signal?: Signal;
}

/** Os primeiros itens já estão dentro da faixa no tick 0. */
const PRE_ROLL = -2400;
const STEP = 6;

export class LaneFlow {
  readonly items: FlowItem[] = [];
  private nextId = 0;
  /** O maior tempo de travessia já criado (limita a busca por quem está ativo). */
  private maxDur = 0;

  constructor(
    readonly cfg: FlowCfg,
    private rng: () => number,
  ) {}

  /** Cria itens até haver um que já entrou em `tick`. */
  private ensure(tick: number) {
    while (this.items.length === 0 || this.items[this.items.length - 1]!.t0 <= tick) this.make();
  }

  private fits(t0: number, p: FlowPick, dur: number): boolean {
    const q = this.items[this.items.length - 1];
    if (!q) return true;
    const half = (q.len + p.len) / 2;
    const gapAt = (t: number) => (q.speed * (t - q.t0) - p.speed * (t - t0)) / ATR_TPS - half;
    const end = Math.min(q.t0 + q.dur, t0 + dur);
    if (end <= t0) return true;
    return gapAt(t0) >= this.cfg.minGap && gapAt(end) >= this.cfg.minGap;
  }

  private make() {
    const { cfg, rng } = this;
    const last = this.items[this.items.length - 1];
    const p = cfg.pick(rng);
    const dur = Math.ceil(((2 * ATR_FLOW_HALF) / p.speed) * ATR_TPS);
    const extra = Math.min(cfg.extraMax, -Math.log(1 - rng()) * cfg.extraMean) * ATR_TPS;
    let t0 = last ? last.t0 + STEP + Math.floor(extra) : PRE_ROLL + Math.floor(rng() * 400);
    const toPost = Math.ceil(((ATR_FLOW_HALF - ATR_SIGNAL_X) / p.speed) * ATR_TPS);
    for (let guard = 0; guard < 2000; guard++) {
      if (!this.fits(t0, p, dur)) {
        t0 += STEP;
        continue;
      }
      if (cfg.signal && !p.bypass) {
        // só passa pela haste do sinal quando está verde
        const pass = t0 + toPost;
        if (!cfg.signal.isGreen(pass)) {
          t0 = cfg.signal.nextGreenStart(pass) - toPost;
          continue;
        }
      }
      break;
    }
    if (last && t0 <= last.t0) t0 = last.t0 + 1;
    this.maxDur = Math.max(this.maxDur, dur);
    this.items.push({
      id: this.nextId++,
      kind: p.kind,
      len: p.len,
      speed: p.speed,
      t0,
      dur,
      variant: p.variant,
      phase: Math.floor(rng() * 1000),
      bypass: !!p.bypass,
    });
  }

  /** Os itens que estão na faixa no instante `tick`. */
  active(tick: number): FlowItem[] {
    this.ensure(tick);
    // o último que já entrou
    let lo = 0;
    let hi = this.items.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.items[mid]!.t0 <= tick) lo = mid;
      else hi = mid - 1;
    }
    const out: FlowItem[] = [];
    for (let i = lo; i >= 0; i--) {
      const it = this.items[i]!;
      if (it.t0 + this.maxDur < tick) break;
      if (it.t0 <= tick && tick <= it.t0 + it.dur) out.push(it);
    }
    return out;
  }
}

/** Centro do item no instante `tick` (casas; positivo à direita). */
export const flowX = (dir: 1 | -1, it: FlowItem, tick: number): number =>
  dir * (-ATR_FLOW_HALF + (it.speed * (tick - it.t0)) / ATR_TPS);

export type CrocState = 'closed' | 'warn' | 'open';
export function crocState(it: FlowItem, tick: number): CrocState {
  const t = (((tick - it.t0 + it.phase) % ATR_CROC_PERIOD) + ATR_CROC_PERIOD) % ATR_CROC_PERIOD;
  if (t >= ATR_CROC_PERIOD - ATR_CROC_OPEN) return 'open';
  if (t >= ATR_CROC_PERIOD - ATR_CROC_OPEN - ATR_CROC_WARN) return 'warn';
  return 'closed';
}

export type TurtleState = 'up' | 'warn' | 'down';
export function turtleState(it: FlowItem, tick: number): TurtleState {
  const t = (((tick - it.t0 + it.phase) % ATR_TURTLE_PERIOD) + ATR_TURTLE_PERIOD) % ATR_TURTLE_PERIOD;
  if (t < ATR_TURTLE_UP) return 'up';
  if (t < ATR_TURTLE_UP + ATR_TURTLE_WARN) return 'warn';
  void ATR_TURTLE_DOWN;
  return 'down';
}

/** Dá para pisar nele agora? (a tartaruga que mergulhou não segura ninguém.) */
export const isSolid = (it: FlowItem, tick: number): boolean =>
  it.kind === 'tartaruga' ? turtleState(it, tick) !== 'down' : true;

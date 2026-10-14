import {
  ATR_DARK_BASE,
  ATR_DARK_CAP,
  ATR_DARK_GROWTH,
  ATR_DARK_KILL_GAP,
  ATR_DARK_LEAD_IN_TICKS,
  ATR_DARK_MAX_GAP,
  ATR_DARK_START_GAP,
  ATR_DIRS,
  ATR_DT,
  ATR_HALF_COLS,
  ATR_HERO_R,
  ATR_LOG_SLACK,
  ATR_MAX_INPUTS,
  ATR_MAX_SCORE,
  ATR_MAX_TICKS,
  ATR_QUEUE_MAX,
  ATR_RIVER_EDGE,
  ATR_SINK_TICKS,
  ATR_STEP_TICKS,
  type AtravessaEnd,
  type Dir,
} from './constants';
import { AtravessaWorld, laneObjects, objX, trainState, type Lane } from './world';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Velocidade da escuridão (linhas/s) para quem já chegou à linha `best`: devagar, e nunca acima do teto. */
export const atravessaDarkSpeed = (best: number): number => Math.min(ATR_DARK_CAP, ATR_DARK_BASE + best * ATR_DARK_GROWTH);

interface Move {
  dir: Dir;
  fromRow: number;
  toRow: number;
  fromX: number;
  toX: number;
  t: number;
}

/** O que a tela precisa para desenhar o herói e o aviso da escuridão. */
export interface AtravessaView {
  tick: number;
  alive: boolean;
  end: AtravessaEnd | null;
  /** Posição em casas (x) e linhas (y), já interpolada no meio do pulo. */
  x: number;
  y: number;
  /** Altura do pulo em casas (0 no chão, arco suave de 0 a 0,45 e de volta). */
  hop: number;
  /** Pulo em andamento: 0 a 1 e a direção; null com o herói parado. */
  step: { progress: number; dir: Dir } | null;
  /** Último pouso: `age` em ticks desde que pousou (a tela usa para o "squash"); null se ainda não pousou. */
  landed: { age: number; dir: Dir } | null;
  /** Para onde o herói está virado (a última direção usada). */
  facing: Dir;
  /** Passos esperando na fila. */
  queued: number;
  score: number;
  /** Frente da escuridão (linha, pode ser fracionária) e quão perto ela está: 0 (longe) a 1 (em cima). */
  darkRow: number;
  danger: number;
  /** Pedra afundando sob o herói: 0 a 1. */
  sinking: number;
  /** Quantos passos já foram recusados (árvore, borda): a tela toca o tremidinho quando sobe. */
  bumps: number;
}

export class AtravessaSim {
  readonly world: AtravessaWorld;
  tick = 0;
  alive = true;
  end: AtravessaEnd | null = null;
  /** Colunas e linha lógicas; `hx` pode ser fracionária em cima de uma tora. */
  hx = 0;
  row = 0;
  best = 0;
  facing: Dir = 0;
  /** Passos recusados até agora (só para a tela). */
  bumps = 0;
  dark = -ATR_DARK_START_GAP;
  private move: Move | null = null;
  private queue: Dir[] = [];
  private landedTick = 0;
  private landedDir: Dir = 0;
  private hasLanded = false;

  constructor(seed: string, world?: AtravessaWorld) {
    this.world = world ?? new AtravessaWorld(seed);
  }

  /** Cópia barata (o mundo é compartilhado: só cresce e é determinístico). */
  clone(): AtravessaSim {
    const c = new AtravessaSim(this.world.seed, this.world);
    Object.assign(c, this);
    c.queue = [...this.queue];
    c.move = this.move ? { ...this.move } : null;
    return c;
  }

  /** O jogador pediu um passo. A fila guarda até 2 para não perder toque. */
  input(dir: Dir) {
    if (!this.alive) return;
    if (this.queue.length < ATR_QUEUE_MAX) this.queue.push(dir);
  }

  get score(): number {
    return this.best;
  }

  private die(end: AtravessaEnd) {
    this.alive = false;
    this.end = end;
    this.queue = [];
  }

  /** Tenta começar o próximo passo da fila. Passo bloqueado é descartado sem gastar tempo. */
  private startMove() {
    while (!this.move && this.queue.length) {
      const dir = this.queue.shift()!;
      this.facing = dir;
      const here = this.world.lane(this.row);
      let toRow = this.row;
      let toX = this.hx;
      if (dir === 0) toRow++;
      else if (dir === 1) toRow--;
      else toX += dir === 2 ? -1 : 1;
      if (toRow < 0) {
        this.bumps++;
        continue;
      }
      const there = this.world.lane(toRow);
      const onLog = there.kind === 'rio' && !there.pads;
      if (dir === 0 || dir === 1) {
        if (!onLog) toX = Math.round(toX);
      }
      // limites do mapa: tora deixa chegar um pouco além da última casa; o resto, não
      const limit = onLog ? ATR_RIVER_EDGE - 0.1 : ATR_HALF_COLS;
      if (
        Math.abs(toX) > limit + 1e-9 ||
        (there.kind === 'descanso' && there.blocked.includes(Math.round(toX))) ||
        (dir >= 2 && here.kind === 'descanso' && here.blocked.includes(Math.round(toX)))
      ) {
        this.bumps++;
        continue;
      }
      this.move = { dir, fromRow: this.row, toRow, fromX: this.hx, toX, t: 0 };
    }
  }

  private arrive(m: Move) {
    this.row = m.toRow;
    this.hx = m.toX;
    this.move = null;
    this.landedTick = this.tick;
    this.landedDir = m.dir;
    this.hasLanded = true;
    const lane = this.world.lane(this.row);
    if (lane.kind === 'rio') {
      if (lane.pads) {
        if (!lane.pads.some((p) => p.col === Math.round(this.hx))) return this.die('agua');
        this.hx = Math.round(this.hx);
      } else if (!this.onLog(lane)) return this.die('agua');
    } else {
      this.hx = Math.round(this.hx);
    }
    if (this.row > this.best) this.best = this.row;
  }

  private onLog(lane: Lane): boolean {
    for (const o of lane.objs) {
      if (Math.abs(this.hx - objX(lane, o, this.tick)) <= o.len / 2 + ATR_LOG_SLACK) return true;
    }
    return false;
  }

  /** Avança um tick (1/60 s). */
  step() {
    if (!this.alive) return;
    this.tick++;

    if (!this.move) this.startMove();
    if (this.move) {
      const m = this.move;
      m.t++;
      const p = m.t / ATR_STEP_TICKS;
      this.hx = m.fromX + (m.toX - m.fromX) * Math.min(1, p);
      if (m.t >= ATR_STEP_TICKS) {
        this.arrive(m);
        if (!this.alive) return;
      }
    } else {
      const lane = this.world.lane(this.row);
      if (lane.kind === 'rio' && !lane.pads) {
        this.hx += lane.dir * lane.speed * ATR_DT;
        if (Math.abs(this.hx) > ATR_RIVER_EDGE) return this.die('arrastado');
      }
    }

    // colisões: na primeira metade do pulo vale a faixa de saída, na segunda a de chegada
    const m = this.move;
    const rowNow = m ? (m.t < ATR_STEP_TICKS / 2 ? m.fromRow : m.toRow) : this.row;
    const lane = this.world.lane(rowNow);
    if (lane.kind === 'estrada') {
      for (const o of laneObjects(lane, this.tick)) {
        if (Math.abs(this.hx - o.x) < o.len / 2 + ATR_HERO_R) return this.die('veiculo');
      }
    } else if (lane.kind === 'trilho') {
      const t = trainState(lane, this.tick);
      if (t.x !== null && Math.abs(this.hx - t.x) < lane.train!.len / 2 + ATR_HERO_R) return this.die('trem');
    }
    if (!m && lane.kind === 'rio' && lane.pads) {
      const pad = lane.pads.find((p) => p.col === Math.round(this.hx));
      if (pad?.sinks && this.tick - this.landedTick >= ATR_SINK_TICKS) return this.die('afundou');
    }

    // a escuridão: devagar, parada no começo, e sem ficar mais longe que o limite
    if (this.tick > ATR_DARK_LEAD_IN_TICKS) this.dark += atravessaDarkSpeed(this.best) * ATR_DT;
    this.dark = Math.max(this.dark, this.best - ATR_DARK_MAX_GAP);
    if (this.y - this.dark <= ATR_DARK_KILL_GAP) this.die('escuridao');
  }

  get y(): number {
    const m = this.move;
    if (!m) return this.row;
    return m.fromRow + (m.toRow - m.fromRow) * Math.min(1, m.t / ATR_STEP_TICKS);
  }

  view(): AtravessaView {
    const m = this.move;
    const p = m ? m.t / ATR_STEP_TICKS : 0;
    const gap = this.y - this.dark;
    return {
      tick: this.tick,
      alive: this.alive,
      end: this.end,
      x: this.hx,
      y: this.y,
      hop: m ? Math.sin(Math.min(1, p) * Math.PI) * 0.45 : 0,
      step: m ? { progress: Math.min(1, p), dir: m.dir } : null,
      landed: this.hasLanded ? { age: this.tick - this.landedTick, dir: this.landedDir } : null,
      facing: this.facing,
      queued: this.queue.length,
      score: this.best,
      darkRow: this.dark,
      danger: clamp(1 - (gap - ATR_DARK_KILL_GAP) / (ATR_DARK_MAX_GAP - ATR_DARK_KILL_GAP), 0, 1),
      sinking: this.sinkingFraction(),
      bumps: this.bumps,
    };
  }

  private sinkingFraction(): number {
    if (this.move) return 0;
    const lane = this.world.lane(this.row);
    if (lane.kind !== 'rio' || !lane.pads) return 0;
    const pad = lane.pads.find((p) => p.col === Math.round(this.hx));
    if (!pad?.sinks) return 0;
    return clamp((this.tick - this.landedTick) / ATR_SINK_TICKS, 0, 1);
  }
}

export interface AtravessaInput {
  /** Tick (1/60 s) em que o passo foi pedido. */
  t: number;
  d: Dir;
}

export function validateAtravessaInputs(inputs: unknown): inputs is AtravessaInput[] {
  if (!Array.isArray(inputs) || inputs.length > ATR_MAX_INPUTS) return false;
  let last = 0;
  for (const i of inputs) {
    if (typeof i !== 'object' || i === null) return false;
    const { t, d } = i as Record<string, unknown>;
    if (typeof t !== 'number' || !Number.isInteger(t) || t < 1 || t > ATR_MAX_TICKS || t < last) return false;
    if (typeof d !== 'number' || !ATR_DIRS.includes(d as Dir)) return false;
    last = t;
  }
  return true;
}

export interface AtravessaResult {
  score: number;
  ticks: number;
  end: AtravessaEnd | null;
}

/**
 * O servidor refaz a partida: mesma seed, mesmos passos nos mesmos ticks. Depois do último passo o
 * herói fica parado até a escuridão alcançá-lo, então a nota é a mesma de quem desistiu.
 */
export function evaluateAtravessa(
  seed: string,
  inputs: AtravessaInput[],
  maxTicks: number = ATR_MAX_TICKS,
): AtravessaResult {
  const sim = new AtravessaSim(seed);
  let i = 0;
  const limit = Math.min(maxTicks, ATR_MAX_TICKS);
  while (sim.alive && sim.tick < limit) {
    while (i < inputs.length && inputs[i]!.t <= sim.tick + 1) sim.input(inputs[i++]!.d);
    sim.step();
  }
  return { score: Math.min(sim.score, ATR_MAX_SCORE), ticks: sim.tick, end: sim.end };
}

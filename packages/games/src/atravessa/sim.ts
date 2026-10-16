import {
  ATR_BACK_ROWS,
  ATR_CROC_HEAD,
  ATR_DIRS,
  ATR_DT,
  ATR_FLOW_HALF,
  ATR_HALF_COLS,
  ATR_HERO_R,
  ATR_LOG_SLACK,
  ATR_MAX_INPUTS,
  ATR_MAX_SCORE,
  ATR_MAX_TICKS,
  ATR_QUEUE_MAX,
  ATR_RESPAWN_TICKS,
  ATR_RIVER_EDGE,
  ATR_SINK_TICKS,
  ATR_STEP_TICKS,
  ATR_SWEEP,
  ATR_SWEEP_AHEAD,
  ATR_SWEEP_BEHIND,
  ATR_SWEEP_COOLDOWN_TICKS,
  ATR_SWEEP_IDLE_TICKS,
  ATR_SWEEP_MIN_ROW,
  ATR_SWEEP_WARN_TICKS,
  type AtravessaEnd,
  type Dir,
  type SweepKind,
} from './constants';
import { crocState, flowX, isSolid, type FlowItem } from './flow';
import { AtravessaWorld, laneBiome, trainState, type Lane } from './world';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface Move {
  dir: Dir;
  fromRow: number;
  toRow: number;
  fromX: number;
  toX: number;
  t: number;
}

/** Uma varrida de aviso: um perigo que desce pela coluna onde o herói ficou parado (spec 029). */
interface Sweep {
  /** A coluna que ele vai varrer e a linha onde o herói estava quando o aviso começou. */
  col: number;
  row0: number;
  kind: SweepKind;
  /** Tick em que o aviso começa e em que o perigo entra. */
  start: number;
  hit: number;
}

export interface SweepView {
  /** Identifica a varrida (o tick em que o aviso começou). */
  id: number;
  col: number;
  /** A linha onde o aviso para (onde o herói estava) e a linha onde o perigo entra. */
  row0: number;
  from: number;
  kind: SweepKind;
  phase: 'warn' | 'hit';
  /** O aviso: 0 a 1. */
  warn: number;
  /** Onde o perigo está (linha, fracionária); null enquanto só avisa. */
  at: number | null;
}

/** O que a tela precisa para desenhar o herói e as suas animações. */
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
  /** Pedra afundando sob o herói: 0 a 1. */
  sinking: number;
  /** Quantos passos já foram recusados (árvore, borda): a tela toca o tremidinho quando sobe. */
  bumps: number;
  /** A varrida de aviso em andamento, se houver. */
  sweep: SweepView | null;
  /** De que lado veio quem matou (-1 esquerda, 1 direita, 0 nenhum): a tela usa para a animação. */
  killer: -1 | 0 | 1;
  /** Sala (spec 031): chegou ao fim, quantas vezes morreu, o último checkpoint e quando renasce. */
  finished: boolean;
  deaths: number;
  checkpoint: number;
  /** Ticks que faltam para renascer (0 se vivo ou se a morte é definitiva). */
  respawnIn: number;
  /** Tick do último renascimento (a tela recomeça a pose do herói). */
  spawnTick: number;
}

/**
 * Regras opcionais da partida (spec 031). O padrão é o jogo solo: sem fim de mapa, sem checkpoints e sem
 * limite de tempo parado. A sala liga e desliga estas peças; o servidor e o aparelho usam as mesmas regras.
 */
export interface AtravessaRules {
  /** Ticks parado (sem começar um pulo) até ser engolido; `null` = nunca. */
  idleKillTicks: number | null;
  /** Chegar a esta linha termina a corrida; `null` = infinito. */
  finishRow: number | null;
  /** Linhas dos checkpoints. Com a lista, quem morre renasce no último; `null` = a partida acaba na morte. */
  checkpoints: readonly number[] | null;
  /** A coluna da largada (na sala cada um começa numa, para as raposas não nascerem empilhadas). */
  startX: number;
}

export const ATR_DEFAULT_RULES: AtravessaRules = {
  idleKillTicks: null,
  finishRow: null,
  checkpoints: null,
  startX: 0,
};

export class AtravessaSim {
  readonly world: AtravessaWorld;
  readonly rules: AtravessaRules;
  tick = 0;
  alive = true;
  end: AtravessaEnd | null = null;
  /** Chegou ao fim do mapa (`rules.finishRow`): a simulação para e `finishTick` guarda quando. */
  finished = false;
  finishTick = 0;
  /** Quantas vezes morreu (com checkpoints a partida continua). */
  deaths = 0;
  /** O último checkpoint alcançado (0 = a largada). */
  checkpointRow = 0;
  /** Tick em que renasce, se estiver morto e a partida continuar; `null` caso contrário. */
  private respawnAt: number | null = null;
  private spawnTick = 0;
  /** Colunas e linha lógicas; `hx` pode ser fracionária em cima de uma tora. */
  hx = 0;
  row = 0;
  best = 0;
  facing: Dir = 0;
  /** Passos recusados até agora (só para a tela). */
  bumps = 0;
  killer: -1 | 0 | 1 = 0;
  private move: Move | null = null;
  private queue: Dir[] = [];
  private landedTick = 0;
  private landedDir: Dir = 0;
  private hasLanded = false;
  /** Há quantos ticks o herói está parado numa faixa (para as varridas). */
  private idle = 0;
  private sweep: Sweep | null = null;
  private sweepFree = 0;

  constructor(seed: string, world?: AtravessaWorld, rules: Partial<AtravessaRules> = {}) {
    this.world = world ?? new AtravessaWorld(seed);
    this.rules = { ...ATR_DEFAULT_RULES, ...rules };
    this.hx = this.rules.startX;
  }

  /** Nada mais muda sozinho: morreu de vez ou chegou ao fim. */
  get halted(): boolean {
    return this.finished || (!this.alive && this.respawnAt === null);
  }

  /** Cópia barata (o mundo é compartilhado: só cresce e é determinístico). */
  clone(): AtravessaSim {
    const c = new AtravessaSim(this.world.seed, this.world);
    Object.assign(c, this);
    c.queue = [...this.queue];
    c.move = this.move ? { ...this.move } : null;
    c.sweep = this.sweep ? { ...this.sweep } : null;
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

  private die(end: AtravessaEnd, killer: -1 | 0 | 1 = 0) {
    this.alive = false;
    this.end = end;
    this.killer = killer;
    this.queue = [];
    this.deaths++;
    this.respawnAt = this.rules.checkpoints ? this.tick + ATR_RESPAWN_TICKS : null;
  }

  /** Volta ao último checkpoint (ou à largada) numa casa livre da faixa de descanso. */
  private respawn() {
    const row = this.checkpointRow > 0 ? this.world.restRowAtOrBelow(this.checkpointRow) : 0;
    this.row = row;
    this.hx = row === 0 ? this.rules.startX : this.world.corridorAt(row);
    this.move = null;
    this.queue = [];
    this.alive = true;
    this.end = null;
    this.killer = 0;
    this.respawnAt = null;
    this.spawnTick = this.tick;
    this.idle = 0;
    this.sweep = null;
    this.sweepFree = this.tick + ATR_SWEEP_COOLDOWN_TICKS;
    this.hasLanded = false;
    this.landedTick = this.tick;
    this.facing = 0;
  }

  /** O maior checkpoint que a linha mais alta já alcançou. */
  private updateCheckpoint() {
    const list = this.rules.checkpoints;
    if (!list) return;
    for (const cp of list) if (cp <= this.best && cp > this.checkpointRow) this.checkpointRow = cp;
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
      if (toRow < -ATR_BACK_ROWS) {
        this.bumps++;
        continue;
      }
      const there = this.world.lane(toRow);
      const onFlow = there.kind === 'rio' && !there.pads;
      if (dir === 0 || dir === 1) {
        if (!onFlow) toX = Math.round(toX);
      }
      // limites do mapa: quem anda no rio deixa chegar um pouco além da última casa; o resto, não
      const limit = onFlow ? ATR_RIVER_EDGE - 0.1 : ATR_HALF_COLS;
      if (
        Math.abs(toX) > limit + 1e-9 ||
        (there.kind === 'descanso' && there.blocked.includes(Math.round(toX))) ||
        (dir >= 2 && here.kind === 'descanso' && here.blocked.includes(Math.round(toX)))
      ) {
        this.bumps++;
        continue;
      }
      this.move = { dir, fromRow: this.row, toRow, fromX: this.hx, toX, t: 0 };
      this.idle = 0;
    }
  }

  /** O que segura o herói em `x` nesta faixa de rio: tora, crocodilo ou tartaruga que não mergulhou. */
  private platformAt(lane: Lane, x: number): FlowItem | null {
    if (!lane.flow) return null;
    for (const it of lane.flow.active(this.tick)) {
      if (!isSolid(it, this.tick)) continue;
      if (Math.abs(x - flowX(lane.dir, it, this.tick)) <= it.len / 2 + ATR_LOG_SLACK) return it;
    }
    return null;
  }

  private arrive(m: Move) {
    this.row = m.toRow;
    this.hx = m.toX;
    this.move = null;
    this.landedTick = this.tick;
    this.landedDir = m.dir;
    this.hasLanded = true;
    this.idle = 0;
    const lane = this.world.lane(this.row);
    if (lane.kind === 'rio') {
      if (lane.pads) {
        if (!lane.pads.some((p) => p.col === Math.round(this.hx))) return this.die('agua');
        this.hx = Math.round(this.hx);
      } else if (!this.platformAt(lane, this.hx)) return this.die('agua');
    } else {
      this.hx = Math.round(this.hx);
    }
    if (this.row > this.best) {
      this.best = this.row;
      this.updateCheckpoint();
    }
    const finish = this.rules.finishRow;
    if (finish !== null && this.row >= finish) {
      this.finished = true;
      this.finishTick = this.tick;
    }
  }

  /** Uma varrida de aviso na coluna do herói, se ele ficou parado tempo demais numa faixa de descanso. */
  private maybeSweep() {
    if (this.sweep || this.tick < this.sweepFree || this.move || this.queue.length) return;
    if (this.row < ATR_SWEEP_MIN_ROW || this.idle < ATR_SWEEP_IDLE_TICKS) return;
    const lane = this.world.lane(this.row);
    if (lane.kind !== 'descanso') return;
    const biome = laneBiome(lane.biome);
    const h = (this.row * 31 + this.tick) % 2;
    const kind: SweepKind =
      biome === 'horta' ? 'barril' : biome === 'neon' ? 'laser' : h === 0 ? 'feno' : 'redemoinho';
    this.sweep = {
      col: Math.round(this.hx),
      row0: this.row,
      kind,
      start: this.tick,
      hit: this.tick + ATR_SWEEP_WARN_TICKS,
    };
  }

  /** Em que linha o perigo está: desce da frente do herói até passar por trás dele. */
  private sweepAt(s: Sweep): number | null {
    if (this.tick < s.hit) return null;
    return s.row0 + ATR_SWEEP_AHEAD - (ATR_SWEEP[s.kind].speed * (this.tick - s.hit)) / 60;
  }

  /** Avança um tick (1/60 s). */
  step() {
    if (this.finished) return;
    if (!this.alive) {
      // com checkpoints o mundo segue andando enquanto o herói espera para voltar
      if (this.respawnAt === null) return;
      this.tick++;
      if (this.tick >= this.respawnAt) this.respawn();
      return;
    }
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
      this.idle++;
      const lane = this.world.lane(this.row);
      if (lane.kind === 'rio' && !lane.pads) {
        // em cima de algo que anda: leva o herói junto (cada um na sua velocidade)
        const it = this.platformAt(lane, this.hx);
        if (!it) {
          const turtle = lane.flow
            ?.active(this.tick)
            .some((t) => t.kind === 'tartaruga' && Math.abs(this.hx - flowX(lane.dir, t, this.tick)) <= t.len / 2 + ATR_LOG_SLACK);
          return this.die(turtle ? 'afundou' : 'agua');
        }
        this.hx += lane.dir * it.speed * ATR_DT;
        if (Math.abs(this.hx) > ATR_RIVER_EDGE) return this.die('arrastado');
        if (it.kind === 'croc' && crocState(it, this.tick) === 'open') {
          const cx = flowX(lane.dir, it, this.tick);
          const head = cx + lane.dir * (it.len / 2 - ATR_CROC_HEAD / 2);
          if (Math.abs(this.hx - head) < ATR_CROC_HEAD / 2 + ATR_HERO_R) return this.die('mordido', lane.dir);
        }
      }
    }

    // colisões: na primeira metade do pulo vale a faixa de saída, na segunda a de chegada
    const m = this.move;
    const rowNow = m ? (m.t < ATR_STEP_TICKS / 2 ? m.fromRow : m.toRow) : this.row;
    const lane = this.world.lane(rowNow);
    if (lane.kind === 'estrada' && lane.flow) {
      for (const it of lane.flow.active(this.tick)) {
        if (Math.abs(this.hx - flowX(lane.dir, it, this.tick)) < it.len / 2 + ATR_HERO_R) {
          return this.die('veiculo', lane.dir);
        }
      }
    } else if (lane.kind === 'trilho') {
      const t = trainState(lane, this.tick);
      if (t.x !== null && Math.abs(this.hx - t.x) < lane.train!.len / 2 + ATR_HERO_R) {
        return this.die('trem', lane.dir);
      }
    }
    if (!m && lane.kind === 'rio' && lane.pads) {
      const pad = lane.pads.find((p) => p.col === Math.round(this.hx));
      if (pad?.sinks && this.tick - this.landedTick >= ATR_SINK_TICKS) return this.die('afundou');
    }

    // varridas de aviso: o perigo desce pela coluna; escapa quem sai dela
    this.maybeSweep();
    if (this.sweep) {
      const s = this.sweep;
      const at = this.sweepAt(s);
      if (at !== null) {
        const w = ATR_SWEEP[s.kind].r + ATR_HERO_R;
        if (Math.abs(this.hx - s.col) < w && Math.abs(this.y - at) < w + 0.25) return this.die('atingido', 0);
        if (at < s.row0 - ATR_SWEEP_BEHIND) {
          this.sweep = null;
          this.sweepFree = this.tick + ATR_SWEEP_COOLDOWN_TICKS;
        }
      }
    }

    // parado por tempo demais (só nas regras que pedem: a sala Infinito)
    const idleMax = this.rules.idleKillTicks;
    if (idleMax !== null && !this.move && this.idle >= idleMax) this.die('parado');
  }

  get y(): number {
    const m = this.move;
    if (!m) return this.row;
    return m.fromRow + (m.toRow - m.fromRow) * Math.min(1, m.t / ATR_STEP_TICKS);
  }

  view(): AtravessaView {
    const m = this.move;
    const p = m ? m.t / ATR_STEP_TICKS : 0;
    const s = this.sweep;
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
      sinking: this.sinkingFraction(),
      bumps: this.bumps,
      sweep: s
        ? {
            id: s.start,
            col: s.col,
            row0: s.row0,
            from: s.row0 + ATR_SWEEP_AHEAD,
            kind: s.kind,
            phase: this.tick < s.hit ? 'warn' : 'hit',
            warn: clamp((this.tick - s.start) / ATR_SWEEP_WARN_TICKS, 0, 1),
            at: this.sweepAt(s),
          }
        : null,
      killer: this.killer,
      finished: this.finished,
      deaths: this.deaths,
      checkpoint: this.checkpointRow,
      respawnIn: this.respawnAt === null ? 0 : Math.max(0, this.respawnAt - this.tick),
      spawnTick: this.spawnTick,
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
 * herói fica parado até algo o pegar (varrida, veículo, tora que o leva) ou o tempo acabar; só vale
 * partida que terminou em morte.
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

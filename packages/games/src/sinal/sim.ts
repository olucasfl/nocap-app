import {
  BACK_LIMIT,
  BUMP_BASE,
  BUMP_PER_R,
  BUMP_TICKS,
  COVER_DARK_FACTOR,
  COVER_LONG_DRAIN,
  COVER_LONG_MAX,
  COVER_REGEN,
  COVER_STUN_FACTOR,
  COVER_ZONE_R,
  DARK_CAP,
  DEADZONE,
  DT,
  ESTEIRA_SPEED,
  FOLEGO_FACTOR,
  FOLEGO_MIN_HIDDEN_TICKS,
  FOLEGO_TICKS,
  GELO_SLICK,
  IMA_PULL,
  LOOK_GRACE,
  MAX_SPEED,
  MOLA_IMPULSE,
  MOLA_PUSH_S,
  MOVER_BUMP,
  MOVE_EPS,
  MUD_FACTOR,
  PLAYER_R,
  SERRA_BUMP,
  SINAL_MAX_INPUTS,
  STUN_BASE_TICKS,
  STUN_MOVER_TICKS,
  STUN_PER_R_TICKS,
  STUN_SERRA_TICKS,
  STUN_SHOVE_TICKS,
  SINAL_MAX_TENTHS,
  SINAL_MAX_TICKS,
  TPS,
  clamp,
  type SinalEnd,
  type SinalEvent,
  type SinalInput,
  type SinalMode,
  type SinalResult,
} from './constants';
import {
  CoverField,
  ObstacleField,
  WidthField,
  courseFor,
  isSolid,
  MOVER_KINDS,
  obstaclePos,
  timelineParams,
  type Course,
  type CoverDef,
  type ObstacleDef,
} from './course';
import { VigiaTimeline, activeLook, noteAt, stateAt, type Cycle, type VigiaState } from './vigia';

/** Velocidade-base da escuridão (m/s) antes dos aceleradores. Cresce com o tempo e, no Clássico, com a fase. */
export function darkBase(course: Course, t: number): number {
  // A escuridão tem que aparecer e apertar (spec 026); o teto de 92% do boneco continua valendo.
  if (course.mode === 'infinito') return 0.5 + 0.02 * t;
  // a cada fase a escuridão larga mais ligeira
  return 0.7 + 0.28 * (course.n - 1) + 0.015 * t;
}

/** A velocidade real da escuridão: a base, mais rápida quanto mais a pessoa fica parada, e NUNCA acima do teto. */
export function darkSpeed(course: Course, t: number, idle: number): number {
  return Math.min(DARK_CAP, darkBase(course, t) * (1 + 3 * idle));
}

/** O que a tela precisa saber a cada instante. */
export interface SinalView {
  tick: number;
  /** Segundos desde o começo da fase. */
  t: number;
  x: number;
  y: number;
  hidden: boolean;
  vigia: VigiaState;
  /** O ciclo do Vigia agora (as notas da cantiga) e a sílaba em curso (-1 entre uma e outra). */
  cycle: Cycle;
  syl: number;
  /** O quanto da sílaba em curso já passou (0 a 1). */
  sylP: number;
  /** A meia largura do corredor em qualquer altura (ele estreita e alarga). */
  halfAt: (y: number) => number;
  darkY: number;
  course: Course;
  meters: number;
  covers: { def: CoverDef; dur: number; broken: boolean }[];
  /** Cada obstáculo com a posição de agora (os que se mexem já vêm no lugar certo) e a pancada (1 no choque, até 0). */
  obstacles: (ObstacleDef & { bump: number })[];
  /** Atordoado (0 a 1, até 1 s e meio): estrelinhas em volta da cabeça. */
  stun: number;
  /** O empurrão que o boneco está levando (1 no começo, até 0) e para onde. */
  knock: number;
  knockDir: { x: number; y: number };
}

/**
 * A corrida inteira como máquina de estados, em passo fixo de 60 por segundo. O jogo a usa para
 * andar e desenhar; o servidor a usa para refazer a corrida pelos movimentos: as duas contas são
 * a mesma, então nunca divergem. Sem relógio, sem desenho e sem acaso solto aqui dentro.
 */
export class SinalSim {
  tick = 0;
  private courseTick = 0;
  course!: Course;
  private timeline!: VigiaTimeline;
  private covers!: CoverField;
  private obstacles!: ObstacleField;
  private width!: WidthField;
  private noteKey = '';
  private inHist: [number, number][] = [];
  private coverState = new Map<number, { dur: number; at: number; broken: boolean }>();
  private n = 1;
  private sumDone = 0;

  x = 0;
  y = 0;
  private svx = 0;
  private svy = 0;
  private impX = 0;
  private impY = 0;
  private impTicks = 0;
  private impTotal = 1;
  private impDecay = false;
  /** Passos que faltam de atordoamento (depois de uma pancada). */
  private stun = 0;
  /** Há quantos passos seguidos está escondido, e quanto falta do fôlego (sprint depois de sair). */
  private hiddenTicks = 0;
  private rested = 0;
  private bumpAt = new Map<number, number>();
  private hidden = false;
  private maxY = 0;
  private darkY = 0;
  private idle = 0;
  private yHist: number[] = [];
  private state: VigiaState = 'costas';

  dead = false;
  private end: SinalEnd | null = null;
  private endedTick = 0;

  /**
   * Sala: ao cruzar a linha de chegada a simulação para ali (`finished`) em vez de seguir para a
   * próxima fase sozinha; quem manda nas fases é a sala.
   */
  holdAtFinish = false;
  finished = false;
  finishedTick = 0;

  /** `phase` é a fase em que começa (a sala joga uma fase de cada vez, cada uma com a sua pista). */
  constructor(
    readonly seed: string,
    readonly mode: SinalMode,
    phase = 1,
  ) {
    this.n = phase;
    this.startCourse();
  }

  private startCourse() {
    this.course = courseFor(this.seed, this.mode, this.n);
    this.timeline = new VigiaTimeline(
      timelineParams(this.course),
      `${this.seed}:vigia:${this.mode}:${this.n}`,
    );
    this.width = new WidthField(this.course, `${this.seed}:largura:${this.mode}:${this.n}`);
    this.covers = new CoverField(this.course, `${this.seed}:cover:${this.mode}:${this.n}`, this.width);
    this.obstacles = new ObstacleField(
      this.course,
      `${this.seed}:obst:${this.mode}:${this.n}`,
      this.covers,
      this.width,
    );
    this.noteKey = '';
    this.inHist = [];
    this.coverState.clear();
    this.x = 0;
    this.y = 0;
    this.svx = 0;
    this.svy = 0;
    this.impX = 0;
    this.impY = 0;
    this.impTicks = 0;
    this.stun = 0;
    this.hiddenTicks = 0;
    this.rested = 0;
    this.bumpAt.clear();
    this.hidden = false;
    this.maxY = 0;
    this.darkY = -this.course.darkStart;
    this.idle = 0;
    this.yHist = [];
    this.courseTick = 0;
    this.state = 'costas';
  }

  /**
   * Sala: alguém te empurrou. Joga o boneco na direção `(dx, dy)` como uma pancada (e, como toda
   * pancada, isso conta como mexer para o Vigia).
   */
  shove(dx: number, dy: number, power: number) {
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6 || this.dead) return;
    this.impX = (dx / len) * power;
    this.impY = (dy / len) * power;
    this.impTicks = BUMP_TICKS;
    this.impTotal = BUMP_TICKS;
    this.impDecay = true;
    this.stun = Math.max(this.stun, STUN_SHOVE_TICKS);
  }

  /**
   * Sala: a escuridão é uma só para todos. Com `externalDark` ligado a simulação não anda com a
   * escuridão sozinha; quem manda nela é a sala, que a posiciona antes de cada passo (`setDarkY`).
   */
  externalDark = false;

  setDarkY(y: number) {
    this.darkY = y;
  }

  /** Onde está a frente da escuridão (m). */
  get darkFront(): number {
    return this.darkY;
  }

  /** Quanto o boneco está "parado" (0 a 1): acelera a escuridão. */
  get idleLevel(): number {
    return this.idle;
  }

  /** Segundos desde o começo da fase. */
  get time(): number {
    return this.courseTick * DT;
  }

  /** O boneco está atordoado agora? */
  get isStunned(): boolean {
    return this.stun > 0;
  }

  /** O boneco está dentro de um esconderijo agora? */
  get isHidden(): boolean {
    return this.hidden;
  }

  /** O resultado até agora (e, depois do fim, o resultado final). */
  get result(): SinalResult {
    const here = Math.min(this.maxY, this.course.length);
    const meters = this.mode === 'infinito' ? Math.max(0, this.maxY) : this.sumDone + Math.max(0, here);
    return {
      mode: this.mode,
      tenths: Math.min(SINAL_MAX_TENTHS, Math.round(meters * 10)),
      meters,
      phases: this.mode === 'classico' ? this.n - 1 : 0,
      ended: this.end,
      endedTick: this.endedTick,
    };
  }

  private curDur(c: CoverDef): number {
    const s = this.coverState.get(c.id);
    if (!s) return c.max;
    if (s.broken) return 0;
    // Enquanto alguém está dentro (passos seguidos) não há recuperação: ela só começa depois que sai.
    const away = Math.max(0, this.courseTick - s.at - 1);
    return Math.min(c.max, s.dur + away * DT * COVER_REGEN);
  }

  /** Esconderijos perto da altura `y` (a lista é ordenada por altura). */
  private nearCovers(y: number, reach: number): CoverDef[] {
    this.covers.ensure(y + 120);
    const list = this.covers.list;
    // as moitas compridas começam até COVER_LONG_MAX antes de `y` e ainda cobrem este ponto
    const from = y - reach - COVER_LONG_MAX;
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]!.y < from) lo = mid + 1;
      else hi = mid;
    }
    const out: CoverDef[] = [];
    for (let i = lo; i < list.length && list[i]!.y <= y + reach; i++) {
      const c = list[i]!;
      if (c.y + c.len >= y - reach) out.push(c);
    }
    return out;
  }

  /** Obstáculos perto da altura `y`, já na posição de agora (a lista-base é ordenada por altura). */
  private nearObstacles(y: number, reach: number): ObstacleDef[] {
    this.obstacles.ensure(y + 120);
    const list = this.obstacles.list;
    // quem se mexe oscila até 4 m para os dois lados da posição-base
    const slack = 4.2;
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]!.y < y - reach - slack) lo = mid + 1;
      else hi = mid;
    }
    const out: ObstacleDef[] = [];
    for (let i = lo; i < list.length && list[i]!.y <= y + reach + slack; i++) {
      const o = list[i]!;
      out.push(o.amp === 0 ? o : { ...o, ...obstaclePos(o, this.courseTick) });
    }
    return out;
  }

  private die(reason: SinalEnd, events: SinalEvent[]) {
    this.dead = true;
    this.end = reason;
    this.endedTick = this.tick;
    events.push({ kind: 'fim', reason });
  }

  /** Avança um passo (1/60 s) com o analógico em (ax, ay), inteiros de -100 a 100. */
  step(ax: number, ay: number): SinalEvent[] {
    const events: SinalEvent[] = [];
    if (this.dead || this.finished) return events;
    const t = this.courseTick * DT;
    const cycle = this.timeline.cycleAt(t);

    // O Vigia canta: cada sílaba vira um evento (o som e o desenho seguem o ritmo dele).
    const vs = stateAt(cycle, t);
    if (vs !== this.state) {
      this.state = vs;
      if (vs === 'aviso') events.push({ kind: 'aviso' });
      else if (vs === 'olhando') events.push({ kind: 'olhando' });
      else if (vs === 'voltando') events.push({ kind: 'voltando' });
    }
    const note = noteAt(cycle, t);
    const noteKey = note ? `${cycle.start}:${note.t0}` : '';
    if (noteKey !== this.noteKey) {
      this.noteKey = noteKey;
      if (note) events.push({ kind: 'nota', syl: note.syl, hold: note.hold });
    }

    // Obstáculos de chão: lamaçal (devagar), esteira (empurra de lado), ímã (puxa) e gelo (escorrega).
    let speedMul = 1;
    let hzx = 0;
    let hzy = 0;
    let zoneSlick = false;
    const around = this.nearObstacles(this.y, 3);
    for (const o of around) {
      if (isSolid(o.kind)) continue;
      const ox = this.x - o.x;
      const oy = this.y - o.y;
      const dd = ox * ox + oy * oy;
      if (dd > o.r * o.r) continue;
      if (o.kind === 'lamacal') speedMul = Math.min(speedMul, MUD_FACTOR);
      else if (o.kind === 'esteira') hzx += o.dir * ESTEIRA_SPEED;
      else if (o.kind === 'gelo') zoneSlick = true;
      else if (o.kind === 'ima') {
        const len = Math.sqrt(dd);
        if (len > 0.3) {
          hzx -= (ox / len) * IMA_PULL;
          hzy -= (oy / len) * IMA_PULL;
        }
      }
    }

    // O analógico. Atordoado, não obedece enquanto dura.
    let ix = clamp(this.stun > 0 ? 0 : ax, -100, 100) / 100;
    let iy = clamp(this.stun > 0 ? 0 : ay, -100, 100) / 100;
    const mag = Math.sqrt(ix * ix + iy * iy);
    if (mag < DEADZONE) {
      ix = 0;
      iy = 0;
    } else if (mag > 1) {
      ix /= mag;
      iy /= mag;
    }
    let boost = 1;
    if (this.rested > 0) {
      boost = FOLEGO_FACTOR;
      this.rested--;
    }
    const tx = ix * MAX_SPEED * speedMul * boost;
    const ty = iy * MAX_SPEED * speedMul * boost;
    // Quanto escorrega: só o gelo (o chão que escorrega).
    const slickK = zoneSlick ? GELO_SLICK : 1;
    if (slickK < 1) {
      this.svx += (tx - this.svx) * slickK;
      this.svy += (ty - this.svy) * slickK;
    } else {
      this.svx = tx;
      this.svy = ty;
    }
    let vx = this.svx + hzx;
    let vy = this.svy + hzy;
    if (this.impTicks > 0) {
      // As pancadas perdem força aos poucos (o empurrão forte é no começo); as outras são constantes.
      const f = this.impDecay ? (this.impTicks / this.impTotal) * 2 : 1;
      vx += this.impX * f;
      vy += this.impY * f;
      this.impTicks--;
    }
    let ny = Math.max(BACK_LIMIT, this.y + vy * DT);
    // O corredor estreita e alarga: a borda é a do ponto onde o boneco está.
    let edge = this.width.halfAt(ny) - PLAYER_R;
    let nx = clamp(this.x + vx * DT, -edge, edge);
    // Os obstáculos não se atravessam: o boneco desliza em volta deles.
    for (let pass = 0; pass < 2; pass++) {
      for (const o of this.nearObstacles(ny, 1.6)) {
        if (!isSolid(o.kind)) continue;
        const ox = nx - o.x;
        const oy = ny - o.y;
        const min = o.r + PLAYER_R;
        const dd = ox * ox + oy * oy;
        if (dd >= min * min) continue;
        const len = Math.sqrt(dd);
        if (len < 1e-6) {
          ny = o.y + min;
        } else {
          nx = o.x + (ox / len) * min;
          ny = o.y + (oy / len) * min;
          // Bater em qualquer sólido joga o boneco para trás; quanto maior (ou mais rápido), mais longe.
          if (this.impTicks === 0) {
            const power =
              o.kind === 'mola'
                ? MOLA_IMPULSE
                : o.kind === 'serra'
                  ? SERRA_BUMP
                  : MOVER_KINDS.includes(o.kind)
                    ? MOVER_BUMP + 1.5 * o.r
                    : BUMP_BASE + BUMP_PER_R * o.r;
            this.impX = (ox / len) * power;
            this.impY = (oy / len) * power;
            this.impTicks = o.kind === 'mola' ? Math.round(MOLA_PUSH_S * TPS) : BUMP_TICKS;
            this.impTotal = this.impTicks;
            this.impDecay = true;
            this.bumpAt.set(o.id, this.courseTick);
            this.stun = Math.max(
              this.stun,
              o.kind === 'serra'
                ? STUN_SERRA_TICKS
                : MOVER_KINDS.includes(o.kind)
                  ? STUN_MOVER_TICKS
                  : Math.round(STUN_BASE_TICKS + STUN_PER_R_TICKS * o.r),
            );
            events.push({ kind: 'choque', size: clamp(power / 9, 0.25, 1) });
          }
        }
      }
      edge = this.width.halfAt(ny) - PLAYER_R;
      nx = clamp(nx, -edge, edge);
    }
    const dx = nx - this.x;
    const dy = ny - this.y;
    // Qualquer deslocamento conta como mexer, venha de onde vier: o analógico, uma pancada, a
    // esteira, o ímã, o gelo, um obstáculo que se mexe. Para ficar parado é preciso estar parado de verdade.
    const moved = Math.sqrt(dx * dx + dy * dy) / DT;
    this.x = nx;
    this.y = ny;
    if (this.y > this.maxY) this.maxY = this.y;

    // Esconderijos: dentro da zona a pessoa fica protegida; ficar demais quebra o esconderijo.
    let hidden = false;
    for (const c of this.nearCovers(this.y, COVER_ZONE_R)) {
      // a zona é uma "cápsula": o ponto mais próximo do trecho da moita (a moita simples é só um ponto)
      const cy = Math.max(c.y, Math.min(this.y, c.y + c.len));
      if ((this.x - c.x) ** 2 + (this.y - cy) ** 2 > COVER_ZONE_R * COVER_ZONE_R) continue;
      const s = this.coverState.get(c.id);
      if (s?.broken) continue;
      const cur = this.curDur(c) - DT * (c.len > 0 ? COVER_LONG_DRAIN : 1);
      if (cur <= 0) {
        this.coverState.set(c.id, { dur: 0, at: this.courseTick, broken: true });
        events.push({ kind: 'quebrou', cover: c.id });
      } else {
        this.coverState.set(c.id, { dur: cur, at: this.courseTick, broken: false });
        hidden = true;
      }
    }
    this.hidden = hidden;
    // Fôlego: quem se escondeu por um tempo sai descansado e corre mais rápido por um instante.
    if (hidden) this.hiddenTicks++;
    else {
      if (this.hiddenTicks >= FOLEGO_MIN_HIDDEN_TICKS) {
        this.rested = FOLEGO_TICKS;
        events.push({ kind: 'folego' });
      }
      this.hiddenTicks = 0;
    }

    // A linha de chegada vale antes de qualquer perda no mesmo instante (o Clássico).
    if (this.course.mode === 'classico' && this.y >= this.course.length) {
      if (this.holdAtFinish) {
        this.finished = true;
        this.finishedTick = this.tick;
        events.push({ kind: 'chegou', meters: this.course.length });
        this.tick++;
        return events;
      }
      const old = this.course.map;
      this.sumDone += this.course.length;
      this.n++;
      this.startCourse();
      events.push({
        kind: 'fase',
        n: this.n,
        map: this.course.map,
        mapChanged: this.course.map !== old,
      });
      this.tick++;
      return events;
    }

    // Se mexeu enquanto ele olha (passada a folga), perdeu. Escondido, não.
    const look = activeLook(cycle, t);
    // Quem está atordoado (bateu há pouco) perde também, mesmo parado: a cabeça gira e o Vigia vê.
    if (look && t >= look.start + LOOK_GRACE && !hidden && (moved > MOVE_EPS || this.stun > 0)) {
      this.die('vigia', events);
      this.tick++;
      return events;
    }

    // A escuridão: mais rápida com o tempo e com a pessoa parada, mas nunca mais que o boneco.
    this.yHist.push(this.y);
    if (this.yHist.length > 6 * TPS) this.yHist.shift();
    const stalled = this.yHist.length >= 6 * TPS && this.y - this.yHist[0]! < 1.5;
    this.idle = clamp(this.idle + (stalled ? DT / 3 : -DT / 1.5), 0, 1);
    // Escondido, a escuridão demora mais para chegar (um respiro, não um abrigo para sempre: o esconderijo quebra).
    if (!this.externalDark) {
      this.darkY += darkSpeed(this.course, t, this.idle) * (hidden ? COVER_DARK_FACTOR : 1) * DT;
    }
    if (this.y - PLAYER_R <= this.darkY) {
      this.die('escuridao', events);
      this.tick++;
      return events;
    }

    // Escondido, o atordoamento passa 3x mais rápido.
    if (this.stun > 0) this.stun = Math.max(0, this.stun - (hidden ? COVER_STUN_FACTOR : 1));
    this.tick++;
    this.courseTick++;
    return events;
  }

  /** Tudo o que a tela precisa para desenhar agora. */
  get view(): SinalView {
    const t = this.courseTick * DT;
    const cycle = this.timeline.cycleAt(t);
    const note = noteAt(cycle, t);
    return {
      tick: this.tick,
      t,
      x: this.x,
      y: this.y,
      hidden: this.hidden,
      vigia: stateAt(cycle, t),
      cycle,
      syl: note ? note.syl : -1,
      sylP: note ? (t - note.t0) / (note.t1 - note.t0) : 0,
      halfAt: (y: number) => this.width.halfAt(y),
      darkY: this.darkY,
      course: this.course,
      meters: this.result.meters,
      covers: this.nearCovers(this.y, 40).map((def) => ({
        def,
        dur: this.curDur(def),
        broken: this.coverState.get(def.id)?.broken ?? false,
      })),
      obstacles: this.nearObstacles(this.y, 40)
        .filter((o) => Math.abs(o.y - this.y) < 44)
        .map((o) => {
          const at = this.bumpAt.get(o.id);
          return { ...o, bump: at === undefined ? 0 : Math.max(0, 1 - (this.courseTick - at) / 21) };
        }),
      stun: this.stun > 0 ? Math.min(1, this.stun / 60) : 0,
      knock: this.impTicks > 0 && this.impDecay ? this.impTicks / this.impTotal : 0,
      knockDir: (() => {
        const len = Math.sqrt(this.impX * this.impX + this.impY * this.impY);
        return len > 0 ? { x: this.impX / len, y: this.impY / len } : { x: 0, y: 0 };
      })(),
    };
  }

  /** A linha do tempo do Vigia desta fase (para o jogo e para os testes). */
  get vigiaTimeline(): VigiaTimeline {
    return this.timeline;
  }
}

/** Confere os movimentos: inteiros, na faixa, em ordem e em quantidade razoável. */
export function validateSinalInputs(inputs: readonly SinalInput[]): string | null {
  if (inputs.length > SINAL_MAX_INPUTS) return 'Movimentos demais';
  let prev = -1;
  for (const i of inputs) {
    if (!Number.isInteger(i.tick) || i.tick < 0 || i.tick > SINAL_MAX_TICKS) return 'Instante inválido';
    if (i.tick <= prev) return 'Movimentos fora de ordem';
    if (!Number.isInteger(i.x) || !Number.isInteger(i.y)) return 'Direção inválida';
    if (i.x < -100 || i.x > 100 || i.y < -100 || i.y > 100) return 'Direção fora da faixa';
    prev = i.tick;
  }
  return null;
}

/**
 * Refaz a corrida a partir dos movimentos: o analógico fica na última direção até o próximo
 * movimento, e a corrida roda até a pessoa perder (ou até o limite de passos, sem acabar).
 */
export function evaluateSinal(
  seed: string,
  mode: SinalMode,
  inputs: readonly SinalInput[],
  maxTicks = SINAL_MAX_TICKS,
): SinalResult {
  const sim = new SinalSim(seed, mode);
  let idx = 0;
  let ax = 0;
  let ay = 0;
  for (let tick = 0; tick < maxTicks && !sim.dead; tick++) {
    while (idx < inputs.length && inputs[idx]!.tick <= tick) {
      ax = inputs[idx]!.x;
      ay = inputs[idx]!.y;
      idx++;
    }
    sim.step(ax, ay);
  }
  return sim.result;
}

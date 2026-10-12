import {
  ATRASO_TICKS,
  BACK_LIMIT,
  CHUVA_IMPULSE,
  CHUVA_PUSH_S,
  CHUVA_RADIUS,
  COVER_REGEN,
  COVER_ZONE_R,
  DARK_CAP,
  DEADZONE,
  BEBADO_AMP,
  BOLHAS_SLICK,
  BEBADO_PERIOD_TICKS,
  BUMP_BASE,
  BUMP_PER_R,
  BUMP_TICKS,
  DT,
  ESTEIRA_SPEED,
  GELO_SLICK,
  HALF,
  IMA_PULL,
  LAMA_FACTOR,
  LOOK_GRACE,
  MAX_SPEED,
  MOLA_IMPULSE,
  MOLA_PUSH_S,
  MOVER_BUMP,
  MOVE_EPS,
  MUD_FACTOR,
  OLEO_RADIUS,
  OLEO_SLICK,
  PATINS_SLICK,
  PLAYER_R,
  RAJADA_SPEED,
  SERRA_BUMP,
  SINAL_MAX_INPUTS,
  STUN_BASE_TICKS,
  STUN_MOVER_TICKS,
  STUN_PER_R_TICKS,
  STUN_SERRA_TICKS,
  STUN_SHOVE_TICKS,
  SINAL_MAX_TENTHS,
  SINAL_MAX_TICKS,
  SOLUCO_EVERY,
  SOLUCO_PUSH_TICKS,
  SOLUCO_SPEED,
  TPS,
  TURBINA_SPEED,
  TURBO_FACTOR,
  VENTO_SPEED,
  clamp,
  type PowerKind,
  type SinalEnd,
  type SinalEvent,
  type SinalInput,
  type SinalMode,
  type SinalResult,
} from './constants';
import {
  CoverField,
  ObstacleField,
  courseFor,
  isSolid,
  MOVER_KINDS,
  obstaclePos,
  timelineParams,
  type Course,
  type CoverDef,
  type ObstacleDef,
} from './course';
import { VigiaTimeline, activeLook, stateAt, type VigiaState } from './vigia';

/** Velocidade-base da escuridão (m/s) antes dos aceleradores. Cresce com o tempo e, no Clássico, com a fase. */
export function darkBase(course: Course, t: number): number {
  if (course.mode === 'infinito') return 0.22 + 0.016 * t;
  // a cada fase a escuridão larga mais ligeira (e o teto de 92% do boneco continua valendo)
  return 0.42 + 0.26 * (course.n - 1) + 0.012 * t;
}

/** A velocidade real da escuridão: a base, mais rápida quanto mais a pessoa fica parada, e NUNCA acima do teto. */
export function darkSpeed(course: Course, t: number, idle: number): number {
  return Math.min(DARK_CAP, darkBase(course, t) * (1 + 3 * idle));
}

interface Patch {
  x: number;
  y: number;
}
interface Mark {
  x: number;
  y: number;
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
  /** O Vigia está dando o falso aviso agora. */
  fake: boolean;
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
  /** `p` é o quanto do aviso ou do efeito já passou (0 a 1). */
  powers: { kind: PowerKind; phase: 'aviso' | 'efeito'; dir: -1 | 1; evaded: boolean; p: number }[];
  patches: Patch[];
  marks: Mark[];
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
  private bumpAt = new Map<number, number>();
  private hidden = false;
  private maxY = 0;
  private darkY = 0;
  private idle = 0;
  private yHist: number[] = [];
  private state: VigiaState = 'costas';
  private fired = new Set<string>();
  private evaded = new Set<string>();
  private patches: Patch[] = [];
  private marks: Mark[] = [];

  dead = false;
  private end: SinalEnd | null = null;
  private endedTick = 0;

  constructor(
    readonly seed: string,
    readonly mode: SinalMode,
  ) {
    this.startCourse();
  }

  private startCourse() {
    this.course = courseFor(this.seed, this.mode, this.n);
    this.timeline = new VigiaTimeline(
      timelineParams(this.course),
      `${this.seed}:vigia:${this.mode}:${this.n}`,
    );
    this.covers = new CoverField(this.course, `${this.seed}:cover:${this.mode}:${this.n}`);
    this.obstacles = new ObstacleField(
      this.course,
      `${this.seed}:obst:${this.mode}:${this.n}`,
      this.covers,
    );
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
    this.bumpAt.clear();
    this.hidden = false;
    this.maxY = 0;
    this.darkY = -this.course.darkStart;
    this.idle = 0;
    this.yHist = [];
    this.courseTick = 0;
    this.state = 'costas';
    this.fired.clear();
    this.evaded.clear();
    this.patches = [];
    this.marks = [];
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
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]!.y < y - reach) lo = mid + 1;
      else hi = mid;
    }
    const out: CoverDef[] = [];
    for (let i = lo; i < list.length && list[i]!.y <= y + reach; i++) out.push(list[i]!);
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
    if (this.dead) return events;
    const t = this.courseTick * DT;
    const cycle = this.timeline.cycleAt(t);

    // O Vigia
    const vs = stateAt(cycle, t);
    if (vs !== this.state) {
      this.state = vs;
      if (vs === 'aviso') events.push({ kind: 'aviso', fake: cycle.fake, variant: cycle.kind });
      else if (vs === 'olhando') events.push({ kind: 'olhando' });
      else if (vs === 'voltando') events.push({ kind: 'voltando' });
    }

    // Os poderes (nunca em quem está escondido)
    let invert = false;
    let lag = false;
    let speedMul = 1;
    let pushX = 0;
    let oleoActive = false;
    let mirrorX = false;
    let wobble = 0;
    let boost = 1;
    let skating = false;
    let soap = false;
    cycle.powers.forEach((p, i) => {
      const key = `${cycle.start}:${i}`;
      if (t >= p.teleStart && !this.fired.has(`${key}:t`)) {
        this.fired.add(`${key}:t`);
        events.push({ kind: 'poder-aviso', power: p.kind });
        if (p.kind === 'chuva') {
          const edge = HALF - 1;
          this.marks = [
            [0, 2.5],
            [-1.8 * p.dir, 4.5],
            [1.8 * p.dir, 6.5],
          ].map(([dx, dy]) => ({ x: clamp(this.x + dx!, -edge, edge), y: this.y + dy! }));
        }
      }
      if (t >= p.effectStart && !this.fired.has(`${key}:s`)) {
        this.fired.add(`${key}:s`);
        if (this.hidden) {
          this.evaded.add(key);
          events.push({ kind: 'poder-evitado', power: p.kind });
          if (p.kind === 'chuva') this.marks = [];
        } else {
          events.push({ kind: 'poder', power: p.kind });
          if (p.kind === 'oleo') {
            const edge = HALF - 1;
            this.patches = [
              [0, 3],
              [1.5 * p.dir, 5.5],
              [-1.2 * p.dir, 8],
            ].map(([dx, dy]) => ({ x: clamp(this.x + dx!, -edge, edge), y: this.y + dy! }));
          } else if (p.kind === 'chuva') {
            // A chuva marcada explode: empurra quem estiver dentro de uma das marcas.
            let best: Mark | null = null;
            let bestD = Infinity;
            for (const m of this.marks) {
              const dd = (this.x - m.x) ** 2 + (this.y - m.y) ** 2;
              if (dd <= CHUVA_RADIUS * CHUVA_RADIUS && dd < bestD) {
                best = m;
                bestD = dd;
              }
            }
            if (best) {
              let dx = this.x - best.x;
              let dy = this.y - best.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len < 0.001) {
                dx = 0;
                dy = 1;
              } else {
                dx /= len;
                dy /= len;
              }
              this.impX = dx * CHUVA_IMPULSE;
              this.impY = dy * CHUVA_IMPULSE;
              this.impTicks = Math.round(CHUVA_PUSH_S * TPS);
              this.impTotal = this.impTicks;
              this.impDecay = false;
            }
            this.marks = [];
          }
        }
      }
      const live = t >= p.effectStart && t < p.effectEnd && !this.evaded.has(key);
      if (live && !this.hidden) {
        // Os corvos também invertem os controles (a tela fica coberta e você erra o lado).
        if (p.kind === 'invertido' || p.kind === 'corvos') invert = true;
        else if (p.kind === 'lama') speedMul = Math.min(speedMul, LAMA_FACTOR);
        else if (p.kind === 'buzina') speedMul = 0;
        else if (p.kind === 'rajada') pushX = p.dir * RAJADA_SPEED;
        else if (p.kind === 'vento') pushX = p.dir * VENTO_SPEED;
        else if (p.kind === 'atraso') lag = true;
        else if (p.kind === 'oleo') oleoActive = true;
        else if (p.kind === 'espelho') mirrorX = true;
        else if (p.kind === 'turbo') boost = TURBO_FACTOR;
        else if (p.kind === 'patins') skating = true;
        else if (p.kind === 'bolhas') soap = true;
        else if (p.kind === 'bebado') {
          // balança de lado, indo e voltando (onda triangular, sem seno)
          const et = this.courseTick - Math.round(p.effectStart * TPS);
          const ph = (et % BEBADO_PERIOD_TICKS) / BEBADO_PERIOD_TICKS;
          wobble = BEBADO_AMP * (ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4);
        } else if (p.kind === 'soluco') {
          // um soluço a cada 1,1 s: um empurrão curto para um lado sorteado
          const startTick = Math.round(p.effectStart * TPS);
          const et = this.courseTick - startTick;
          if (et >= 0 && et % SOLUCO_EVERY === 0) {
            const idx = Math.floor(et / SOLUCO_EVERY);
            const h = Math.imul(idx * 40503 + startTick + 1, 2654435761) >>> 0;
            const dir = h % 4;
            this.impX = dir === 0 ? SOLUCO_SPEED : dir === 1 ? -SOLUCO_SPEED : 0;
            this.impY = dir === 2 ? SOLUCO_SPEED : dir === 3 ? -SOLUCO_SPEED : 0;
            this.impTicks = SOLUCO_PUSH_TICKS;
            this.impTotal = SOLUCO_PUSH_TICKS;
            this.impDecay = false;
            events.push({ kind: 'soluco' });
          }
        }
      }
      if (t >= p.effectEnd && !this.fired.has(`${key}:e`)) {
        this.fired.add(`${key}:e`);
        if (!this.evaded.has(key)) events.push({ kind: 'poder-fim', power: p.kind });
        if (p.kind === 'oleo') this.patches = [];
      }
    });

    // Obstáculos de chão: lamaçal (devagar), esteira (empurra de lado), ímã (puxa), turbina (para
    // frente ou para trás), gelo (escorrega), cola (atrasa os comandos) e inversor (troca os controles).
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
      else if (o.kind === 'turbina') hzy += o.dir * TURBINA_SPEED;
      else if (o.kind === 'gelo') zoneSlick = true;
      else if (o.kind === 'cola') lag = true;
      else if (o.kind === 'inversor') invert = !invert;
      else if (o.kind === 'ima') {
        const len = Math.sqrt(dd);
        if (len > 0.3) {
          hzx -= (ox / len) * IMA_PULL;
          hzy -= (oy / len) * IMA_PULL;
        }
      }
    }

    // O analógico (com atraso, ele vale o de 0,4 s atrás)
    this.inHist.push([ax, ay]);
    if (this.inHist.length > ATRASO_TICKS + 2) this.inHist.shift();
    let rax = ax;
    let ray = ay;
    if (lag) {
      const old = this.inHist[this.inHist.length - 1 - ATRASO_TICKS];
      rax = old ? old[0] : 0;
      ray = old ? old[1] : 0;
    }
    // Atordoado: não obedece o analógico enquanto dura.
    if (this.stun > 0) {
      rax = 0;
      ray = 0;
    }
    let ix = clamp(rax, -100, 100) / 100;
    let iy = clamp(ray, -100, 100) / 100;
    const mag = Math.sqrt(ix * ix + iy * iy);
    if (mag < DEADZONE) {
      ix = 0;
      iy = 0;
    } else if (mag > 1) {
      ix /= mag;
      iy /= mag;
    }
    if (invert) {
      ix = -ix;
      iy = -iy;
    }
    // O espelho troca só a esquerda e a direita.
    if (mirrorX) ix = -ix;
    const tx = ix * MAX_SPEED * speedMul * boost;
    const ty = iy * MAX_SPEED * speedMul * boost;
    // Quanto escorrega: óleo, gelo e patins (o mais escorregadio manda).
    let slickK = 1;
    if (oleoActive) {
      for (const p of this.patches) {
        if ((this.x - p.x) ** 2 + (this.y - p.y) ** 2 <= OLEO_RADIUS * OLEO_RADIUS) slickK = Math.min(slickK, OLEO_SLICK);
      }
    }
    if (zoneSlick) slickK = Math.min(slickK, GELO_SLICK);
    if (skating) slickK = Math.min(slickK, PATINS_SLICK);
    if (soap) slickK = Math.min(slickK, BOLHAS_SLICK);
    if (slickK < 1) {
      this.svx += (tx - this.svx) * slickK;
      this.svy += (ty - this.svy) * slickK;
    } else {
      this.svx = tx;
      this.svy = ty;
    }
    let vx = this.svx + pushX + wobble + hzx;
    let vy = this.svy + hzy;
    if (this.impTicks > 0) {
      // As pancadas perdem força aos poucos (o empurrão forte é no começo); as outras são constantes.
      const f = this.impDecay ? (this.impTicks / this.impTotal) * 2 : 1;
      vx += this.impX * f;
      vy += this.impY * f;
      this.impTicks--;
    }
    const edge = HALF - PLAYER_R;
    let nx = clamp(this.x + vx * DT, -edge, edge);
    let ny = Math.max(BACK_LIMIT, this.y + vy * DT);
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
      if ((this.x - c.x) ** 2 + (this.y - c.y) ** 2 > COVER_ZONE_R * COVER_ZONE_R) continue;
      const s = this.coverState.get(c.id);
      if (s?.broken) continue;
      const cur = this.curDur(c) - DT;
      if (cur <= 0) {
        this.coverState.set(c.id, { dur: 0, at: this.courseTick, broken: true });
        events.push({ kind: 'quebrou', cover: c.id });
      } else {
        this.coverState.set(c.id, { dur: cur, at: this.courseTick, broken: false });
        hidden = true;
      }
    }
    this.hidden = hidden;

    // A linha de chegada vale antes de qualquer perda no mesmo instante (o Clássico).
    if (this.course.mode === 'classico' && this.y >= this.course.length) {
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
    this.darkY += darkSpeed(this.course, t, this.idle) * DT;
    if (this.y - PLAYER_R <= this.darkY) {
      this.die('escuridao', events);
      this.tick++;
      return events;
    }

    if (this.stun > 0) this.stun--;
    this.tick++;
    this.courseTick++;
    return events;
  }

  /** Tudo o que a tela precisa para desenhar agora. */
  get view(): SinalView {
    const t = this.courseTick * DT;
    const cycle = this.timeline.cycleAt(t);
    const powers: SinalView['powers'] = [];
    cycle.powers.forEach((p, i) => {
      const evaded = this.evaded.has(`${cycle.start}:${i}`);
      if (t >= p.teleStart && t < p.effectStart) {
        powers.push({ kind: p.kind, phase: 'aviso', dir: p.dir, evaded, p: (t - p.teleStart) / (p.effectStart - p.teleStart) });
      } else if (t >= p.effectStart && t < p.effectEnd) {
        powers.push({ kind: p.kind, phase: 'efeito', dir: p.dir, evaded, p: (t - p.effectStart) / (p.effectEnd - p.effectStart) });
      }
    });
    return {
      tick: this.tick,
      t,
      x: this.x,
      y: this.y,
      hidden: this.hidden,
      vigia: stateAt(cycle, t),
      fake: cycle.fake && t >= cycle.avisoStart && t < cycle.end,
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
      powers,
      patches: this.patches,
      marks: this.marks,
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

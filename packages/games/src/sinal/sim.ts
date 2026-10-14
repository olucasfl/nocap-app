import {
  BACK_LIMIT,
  BUMP_BASE,
  BUMP_PER_R,
  BUMP_TICKS,
  CHASER_DIZZY_TICKS,
  CHASER_GIVEUP_BEHIND,
  CHASER_HIT_POWER,
  CHASER_R,
  CHASER_SPAWN_AHEAD,
  CHASER_STUN_TICKS,
  COVER_DARK_FACTOR,
  COVER_LONG_DRAIN,
  COVER_LONG_MAX,
  COVER_REGEN,
  COVER_STUN_FACTOR,
  COVER_ZONE_R,
  DARK_CAP,
  DEADZONE,
  DT,
  ATORDOAR_TICKS,
  ESCORREGAO_TICKS,
  ESTEIRA_SPEED,
  FOLEGO_FACTOR,
  FOLEGO_MIN_HIDDEN_TICKS,
  FOLEGO_TICKS,
  GELO_SLICK,
  IMA_PULL,
  IMPULSO_FACTOR,
  IMPULSO_TICKS,
  ITEM_PICKUP_R,
  ITEM_USE,
  LOOK_GRACE,
  MAX_SPEED,
  MOLA_IMPULSE,
  MOLA_PUSH_S,
  MOVER_BUMP,
  MOVE_EPS,
  MUD_FACTOR,
  PESO_FACTOR,
  PESO_TICKS,
  PLAYER_R,
  ROLL_R,
  ROLL_SPEED,
  ROLL_WIND_TICKS,
  SAFE_BEFORE_LOOK_S,
  SERRA_BUMP,
  SOMBRA_TICKS,
  SINAL_MAX_INPUTS,
  STUN_BASE_TICKS,
  STUN_MOVER_TICKS,
  STUN_PER_R_TICKS,
  STUN_SERRA_TICKS,
  STUN_SHOVE_TICKS,
  SINAL_MAX_TENTHS,
  SINAL_MAX_TICKS,
  THROW_AHEAD,
  THROW_BEHIND,
  THROW_FLIGHT_TICKS,
  THROW_HIT_POWER,
  THROW_LEAD,
  THROW_RADIUS,
  THROW_STUN_TICKS,
  THROW_WIND_TICKS,
  TPS,
  clamp,
  type SinalEnd,
  type SinalEvent,
  type SinalInput,
  type SinalMode,
  isHinder,
  type ItemKind,
  type SinalResult,
  type ThrowKind,
} from './constants';
import {
  ChaserField,
  CoverField,
  ItemField,
  ObstacleField,
  ThrowerField,
  WidthField,
  courseFor,
  isSolid,
  MOVER_KINDS,
  obstaclePos,
  timelineParams,
  type Course,
  type CoverDef,
  type ItemDef,
  type ObstacleDef,
  type ThrowerDef,
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
  /** Quem joga coisas (nas bordas), o que está no ar ou marcado no chão, e quem corre atrás de você. */
  throwers: { id: number; x: number; y: number; side: -1 | 1; kind: ThrowKind; phase: 'idle' | 'wind' | 'fly'; p: number }[];
  shots: ShotView[];
  chasers: { id: number; x: number; y: number; frozen: boolean; dizzy: boolean; speed: number }[];
  /** Os itens no chão perto de você, o que você carrega e o quanto falta de cada efeito (1 = cheio, 0 = acabou). */
  items: ItemDef[];
  held: ItemKind | null;
  shadow: number;
  boost: number;
  /** Sala: poderes de outros jogadores a caminho (p = quanto do aviso já passou) e o que está te atrapalhando agora. */
  incoming: { item: ItemKind; p: number }[];
  debuff: { item: ItemKind; p: number } | null;
}

/** Um arremesso em andamento: a marca no chão, o voo ou a faixa por onde a bola rola. */
export interface ShotView {
  id: number;
  kind: ThrowKind;
  phase: 'wind' | 'fly' | 'roll';
  /** O quanto da fase já passou (0 a 1). */
  p: number;
  /** De onde saiu, para onde vai e onde está agora (m). */
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  x: number;
  y: number;
  /** O arremesso vai cair numa hora em que o Vigia está para olhar ou olhando: não faz mal (o jogo desenha a marca apagada). */
  dud: boolean;
}

interface Shot {
  start: number;
  kind: ThrowKind;
  tx: number;
  ty: number;
  done: boolean;
}

interface Chaser {
  x: number;
  y: number;
  gone: boolean;
  dizzy: number;
  frozen: boolean;
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
  private throwers!: ThrowerField;
  private chasers!: ChaserField;
  private itemField!: ItemField;
  private taken = new Set<number>();
  /** O item que a pessoa carrega (um por vez) e os efeitos ligados. */
  held: ItemKind | null = null;
  private shadowTicks = 0;
  private boostTicks = 0;
  /** Poderes de outros jogadores a caminho (a hora de bater, em passos) e o efeito que está valendo. */
  private pending: { item: ItemKind; at: number; from: number }[] = [];
  private debuff: { item: ItemKind; ticks: number; total: number } | null = null;
  /** Sala: sem itens (a sala não os usa ainda); o jogo solo liga. */
  itemsEnabled = true;
  private shotState = new Map<number, Shot>();
  private chaserState = new Map<number, Chaser>();
  /** A velocidade do boneco no passo anterior (m/s): os arremessos miram um pouco à frente. */
  private velX = 0;
  private velY = 0;
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
    /** Sala: entram os itens que atrapalham os outros jogadores. */
    readonly online = false,
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
    this.throwers = new ThrowerField(this.course, `${this.seed}:lanc:${this.mode}:${this.n}`);
    this.chasers = new ChaserField(this.course, `${this.seed}:persg:${this.mode}:${this.n}`, this.width);
    this.itemField = new ItemField(`${this.seed}:itens:${this.mode}:${this.n}`, this.width, this.obstacles, this.online);
    this.taken.clear();
    this.pending = [];
    this.debuff = null;
    this.held = null;
    this.shadowTicks = 0;
    this.boostTicks = 0;
    this.shotState.clear();
    this.chaserState.clear();
    this.velX = 0;
    this.velY = 0;
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
  step(ax: number, ay: number, use = false): SinalEvent[] {
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
      if (note) events.push({ kind: 'nota', syl: note.syl, hold: note.hold, rush: cycle.rush });
    }

    // Poderes de outros jogadores (sala): o aviso passou? bate (ou é barrado por esconderijo e perto do olhar).
    const safeNow = this.isSafeWindow(this.courseTick);
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const pw = this.pending[i]!;
      if (this.courseTick < pw.at) continue;
      this.pending.splice(i, 1);
      if (this.hidden || safeNow) {
        events.push({ kind: 'defendeu', item: pw.item });
      } else if (pw.item === 'atordoar') {
        this.stun = Math.max(this.stun, ATORDOAR_TICKS);
        events.push({ kind: 'sofreu', item: pw.item });
      } else {
        const total = pw.item === 'escorregao' ? ESCORREGAO_TICKS : PESO_TICKS;
        this.debuff = { item: pw.item, ticks: total, total };
        events.push({ kind: 'sofreu', item: pw.item });
      }
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

    // O efeito de um poder que te atrapalha: vale só fora da janela do Vigia (perto do olhar, nada pesa nem escorrega).
    if (this.debuff) {
      this.debuff.ticks--;
      if (this.debuff.ticks <= 0) this.debuff = null;
      else if (!safeNow) {
        if (this.debuff.item === 'peso') speedMul = Math.min(speedMul, PESO_FACTOR);
        else if (this.debuff.item === 'escorregao') zoneSlick = true;
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
    // Usar o item que se carrega: a Sombra esconde em qualquer lugar e o Impulso acelera, por 2 s.
    if (use && this.held && this.itemsEnabled) {
      const item = this.held;
      this.held = null;
      if (item === 'sombra') this.shadowTicks = SOMBRA_TICKS;
      else if (item === 'impulso') this.boostTicks = IMPULSO_TICKS;
      events.push({ kind: 'usou', item });
    }
    if (this.boostTicks > 0) {
      boost = Math.max(boost, IMPULSO_FACTOR);
      this.boostTicks--;
      if (this.boostTicks === 0) events.push({ kind: 'item-fim', item: 'impulso' });
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
    // A Sombra esconde em qualquer lugar: vale como esconderijo (protege do Vigia e de tudo o mais).
    if (this.shadowTicks > 0) {
      hidden = true;
      this.shadowTicks--;
      if (this.shadowTicks === 0) events.push({ kind: 'item-fim', item: 'sombra' });
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

    this.velX = dx / DT;
    this.velY = dy / DT;
    // Pegar um item do chão (só se não carrega outro): é só passar por cima.
    if (this.itemsEnabled && this.held === null) {
      this.itemField.ensure(this.y + 50);
      for (const it of this.itemField.list) {
        if (it.y > this.y + ITEM_PICKUP_R + 1) break;
        if (this.taken.has(it.id) || it.y < this.y - ITEM_PICKUP_R - 1) continue;
        if ((this.x - it.x) ** 2 + (this.y - it.y) ** 2 < ITEM_PICKUP_R * ITEM_PICKUP_R) {
          this.taken.add(it.id);
          this.held = it.kind;
          events.push({ kind: 'item', item: it.kind, id: it.id });
          break;
        }
      }
    }
    this.hazards(moved > MOVE_EPS, events);

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

  /** Sala: outro jogador pegou este item do chão; ele some também aqui. */
  markTaken(id: number) {
    this.taken.add(id);
  }

  /**
   * Sala: um poder de outro jogador vem na sua direção. Bate daqui a `delayTicks` passos (o aviso), e
   * não pega quem estiver escondido (esconderijo ou Sombra) nem perto de o Vigia olhar.
   */
  receive(item: ItemKind, delayTicks: number, from = 0) {
    if (!isHinder(item) || this.dead || this.finished) return;
    this.pending.push({ item, at: this.courseTick + delayTicks, from });
  }

  /** Joga o boneco para longe de (dx, dy) e o atordoa: o mesmo efeito de bater num obstáculo. */
  private knock(dx: number, dy: number, power: number, stunTicks: number) {
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = len > 1e-6 ? dx / len : 0;
    const uy = len > 1e-6 ? dy / len : -1;
    this.impX = ux * power;
    this.impY = uy * power;
    this.impTicks = BUMP_TICKS;
    this.impTotal = BUMP_TICKS;
    this.impDecay = true;
    this.stun = Math.max(this.stun, stunTicks);
  }

  /** O passo `tick` está perto demais de um olhar do Vigia para uma pancada valer (dura menos que a tontura). */
  private isSafeWindow(tick: number): boolean {
    const t = tick * DT;
    const c = this.timeline.cycleAt(t);
    return t >= c.lookStart - SAFE_BEFORE_LOOK_S && t < c.lookEnd + 0.05;
  }

  /** Os arremessadores perto da altura `y` (a lista é ordenada por altura). */
  private nearThrowers(y: number, behind: number, ahead: number): ThrowerDef[] {
    this.throwers.ensure(y + ahead + 30);
    const list = this.throwers.list;
    const out: ThrowerDef[] = [];
    for (const th of list) {
      if (th.y < y - behind) continue;
      if (th.y > y + ahead) break;
      out.push(th);
    }
    return out;
  }

  /**
   * Os perigos que se mexem sozinhos: arremessadores (a marca avisa onde cai, e dá para sair) e
   * perseguidores (só andam enquanto você anda e não está escondido). Quem está escondido não é
   * atingido; o resto vira pancada, com tontura (e, se o Vigia olhar nesse tempo, é o fim).
   */
  private hazards(playerMoving: boolean, events: SinalEvent[]) {
    const tick = this.courseTick;
    // Justiça com o Vigia: perto de ele olhar (e enquanto olha) nada pode te atordoar, senão não haveria
    // saída (parar para o Vigia e levar a pancada, ou desviar e ser visto). Os arremessos viram "bombas
    // de festim" e os perseguidores esperam.
    const safe = this.isSafeWindow(tick);
    // ---- arremessadores
    for (const th of this.nearThrowers(this.y, THROW_BEHIND, THROW_AHEAD)) {
      const wind = th.kind === 'roll' ? ROLL_WIND_TICKS : THROW_WIND_TICKS;
      const local = (tick + th.offset) % th.period;
      const start = tick - local;
      let st = this.shotState.get(th.id);
      if (local === 0) {
        // começa a mirar: o alvo é onde a pessoa vai estar daqui a pouco
        const ahead = ((wind + (th.kind === 'lob' ? THROW_FLIGHT_TICKS : 0)) * DT) * THROW_LEAD;
        let tx = this.x + this.velX * ahead;
        let ty = this.y + this.velY * ahead;
        if (th.kind === 'roll') {
          ty += 1.0;
          tx = 0;
        }
        const half = this.width.halfAt(ty);
        tx = clamp(tx, -(half - 0.6), half - 0.6);
        st = { start, kind: th.kind, tx, ty, done: false };
        this.shotState.set(th.id, st);
        events.push({ kind: 'lancou', shot: th.kind });
      }
      if (!st || st.start !== start || st.done) continue;
      const age = tick - start;
      if (th.kind === 'lob') {
        if (age === wind + THROW_FLIGHT_TICKS) {
          st.done = true;
          const ddx = this.x - st.tx;
          const ddy = this.y - st.ty;
          const hit = !safe && !this.hidden && ddx * ddx + ddy * ddy < THROW_RADIUS * THROW_RADIUS;
          if (hit) {
            this.knock(ddx, ddy, THROW_HIT_POWER, THROW_STUN_TICKS);
            events.push({ kind: 'choque', size: 0.75 });
          }
          events.push({ kind: 'impacto', shot: 'lob', hit });
        }
      } else if (age >= wind) {
        // a bola rola de um lado ao outro pela faixa avisada
        const half = this.width.halfAt(st.ty);
        const dir = -th.side;
        const bx = th.side * (half + 0.6) + dir * ROLL_SPEED * (age - wind) * DT;
        if (Math.abs(bx) > half + 1.2) {
          st.done = true;
          continue;
        }
        const ddx = this.x - bx;
        const ddy = this.y - st.ty;
        const min = ROLL_R + PLAYER_R;
        if (!safe && !this.hidden && ddx * ddx + ddy * ddy < min * min) {
          st.done = true;
          this.knock(dir, ddy === 0 ? 0.35 : ddy, THROW_HIT_POWER, THROW_STUN_TICKS);
          events.push({ kind: 'choque', size: 0.75 });
          events.push({ kind: 'impacto', shot: 'roll', hit: true });
        }
      }
    }

    // ---- perseguidores
    this.chasers.ensure(this.y + CHASER_SPAWN_AHEAD + 40);
    for (const def of this.chasers.list) {
      if (def.y > this.y + CHASER_SPAWN_AHEAD + 40) break;
      let ch = this.chaserState.get(def.id);
      if (!ch) {
        if (this.y < def.y - CHASER_SPAWN_AHEAD) continue;
        ch = { x: def.x, y: def.y, gone: false, dizzy: 0, frozen: false };
        this.chaserState.set(def.id, ch);
        events.push({ kind: 'perseguidor' });
      }
      if (ch.gone) continue;
      if (ch.y < this.y - CHASER_GIVEUP_BEHIND || ch.y < this.darkY) {
        ch.gone = true;
        continue;
      }
      if (ch.dizzy > 0) {
        ch.dizzy--;
        ch.frozen = true;
        continue;
      }
      // só anda se a pessoa anda e não está escondida
      ch.frozen = this.hidden || !playerMoving || safe;
      if (!ch.frozen) {
        let ddx = this.x - ch.x;
        let ddy = this.y - ch.y;
        const len = Math.sqrt(ddx * ddx + ddy * ddy);
        if (len > 1e-6) {
          ddx /= len;
          ddy /= len;
          ch.x += ddx * def.speed * DT;
          ch.y += ddy * def.speed * DT;
        }
        // não atravessa os obstáculos sólidos: fica preso atrás deles
        for (const o of this.nearObstacles(ch.y, 2)) {
          if (!isSolid(o.kind)) continue;
          const ox = ch.x - o.x;
          const oy = ch.y - o.y;
          const min = o.r + CHASER_R;
          const dd = ox * ox + oy * oy;
          if (dd >= min * min || dd < 1e-9) continue;
          const l2 = Math.sqrt(dd);
          ch.x = o.x + (ox / l2) * min;
          ch.y = o.y + (oy / l2) * min;
        }
        const edge = this.width.halfAt(ch.y) - CHASER_R;
        ch.x = clamp(ch.x, -edge, edge);
      }
      const px = this.x - ch.x;
      const py = this.y - ch.y;
      const touch = CHASER_R + PLAYER_R;
      if (!safe && !this.hidden && px * px + py * py < touch * touch) {
        this.knock(px, py, CHASER_HIT_POWER, CHASER_STUN_TICKS);
        ch.dizzy = CHASER_DIZZY_TICKS;
        events.push({ kind: 'choque', size: 0.8 });
        events.push({ kind: 'pegou' });
      }
    }
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
      ...this.hazardView(),
      ...this.itemView(),
    };
  }

  private itemView(): Pick<SinalView, 'items' | 'held' | 'shadow' | 'boost' | 'incoming' | 'debuff'> {
    this.itemField.ensure(this.y + 50);
    const items = this.itemsEnabled
      ? this.itemField.list.filter((it) => !this.taken.has(it.id) && Math.abs(it.y - this.y) < 44)
      : [];
    return {
      items,
      held: this.held,
      shadow: this.shadowTicks / SOMBRA_TICKS,
      boost: this.boostTicks / IMPULSO_TICKS,
      incoming: this.pending.map((pw) => ({
        item: pw.item,
        p: clamp(1 - (pw.at - this.courseTick) / 48, 0, 1),
      })),
      debuff: this.debuff ? { item: this.debuff.item, p: this.debuff.ticks / this.debuff.total } : null,
    };
  }

  private hazardView(): Pick<SinalView, 'throwers' | 'shots' | 'chasers'> {
    const tick = this.courseTick;
    const throwers: SinalView['throwers'] = [];
    const shots: ShotView[] = [];
    for (const th of this.nearThrowers(this.y, 40, 44)) {
      const half = this.width.halfAt(th.y);
      const tx = th.side * (half + 0.65);
      const wind = th.kind === 'roll' ? ROLL_WIND_TICKS : THROW_WIND_TICKS;
      const local = (tick + th.offset) % th.period;
      const st = this.shotState.get(th.id);
      let phase: 'idle' | 'wind' | 'fly' = 'idle';
      let p = 0;
      if (st && st.start === tick - local && !st.done) {
        if (local < wind) {
          phase = 'wind';
          p = local / wind;
        } else {
          phase = 'fly';
          p = th.kind === 'lob' ? (local - wind) / THROW_FLIGHT_TICKS : 0;
        }
        if (th.kind === 'lob') {
          const fp = phase === 'fly' ? p : 0;
          shots.push({
            id: th.id,
            kind: 'lob',
            phase,
            p,
            sx: tx,
            sy: th.y,
            tx: st.tx,
            ty: st.ty,
            x: tx + (st.tx - tx) * fp,
            y: th.y + (st.ty - th.y) * fp,
            dud: this.isSafeWindow(st.start + wind + THROW_FLIGHT_TICKS),
          });
        } else if (phase === 'wind') {
          shots.push({ id: th.id, kind: 'roll', phase: 'wind', p, sx: tx, sy: st.ty, tx: -tx, ty: st.ty, x: tx, y: st.ty, dud: this.isSafeWindow(st.start + wind + 60) });
        } else {
          const bx = tx + -th.side * ROLL_SPEED * (local - wind) * DT;
          shots.push({ id: th.id, kind: 'roll', phase: 'roll', p: 0, sx: tx, sy: st.ty, tx: -tx, ty: st.ty, x: bx, y: st.ty, dud: this.isSafeWindow(tick) });
        }
      }
      throwers.push({ id: th.id, x: tx, y: th.y, side: th.side, kind: th.kind, phase, p });
    }
    const chasers: SinalView['chasers'] = [];
    for (const def of this.chasers.list) {
      const ch = this.chaserState.get(def.id);
      if (!ch || ch.gone) continue;
      if (Math.abs(ch.y - this.y) > 44) continue;
      chasers.push({ id: def.id, x: ch.x, y: ch.y, frozen: ch.frozen, dizzy: ch.dizzy > 0, speed: def.speed });
    }
    return { throwers, shots, chasers };
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
  let prevUse = false;
  for (const i of inputs) {
    if (!Number.isInteger(i.tick) || i.tick < 0 || i.tick > SINAL_MAX_TICKS) return 'Instante inválido';
    if (!Number.isInteger(i.x) || !Number.isInteger(i.y)) return 'Direção inválida';
    const use = i.x === ITEM_USE && i.y === 0;
    // Dois movimentos não dividem o instante, mas o "usou o item" pode vir junto de uma mudança do analógico.
    if (i.tick < prev || (i.tick === prev && !use && !prevUse)) return 'Movimentos fora de ordem';
    if (!use && (i.x < -100 || i.x > 100 || i.y < -100 || i.y > 100)) return 'Direção fora da faixa';
    prev = i.tick;
    prevUse = use;
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
    let use = false;
    while (idx < inputs.length && inputs[idx]!.tick <= tick) {
      if (inputs[idx]!.x === ITEM_USE && inputs[idx]!.y === 0) use = true;
      else {
        ax = inputs[idx]!.x;
        ay = inputs[idx]!.y;
      }
      idx++;
    }
    sim.step(ax, ay, use);
  }
  return sim.result;
}

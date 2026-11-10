import {
  GP_ACCEL,
  GP_BRAKE,
  GP_BRAKE_MIN,
  GP_BUMP_E,
  GP_CAR_HALF,
  GP_CAR_R,
  GP_COAST,
  GP_CUT_JUMP,
  GP_CUT_OFF,
  GP_DNF_SEC,
  GP_GRID_FIRST,
  GP_GRID_GAP,
  GP_GRID_SIDE,
  GP_GRIP_MIN,
  GP_HALF_WIDTH,
  GP_KERB_W,
  GP_LAPS,
  GP_LAT_ACC,
  GP_LIMIT,
  GP_OVER_DECEL,
  GP_PIT_STOP_SEC,
  GP_QUALI_MAX_SEC,
  GP_QUALI_SPAWN,
  GP_REVERSE_ACCEL,
  GP_REVERSE_MAX,
  GP_SLIDE_DRAG,
  GP_SLIP_DAMP,
  GP_SLIP_FILL_FAR,
  GP_SLIP_FILL_NEAR,
  GP_SLIP_LEN,
  GP_SLIP_MIN_V,
  GP_SLIP_W,
  GP_STEER_FALL,
  GP_STEER_FULL_V,
  GP_STEER_RATE,
  GP_SURFACE,
  GP_TURBO_ACCEL,
  GP_TURBO_GAIN,
  GP_TURBO_PASS_GRACE,
  GP_TURBO_SEC,
  GP_VALID_EVERY,
  GP_VMAX,
  GP_WALL_KEEP,
  GP_WEAR_BRAKE,
  GP_WEAR_DIST,
  GP_WEAR_OFF,
  GP_WEAR_SLIP,
  type GpSurface,
} from './constants';
import { gpTrack, type GpTrack, type GpTrackDef } from './track';

/** Quem corre: id, nome na tela, cor do pelo (a pintura do carro segue) e se é bot. */
export interface GpPlayerInfo {
  id: string;
  name: string;
  color: number;
  bot?: boolean;
}

/** O que o piloto aperta: acelerar e frear de 0 a 1, volante de −1 (esquerda) a 1 (direita), turbo. */
export interface GpInput {
  throttle: number;
  brake: number;
  steer: number;
  turbo: boolean;
}

export const GP_IDLE: GpInput = { throttle: 0, brake: 0, steer: 0, turbo: false };

export type GpPhase = 'quali' | 'race';

export interface GpCar {
  id: string;
  name: string;
  color: number;
  bot: boolean;
  slot: number;
  x: number;
  z: number;
  /** Direção: o carro olha para (sen h, −cos h). */
  h: number;
  vx: number;
  vz: number;
  /** Velocidade para a frente (com sinal: negativa de ré). */
  speed: number;
  /** Amostra da pista mais perto, distância no traçado e afastamento do centro. */
  idx: number;
  s: number;
  d: number;
  /** Distância percorrida desde a linha (negativa antes de cruzá-la): é o que ordena a corrida. */
  prog: number;
  surface: GpSurface;
  /** Desgaste do pneu, de 0 (novo) a 1 (gasto). */
  wear: number;
  /** Barra do turbo da cauda, de 0 a 1. */
  bar: number;
  /** Tempo de turbo que ainda resta (s). */
  turbo: number;
  turboEndT: number;
  /** Quanto está no vácuo agora (0 a 1): a cauda balança mais forte. */
  slip: number;
  /** Parado na vaga do box: tempo que falta (s). */
  pitHold: number;
  /** Já parou nesta passagem pelo box (zera quando sai da faixa). */
  pitServed: boolean;
  pitStops: number;
  /** O que apertou no último passo (para o desenho: rodas, freio, cauda). */
  steer: number;
  braking: boolean;
  // tempos
  lapStartT: number;
  laps: number[];
  bestLap: number | null;
  /** Classificação: quando cruzou a linha para começar a volta, o tempo e quando o marcou. */
  qualiStartT: number | null;
  qualiMs: number | null;
  qualiAt: number | null;
  finished: boolean;
  finishMs: number | null;
  dnf: boolean;
  /** Saiu (desconectou): some da pista. */
  gone: boolean;
  /** Ultrapassagens feitas com o turbo. */
  passes: number;
  /** Tempo (s) em que chegou a cada 10 m de corrida (para a diferença ao líder). */
  marks: number[];
  /** Fantasma: sem colisão com ninguém (classificação). */
  ghost: boolean;
  /** Online: carro de outra pessoa, desenhado pelo que ela relata (o motor não o simula). */
  remote: boolean;
  lastValid: { x: number; z: number; h: number; prog: number; idx: number };
  validT: number;
  stepN: number;
}

export type GpEvent =
  | { type: 'lap'; id: string; lap: number; ms: number }
  | { type: 'finish'; id: string; place: number; ms: number }
  | { type: 'qtime'; id: string; ms: number }
  | { type: 'turbo'; id: string }
  | { type: 'ready'; id: string }
  | { type: 'pitin'; id: string }
  | { type: 'pitout'; id: string }
  | { type: 'cut'; id: string }
  | { type: 'wall'; id: string; speed: number }
  | { type: 'bump'; a: string; b: string; force: number }
  | { type: 'pass'; id: string; turbo: boolean }
  | { type: 'dnf'; id: string };

export interface GpStanding {
  car: GpCar;
  pos: number;
  /** Diferença para o líder (s); null para o próprio líder ou sem referência. */
  gap: number | null;
}

/** Estado relatado de um carro de outra pessoa (online). */
export interface GpRemoteState {
  x: number;
  z: number;
  h: number;
  speed: number;
  prog: number;
  turbo: boolean;
  slip: number;
  wear: number;
  steer: number;
  pit: boolean;
}

const MARK = 10;

/**
 * Grid de largada pela classificação: do menor para o maior tempo; empate, larga na frente quem marcou primeiro; quem não
 * marcou tempo larga no fim (na ordem das vagas). Devolve os ids na ordem do grid.
 */
export function gpGridOrder(
  rows: readonly { id: string; slot: number; ms: number | null; at: number | null }[],
): string[] {
  return [...rows]
    .sort((a, b) => {
      if (a.ms === null && b.ms === null) return a.slot - b.slot;
      if (a.ms === null) return 1;
      if (b.ms === null) return -1;
      return a.ms - b.ms || (a.at ?? 0) - (b.at ?? 0) || a.slot - b.slot;
    })
    .map((r) => r.id);
}

/** Lugar do grid: o 1º um pouco antes da linha, cada um mais para trás, lados alternados. */
export function gpGridSpot(track: GpTrack, place: number) {
  const s = GP_GRID_FIRST - GP_GRID_GAP * place;
  const d = place % 2 === 0 ? -GP_GRID_SIDE : GP_GRID_SIDE;
  return { ...track.pointAt(s, d), s, d };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * O Fox GP (spec 078): a corrida inteira, determinística, num passo fixo. Não sabe nada de tela nem de rede; quem desenha
 * lê os carros e os eventos. Online, só o próprio carro é simulado; os outros chegam por `setRemote`.
 */
export class GpWorld {
  readonly track: GpTrack;
  readonly cars: GpCar[];
  phase: GpPhase = 'quali';
  /** Segundos desde o começo da fase (na corrida, desde que as luzes apagaram). */
  t = 0;
  ended = false;
  /** Hora (s) em que o primeiro terminou a corrida. */
  firstFinishT: number | null = null;
  /** Volta mais rápida da corrida. */
  fastest: { id: string; ms: number } | null = null;
  private events: GpEvent[] = [];
  private order = new Map<string, number>();
  private finishedCount = 0;
  meId: string | null = null;

  constructor(
    readonly seed: string,
    infos: readonly GpPlayerInfo[],
    def?: GpTrackDef,
  ) {
    this.track = gpTrack(def);
    this.cars = infos.map((p, slot) => this.newCar(p, slot));
    this.beginQuali();
  }

  private newCar(p: GpPlayerInfo, slot: number): GpCar {
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      bot: !!p.bot,
      slot,
      x: 0,
      z: 0,
      h: 0,
      vx: 0,
      vz: 0,
      speed: 0,
      idx: 0,
      s: 0,
      d: 0,
      prog: 0,
      surface: 'asphalt',
      wear: 0,
      bar: 0,
      turbo: 0,
      turboEndT: -99,
      slip: 0,
      pitHold: 0,
      pitServed: false,
      pitStops: 0,
      steer: 0,
      braking: false,
      lapStartT: 0,
      laps: [],
      bestLap: null,
      qualiStartT: null,
      qualiMs: null,
      qualiAt: null,
      finished: false,
      finishMs: null,
      dnf: false,
      gone: false,
      passes: 0,
      marks: [],
      ghost: true,
      remote: false,
      lastValid: { x: 0, z: 0, h: 0, prog: 0, idx: 0 },
      validT: 0,
      stepN: 0,
    };
  }

  car(id: string): GpCar | undefined {
    return this.cars.find((c) => c.id === id);
  }

  /** Online: só este carro é simulado aqui; os outros são desenhados pelo que relatam. */
  goOnline(meId: string) {
    this.meId = meId;
    for (const c of this.cars) c.remote = c.id !== meId;
  }

  private place(c: GpCar, s: number, d: number) {
    const p = this.track.pointAt(s, d);
    c.x = p.x;
    c.z = p.z;
    c.h = p.h;
    c.vx = 0;
    c.vz = 0;
    c.speed = 0;
    const pr = this.track.projectGlobal(c.x, c.z);
    c.idx = pr.i;
    c.s = pr.s;
    c.d = pr.d;
    c.prog = s;
    c.surface = this.track.surface(pr);
    c.lastValid = { x: c.x, z: c.z, h: c.h, prog: c.prog, idx: c.idx };
    c.validT = 0;
  }

  private resetRun(c: GpCar) {
    c.wear = 0;
    c.bar = 0;
    c.turbo = 0;
    c.turboEndT = -99;
    c.slip = 0;
    c.pitHold = 0;
    c.pitServed = false;
    c.pitStops = 0;
    c.lapStartT = 0;
    c.laps = [];
    c.bestLap = null;
    c.finished = false;
    c.finishMs = null;
    c.dnf = false;
    c.passes = 0;
    c.marks = [];
    c.stepN = 0;
  }

  /** Classificação: todos ao mesmo tempo, cada um como fantasma, antes da linha para a volta lançada. */
  beginQuali() {
    this.phase = 'quali';
    this.t = 0;
    this.ended = false;
    this.events = [];
    for (const c of this.cars) {
      this.resetRun(c);
      c.qualiStartT = null;
      c.qualiMs = null;
      c.qualiAt = null;
      c.ghost = true;
      this.place(c, GP_QUALI_SPAWN, 0);
    }
  }

  /** A classificação acabou: todos marcaram tempo (ou saíram) ou o tempo máximo passou. */
  qualiDone(): boolean {
    if (this.t >= GP_QUALI_MAX_SEC) return true;
    return this.cars.every((c) => c.gone || c.qualiMs !== null);
  }

  /** Resultado da classificação na ordem do grid. */
  gridOrder(): string[] {
    return gpGridOrder(
      this.cars
        .filter((c) => !c.gone)
        .map((c) => ({ id: c.id, slot: c.slot, ms: c.qualiMs, at: c.qualiAt })),
    );
  }

  /** Corrida: cada carro no seu lugar do grid (ordem = ids do 1º ao último). Quem não está na ordem vai para o fim. */
  beginRace(order: readonly string[]) {
    this.phase = 'race';
    this.t = 0;
    this.ended = false;
    this.firstFinishT = null;
    this.fastest = null;
    this.finishedCount = 0;
    this.events = [];
    const rest = this.cars.filter((c) => !order.includes(c.id)).map((c) => c.id);
    [...order, ...rest].forEach((id, place) => {
      const c = this.car(id);
      if (!c) return;
      this.resetRun(c);
      c.ghost = false;
      const spot = gpGridSpot(this.track, place);
      this.place(c, spot.s, spot.d);
    });
    this.order.clear();
    this.standings().forEach((r) => this.order.set(r.car.id, r.pos));
  }

  drainEvents(): GpEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Um passo da simulação. `inputs` só precisa ter os carros simulados aqui. */
  step(dt: number, inputs: Readonly<Record<string, GpInput>>) {
    if (this.ended) return;
    this.t += dt;
    for (const c of this.cars) {
      if (c.gone || c.remote) continue;
      this.stepCar(c, inputs[c.id] ?? GP_IDLE, dt);
    }
    if (this.phase === 'race') {
      this.collide();
      this.slipstream(dt);
      this.ranks();
      this.checkEnd();
    }
  }

  /** Aderência total agora: superfície × pneu. */
  gripOf(c: GpCar): number {
    return GP_SURFACE[c.surface].grip * (1 - c.wear * (1 - GP_GRIP_MIN));
  }

  /** Velocidade máxima agora (superfície, turbo). */
  vmaxOf(c: GpCar): number {
    const base = GP_VMAX * GP_SURFACE[c.surface].vmax;
    return c.turbo > 0 && c.surface !== 'pit' ? base * (1 + GP_TURBO_GAIN) : base;
  }

  private stepCar(c: GpCar, inp: GpInput, dt: number) {
    c.stepN += 1;
    const racing = this.phase === 'race';
    const done = racing && c.finished;
    // ---- box: parado na vaga ----
    if (c.pitHold > 0) {
      c.pitHold -= dt;
      c.vx = 0;
      c.vz = 0;
      c.speed = 0;
      if (c.pitHold <= 0) {
        c.pitHold = 0;
        c.wear = 0;
        c.pitServed = true;
        c.pitStops += 1;
        this.events.push({ type: 'pitout', id: c.id });
      }
      this.track_(c, dt, racing);
      return;
    }
    // quem já terminou só desacelera e segue a pista sozinho (o "piloto automático" da volta de desaceleração)
    const input: GpInput = done ? this.cruise(c) : inp;
    const fx = Math.sin(c.h);
    const fz = -Math.cos(c.h);
    const rx = Math.cos(c.h);
    const rz = Math.sin(c.h);
    let vf = c.vx * fx + c.vz * fz;
    let vl = c.vx * rx + c.vz * rz;
    const grip = this.gripOf(c);
    const brakeK = 1 - c.wear * (1 - GP_BRAKE_MIN);
    const vmax = this.vmaxOf(c);

    // ---- turbo ----
    if (input.turbo && c.bar >= 1 && c.turbo <= 0 && racing && !done) {
      c.turbo = GP_TURBO_SEC;
      c.bar = 0;
      this.events.push({ type: 'turbo', id: c.id });
    }
    if (c.turbo > 0) {
      c.turbo -= dt;
      if (c.turbo <= 0) {
        c.turbo = 0;
        c.turboEndT = this.t;
      }
    }

    // ---- volante: gira mais devagar parado e em alta velocidade ----
    const steer = clamp(input.steer, -1, 1);
    const sv = Math.abs(vf);
    const steerK =
      sv < GP_STEER_FULL_V
        ? sv / GP_STEER_FULL_V
        : 1 / (1 + (sv - GP_STEER_FULL_V) / GP_STEER_FALL);
    c.h += steer * GP_STEER_RATE * steerK * Math.sign(vf || 1) * dt;
    c.steer = steer;

    // ---- acelerar, frear, ré ----
    const throttle = clamp(input.throttle, 0, 1);
    const brake = clamp(input.brake, 0, 1);
    c.braking = brake > 0.1 && vf > 1;
    if (brake > 0.1 && vf > 0.5) {
      vf = Math.max(0, vf - GP_BRAKE * brakeK * brake * dt);
      if (vf > 12) c.wear += GP_WEAR_BRAKE * brake * dt;
    } else if (brake > 0.1 && vf <= 0.5) {
      vf = Math.max(-GP_REVERSE_MAX, vf - GP_REVERSE_ACCEL * brake * dt);
    } else if (throttle > 0.05) {
      if (vf < 0) vf = Math.min(0, vf + GP_BRAKE * dt);
      else if (vf < vmax) {
        const f = 1 - (vf / vmax) ** 2;
        const boost = c.turbo > 0 ? GP_TURBO_ACCEL : 0;
        vf = Math.min(vmax, vf + (GP_ACCEL * f + boost) * throttle * dt);
      }
    } else {
      vf -= vf * GP_COAST * dt;
      if (Math.abs(vf) < 0.05) vf = 0;
    }
    // acima da máxima da superfície (entrou na grama rápido, saiu do turbo, entrou no box): perde velocidade
    if (vf > vmax) vf = Math.max(vmax, vf - GP_OVER_DECEL * dt);

    // ---- aderência: corrige o escorregão até o limite do pneu; o resto vira derrapagem ----
    const fix = GP_LAT_ACC * grip * dt;
    vl = Math.abs(vl) <= fix ? 0 : vl - Math.sign(vl) * fix;
    vl -= vl * GP_SLIP_DAMP * dt;
    if (Math.abs(vl) > 0.3) {
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), GP_SLIDE_DRAG * Math.abs(vl) * dt * 10);
      c.wear += GP_WEAR_SLIP * Math.abs(vl) * dt;
    }

    // a nova direção do carro: a velocidade para a frente segue o nariz; a de lado fica (é o escorregão)
    const nfx = Math.sin(c.h);
    const nfz = -Math.cos(c.h);
    const nrx = Math.cos(c.h);
    const nrz = Math.sin(c.h);
    c.vx = nfx * vf + nrx * vl;
    c.vz = nfz * vf + nrz * vl;
    c.speed = vf;
    c.x += c.vx * dt;
    c.z += c.vz * dt;
    // desgaste pelo caminho
    c.wear += GP_WEAR_DIST * Math.abs(vf) * dt;
    if (c.surface === 'grass' || c.surface === 'gravel') c.wear += GP_WEAR_OFF * dt;
    c.wear = Math.min(1, c.wear);

    this.track_(c, dt, racing);
  }

  /** Volta de desaceleração: segue o meio da pista devagar. */
  private cruise(c: GpCar): GpInput {
    const p = this.track.pointAt(c.s + 10 + Math.abs(c.speed) * 0.5, 0);
    const want = Math.atan2(p.x - c.x, -(p.z - c.z));
    const diff = Math.atan2(Math.sin(want - c.h), Math.cos(want - c.h));
    return {
      throttle: c.speed < 14 ? 0.6 : 0,
      brake: c.speed > 18 ? 0.4 : 0,
      steer: clamp(diff * 2.5, -1, 1),
      turbo: false,
    };
  }

  /** Atualiza onde o carro está na pista: superfície, barreira, corte, box, voltas. */
  private track_(c: GpCar, dt: number, racing: boolean) {
    const tr = this.track;
    const before = c.s;
    let p = tr.project(c.x, c.z, c.idx);
    // ---- barreira de pneus: segura o carro no limite ----
    if (Math.abs(p.d) > GP_LIMIT && tr.wallOn(p.i, p.d)) {
      const back = Math.abs(p.d) - GP_LIMIT;
      const nx = -tr.tz[p.i]! * Math.sign(p.d);
      const nz = tr.tx[p.i]! * Math.sign(p.d);
      c.x -= nx * back;
      c.z -= nz * back;
      const vn = c.vx * nx + c.vz * nz;
      const hit = Math.hypot(c.vx, c.vz);
      if (vn > 0) {
        c.vx -= nx * vn;
        c.vz -= nz * vn;
      }
      c.vx *= GP_WALL_KEEP ** (dt * 6);
      c.vz *= GP_WALL_KEEP ** (dt * 6);
      c.speed = c.vx * Math.sin(c.h) - c.vz * Math.cos(c.h);
      if (hit > 4 && vn > 2) this.events.push({ type: 'wall', id: c.id, speed: hit });
      p = tr.project(c.x, c.z, p.i);
    }
    c.idx = p.i;
    c.s = p.s;
    c.d = p.d;
    c.surface = tr.surface(p);
    const prev = c.prog;
    c.prog += tr.delta(before, p.s);

    // ---- corte de caminho ----
    let cut = false;
    const offTrack = Math.abs(p.d) > GP_HALF_WIDTH + GP_KERB_W + GP_CUT_OFF;
    if (tr.noCut[p.i] === 1 && offTrack && c.surface !== 'pit') cut = true;
    if (!cut && c.stepN % 12 === 0) {
      const g = tr.projectGlobal(c.x, c.z);
      const jump = tr.delta(p.s, g.s);
      if (Math.abs(jump) > GP_CUT_JUMP && g.dist + 4 < p.dist) cut = true;
    }
    if (cut) {
      const v = c.lastValid;
      c.x = v.x;
      c.z = v.z;
      c.h = v.h;
      c.vx = 0;
      c.vz = 0;
      c.speed = 0;
      c.idx = v.idx;
      const q = tr.project(c.x, c.z, v.idx);
      c.s = q.s;
      c.d = q.d;
      c.prog = v.prog;
      c.surface = tr.surface(q);
      this.events.push({ type: 'cut', id: c.id });
      return;
    }
    // o último ponto válido: no asfalto ou na zebra, andando para a frente
    c.validT += dt;
    if (
      c.validT >= GP_VALID_EVERY &&
      (c.surface === 'asphalt' || c.surface === 'kerb' || c.surface === 'pit') &&
      c.prog >= c.lastValid.prog
    ) {
      c.validT = 0;
      const tp = tr.pointAt(c.s, c.d);
      c.lastValid = { x: c.x, z: c.z, h: tp.h, prog: c.prog, idx: c.idx };
    }

    // ---- box ----
    if (c.surface !== 'pit') c.pitServed = false;
    else if (!c.pitServed && c.pitHold <= 0 && tr.inBox(c.s, c.d)) {
      c.pitHold = GP_PIT_STOP_SEC;
      c.vx = 0;
      c.vz = 0;
      c.speed = 0;
      this.events.push({ type: 'pitin', id: c.id });
    }

    // ---- tempos ----
    const L = tr.length;
    const cross = (line: number) => prev < line && c.prog >= line;
    const at = (line: number) => {
      const f = (line - prev) / Math.max(1e-9, c.prog - prev);
      return this.t - dt + f * dt;
    };
    if (this.phase === 'quali') {
      if (c.qualiMs === null && c.qualiStartT === null && cross(0)) c.qualiStartT = at(0);
      if (c.qualiMs === null && c.qualiStartT !== null && cross(L)) {
        const tt = at(L);
        c.qualiMs = Math.round((tt - c.qualiStartT) * 1000);
        c.qualiAt = tt;
        this.events.push({ type: 'qtime', id: c.id, ms: c.qualiMs });
      }
      return;
    }
    if (!racing || c.finished) return;
    if (c.prog >= 0) {
      const m = Math.floor(c.prog / MARK);
      while (c.marks.length <= m) c.marks.push(this.t);
    }
    for (let k = c.laps.length + 1; k <= GP_LAPS; k++) {
      if (!cross(k * L)) break;
      const tt = at(k * L);
      const ms = Math.round((tt - c.lapStartT) * 1000);
      c.laps.push(ms);
      c.lapStartT = tt;
      if (c.bestLap === null || ms < c.bestLap) c.bestLap = ms;
      if (this.fastest === null || ms < this.fastest.ms) this.fastest = { id: c.id, ms };
      this.events.push({ type: 'lap', id: c.id, lap: k, ms });
      if (k === GP_LAPS) this.finishCar(c, Math.round(tt * 1000));
    }
  }

  private finishCar(c: GpCar, ms: number) {
    if (c.finished) return;
    c.finished = true;
    c.finishMs = ms;
    this.finishedCount += 1;
    if (this.firstFinishT === null) this.firstFinishT = ms / 1000;
    this.events.push({ type: 'finish', id: c.id, place: this.finishedCount, ms });
  }

  /** Online: a sala confirmou que esta pessoa terminou (os outros carros não são simulados aqui). */
  applyFinish(id: string, ms: number) {
    const c = this.car(id);
    if (!c || c.finished) return;
    this.finishCar(c, ms);
  }

  /** Online: a sala deu esta pessoa como fora (desconectou ou DNF). */
  markGone(id: string) {
    const c = this.car(id);
    if (!c || c.gone) return;
    c.gone = true;
    c.dnf = !c.finished;
  }

  /** Online: o relato mais recente do carro de outra pessoa (já suavizado por quem chama). */
  setRemote(id: string, st: GpRemoteState) {
    const c = this.car(id);
    if (!c || !c.remote) return;
    c.x = st.x;
    c.z = st.z;
    c.h = st.h;
    c.speed = st.speed;
    c.vx = Math.sin(st.h) * st.speed;
    c.vz = -Math.cos(st.h) * st.speed;
    c.prog = st.prog;
    c.turbo = st.turbo ? 1 : 0;
    c.slip = st.slip;
    c.wear = st.wear;
    c.steer = st.steer;
    const p = this.track.project(c.x, c.z, c.idx, 80);
    c.idx = p.i;
    c.s = p.s;
    c.d = p.d;
    c.surface = st.pit ? 'pit' : this.track.surface(p);
    if (this.phase === 'race' && !c.finished && c.prog >= 0) {
      const m = Math.floor(c.prog / MARK);
      while (c.marks.length <= m) c.marks.push(this.t);
    }
  }

  // ---- entre carros ----

  private circles(c: GpCar): [number, number, number, number] {
    const fx = Math.sin(c.h) * GP_CAR_HALF;
    const fz = -Math.cos(c.h) * GP_CAR_HALF;
    return [c.x + fx, c.z + fz, c.x - fx, c.z - fz];
  }

  /** Batida: os carros se empurram (ninguém roda). Online, cada aparelho mexe só o próprio carro. */
  private collide() {
    const live = this.cars.filter((c) => !c.gone && !c.ghost && c.pitHold <= 0);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i]!;
        const b = live[j]!;
        if (a.remote && b.remote) continue;
        if (Math.abs(a.x - b.x) > 6 || Math.abs(a.z - b.z) > 6) continue;
        const ca = this.circles(a);
        const cb = this.circles(b);
        let best: { o: number; nx: number; nz: number } | null = null;
        for (let p = 0; p < 2; p++) {
          for (let q = 0; q < 2; q++) {
            const dx = cb[q * 2]! - ca[p * 2]!;
            const dz = cb[q * 2 + 1]! - ca[p * 2 + 1]!;
            const dist = Math.hypot(dx, dz);
            const o = GP_CAR_R * 2 - dist;
            if (o > 0 && (!best || o > best.o)) {
              const len = dist || 1;
              best = { o, nx: dist ? dx / len : 1, nz: dist ? dz / len : 0 };
            }
          }
        }
        if (!best) continue;
        const { o, nx, nz } = best;
        // quem é simulado aqui sai do caminho; online o outro aparelho faz a parte dele
        const wa = a.remote ? 0 : b.remote ? 0.5 : 0.5;
        const wb = b.remote ? 0 : a.remote ? 0.5 : 0.5;
        a.x -= nx * o * wa;
        a.z -= nz * o * wa;
        b.x += nx * o * wb;
        b.z += nz * o * wb;
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rel < 0) {
          const jv = (-(1 + GP_BUMP_E) * rel) / 2;
          if (!a.remote) {
            a.vx -= nx * jv;
            a.vz -= nz * jv;
            a.speed = a.vx * Math.sin(a.h) - a.vz * Math.cos(a.h);
          }
          if (!b.remote) {
            b.vx += nx * jv;
            b.vz += nz * jv;
            b.speed = b.vx * Math.sin(b.h) - b.vz * Math.cos(b.h);
          }
          if (jv > 0.8) this.events.push({ type: 'bump', a: a.id, b: b.id, force: jv });
        }
      }
    }
  }

  /** Vácuo: logo atrás de outro carro e alinhado, a barra do turbo enche. O líder nunca enche. */
  private slipstream(dt: number) {
    for (const c of this.cars) {
      if (c.remote || c.gone || c.finished) continue;
      c.slip = 0;
      if (c.turbo > 0 || c.bar >= 1 || c.speed < GP_SLIP_MIN_V) continue;
      if ((this.order.get(c.id) ?? 1) <= 1) continue;
      const fx = Math.sin(c.h);
      const fz = -Math.cos(c.h);
      let best = 0;
      for (const o of this.cars) {
        if (o === c || o.gone || o.pitHold > 0) continue;
        const dx = o.x - c.x;
        const dz = o.z - c.z;
        const along = dx * fx + dz * fz;
        if (along < 2.5 || along > GP_SLIP_LEN) continue;
        const lat = Math.abs(dx * fz * -1 + dz * fx);
        if (lat > GP_SLIP_W) continue;
        if (Math.cos(o.h - c.h) < 0.85) continue;
        best = Math.max(best, 1 - (along - 2.5) / (GP_SLIP_LEN - 2.5));
      }
      if (best <= 0) continue;
      c.slip = best;
      const rate = GP_SLIP_FILL_FAR + (GP_SLIP_FILL_NEAR - GP_SLIP_FILL_FAR) * best;
      c.bar = Math.min(1, c.bar + rate * dt);
      if (c.bar >= 1) this.events.push({ type: 'ready', id: c.id });
    }
  }

  /** Posições e ultrapassagens com o turbo. */
  private ranks() {
    const st = this.standings();
    for (const r of st) {
      const was = this.order.get(r.car.id);
      const c = r.car;
      if (
        was !== undefined &&
        r.pos < was &&
        !c.finished &&
        !c.remote &&
        (c.turbo > 0 || this.t - c.turboEndT < GP_TURBO_PASS_GRACE)
      ) {
        c.passes += was - r.pos;
        this.events.push({ type: 'pass', id: c.id, turbo: true });
      }
      this.order.set(c.id, r.pos);
    }
  }

  /** A corrida acaba quando todos cruzam a linha, ou 30 s depois do primeiro (o resto é DNF). */
  private checkEnd() {
    const live = this.cars.filter((c) => !c.gone);
    if (live.length === 0) {
      this.ended = true;
      return;
    }
    // online quem decide o fim é a sala
    if (this.meId !== null) return;
    if (live.every((c) => c.finished)) {
      this.ended = true;
      return;
    }
    if (this.firstFinishT !== null && this.t >= this.firstFinishT + GP_DNF_SEC) {
      for (const c of live) {
        if (!c.finished) {
          c.dnf = true;
          this.events.push({ type: 'dnf', id: c.id });
        }
      }
      this.ended = true;
    }
  }

  /** Online: a sala encerrou a corrida (quem não terminou é DNF). */
  endNow() {
    for (const c of this.cars) if (!c.finished) c.dnf = true;
    this.ended = true;
  }

  /** Posição de cada um agora: quem terminou pela hora da chegada; os outros pela distância; quem saiu por último. */
  standings(): GpStanding[] {
    const list = [...this.cars].sort((a, b) => {
      if (a.gone !== b.gone) return a.gone ? 1 : -1;
      if (a.finished && b.finished) return (a.finishMs ?? 0) - (b.finishMs ?? 0);
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.prog - a.prog || a.slot - b.slot;
    });
    const leader = list[0];
    return list.map((car, i) => {
      let gap: number | null = null;
      if (leader && car !== leader && this.phase === 'race') {
        if (car.finished && leader.finished)
          gap = ((car.finishMs ?? 0) - (leader.finishMs ?? 0)) / 1000;
        else if (car.prog >= 0) {
          const m = leader.marks[Math.floor(car.prog / MARK)];
          if (m !== undefined) gap = Math.max(0, this.t - m);
        }
      }
      return { car, pos: i + 1, gap };
    });
  }
}

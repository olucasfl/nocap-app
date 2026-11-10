import {
  GP_BRAKE,
  GP_BRAKE_MIN,
  GP_BRAKE_RAMP,
  GP_BUMP_E,
  GP_BUMP_MU,
  GP_CAR_HALF,
  GP_CAR_R,
  GP_CUT_JUMP,
  GP_CUT_OFF,
  GP_DNF_SEC,
  GP_DRAG,
  GP_ENGINE,
  GP_GEARS,
  GP_GEAR_TOP,
  GP_GRID_FIRST,
  GP_GRID_GAP,
  GP_GRID_SIDE,
  GP_GRIP_MIN,
  GP_GRIP_TOTAL,
  GP_HALF_WIDTH,
  GP_INERTIA,
  GP_KERB_W,
  GP_LAPS,
  GP_OVER_DECEL,
  GP_PIT_STOP_SEC,
  GP_QUALI_MAX_SEC,
  GP_QUALI_WARMUP,
  GP_REVERSE_ACCEL,
  GP_REVERSE_MAX,
  GP_ROLL,
  GP_ROLL0,
  GP_SLIDE_DRAG,
  GP_SLIP_DAMP,
  GP_SLIP_FILL_FAR,
  GP_SLIP_FILL_NEAR,
  GP_SLIP_LEN,
  GP_SLIP_MIN_V,
  GP_SLIP_W,
  GP_SPIN_DAMP,
  GP_STEER_FALL,
  GP_STEER_FULL_V,
  GP_STEER_RATE,
  GP_SURFACE,
  GP_TURBO_GAIN,
  GP_TURBO_PASS_GRACE,
  GP_TURBO_SEC,
  GP_VALID_EVERY,
  GP_VMAX,
  GP_WALL_E,
  GP_WALL_KEEP,
  GP_WALL_MU,
  GP_WEAR_BRAKE,
  GP_WEAR_DIST,
  GP_WEAR_OFF,
  GP_WEAR_SLIP,
  type GpSurface,
} from './constants';
import { gpTrack, type GpTrack, type GpTrackDef } from './track';

/** Quem corre: id, nome na tela, cor do pelo, pintura do carro (opcional) e se é bot. */
export interface GpPlayerInfo {
  id: string;
  name: string;
  color: number;
  /** Customização do carro (garagem). Sem ela, a pintura segue o pelo. */
  paint?: GpPaint;
  bot?: boolean;
}

/** Customização do carro: cores e desenho da pintura (só visual: todos os carros andam igual). */
export interface GpPaint {
  body: number;
  accent: number;
  pattern: 'solida' | 'faixa' | 'listras' | 'chevron';
  number: number;
}

/** O que o piloto aperta: acelerar e frear de 0 a 1, volante de −1 (esquerda) a 1 (direita), turbo e "iniciar volta". */
export interface GpInput {
  throttle: number;
  brake: number;
  steer: number;
  turbo: boolean;
  /** Classificação: começa a volta lançada agora (fora do box). */
  lap?: boolean;
}

export const GP_IDLE: GpInput = { throttle: 0, brake: 0, steer: 0, turbo: false };

export type GpPhase = 'quali' | 'race';

export interface GpCar {
  id: string;
  name: string;
  color: number;
  paint: GpPaint | null;
  bot: boolean;
  slot: number;
  x: number;
  z: number;
  /** Direção: o carro olha para (sen h, −cos h). */
  h: number;
  vx: number;
  vz: number;
  /** Giro solto do corpo (rad/s), que vem das batidas e some com a aderência. */
  spin: number;
  /** Velocidade para a frente (com sinal: negativa de ré). */
  speed: number;
  /** Marcha (1 a 8; 0 = ré) e giro do motor (0 a 1). */
  gear: number;
  rpm: number;
  /** Quanto do freio está aplicado (sobe aos poucos até o pedido). */
  brakeLevel: number;
  /** Escorregão de lado agora (m/s): marcas e fumaça de pneu. */
  skid: number;
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
  /** Tempo de cada setor da volta de agora e o melhor de cada setor (ms). */
  sectorT: number[];
  sectorStartT: number;
  bestSectors: (number | null)[];
  /** Classificação: quanto já andou aquecendo, quando começou a volta (e de onde), o tempo e quando o marcou. */
  warm: number;
  qualiStartT: number | null;
  qualiStartProg: number;
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
  | { type: 'sector'; id: string; sector: number; ms: number; best: boolean }
  | { type: 'finish'; id: string; place: number; ms: number }
  | { type: 'qstart'; id: string }
  | { type: 'qtime'; id: string; ms: number }
  | { type: 'turbo'; id: string }
  | { type: 'ready'; id: string }
  | { type: 'pitin'; id: string }
  | { type: 'pitout'; id: string }
  | { type: 'cut'; id: string }
  | { type: 'wall'; id: string; speed: number; x: number; z: number }
  | { type: 'bump'; a: string; b: string; force: number; x: number; z: number }
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
  vx?: number;
  vz?: number;
  spin?: number;
  gear?: number;
  skid?: number;
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
const cross = (ax: number, az: number, bx: number, bz: number) => ax * bz - az * bx;

/** Curva de torque do motor pelo giro (0 a 1): forte embaixo, pico no meio e cai no fim. */
export function gpTorque(rpm: number): number {
  const r = clamp(rpm, 0, 1);
  return 0.74 + 0.26 * Math.sin(Math.PI * Math.min(1, r * 1.05));
}

/** Marcha automática pela velocidade (troca para cima perto do giro máximo, reduz com folga). */
export function gpAutoGear(current: number, v: number): number {
  let g = Math.max(1, Math.min(GP_GEARS.length, current || 1));
  while (g < GP_GEARS.length && v > GP_GEAR_TOP[g - 1]! * 0.95) g++;
  while (g > 1 && v < GP_GEAR_TOP[g - 2]! * 0.62) g--;
  return g;
}

/**
 * O Fox GP (specs 078 e 079): a corrida inteira, determinística, num passo fixo. Não sabe nada de tela nem de rede; quem
 * desenha lê os carros e os eventos. Online o aparelho do líder simula todos os carros (`GpHost`); os outros preveem o
 * próprio carro (`GpClient`) e desenham os outros pelo que o líder manda.
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
  /** Desligado: quem decide o fim e o DNF é a sala (online). */
  autoEnd = true;
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
      paint: p.paint ?? null,
      bot: !!p.bot,
      slot,
      x: 0,
      z: 0,
      h: 0,
      vx: 0,
      vz: 0,
      spin: 0,
      speed: 0,
      gear: 1,
      rpm: 0,
      brakeLevel: 0,
      skid: 0,
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
      sectorT: [],
      sectorStartT: 0,
      bestSectors: [null, null, null],
      warm: 0,
      qualiStartT: null,
      qualiStartProg: 0,
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
    this.autoEnd = false;
    for (const c of this.cars) c.remote = c.id !== meId;
  }

  private place(c: GpCar, s: number, d: number) {
    const p = this.track.pointAt(s, d);
    c.x = p.x;
    c.z = p.z;
    c.h = p.h;
    c.vx = 0;
    c.vz = 0;
    c.spin = 0;
    c.speed = 0;
    c.gear = 1;
    c.brakeLevel = 0;
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
    c.sectorT = [];
    c.sectorStartT = 0;
    c.bestSectors = [null, null, null];
    c.finished = false;
    c.finishMs = null;
    c.dnf = false;
    c.passes = 0;
    c.marks = [];
    c.stepN = 0;
    c.skid = 0;
  }

  /**
   * Classificação (decisão de 10/11/2026): todos saem do box ao mesmo tempo, como fantasmas, aquecem à vontade e começam a
   * própria volta lançada quando quiserem (pelo botão, ou cruzando a linha depois do aquecimento). Vale uma volta.
   */
  beginQuali() {
    this.phase = 'quali';
    this.t = 0;
    this.ended = false;
    this.events = [];
    const pit = this.track.pit;
    for (const c of this.cars) {
      this.resetRun(c);
      c.warm = 0;
      c.qualiStartT = null;
      c.qualiStartProg = 0;
      c.qualiMs = null;
      c.qualiAt = null;
      c.ghost = true;
      // saindo da vaga do box: já serviu o box nesta passagem (não para de novo)
      const s = pit.box + 4;
      this.place(c, s, this.track.pitCenter(s) ?? 0);
      c.pitServed = true;
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

  /**
   * Um passo da simulação. `inputs` só precisa ter os carros simulados aqui. Com `only`, só aquele carro anda (os outros
   * ficam parados no lugar, como obstáculos): é o que o aparelho usa para refazer a previsão do próprio carro.
   */
  step(dt: number, inputs: Readonly<Record<string, GpInput>>, only?: string) {
    if (this.ended) return;
    if (!only) this.t += dt;
    for (const c of this.cars) {
      if (c.gone || (only ? c.id !== only : c.remote)) continue;
      this.stepCar(c, inputs[c.id] ?? GP_IDLE, dt);
    }
    if (this.phase === 'race') {
      this.collide(only);
      if (!only) {
        this.slipstream(dt);
        this.ranks();
        this.checkEnd();
      }
    }
  }

  /** Aderência agora: superfície × pneu. */
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
      c.spin = 0;
      c.speed = 0;
      if (c.pitHold <= 0) {
        c.pitHold = 0;
        c.wear = 0;
        c.pitServed = true;
        c.pitStops += 1;
        this.events.push({ type: 'pitout', id: c.id });
      }
      this.trackCar(c, dt, racing);
      return;
    }
    // quem já terminou só desacelera e segue a pista sozinho (a volta de desaceleração)
    const input: GpInput = done ? this.cruise(c) : inp;
    // classificação: "iniciar volta" pelo botão (fora do box)
    if (
      this.phase === 'quali' &&
      input.lap &&
      c.qualiStartT === null &&
      c.qualiMs === null &&
      c.surface !== 'pit'
    )
      this.startQualiLap(c, this.t, c.prog);

    // velocidade para a frente (antes de virar o nariz): só para o volante saber quanto pode girar
    const vf0 = c.vx * Math.sin(c.h) - c.vz * Math.cos(c.h);
    const grip = this.gripOf(c);
    const total = GP_GRIP_TOTAL * grip;
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

    // ---- volante: gira mais devagar parado e em alta velocidade; o giro solto das batidas soma e some com a aderência ----
    const steer = clamp(input.steer, -1, 1);
    const sv = Math.abs(vf0);
    const steerK =
      sv < GP_STEER_FULL_V ? sv / GP_STEER_FULL_V : 1 / (1 + (sv - GP_STEER_FULL_V) / GP_STEER_FALL);
    c.h += (steer * GP_STEER_RATE * steerK * Math.sign(vf0 || 1) + c.spin) * dt;
    c.spin *= Math.exp(-GP_SPIN_DAMP * Math.max(0.2, grip) * dt);
    if (Math.abs(c.spin) < 1e-3) c.spin = 0;
    c.steer = steer;
    // o nariz já virou; a velocidade ainda aponta para onde ia: o pneu é que a traz para o nariz (até o limite dele)
    const fx = Math.sin(c.h);
    const fz = -Math.cos(c.h);
    const rx = Math.cos(c.h);
    const rz = Math.sin(c.h);
    let vf = c.vx * fx + c.vz * fz;
    let vl = c.vx * rx + c.vz * rz;

    // ---- motor e câmbio automático ----
    const throttle = clamp(input.throttle, 0, 1);
    const brake = clamp(input.brake, 0, 1);
    c.gear = vf < -0.3 ? 0 : gpAutoGear(c.gear, Math.max(0, vf));
    const g = Math.max(1, c.gear);
    const top = GP_GEAR_TOP[g - 1]!;
    c.rpm = clamp(Math.max(0, vf) / top, 0.12, 1);
    const turboK = c.turbo > 0 ? 1.4 : 1;
    let engine = throttle * GP_ENGINE * GP_GEARS[g - 1]! * gpTorque(c.rpm) * turboK;
    // limitador: na última marcha o motor corta no giro máximo
    if (g === GP_GEARS.length && Math.max(0, vf) >= top) engine = 0;
    // pedal de freio progressivo
    const want = brake > 0.05 ? brake : 0;
    c.brakeLevel += clamp(want - c.brakeLevel, -GP_BRAKE_RAMP * 2 * dt, GP_BRAKE_RAMP * dt);
    c.braking = c.brakeLevel > 0.1 && vf > 1;

    // ---- força para a frente (limitada pelo pneu) ----
    let along = 0;
    if (c.brakeLevel > 0.05 && vf > 0.5) {
      along = -Math.min(GP_BRAKE * brakeK * c.brakeLevel, total);
      if (vf > 12) c.wear += GP_WEAR_BRAKE * c.brakeLevel * dt;
    } else if (brake > 0.1 && vf <= 0.5) {
      along = vf > -GP_REVERSE_MAX ? -GP_REVERSE_ACCEL * brake : 0;
    } else if (throttle > 0.05) {
      along = vf < 0 ? GP_BRAKE : Math.min(engine, total);
    }
    // arrasto do ar (menor no turbo: é o vácuo da cauda) e resistência de rolagem
    const drag = (c.turbo > 0 ? GP_DRAG * 0.78 : GP_DRAG) * vf * Math.abs(vf) + GP_ROLL * vf + GP_ROLL0 * Math.sign(vf);
    const nvf = vf + (along - drag) * dt;
    // a rolagem não inverte o sentido sozinha
    vf = Math.sign(nvf) !== Math.sign(vf) && Math.abs(along) < 1e-6 && vf !== 0 ? 0 : nvf;
    if (Math.abs(vf) < 0.03 && Math.abs(along) < 1e-6) vf = 0;
    // fora do asfalto (grama, brita, box) a máxima cai: perde velocidade até ela
    if (GP_SURFACE[c.surface].vmax < 1 && vf > vmax) vf = Math.max(vmax, vf - GP_OVER_DECEL * dt);

    // ---- de lado: o que sobra do pneu (círculo de atrito) corrige o escorregão; o resto vira derrapagem ----
    const latAvail = Math.sqrt(Math.max(0, total * total - along * along));
    const fix = latAvail * dt;
    vl = Math.abs(vl) <= fix ? 0 : vl - Math.sign(vl) * fix;
    vl -= vl * GP_SLIP_DAMP * dt;
    c.skid = Math.abs(vl);
    if (Math.abs(vl) > 0.3) {
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), GP_SLIDE_DRAG * Math.abs(vl) * dt * 10);
      c.wear += GP_WEAR_SLIP * Math.abs(vl) * dt;
    }

    const nfx = Math.sin(c.h);
    const nfz = -Math.cos(c.h);
    const nrx = Math.cos(c.h);
    const nrz = Math.sin(c.h);
    c.vx = nfx * vf + nrx * vl;
    c.vz = nfz * vf + nrz * vl;
    c.speed = vf;
    c.x += c.vx * dt;
    c.z += c.vz * dt;
    c.wear += GP_WEAR_DIST * Math.abs(vf) * dt;
    if (c.surface === 'grass' || c.surface === 'gravel') c.wear += GP_WEAR_OFF * dt;
    c.wear = Math.min(1, c.wear);

    this.trackCar(c, dt, racing);
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

  private startQualiLap(c: GpCar, t: number, prog: number) {
    c.qualiStartT = t;
    c.qualiStartProg = prog;
    c.sectorStartT = t;
    c.sectorT = [];
    this.events.push({ type: 'qstart', id: c.id });
  }

  /** Bate na barreira: impulso com restituição e atrito no ponto de contato (o carro pode girar), e perde velocidade. */
  private hitWall(c: GpCar, nx: number, nz: number, back: number, dt: number) {
    c.x -= nx * back;
    c.z -= nz * back;
    // ponto de contato: a ponta do carro (frente ou trás) mais perto da barreira
    const fx = Math.sin(c.h) * GP_CAR_HALF;
    const fz = -Math.cos(c.h) * GP_CAR_HALF;
    const front = fx * nx + fz * nz >= 0;
    const rxp = (front ? fx : -fx) + nx * GP_CAR_R;
    const rzp = (front ? fz : -fz) + nz * GP_CAR_R;
    // velocidade do ponto de contato (translação + giro)
    const w = c.spin;
    const pvx = c.vx - w * rzp;
    const pvz = c.vz + w * rxp;
    const vn = pvx * nx + pvz * nz;
    const hit = Math.hypot(c.vx, c.vz);
    if (vn > 0) {
      const rn = cross(rxp, rzp, nx, nz);
      const j = ((1 + GP_WALL_E) * vn) / (1 + (rn * rn) / GP_INERTIA);
      c.vx -= nx * j;
      c.vz -= nz * j;
      c.spin -= (rn * j) / GP_INERTIA;
      // atrito de raspar na barreira: freia o deslizamento ao longo dela e gira o carro
      const tx = -nz;
      const tz = nx;
      const vt = pvx * tx + pvz * tz;
      const rt = cross(rxp, rzp, tx, tz);
      const jt = clamp(-vt / (1 + (rt * rt) / GP_INERTIA), -GP_WALL_MU * j, GP_WALL_MU * j);
      c.vx += tx * jt;
      c.vz += tz * jt;
      c.spin += (rt * jt) / GP_INERTIA;
    }
    // barreira de pneus: amortece muito (o carro para no lugar e pode voltar)
    const keep = GP_WALL_KEEP ** (dt * 6);
    c.vx *= keep;
    c.vz *= keep;
    c.speed = c.vx * Math.sin(c.h) - c.vz * Math.cos(c.h);
    if (hit > 4 && vn > 2)
      this.events.push({ type: 'wall', id: c.id, speed: hit, x: c.x + rxp, z: c.z + rzp });
  }

  /** Atualiza onde o carro está na pista: superfície, barreira, corte, box, setores, voltas. */
  private trackCar(c: GpCar, dt: number, racing: boolean) {
    const tr = this.track;
    const before = c.s;
    let p = tr.project(c.x, c.z, c.idx);
    // ---- barreira de pneus ----
    const lim = tr.wallAt(p.i, p.d) - GP_CAR_R * 0.6;
    if (Math.abs(p.d) > lim) {
      const nx = -tr.tz[p.i]! * Math.sign(p.d);
      const nz = tr.tx[p.i]! * Math.sign(p.d);
      this.hitWall(c, nx, nz, Math.abs(p.d) - lim, dt);
      p = tr.project(c.x, c.z, p.i);
    }
    c.idx = p.i;
    c.s = p.s;
    c.d = p.d;
    c.surface = tr.surface(p);
    const prev = c.prog;
    c.prog += tr.delta(before, p.s);
    if (this.phase === 'quali' && c.prog > prev) c.warm += c.prog - prev;

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
      c.spin = 0;
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
    // o último ponto válido: no asfalto, na zebra ou no box, andando para a frente
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
      c.spin = 0;
      c.speed = 0;
      this.events.push({ type: 'pitin', id: c.id });
    }

    // ---- tempos ----
    const L = tr.length;
    const crossed = (line: number) => prev < line && c.prog >= line;
    const at = (line: number) => {
      const f = (line - prev) / Math.max(1e-9, c.prog - prev);
      return this.t - dt + f * dt;
    };
    const sectors = (base: number) => {
      // setores 1 e 2 (o 3 fecha na linha)
      for (let k = 0; k < 2; k++) {
        const line = base + tr.sectorS[k]!;
        if (c.sectorT.length === k && crossed(line)) this.closeSector(c, k, at(line));
      }
    };
    if (this.phase === 'quali') {
      if (c.qualiMs !== null) return;
      if (c.qualiStartT === null) {
        // depois do aquecimento, cruzar a linha começa a volta
        const lineNow = Math.floor(prev / L + 1) * L;
        if (c.warm >= GP_QUALI_WARMUP && crossed(lineNow) && c.surface !== 'pit')
          this.startQualiLap(c, at(lineNow), lineNow);
        return;
      }
      const startLine = c.qualiStartProg;
      // setores só quando a volta começou na linha (do contrário eles não fecham na ordem)
      if (Math.abs(startLine / L - Math.round(startLine / L)) < 1e-9) sectors(startLine);
      if (crossed(startLine + L)) {
        const tt = at(startLine + L);
        c.qualiMs = Math.round((tt - c.qualiStartT) * 1000);
        c.qualiAt = tt;
        if (c.sectorT.length === 2) this.closeSector(c, 2, tt);
        this.events.push({ type: 'qtime', id: c.id, ms: c.qualiMs });
      }
      return;
    }
    if (!racing || c.finished) return;
    if (c.prog >= 0) {
      const m = Math.floor(c.prog / MARK);
      while (c.marks.length <= m) c.marks.push(this.t);
    }
    const lapBase = c.laps.length * L;
    if (c.prog >= 0) sectors(lapBase);
    for (let k = c.laps.length + 1; k <= GP_LAPS; k++) {
      if (!crossed(k * L)) break;
      const tt = at(k * L);
      if (c.sectorT.length === 2) this.closeSector(c, 2, tt);
      c.sectorT = [];
      c.sectorStartT = tt;
      const ms = Math.round((tt - c.lapStartT) * 1000);
      c.laps.push(ms);
      c.lapStartT = tt;
      if (c.bestLap === null || ms < c.bestLap) c.bestLap = ms;
      if (this.fastest === null || ms < this.fastest.ms) this.fastest = { id: c.id, ms };
      this.events.push({ type: 'lap', id: c.id, lap: k, ms });
      if (k === GP_LAPS) this.finishCar(c, Math.round(tt * 1000));
    }
  }

  private closeSector(c: GpCar, k: number, tt: number) {
    const ms = Math.round((tt - c.sectorStartT) * 1000);
    c.sectorT.push(ms);
    c.sectorStartT = tt;
    const best = c.bestSectors[k] === null || ms < (c.bestSectors[k] as number);
    if (best) c.bestSectors[k] = ms;
    this.events.push({ type: 'sector', id: c.id, sector: k, ms, best });
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
    c.vx = st.vx ?? Math.sin(st.h) * st.speed;
    c.vz = st.vz ?? -Math.cos(st.h) * st.speed;
    c.spin = st.spin ?? 0;
    c.gear = st.gear ?? c.gear;
    c.skid = st.skid ?? 0;
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

  /**
   * Batida entre carros como corpos rígidos (massa igual): impulso no ponto de contato com restituição e atrito, que
   * troca velocidade e gera giro (batida de lado gira o carro). Carro de outra pessoa (online) entra como obstáculo de
   * massa infinita: quem decide a batida dele é o líder.
   */
  private collide(only?: string) {
    const live = this.cars.filter((c) => !c.gone && !c.ghost && c.pitHold <= 0);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i]!;
        const b = live[j]!;
        const movA = only ? a.id === only : !a.remote;
        const movB = only ? b.id === only : !b.remote;
        if (!movA && !movB) continue;
        if (Math.abs(a.x - b.x) > 6 || Math.abs(a.z - b.z) > 6) continue;
        const ca = this.circles(a);
        const cb = this.circles(b);
        let best: { o: number; nx: number; nz: number; px: number; pz: number } | null = null;
        for (let p = 0; p < 2; p++) {
          for (let q = 0; q < 2; q++) {
            const ax = ca[p * 2]!;
            const az = ca[p * 2 + 1]!;
            const bx = cb[q * 2]!;
            const bz = cb[q * 2 + 1]!;
            const dx = bx - ax;
            const dz = bz - az;
            const dist = Math.hypot(dx, dz);
            const o = GP_CAR_R * 2 - dist;
            if (o > 0 && (!best || o > best.o)) {
              const nx = dist ? dx / dist : 1;
              const nz = dist ? dz / dist : 0;
              best = { o, nx, nz, px: ax + nx * GP_CAR_R, pz: az + nz * GP_CAR_R };
            }
          }
        }
        if (!best) continue;
        const { o, nx, nz, px, pz } = best;
        const ima = movA ? 1 : 0;
        const imb = movB ? 1 : 0;
        const iia = movA ? 1 / GP_INERTIA : 0;
        const iib = movB ? 1 / GP_INERTIA : 0;
        // separa sem deixar um dentro do outro (quem não anda não se mexe); no máximo um pouco por passo, para um carro de
        // outra pessoa que aparece encostado (rede) não dar um tranco: o resto sai nos passos seguintes
        const share = ima + imb;
        const push = Math.min(o, 0.35);
        a.x -= (nx * push * ima) / share;
        a.z -= (nz * push * ima) / share;
        b.x += (nx * push * imb) / share;
        b.z += (nz * push * imb) / share;
        // velocidade relativa do ponto de contato
        const rax = px - a.x;
        const raz = pz - a.z;
        const rbx = px - b.x;
        const rbz = pz - b.z;
        const vax = a.vx - a.spin * raz;
        const vaz = a.vz + a.spin * rax;
        const vbx = b.vx - b.spin * rbz;
        const vbz = b.vz + b.spin * rbx;
        const rvx = vbx - vax;
        const rvz = vbz - vaz;
        const vn = rvx * nx + rvz * nz;
        if (vn >= 0) continue;
        const ran = cross(rax, raz, nx, nz);
        const rbn = cross(rbx, rbz, nx, nz);
        const k = ima + imb + ran * ran * iia + rbn * rbn * iib;
        const jn = (-(1 + GP_BUMP_E) * vn) / k;
        // atrito: freia o deslizamento entre os dois no ponto de contato
        const tx = -nz;
        const tz = nx;
        const vt = rvx * tx + rvz * tz;
        const rat = cross(rax, raz, tx, tz);
        const rbt = cross(rbx, rbz, tx, tz);
        const kt = ima + imb + rat * rat * iia + rbt * rbt * iib;
        const jt = clamp(-vt / kt, -GP_BUMP_MU * jn, GP_BUMP_MU * jn);
        const ix = nx * jn + tx * jt;
        const iz = nz * jn + tz * jt;
        if (movA) {
          a.vx -= ix * ima;
          a.vz -= iz * ima;
          a.spin -= cross(rax, raz, ix, iz) * iia;
          a.speed = a.vx * Math.sin(a.h) - a.vz * Math.cos(a.h);
        }
        if (movB) {
          b.vx += ix * imb;
          b.vz += iz * imb;
          b.spin += cross(rbx, rbz, ix, iz) * iib;
          b.speed = b.vx * Math.sin(b.h) - b.vz * Math.cos(b.h);
        }
        if (jn > 0.8) this.events.push({ type: 'bump', a: a.id, b: b.id, force: jn, x: px, z: pz });
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
        const lat = Math.abs(-dx * fz + dz * fx);
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
    if (!this.autoEnd) return;
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
      if (this.phase === 'quali') {
        if (a.qualiMs !== null && b.qualiMs !== null) return a.qualiMs - b.qualiMs;
        if ((a.qualiMs !== null) !== (b.qualiMs !== null)) return a.qualiMs !== null ? -1 : 1;
        return a.slot - b.slot;
      }
      if (a.finished && b.finished) return (a.finishMs ?? 0) - (b.finishMs ?? 0);
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.prog - a.prog || a.slot - b.slot;
    });
    const leader = list[0];
    return list.map((car, i) => {
      let gap: number | null = null;
      if (leader && car !== leader) {
        if (this.phase === 'quali') {
          if (car.qualiMs !== null && leader.qualiMs !== null) gap = (car.qualiMs - leader.qualiMs) / 1000;
        } else if (car.finished && leader.finished)
          gap = ((car.finishMs ?? 0) - (leader.finishMs ?? 0)) / 1000;
        else if (car.prog >= 0) {
          const m = leader.marks[Math.floor(car.prog / MARK)];
          if (m !== undefined) gap = Math.max(0, this.t - m);
        }
      }
      return { car, pos: i + 1, gap };
    });
  }

  // ---- estado em números (rede) ----

  /** O estado físico de um carro em números (o líder manda; o aparelho refaz a previsão a partir dele). */
  pack(c: GpCar): number[] {
    return [
      c.x,
      c.z,
      c.h,
      c.vx,
      c.vz,
      c.spin,
      c.prog,
      c.idx,
      c.wear,
      c.bar,
      c.turbo,
      c.pitHold,
      c.pitServed ? 1 : 0,
      c.gear,
      c.brakeLevel,
      c.warm,
      c.qualiStartT ?? -1,
      c.qualiStartProg,
      c.lastValid.x,
      c.lastValid.z,
      c.lastValid.h,
      c.lastValid.prog,
      c.lastValid.idx,
      c.slip,
      c.steer,
      c.skid,
    ];
  }

  /** Põe o carro no estado recebido (o que não está no pacote, como as voltas, segue o que o carro já tem). */
  unpack(c: GpCar, v: readonly number[]) {
    if (v.length < 26) return;
    c.x = v[0]!;
    c.z = v[1]!;
    c.h = v[2]!;
    c.vx = v[3]!;
    c.vz = v[4]!;
    c.spin = v[5]!;
    c.prog = v[6]!;
    c.idx = Math.max(0, Math.min(this.track.n - 1, Math.trunc(v[7]!)));
    c.wear = v[8]!;
    c.bar = v[9]!;
    c.turbo = v[10]!;
    c.pitHold = v[11]!;
    c.pitServed = v[12] === 1;
    c.gear = v[13]!;
    c.brakeLevel = v[14]!;
    c.warm = v[15]!;
    c.qualiStartT = v[16]! < 0 ? null : v[16]!;
    c.qualiStartProg = v[17]!;
    c.lastValid = { x: v[18]!, z: v[19]!, h: v[20]!, prog: v[21]!, idx: Math.trunc(v[22]!) };
    c.slip = v[23]!;
    c.steer = v[24]!;
    c.skid = v[25]!;
    c.speed = c.vx * Math.sin(c.h) - c.vz * Math.cos(c.h);
    const p = this.track.project(c.x, c.z, c.idx);
    c.idx = p.i;
    c.s = p.s;
    c.d = p.d;
    c.surface = this.track.surface(p);
  }
}

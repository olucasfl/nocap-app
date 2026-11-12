import {
  GP_ARC_ACC_K,
  GP_ARC_BAR_FULL_SEC,
  GP_ARC_BAR_MAX,
  GP_ARC_BOOST,
  GP_ARC_BOOST_FADE,
  GP_ARC_BOOST_OFFROAD,
  GP_ARC_BOOST_RISE,
  GP_ARC_BRAKE,
  GP_ARC_COAST,
  GP_ARC_DRIFT_BASE,
  GP_ARC_DRIFT_FILL,
  GP_ARC_DRIFT_FILL_IN,
  GP_ARC_DRIFT_GRACE,
  GP_ARC_DRIFT_IN,
  GP_ARC_DRIFT_MIN,
  GP_ARC_DRIFT_OUT,
  GP_ARC_DRIFT_SPEED,
  GP_ARC_DRIFT_STEER,
  GP_ARC_GRASS_VMAX,
  GP_ARC_GRAVEL_VMAX,
  GP_ARC_HOP_SEC,
  GP_ARC_KERB_VMAX,
  GP_ARC_OVER_DECEL,
  GP_ARC_REVERSE_ACCEL,
  GP_ARC_REVERSE_MAX,
  GP_ARC_TURN_LOSS,
  GP_ARC_TYRE_REBOUND,
  GP_ARC_VMAX,
  GP_ARC_WALL_CD,
  GP_ARC_WALL_KEEP,
  GP_ARC_YAW_FULL_V,
  GP_ARC_YAW_HIGH,
  GP_ARC_YAW_LOW,
  GP_BRAKE_MIN,
  GP_BUMP_E,
  GP_BUMP_KNOCK_DAMP,
  GP_BUMP_MU,
  GP_BUMP_PUSH,
  GP_BUMP_REARM,
  GP_BUMP_SOFT,
  GP_BUMP_SPIN_DAMP,
  GP_BUMP_SPIN_MAX,
  GP_CAR_LEN,
  GP_CAR_R,
  GP_CAR_WALL_IN,
  GP_CAR_WID,
  GP_CUT_JUMP,
  GP_CUT_OFF,
  GP_DNF_SEC,
  GP_DRS_DRAG,
  GP_DRS_FROM_LAP,
  GP_GRID_FIRST,
  GP_GRID_GAP,
  GP_GRID_SIDE,
  GP_GRIP_MIN,
  GP_HALF_WIDTH,
  GP_INERTIA,
  GP_KERB_W,
  GP_LAPS,
  GP_PIT_LIMIT,
  GP_PIT_STOP_SEC,
  GP_QUALI_HOLD_SEC,
  GP_QUALI_MAX_SEC,
  GP_QUALI_START_S,
  GP_REAL_ACC_MAX,
  GP_REAL_ENGINE,
  GP_REAL_GEAR_TOP,
  GP_REAL_SCRUB_MAX,
  GP_GEAR_TOP,
  GP_GEARS,
  GP_REAL_SHIFT_CUT,
  GP_REAL_SHIFT_DOWN,
  GP_REAL_SHIFT_UP,
  GP_REAL_BRK_RATE,
  GP_REAL_DRAG,
  GP_REAL_REVERSE_OUT,
  GP_REAL_REVERSE_OUT0,
  GP_REAL_ROLL,
  GP_REAL_SCRUB,
  GP_REAL_STEER_CENTER,
  GP_REAL_STEER_FADE,
  GP_REAL_STEER_FLIP,
  GP_REAL_STEER_MAX,
  GP_REAL_STEER_RISE,
  GP_REAL_THR_FALL,
  GP_REAL_THR_RISE,
  GP_REVERSE_ACCEL,
  GP_REVERSE_MAX,
  GP_OVER_DECEL,
  GP_REAL_WALL_ALIGN,
  GP_REAL_WALL_CD,
  GP_REAL_WALL_KEEP,
  GP_REAL_WHEELBASE,
  GP_SLIP_DRAG,
  GP_SLIP_LEN,
  GP_SLIP_MIN,
  GP_SLIP_MIN_V,
  GP_SLIP_W,
  GP_SURFACE,
  GP_VALID_EVERY,
  GP_WEAR_BRAKE,
  GP_WEAR_DIST,
  GP_WEAR_OFF,
  GP_WEAR_SLIP,
  gpRealBrake,
  gpRealLatMax,
  gpVmaxOf,
  type GpPhysicsMode,
  type GpSurface,
} from './constants';
import { gpTrack, gpTrackDefFor, type GpTrack, type GpTrackDef } from './track';

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

/** O que o piloto aperta: acelerar e frear de 0 a 1, volante de −1 (esquerda) a 1 (direita), DRS e "iniciar volta". */
export interface GpInput {
  throttle: number;
  brake: number;
  steer: number;
  /** Abre a asa (só dentro da zona, quando liberado). Fecha sozinha ao frear ou sair da zona. */
  drs?: boolean;
  /** Classificação: começa a volta lançada (o carro vai para a largada). */
  lap?: boolean;
  /** Arcade: segurar para derrapar (só entra no drift quando liberado). */
  drift?: boolean;
  /** Arcade: usar o turbo (toque: gasta a barra toda). */
  turbo?: boolean;
}

export const GP_IDLE: GpInput = { throttle: 0, brake: 0, steer: 0 };

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
  /**
   * Realista: empurrão de lado de uma batida (m/s, no mundo), que some sozinho. A velocidade do carro continua para o
   * nariz; isto só desloca o carro um pouco para o lado (`vx`/`vz` já o incluem).
   */
  kx: number;
  kz: number;
  /** Velocidade para a frente (com sinal: negativa de ré). */
  speed: number;
  /** Marcha (1 a 8; 0 = ré) e giro do motor (0 a 1). No Realista são os que movem o carro (não só desenho). */
  gear: number;
  rpm: number;
  /** Realista: corte de força da troca de marcha que ainda falta (s). */
  shiftT: number;
  /** Arcade (kart): drift liberado agora, lado do drift (−1, 0, 1), há quanto tempo derrapa (s) e o pulinho (s). */
  driftAvail: boolean;
  driftDir: number;
  driftT: number;
  hop: number;
  /** Arcade: barra de turbo (0 a 3), nível do turbo em uso (0 a 3), quanto falta dele (s) e o ganho de agora (0 a ~0,55). */
  bar: number;
  boostLevel: number;
  boostT: number;
  boostX: number;
  /** Arcade: o botão de drift e o de turbo estavam apertados no passo anterior (o drift e o turbo valem ao apertar). */
  driftHeld: boolean;
  turboHeld: boolean;
  /** Arcade: tempo que o aperto do drift ainda vale para entrar (s). */
  driftPress: number;
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
  /** Quanto está no vácuo agora (0 a 1): menos arrasto, a cauda balança mais forte. */
  slip: number;
  /** DRS liberado agora (dentro da zona e pelas regras) e asa aberta. */
  drsAvail: boolean;
  drsOpen: boolean;
  /** Realista: acelerador, freio e volante suavizados (o que o carro sente) e a espera entre batidas na barreira (s). */
  rThr: number;
  rBrk: number;
  rSteer: number;
  wallCd: number;
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
  /** Classificação: contagem na largada antes da volta lançada (s), quando começou a volta (e de onde), o tempo e quando. */
  qualiHold: number;
  qualiStartT: number | null;
  qualiStartProg: number;
  qualiMs: number | null;
  qualiAt: number | null;
  finished: boolean;
  finishMs: number | null;
  dnf: boolean;
  /** Saiu (desconectou): some da pista. */
  gone: boolean;
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
  | { type: 'qready'; id: string }
  | { type: 'qstart'; id: string }
  | { type: 'qtime'; id: string; ms: number }
  | { type: 'drsready'; id: string }
  | { type: 'pitin'; id: string }
  | { type: 'pitout'; id: string }
  | { type: 'cut'; id: string }
  | { type: 'wall'; id: string; speed: number; x: number; z: number; kind?: 'metal' | 'tyres' }
  | { type: 'bump'; a: string; b: string; force: number; x: number; z: number }
  | { type: 'dnf'; id: string }
  | { type: 'drift'; id: string; dir: number }
  | { type: 'bar'; id: string; level: number }
  | { type: 'turbo'; id: string; level: number }
  | { type: 'noturbo'; id: string }
  | { type: 'pad'; id: string; x: number; z: number };

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
  drs: boolean;
  slip: number;
  wear: number;
  steer: number;
  pit: boolean;
  vx?: number;
  vz?: number;
  spin?: number;
  gear?: number;
  skid?: number;
  /** Arcade: lado do drift, pulinho, nível do turbo em uso e a barra. */
  driftDir?: number;
  hop?: number;
  boostLevel?: number;
  bar?: number;
}

const MARK = 10;
/** Quantos números tem o estado físico de um carro (`pack`). */
export const GP_PACK_LEN = 45;

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
  /** Pares de carros encostados no passo anterior (a batida dá um impulso só quando o contato começa). */
  private contacts = new Set<string>();
  private finishedCount = 0;
  meId: string | null = null;

  constructor(
    readonly seed: string,
    infos: readonly GpPlayerInfo[],
    def?: GpTrackDef,
    /** Modo de física (spec 080): o mesmo para todos os carros da partida. */
    readonly mode: GpPhysicsMode = 'arcade',
  ) {
    // sem pista dada, a do modo (o kart na Bala Track, o F1 na Marina)
    this.track = gpTrack(def ?? gpTrackDefFor(mode));
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
      kx: 0,
      kz: 0,
      speed: 0,
      gear: 1,
      rpm: 0,
      shiftT: 0,
      driftAvail: false,
      driftDir: 0,
      driftT: 0,
      hop: 0,
      bar: 0,
      boostLevel: 0,
      boostT: 0,
      boostX: 0,
      driftHeld: false,
      turboHeld: false,
      driftPress: 0,
      brakeLevel: 0,
      skid: 0,
      idx: 0,
      s: 0,
      d: 0,
      prog: 0,
      surface: 'asphalt',
      wear: 0,
      slip: 0,
      drsAvail: false,
      drsOpen: false,
      rThr: 0,
      rBrk: 0,
      rSteer: 0,
      wallCd: 0,
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
      qualiHold: 0,
      qualiStartT: null,
      qualiStartProg: 0,
      qualiMs: null,
      qualiAt: null,
      finished: false,
      finishMs: null,
      dnf: false,
      gone: false,
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
    c.kx = 0;
    c.kz = 0;
    c.speed = 0;
    c.gear = 1;
    c.shiftT = 0;
    c.driftDir = 0;
    c.driftT = 0;
    c.hop = 0;
    c.boostLevel = 0;
    c.boostT = 0;
    c.boostX = 0;
    c.brakeLevel = 0;
    c.rThr = 0;
    c.rBrk = 0;
    c.rSteer = 0;
    c.wallCd = 0;
    c.drsAvail = false;
    c.drsOpen = false;
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
    c.slip = 0;
    c.drsAvail = false;
    c.drsOpen = false;
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
    c.marks = [];
    c.stepN = 0;
    c.skid = 0;
  }

  /**
   * Classificação (decisões de 10 e 11/11/2026): todos saem do box ao mesmo tempo, como fantasmas, andam à vontade e
   * começam a própria volta lançada quando quiserem, pelo botão: o carro vai para a largada, espera a contagem e o tempo
   * começa. Vale uma volta.
   */
  beginQuali() {
    this.phase = 'quali';
    this.t = 0;
    this.ended = false;
    this.events = [];
    const pit = this.track.pit;
    for (const [k, c] of this.cars.entries()) {
      this.resetRun(c);
      c.qualiHold = 0;
      c.qualiStartT = null;
      c.qualiStartProg = 0;
      c.qualiMs = null;
      c.qualiAt = null;
      c.ghost = true;
      if (pit) {
        // saindo da vaga do box: já serviu o box nesta passagem (não para de novo)
        const s = pit.box + 4;
        this.place(c, s, this.track.pitCenter(s) ?? 0);
        c.pitServed = true;
      } else {
        // pista sem box (kart): todos começam na pista, antes da linha (fantasmas)
        this.place(c, GP_QUALI_START_S - 30 - (k % 6) * 2, 0);
      }
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
    this.contacts.clear();
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
        if (this.mode === 'real') this.slipstream();
        this.ranks();
        this.checkEnd();
      }
    }
  }

  /** Aderência agora: superfície × pneu. */
  gripOf(c: GpCar): number {
    return GP_SURFACE[c.surface].grip * (1 - c.wear * (1 - GP_GRIP_MIN));
  }

  /** Velocidade máxima agora (pela superfície e pelo modo; na faixa do box, o limitador). */
  vmaxOf(c: GpCar): number {
    if (this.mode === 'arcade') {
      const f =
        c.surface === 'kerb'
          ? GP_ARC_KERB_VMAX
          : c.surface === 'grass'
            ? GP_ARC_GRASS_VMAX
            : c.surface === 'gravel'
              ? GP_ARC_GRAVEL_VMAX
              : 1;
      return GP_ARC_VMAX * f;
    }
    if (c.surface === 'pit') return GP_PIT_LIMIT;
    return gpVmaxOf(this.mode) * GP_SURFACE[c.surface].vmax;
  }

  /** Quanto do arrasto vale agora: DRS aberto e vácuo tiram uma parte (multiplicam). */
  dragOf(c: GpCar): number {
    return (c.drsOpen ? 1 - GP_DRS_DRAG : 1) * (1 - GP_SLIP_DRAG * c.slip);
  }

  /** Posição na corrida agora (contando quem já terminou e quem está mais adiante). */
  private placeOf(c: GpCar): number {
    let p = 1;
    for (const o of this.cars) {
      if (o === c || o.gone) continue;
      if (o.finished && !c.finished) p++;
      else if (o.finished === c.finished && o.prog > c.prog) p++;
    }
    return p;
  }

  /**
   * DRS (spec 080): só dentro da zona; na classificação liberado para todos; na corrida só depois da 1ª volta e nunca para
   * quem está em 1º. Abre quando pede; fecha ao frear, ao sair da zona ou quando deixa de valer.
   */
  private drsRules(c: GpCar, input: GpInput) {
    const tr = this.track;
    let ok = tr.drsAt[c.idx] === 1 && c.surface !== 'pit' && c.pitHold <= 0 && c.qualiHold <= 0;
    if (this.phase === 'race')
      ok = ok && !c.finished && c.laps.length >= GP_DRS_FROM_LAP && this.placeOf(c) > 1;
    if (ok && !c.drsAvail) this.events.push({ type: 'drsready', id: c.id });
    c.drsAvail = ok;
    if (!ok || input.brake > 0.1) c.drsOpen = false;
    else if (input.drs) c.drsOpen = true;
  }

  /** Para o carro no lugar (box, contagem da volta lançada). */
  private freeze(c: GpCar) {
    c.vx = 0;
    c.vz = 0;
    c.spin = 0;
    c.kx = 0;
    c.kz = 0;
    c.speed = 0;
    c.rThr = 0;
    c.rBrk = 0;
    c.drsOpen = false;
  }

  private stepCar(c: GpCar, inp: GpInput, dt: number) {
    c.stepN += 1;
    const racing = this.phase === 'race';
    const done = racing && c.finished;
    // ---- classificação: contagem parado na largada antes da volta lançada ----
    if (c.qualiHold > 0) {
      c.qualiHold -= dt;
      this.freeze(c);
      if (c.qualiHold <= 0) {
        c.qualiHold = 0;
        this.startQualiLap(c, this.t, c.prog);
      }
      return;
    }
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
    // classificação: "iniciar volta" leva o carro para a largada, parado e alinhado, e começa a contagem
    if (this.phase === 'quali' && input.lap && c.qualiStartT === null && c.qualiMs === null) {
      this.place(c, GP_QUALI_START_S, 0);
      c.pitServed = false;
      c.qualiHold = GP_QUALI_HOLD_SEC;
      this.events.push({ type: 'qready', id: c.id });
      return;
    }
    if (this.mode === 'real') {
      this.drsRules(c, input);
      this.stepReal(c, input, dt);
    } else this.stepKart(c, input, dt);
    this.trackCar(c, dt, racing);
  }

  /**
   * O passo do kart (Arcade, spec 081, Fase 5): a velocidade sempre para o nariz (não escorrega de lado), direção muito
   * rápida que quase não perde velocidade, sem marchas. Drift (liberado por regras) muda o raio pelo volante, dá um pouco
   * de velocidade e enche a barra de turbo mais rápido; o turbo gasta a barra e dá o impulso do nível atingido. Sem
   * desgaste de pneu, vácuo, box nem DRS.
   */
  private stepKart(c: GpCar, input: GpInput, dt: number) {
    const thr = clamp(input.throttle, 0, 1);
    const brk = clamp(input.brake, 0, 1);
    const st = clamp(input.steer, -1, 1);
    c.steer = st;
    c.wallCd -= dt;
    let v = c.speed;
    const av = Math.abs(v);
    const road = c.surface === 'asphalt' || c.surface === 'kerb' || c.surface === 'pit';

    // ---- drift: liberado, entra ao apertar (para o lado do volante), sai ao soltar ou fora da pista ----
    const held = !!input.drift;
    c.driftAvail = v >= GP_ARC_DRIFT_MIN * GP_ARC_VMAX && Math.abs(st) > GP_ARC_DRIFT_STEER && road;
    if (held && !c.driftHeld) c.driftPress = GP_ARC_DRIFT_GRACE;
    if (!held) c.driftPress = 0;
    if (held && c.driftPress > 0 && c.driftAvail && c.driftDir === 0) {
      c.driftPress = 0;
      c.driftDir = Math.sign(st);
      c.driftT = 0;
      c.hop = GP_ARC_HOP_SEC;
      this.events.push({ type: 'drift', id: c.id, dir: c.driftDir });
    }
    if (c.driftDir !== 0 && (!held || !road || v < GP_ARC_DRIFT_MIN * GP_ARC_VMAX * 0.7)) c.driftDir = 0;
    c.driftHeld = held;
    c.driftPress = Math.max(0, c.driftPress - dt);
    c.hop = Math.max(0, c.hop - dt);
    const drifting = c.driftDir !== 0;
    if (drifting) c.driftT += dt;
    else c.driftT = 0;

    // ---- placa de turbo (Bala Track): turbo de nível 1 sem gastar a barra; passar de novo renova ----
    if (this.track.pads.length && road) {
      const k = this.track.padAt(c.s, c.d);
      if (k >= 0 && (c.boostT <= 0 || c.boostLevel <= 1)) {
        const fresh = c.boostT <= 0;
        c.boostLevel = 1;
        c.boostT = GP_ARC_BOOST[0]!.sec;
        if (fresh) this.events.push({ type: 'pad', id: c.id, x: c.x, z: c.z });
      }
    }
    // ---- turbo: gasta a barra toda; o nível é o terço atingido ----
    const tap = !!input.turbo;
    if (tap && !c.turboHeld) {
      if (c.bar < 1) this.events.push({ type: 'noturbo', id: c.id });
      else {
        const level = Math.min(GP_ARC_BOOST.length, Math.floor(c.bar));
        c.bar = 0;
        c.boostLevel = level;
        c.boostT = GP_ARC_BOOST[level - 1]!.sec;
        this.events.push({ type: 'turbo', id: c.id, level });
      }
    }
    c.turboHeld = tap;

    // ---- direção ----
    const yawMax = GP_ARC_YAW_LOW + (GP_ARC_YAW_HIGH - GP_ARC_YAW_LOW) * Math.min(1, av / GP_ARC_VMAX);
    const slowK = Math.min(1, av / GP_ARC_YAW_FULL_V);
    let yaw: number;
    let rel = 0;
    if (drifting) {
      // o volante para dentro fecha a curva, para fora abre
      rel = st * c.driftDir;
      const f = rel >= 0 ? 1 + (GP_ARC_DRIFT_IN - 1) * rel : 1 + (1 - GP_ARC_DRIFT_OUT) * rel;
      yaw = c.driftDir * yawMax * GP_ARC_DRIFT_BASE * f;
    } else yaw = st * yawMax;
    c.h += yaw * slowK * Math.sign(v || 1) * dt;
    // giro e empurrão de uma batida: somem sozinhos
    if (c.spin !== 0) {
      c.h += c.spin * dt;
      c.spin *= Math.exp(-GP_BUMP_SPIN_DAMP * dt);
      if (Math.abs(c.spin) < 1e-3) c.spin = 0;
    }
    const knockKeep = Math.exp(-GP_BUMP_KNOCK_DAMP * dt);
    c.kx *= knockKeep;
    c.kz *= knockKeep;

    // ---- velocidade: alvo pela superfície, drift e turbo ----
    if (c.boostT > 0) {
      const lv = GP_ARC_BOOST[c.boostLevel - 1]!;
      c.boostX = lv.extra * (road ? 1 : GP_ARC_BOOST_OFFROAD);
      c.boostT = Math.max(0, c.boostT - dt);
    } else if (c.boostX > 0) {
      // fim do turbo: volta à máxima normal numa rampa curta
      const lv = GP_ARC_BOOST[Math.max(0, c.boostLevel - 1)]!;
      c.boostX = Math.max(0, c.boostX - (lv.extra / GP_ARC_BOOST_FADE) * dt);
      if (c.boostX === 0) c.boostLevel = 0;
    }
    const boosting = c.boostT > 0;
    const target = this.vmaxOf(c) * (drifting ? GP_ARC_DRIFT_SPEED : 1) * (1 + c.boostX);
    if (brk > 0.05 && v > 0.5) v = Math.max(0, v - GP_ARC_BRAKE * brk * dt);
    else if (brk > 0.1 && v <= 0.5 && !boosting) v = Math.max(-GP_ARC_REVERSE_MAX, v - GP_ARC_REVERSE_ACCEL * brk * dt);
    else if (v < 0) v = Math.min(0, v + GP_ARC_BRAKE * Math.max(thr, 0.3) * dt);
    else if (boosting && v < target) v = Math.min(target, v + ((target - v) / GP_ARC_BOOST_RISE) * dt + 2 * dt);
    else if (thr > 0.05 && v < target) v = Math.min(target, v + thr * GP_ARC_ACC_K * (target - v) * dt + 0.5 * dt);
    else if (thr <= 0.05) v -= GP_ARC_COAST * v * dt;
    // acima da máxima da hora (zebra, grama, fim do turbo): perde até ela, sem corte brusco
    if (v > target) v = Math.max(target, v - GP_ARC_OVER_DECEL * dt);
    if (Math.abs(v) < 0.03 && thr <= 0.05 && brk <= 0.05) v = 0;
    // curvando quase não perde velocidade
    v -= v * GP_ARC_TURN_LOSS * Math.min(1, Math.abs(yaw) / yawMax) * dt;

    // ---- barra: enche andando; derrapando, bem mais rápido ----
    if (v > 1 && !boosting) {
      let rate = (GP_ARC_BAR_MAX / GP_ARC_BAR_FULL_SEC) * Math.min(1, v / GP_ARC_VMAX);
      if (drifting) rate *= GP_ARC_DRIFT_FILL * (1 + (GP_ARC_DRIFT_FILL_IN - 1) * Math.max(0, rel));
      const before = Math.floor(c.bar);
      c.bar = Math.min(GP_ARC_BAR_MAX, c.bar + rate * dt);
      const now = Math.floor(c.bar);
      if (now > before) this.events.push({ type: 'bar', id: c.id, level: now });
    }

    c.speed = v;
    // som e desenho: um giro contínuo (sem marchas) e as marcas de pneu no drift
    c.gear = v < -0.3 ? 0 : 1;
    c.rpm = clamp(0.15 + 0.85 * (Math.abs(v) / (GP_ARC_VMAX * 1.55)) + thr * 0.08, 0.1, 1);
    c.skid = drifting ? 3 : 0;
    c.brakeLevel = brk;
    c.braking = brk > 0.1 && v > 1;
    c.vx = Math.sin(c.h) * v + c.kx;
    c.vz = -Math.cos(c.h) * v + c.kz;
    c.x += c.vx * dt;
    c.z += c.vz * dt;
  }

  /** Cancela o drift (batida, muro). */
  private stopDrift(c: GpCar) {
    c.driftDir = 0;
    c.driftT = 0;
  }

  /**
   * O passo do Realista (spec 080, modelo do repositório de referência): a velocidade é um número, sempre alinhado com o
   * nariz. A curva é limitada pela aderência lateral (`GRIP0 + DF·v²`): pedir mais do que o pneu aguenta faz o carro abrir
   * a trajetória e perder velocidade, sem ficar de lado. Sem escorregão (`skid` 0).
   */
  private stepReal(c: GpCar, input: GpInput, dt: number) {
    // entradas suavizadas: o pedal e o volante não pulam
    const thrIn = clamp(input.throttle, 0, 1);
    const brkIn = clamp(input.brake, 0, 1);
    const stIn = clamp(input.steer, -1, 1);
    c.rThr += clamp(thrIn - c.rThr, -GP_REAL_THR_FALL * dt, GP_REAL_THR_RISE * dt);
    c.rBrk += clamp(brkIn - c.rBrk, -GP_REAL_BRK_RATE * dt, GP_REAL_BRK_RATE * dt);
    const rate = stIn === 0 ? GP_REAL_STEER_CENTER : c.rSteer * stIn < 0 ? GP_REAL_STEER_FLIP : GP_REAL_STEER_RISE;
    c.rSteer += clamp(stIn - c.rSteer, -rate * dt, rate * dt);
    c.steer = c.rSteer;
    c.wallCd -= dt;
    c.skid = 0;
    // giro e empurrão de uma batida entre carros: somem sozinhos, sem escorregão
    if (c.spin !== 0) {
      c.h += c.spin * dt;
      c.spin *= Math.exp(-GP_BUMP_SPIN_DAMP * dt);
      if (Math.abs(c.spin) < 1e-3) c.spin = 0;
    }
    const knockKeep = Math.exp(-GP_BUMP_KNOCK_DAMP * dt);
    c.kx *= knockKeep;
    c.kz *= knockKeep;
    if (Math.abs(c.kx) + Math.abs(c.kz) < 1e-3) {
      c.kx = 0;
      c.kz = 0;
    }

    let v = c.speed;
    const av = Math.abs(v);
    const grip = this.gripOf(c);
    // ---- curva: o que o volante pede, limitado pelo que o pneu aguenta ----
    const sa = (c.rSteer * GP_REAL_STEER_MAX) / (1 + av / GP_REAL_STEER_FADE);
    const yawD = (v * Math.tan(sa)) / GP_REAL_WHEELBASE;
    const yawM = (gpRealLatMax(av) * grip) / Math.max(av, 1);
    const yaw = clamp(yawD, -yawM, yawM);
    if (Math.abs(yawD) > yawM && av > 5) {
      const over = Math.min(GP_REAL_SCRUB_MAX, (Math.abs(yawD) - yawM) / yawM);
      v -= Math.sign(v) * over * GP_REAL_SCRUB * dt;
      c.wear += GP_WEAR_SLIP * over * av * 0.25 * dt;
    }
    c.h += yaw * dt;

    // ---- motor, freio e ré ----
    const brakeK = 1 - c.wear * (1 - GP_BRAKE_MIN);
    if (v <= 0.5 && c.rBrk > 0.5 && c.rThr < 0.1) v = Math.max(-GP_REVERSE_MAX, v - GP_REVERSE_ACCEL * dt);
    else if (v < 0) v = Math.min(0, v + (c.rThr * GP_REAL_REVERSE_OUT + GP_REAL_REVERSE_OUT0) * dt);
    else {
      // câmbio automático de verdade: a marcha decide a força; na troca para cima a força corta um instante
      const tops = GP_REAL_GEAR_TOP;
      let g = Math.max(1, Math.min(tops.length, c.gear || 1));
      if (g < tops.length && v > tops[g - 1]! * GP_REAL_SHIFT_UP) {
        g += 1;
        c.shiftT = GP_REAL_SHIFT_CUT;
      }
      while (g > 1 && v < tops[g - 2]! * GP_REAL_SHIFT_DOWN) g -= 1;
      c.gear = g;
      const top = tops[g - 1]!;
      c.rpm = clamp(v / top, 0.1, 1);
      const limiter = g === tops.length && v >= top;
      const engine =
        c.shiftT > 0 || limiter ? 0 : c.rThr * Math.min(GP_REAL_ACC_MAX, (GP_REAL_ENGINE * gpTorque(c.rpm)) / top);
      c.shiftT = Math.max(0, c.shiftT - dt);
      const a =
        engine -
        this.dragOf(c) * GP_REAL_DRAG * v * v -
        (v > 0 ? GP_REAL_ROLL : 0) -
        c.rBrk * brakeK * gpRealBrake(v);
      v = Math.max(0, v + a * dt);
      if (c.rBrk > 0.05 && v > 12) c.wear += GP_WEAR_BRAKE * c.rBrk * dt;
    }
    // fora do asfalto (grama, brita, box) a máxima cai: perde velocidade até ela
    const vmax = this.vmaxOf(c);
    if (GP_SURFACE[c.surface].vmax < 1 && v > vmax) v = Math.max(vmax, v - GP_OVER_DECEL * dt);
    c.brakeLevel = c.rBrk;
    c.braking = c.rBrk > 0.1 && v > 1;

    // de ré ou parado: marcha à ré ou 1ª, giro baixo
    if (v < -0.3) c.gear = 0;
    else if (c.gear === 0) c.gear = 1;
    if (v <= 0.5) c.rpm = Math.max(0.1, c.rThr * 0.5);

    c.speed = v;
    c.vx = Math.sin(c.h) * v + c.kx;
    c.vz = -Math.cos(c.h) * v + c.kz;
    c.x += c.vx * dt;
    c.z += c.vz * dt;
    c.wear += GP_WEAR_DIST * Math.abs(v) * dt;
    if (c.surface === 'grass' || c.surface === 'gravel') c.wear += GP_WEAR_OFF * dt;
    c.wear = Math.min(1, c.wear);
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
    };
  }

  private startQualiLap(c: GpCar, t: number, prog: number) {
    c.qualiStartT = t;
    c.qualiStartProg = prog;
    c.sectorStartT = t;
    c.sectorT = [];
    this.events.push({ type: 'qstart', id: c.id });
  }

  /**
   * Realista: a barreira empurra o carro para dentro, alinha parte da direção com a pista e corta a velocidade (com uma
   * espera curta entre uma batida e a próxima, como na referência).
   */
  private hitWallReal(c: GpCar, nx: number, nz: number, back: number, i: number) {
    c.x -= nx * back;
    c.z -= nz * back;
    const th = this.track.heading(i);
    const along = Math.cos(c.h - th) >= 0 ? th : th + Math.PI;
    c.h += Math.atan2(Math.sin(along - c.h), Math.cos(along - c.h)) * GP_REAL_WALL_ALIGN;
    if (c.wallCd <= 0) {
      const hit = Math.abs(c.speed);
      c.speed *= GP_REAL_WALL_KEEP;
      c.wallCd = GP_REAL_WALL_CD;
      if (hit > 4) this.events.push({ type: 'wall', id: c.id, speed: hit, x: c.x + nx, z: c.z + nz });
    }
    c.kx = 0;
    c.kz = 0;
    c.vx = Math.sin(c.h) * c.speed;
    c.vz = -Math.cos(c.h) * c.speed;
  }

  /**
   * Kart na barreira (spec 081, 6B.4): no muro, batida normal (perde ~35 % e é empurrado para dentro, alinhando um pouco
   * com a pista); na pilha de pneus, quica para trás (a velocidade vira de volta, metade). Cancela o drift.
   */
  private hitWallKart(c: GpCar, nx: number, nz: number, back: number, i: number, kind: 'metal' | 'tyres') {
    c.x -= nx * back;
    c.z -= nz * back;
    c.kx = 0;
    c.kz = 0;
    this.stopDrift(c);
    const fx = Math.sin(c.h);
    const fz = -Math.cos(c.h);
    // só conta a batida quando o carro vai de encontro à barreira
    const into = (fx * nx + fz * nz) * c.speed;
    if (c.wallCd <= 0 && into > 0.5) {
      const hit = Math.abs(c.speed);
      if (kind === 'tyres') c.speed = -GP_ARC_TYRE_REBOUND * c.speed;
      else {
        c.speed *= GP_ARC_WALL_KEEP;
        const th = this.track.heading(i);
        const along = Math.cos(c.h - th) >= 0 ? th : th + Math.PI;
        c.h += Math.atan2(Math.sin(along - c.h), Math.cos(along - c.h)) * GP_REAL_WALL_ALIGN;
      }
      c.wallCd = GP_ARC_WALL_CD;
      if (hit > 4) this.events.push({ type: 'wall', id: c.id, speed: hit, x: c.x + nx, z: c.z + nz, kind });
    }
    c.vx = Math.sin(c.h) * c.speed;
    c.vz = -Math.cos(c.h) * c.speed;
  }

  /** Atualiza onde o carro está na pista: superfície, barreira, corte, box, setores, voltas. */
  private trackCar(c: GpCar, dt: number, racing: boolean) {
    const tr = this.track;
    const before = c.s;
    let p = tr.project(c.x, c.z, c.idx);
    // ---- barreira de pneus ----
    const lim = tr.wallAt(p.i, p.d) - GP_CAR_R * GP_CAR_WALL_IN;
    if (Math.abs(p.d) > lim) {
      const nx = -tr.tz[p.i]! * Math.sign(p.d);
      const nz = tr.tx[p.i]! * Math.sign(p.d);
      if (this.mode === 'real') this.hitWallReal(c, nx, nz, Math.abs(p.d) - lim, p.i);
      else this.hitWallKart(c, nx, nz, Math.abs(p.d) - lim, p.i, tr.wallKind(p.i, p.d));
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
      this.freeze(c);
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
    else if (this.mode === 'real' && !c.pitServed && c.pitHold <= 0 && tr.inBox(c.s, c.d)) {
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
      // sem volta lançada em andamento o carro só anda (sem tempo correndo)
      if (c.qualiMs !== null || c.qualiStartT === null) return;
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
    c.driftDir = st.driftDir ?? 0;
    c.hop = st.hop ?? 0;
    c.boostLevel = st.boostLevel ?? 0;
    c.boostT = c.boostLevel > 0 ? 1 : 0;
    c.bar = st.bar ?? c.bar;
    c.prog = st.prog;
    c.drsOpen = st.drs;
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

  private testCarObb(a: GpCar, b: GpCar): { overlap: number; nx: number; nz: number; px: number; pz: number } | null {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    if (dx * dx + dz * dz > GP_CAR_LEN * GP_CAR_LEN + GP_CAR_WID * GP_CAR_WID) return null;

    const hl = GP_CAR_LEN * 0.5;
    const hw = GP_CAR_WID * 0.5;

    const fax = Math.sin(a.h);
    const faz = -Math.cos(a.h);
    const rax = Math.cos(a.h);
    const raz = Math.sin(a.h);

    const fbx = Math.sin(b.h);
    const fbz = -Math.cos(b.h);
    const rbx = Math.cos(b.h);
    const rbz = Math.sin(b.h);

    const axes = [
      { x: rax, z: raz },
      { x: fax, z: faz },
      { x: rbx, z: rbz },
      { x: fbx, z: fbz },
    ];

    let minOverlap = Infinity;
    let bestNx = 0;
    let bestNz = 0;

    for (let k = 0; k < 4; k++) {
      const ax = axes[k]!.x;
      const az = axes[k]!.z;

      const d = Math.abs(dx * ax + dz * az);
      const projA = hl * Math.abs(fax * ax + faz * az) + hw * Math.abs(rax * ax + raz * az);
      const projB = hl * Math.abs(fbx * ax + fbz * az) + hw * Math.abs(rbx * ax + rbz * az);

      const overlap = projA + projB - d;
      if (overlap <= 0) return null;

      if (overlap < minOverlap) {
        minOverlap = overlap;
        const sign = dx * ax + dz * az >= 0 ? 1 : -1;
        bestNx = ax * sign;
        bestNz = az * sign;
      }
    }

    return {
      overlap: minOverlap,
      nx: bestNx,
      nz: bestNz,
      px: (a.x + b.x) * 0.5,
      pz: (a.z + b.z) * 0.5,
    };
  }

  /**
   * Batida entre carros (spec 081, Fase 13.3): caixa do carro (`testCarObb`) e impulso de corpo rígido com massas iguais
   * na normal do contato, com restituição e atrito pequenos, **uma vez por contato**. Enquanto as caixas continuam se
   * tocando os carros só se separam pela posição (sem perder velocidade); um impulso novo só vem se a aproximação voltar
   * a passar de `GP_BUMP_REARM`. Assim a batida de traseira empurra o da frente, quem bate perde uma parte do impacto, e a
   * perda não se acumula a cada passo. Carro de outra pessoa (online) entra como obstáculo de massa infinita: quem decide
   * a batida dele é o líder. Vale para os dois modos.
   */
  private collide(only?: string) {
    const live = this.cars.filter((c) => !c.gone && !c.ghost && c.pitHold <= 0);
    const touching = new Set<string>();
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i]!;
        const b = live[j]!;
        const movA = only ? a.id === only : !a.remote;
        const movB = only ? b.id === only : !b.remote;
        if (!movA && !movB) continue;
        const hit = this.testCarObb(a, b);
        if (!hit) continue;
        const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        touching.add(key);
        const { overlap, nx, nz, px, pz } = hit;
        const ima = movA ? 1 : 0;
        const imb = movB ? 1 : 0;
        const share = ima + imb;
        // separa pela posição (sem tirar velocidade), no máximo um pouco por passo
        const push = Math.min(overlap, GP_BUMP_PUSH);
        a.x -= (nx * push * ima) / share;
        a.z -= (nz * push * ima) / share;
        b.x += (nx * push * imb) / share;
        b.z += (nz * push * imb) / share;
        // velocidade relativa do ponto de contato (translação + giro)
        const rax = px - a.x;
        const raz = pz - a.z;
        const rbx = px - b.x;
        const rbz = pz - b.z;
        const rvx = b.vx - b.spin * rbz - (a.vx - a.spin * raz);
        const rvz = b.vz + b.spin * rbx - (a.vz + a.spin * rax);
        const vn = rvx * nx + rvz * nz;
        if (vn >= 0) continue;
        if (this.contacts.has(key) && -vn < GP_BUMP_REARM) continue;
        const iia = ima / GP_INERTIA;
        const iib = imb / GP_INERTIA;
        const ran = cross(rax, raz, nx, nz);
        const rbn = cross(rbx, rbz, nx, nz);
        const k = ima + imb + ran * ran * iia + rbn * rbn * iib;
        const jn = ((-(1 + GP_BUMP_E) * vn) / k) * GP_BUMP_SOFT;
        // atrito pequeno: freia o deslizamento entre os dois no ponto de contato (raspada de lado quase não tira nada)
        const tx = -nz;
        const tz = nx;
        const vt = rvx * tx + rvz * tz;
        const rat = cross(rax, raz, tx, tz);
        const rbt = cross(rbx, rbz, tx, tz);
        const kt = ima + imb + rat * rat * iia + rbt * rbt * iib;
        const jt = clamp(-vt / kt, -GP_BUMP_MU * jn, GP_BUMP_MU * jn);
        const ix = nx * jn + tx * jt;
        const iz = nz * jn + tz * jt;
        if (movA) this.kick(a, -ix, -iz, -cross(rax, raz, ix, iz) * iia);
        if (movB) this.kick(b, ix, iz, cross(rbx, rbz, ix, iz) * iib);
        if (jn > 0.8) this.events.push({ type: 'bump', a: a.id, b: b.id, force: jn, x: px, z: pz });
      }
    }
    this.contacts = touching;
  }

  /**
   * Aplica a mudança de velocidade de uma batida. Nos dois modos a velocidade sempre aponta para o nariz: a parte para a
   * frente muda a velocidade e a de lado vira o empurrão que some sozinho. O giro de uma batida é limitado. No kart, uma
   * batida de verdade cancela o drift.
   */
  private kick(c: GpCar, dvx: number, dvz: number, dspin: number) {
    c.spin += clamp(dspin, -GP_BUMP_SPIN_MAX, GP_BUMP_SPIN_MAX);
    const fx = Math.sin(c.h);
    const fz = -Math.cos(c.h);
    const along = dvx * fx + dvz * fz;
    c.speed += along;
    c.kx += dvx - fx * along;
    c.kz += dvz - fz * along;
    c.vx = fx * c.speed + c.kx;
    c.vz = fz * c.speed + c.kz;
    if (this.mode === 'arcade' && Math.hypot(dvx, dvz) > 1) this.stopDrift(c);
  }

  /** Vácuo passivo: logo atrás de outro carro e alinhado, o arrasto cai (mais perto, mais). Vale para todos. */
  private slipstream() {
    for (const c of this.cars) {
      if (c.remote || c.gone || c.finished) continue;
      c.slip = 0;
      if (c.speed < GP_SLIP_MIN_V) continue;
      const fx = Math.sin(c.h);
      const fz = -Math.cos(c.h);
      let best = 0;
      for (const o of this.cars) {
        if (o === c || o.gone || o.pitHold > 0) continue;
        const dx = o.x - c.x;
        const dz = o.z - c.z;
        const along = dx * fx + dz * fz;
        if (along < GP_SLIP_MIN || along > GP_SLIP_LEN) continue;
        const lat = Math.abs(-dx * fz + dz * fx);
        if (lat > GP_SLIP_W) continue;
        if (Math.cos(o.h - c.h) < 0.85) continue;
        best = Math.max(best, 1 - (along - GP_SLIP_MIN) / (GP_SLIP_LEN - GP_SLIP_MIN));
      }
      c.slip = Math.max(0, best);
    }
  }

  /** Posições de agora. */
  private ranks() {
    for (const r of this.standings()) this.order.set(r.car.id, r.pos);
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
      c.drsAvail ? 1 : 0,
      c.drsOpen ? 1 : 0,
      c.pitHold,
      c.pitServed ? 1 : 0,
      c.gear,
      c.brakeLevel,
      c.qualiHold,
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
      c.rThr,
      c.rBrk,
      c.rSteer,
      c.wallCd,
      c.kx,
      c.kz,
      c.shiftT,
      c.driftDir,
      c.driftT,
      c.hop,
      c.bar,
      c.boostLevel,
      c.boostT,
      c.boostX,
      c.driftHeld ? 1 : 0,
      c.turboHeld ? 1 : 0,
      c.driftAvail ? 1 : 0,
      c.spin,
      c.driftPress,
    ];
  }

  /** Põe o carro no estado recebido (o que não está no pacote, como as voltas, segue o que o carro já tem). */
  unpack(c: GpCar, v: readonly number[]) {
    if (v.length < GP_PACK_LEN) return;
    c.x = v[0]!;
    c.z = v[1]!;
    c.h = v[2]!;
    c.vx = v[3]!;
    c.vz = v[4]!;
    c.spin = v[5]!;
    c.prog = v[6]!;
    c.idx = Math.max(0, Math.min(this.track.n - 1, Math.trunc(v[7]!)));
    c.wear = v[8]!;
    c.drsAvail = v[9] === 1;
    c.drsOpen = v[10] === 1;
    c.pitHold = v[11]!;
    c.pitServed = v[12] === 1;
    c.gear = v[13]!;
    c.brakeLevel = v[14]!;
    c.qualiHold = v[15]!;
    c.qualiStartT = v[16]! < 0 ? null : v[16]!;
    c.qualiStartProg = v[17]!;
    c.lastValid = { x: v[18]!, z: v[19]!, h: v[20]!, prog: v[21]!, idx: Math.trunc(v[22]!) };
    c.slip = v[23]!;
    c.steer = v[24]!;
    c.skid = v[25]!;
    c.rThr = v[26]!;
    c.rBrk = v[27]!;
    c.rSteer = v[28]!;
    c.wallCd = v[29]!;
    c.kx = v[30]!;
    c.kz = v[31]!;
    c.shiftT = v[32]!;
    c.driftDir = v[33]!;
    c.driftT = v[34]!;
    c.hop = v[35]!;
    c.bar = v[36]!;
    c.boostLevel = v[37]!;
    c.boostT = v[38]!;
    c.boostX = v[39]!;
    c.driftHeld = v[40] === 1;
    c.turboHeld = v[41] === 1;
    c.driftAvail = v[42] === 1;
    c.spin = v[43]!;
    c.driftPress = v[44]!;
    // a velocidade é sempre para o nariz (sem o empurrão de lado)
    c.speed = (c.vx - c.kx) * Math.sin(c.h) - (c.vz - c.kz) * Math.cos(c.h);
    const p = this.track.project(c.x, c.z, c.idx);
    c.idx = p.i;
    c.s = p.s;
    c.d = p.d;
    c.surface = this.track.surface(p);
  }
}

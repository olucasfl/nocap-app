import { GP_DT } from './constants';
import { GP_IDLE, type GpCar, type GpEvent, type GpInput, type GpWorld } from './world';

/**
 * Rede do Fox GP (spec 079), igual à do Fut Fox na ideia: o aparelho do LÍDER simula todos os carros (é a autoridade:
 * batidas iguais para todos); os outros mandam só a entrada e recebem o estado. Cada aparelho prevê o próprio carro na
 * hora (sem esperar a rede) e, quando o estado do líder chega, refaz a previsão a partir dele, escondendo a diferença aos
 * poucos (sem teleporte). Os outros carros são desenhados ~100 ms atrás, interpolados entre dois estados.
 * Tudo aqui é lógica pura: o transporte (WebRTC ou repasse pela sala) fica no app.
 */

/** Entrada empacotada: [seq, acelerar, frear, volante, turbo(0/1), iniciar volta(0/1)]. */
export type GpInputRow = [number, number, number, number, number, number];

/** O pacote de entrada leva as últimas entradas (o canal não garante entrega: a repetição cobre a perda). */
export interface GpInputPacket {
  rows: GpInputRow[];
}

/** O estado do líder: hora do jogo, fase, e por carro [vaga, última entrada aplicada, ...estado físico]. */
export interface GpSnapshot {
  t: number;
  /** 'q' classificação, 'r' corrida: estado de outra fase é ignorado. */
  ph: 'q' | 'r';
  cars: number[][];
  /** Dados de tempo (voltas, classificação, chegada) por vaga, a cada tanto tempo. */
  meta?: GpCarMeta[];
}

/** Os tempos de um carro, como o líder vê. */
export type GpCarMeta = [
  slot: number,
  laps: number[],
  qualiMs: number | null,
  qualiStartT: number | null,
  finishMs: number | null,
  passes: number,
  pitStops: number,
  bestSectors: (number | null)[],
  sectorT: number[],
];

const packInput = (seq: number, i: GpInput): GpInputRow => [
  seq,
  Math.round(i.throttle * 100) / 100,
  Math.round(i.brake * 100) / 100,
  Math.round(i.steer * 1000) / 1000,
  i.turbo ? 1 : 0,
  i.lap ? 1 : 0,
];
const unpackInput = (r: GpInputRow): GpInput => ({
  throttle: r[1],
  brake: r[2],
  steer: r[3],
  turbo: r[4] === 1,
  lap: r[5] === 1,
});

/** Até quantas entradas ficam na fila de cada aparelho no líder (mais que isso vira atraso). */
const QUEUE_MAX = 6;
/** O líder manda o estado a cada tantos passos (60/2 = 30 por segundo) e os tempos a cada tantos estados. */
export const GP_SNAP_EVERY = 2;
const META_EVERY = 10;

/** O lado do líder: aplica a entrada de cada um, passo a passo, e monta o estado para mandar. */
export class GpHost {
  private queues = new Map<string, GpInputRow[]>();
  private last = new Map<string, GpInputRow>();
  private acks = new Map<string, number>();
  private n = 0;
  private snaps = 0;
  private events: GpEvent[] = [];

  constructor(
    readonly world: GpWorld,
    readonly meId: string,
  ) {}

  /** Chegou um pacote de entrada de alguém: entra na fila só o que é novo. */
  receive(id: string, p: GpInputPacket) {
    if (!p || !Array.isArray(p.rows)) return;
    const q = this.queues.get(id) ?? [];
    const top = Math.max(this.acks.get(id) ?? -1, q.length ? q[q.length - 1]![0] : -1);
    for (const r of p.rows) {
      if (!Array.isArray(r) || r.length !== 6 || !r.every((v) => typeof v === 'number' && Number.isFinite(v)))
        continue;
      if (r[0] > top) q.push(r);
    }
    q.sort((a, b) => a[0] - b[0]);
    while (q.length > QUEUE_MAX) q.shift();
    this.queues.set(id, q);
  }

  /** Um passo: a entrada do líder vem direto; a de cada um sai da fila dele (sem fila, repete a última). */
  step(own: GpInput, extra: Readonly<Record<string, GpInput>> = {}) {
    const inputs: Record<string, GpInput> = { ...extra, [this.meId]: own };
    for (const c of this.world.cars) {
      if (c.id === this.meId || c.gone || extra[c.id]) continue;
      const q = this.queues.get(c.id);
      const row = q?.shift() ?? this.last.get(c.id);
      if (!row) {
        inputs[c.id] = GP_IDLE;
        continue;
      }
      if (q && row !== this.last.get(c.id)) {
        this.acks.set(c.id, row[0]);
        this.last.set(c.id, [row[0], row[1], row[2], row[3], 0, 0]);
      }
      inputs[c.id] = unpackInput(row);
    }
    this.world.step(GP_DT, inputs);
    for (const e of this.world.drainEvents()) this.events.push(e);
    this.n += 1;
  }

  /** Eventos novos (com garantia de entrega no app): voltas, chegada, box, batidas... */
  drainEvents(): GpEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Está na hora de mandar o estado? */
  get snapDue(): boolean {
    return this.n % GP_SNAP_EVERY === 0;
  }

  snapshot(): GpSnapshot {
    const w = this.world;
    this.snaps += 1;
    const snap: GpSnapshot = {
      t: w.t,
      ph: w.phase === 'race' ? 'r' : 'q',
      cars: w.cars
        .filter((c) => !c.gone)
        .map((c) => [c.slot, this.acks.get(c.id) ?? -1, ...w.pack(c).map((v) => Math.round(v * 1000) / 1000)]),
    };
    if (this.snaps % META_EVERY === 1) snap.meta = w.cars.map((c) => gpCarMeta(c));
    return snap;
  }
}

export function gpCarMeta(c: GpCar): GpCarMeta {
  return [
    c.slot,
    [...c.laps],
    c.qualiMs,
    c.qualiStartT,
    c.finishMs,
    c.passes,
    c.pitStops,
    [...c.bestSectors],
    [...c.sectorT],
  ];
}

/** Aplica os tempos que o líder mandou num carro. */
export function gpApplyMeta(world: GpWorld, m: GpCarMeta) {
  const c = world.cars.find((x) => x.slot === m[0]);
  if (!c) return;
  c.laps = m[1];
  c.bestLap = c.laps.length ? Math.min(...c.laps) : null;
  c.qualiMs = m[2];
  c.qualiStartT = m[3];
  if (m[4] !== null && !c.finished) world.applyFinish(c.id, m[4]);
  c.passes = m[5];
  c.pitStops = m[6];
  c.bestSectors = m[7];
  c.sectorT = m[8];
}

interface Buffered {
  at: number;
  state: number[];
}

/** O lado dos outros aparelhos: prevê o próprio carro, reconcilia com o líder e interpola os outros. */
export class GpClient {
  private seq = 0;
  private history: GpInputRow[] = [];
  private buffers = new Map<number, Buffered[]>();
  /** Onde cada um dos outros carros está desenhado: segue o alvo interpolado sem pular. */
  private shown = new Map<number, { x: number; z: number; h: number }>();
  /** Diferença visual que sobrou da última correção (some aos poucos). */
  readonly error = { x: 0, z: 0, h: 0 };
  /** Atraso de desenho dos outros carros (ms): sobe se os estados chegam espaçados. */
  delay = 100;
  private lastArrival = 0;
  private gapAvg = 1000 / 30;
  /** Hora do líder no último estado e quando ele chegou (para o relógio do jogo andar entre um e outro). */
  private hostT = 0;
  private hostAt = 0;
  corrections = 0;
  maxCorrection = 0;

  constructor(
    readonly world: GpWorld,
    readonly meId: string,
  ) {}

  /** Um passo da previsão do próprio carro; devolve o pacote para mandar ao líder. */
  local(input: GpInput): GpInputPacket {
    this.seq += 1;
    const row = packInput(this.seq, input);
    this.history.push(row);
    if (this.history.length > 240) this.history.shift();
    if (this.world.car(this.meId) && !this.world.ended) this.world.step(GP_DT, { [this.meId]: input }, this.meId);
    return { rows: this.history.slice(-4) };
  }

  /** Relógio do jogo agora (s), pelo do líder. */
  hostClock(now: number): number {
    return this.hostT + Math.max(0, now - this.hostAt) / 1000;
  }

  /** Chegou um estado do líder (`now` em ms, relógio deste aparelho). */
  receive(s: GpSnapshot, now: number) {
    const w = this.world;
    if ((s.ph === 'r') !== (w.phase === 'race')) return;
    if (s.t < this.hostT - 1e-6) return;
    if (this.lastArrival) {
      const gap = now - this.lastArrival;
      this.gapAvg += (gap - this.gapAvg) * 0.1;
      this.delay = Math.max(70, Math.min(220, this.gapAvg * 2.2 + 25));
    }
    this.lastArrival = now;
    this.hostT = s.t;
    this.hostAt = now;
    w.t = s.t;
    if (s.meta) for (const m of s.meta) gpApplyMeta(w, m);
    for (const row of s.cars) {
      const slot = row[0]!;
      const car = w.cars.find((c) => c.slot === slot);
      if (!car) continue;
      const state = row.slice(2);
      if (car.id === this.meId) this.reconcile(car, row[1]!, state);
      else {
        const buf = this.buffers.get(slot) ?? [];
        buf.push({ at: now, state });
        while (buf.length > 30) buf.shift();
        this.buffers.set(slot, buf);
      }
    }
  }

  /** Refaz a previsão do próprio carro a partir do estado do líder e guarda a diferença para sumir aos poucos. */
  private reconcile(car: GpCar, ack: number, state: number[]) {
    const w = this.world;
    const before = { x: car.x, z: car.z, h: car.h };
    w.unpack(car, state);
    this.history = this.history.filter((r) => r[0] > ack);
    for (const r of this.history) w.step(GP_DT, { [this.meId]: unpackInput(r) }, this.meId);
    // eventos da reprevisão não valem (os de verdade vêm do líder)
    w.drainEvents();
    const dx = before.x - car.x;
    const dz = before.z - car.z;
    const dh = Math.atan2(Math.sin(before.h - car.h), Math.cos(before.h - car.h));
    const jump = Math.hypot(dx, dz);
    this.corrections += 1;
    this.maxCorrection = Math.max(this.maxCorrection, jump);
    // erro grande demais (batida de verdade, corte): aceita na hora
    if (jump > 6) {
      this.error.x = 0;
      this.error.z = 0;
      this.error.h = 0;
      return;
    }
    this.error.x += dx;
    this.error.z += dz;
    this.error.h += dh;
  }

  /** Por quadro: o erro visual some (~0,1 s) e os outros carros vão para a posição interpolada. */
  frame(dt: number, now: number) {
    const k = Math.exp(-dt * 12);
    this.error.x *= k;
    this.error.z *= k;
    this.error.h *= k;
    const w = this.world;
    const when = now - this.delay;
    for (const [slot, buf] of this.buffers) {
      const car = w.cars.find((c) => c.slot === slot);
      if (!car || car.gone || buf.length === 0) continue;
      let i = buf.length - 1;
      while (i > 0 && buf[i]!.at > when) i--;
      const a = buf[i]!;
      const b = buf[Math.min(buf.length - 1, i + 1)]!;
      const span = b.at - a.at;
      const f = span > 0 ? Math.max(0, Math.min(1, (when - a.at) / span)) : 1;
      const s = f >= 1 ? b.state : a.state;
      const lerp = (p: number) => a.state[p]! + (b.state[p]! - a.state[p]!) * f;
      const dh = Math.atan2(Math.sin(b.state[2]! - a.state[2]!), Math.cos(b.state[2]! - a.state[2]!));
      // passou do último estado (estado atrasado/perdido): anda um pouco pela velocidade, no máximo 150 ms
      const late = Math.min(0.15, Math.max(0, when - b.at) / 1000);
      const x = (f < 1 ? lerp(0) : b.state[0]!) + (f >= 1 ? b.state[3]! * late : 0);
      const z = (f < 1 ? lerp(1) : b.state[1]!) + (f >= 1 ? b.state[4]! * late : 0);
      const h = a.state[2]! + dh * f;
      const vx = s[3]!;
      const vz = s[4]!;
      // segue o alvo: anda pela velocidade e corrige a diferença aos poucos (longe demais, vai direto)
      let sh = this.shown.get(slot);
      if (!sh || Math.hypot(sh.x - x, sh.z - z) > 8) sh = { x, z, h };
      else {
        const k = 1 - Math.exp(-dt * 18);
        sh.x += vx * dt;
        sh.z += vz * dt;
        sh.x += (x - sh.x) * k;
        sh.z += (z - sh.z) * k;
        sh.h += Math.atan2(Math.sin(h - sh.h), Math.cos(h - sh.h)) * Math.min(1, k * 1.5);
      }
      this.shown.set(slot, sh);
      w.setRemote(car.id, {
        x: sh.x,
        z: sh.z,
        h: sh.h,
        vx,
        vz,
        speed: vx * Math.sin(h) - vz * Math.cos(h),
        spin: s[5]!,
        prog: f < 1 ? lerp(6) : b.state[6]!,
        wear: s[8]!,
        turbo: s[10]! > 0,
        pit: s[11]! > 0 || false,
        gear: s[13]!,
        slip: s[23]!,
        steer: s[24]!,
        skid: s[25]!,
      });
      // estados velhos demais saem do buffer
      while (buf.length > 2 && buf[1]!.at < when - 200) buf.shift();
    }
  }
}

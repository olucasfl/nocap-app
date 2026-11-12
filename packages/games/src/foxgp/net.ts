import { GP_DT, GP_NET_VERSION } from './constants';
import { GP_IDLE, type GpCar, type GpEvent, type GpInput, type GpWorld } from './world';

/**
 * Rede do Fox GP (specs 079 e 080), igual à do Fut Fox na ideia: o aparelho do LÍDER simula todos os carros (é a
 * autoridade: batidas iguais para todos); os outros mandam só a entrada e recebem o estado. Cada aparelho prevê o próprio
 * carro na hora (sem esperar a rede) e, quando o estado do líder chega, refaz a previsão a partir dele, escondendo a
 * diferença aos poucos (sem teleporte). Os outros carros são desenhados ~100 ms atrás, interpolados entre dois estados.
 * Com até 12 carros o estado vai enxuto: cada carro manda só o que o desenho precisa; o estado físico completo vai só
 * para o dono do carro (é o que ele usa para refazer a previsão).
 * Tudo aqui é lógica pura: o transporte (WebRTC ou repasse pela sala) fica no app.
 */

/** Entrada empacotada: [seq, acelerar, frear, volante, DRS(0/1), iniciar volta(0/1)]. */
/** [seq, acelerador, freio, volante, DRS, volta, drift, turbo] (spec 081: drift e turbo do kart). */
export type GpInputRow = [number, number, number, number, number, number, number, number];

/** O pacote de entrada leva as últimas entradas (o canal não garante entrega: a repetição cobre a perda). */
export interface GpInputPacket {
  /** Versão do protocolo (`GP_NET_VERSION`): de outra versão é ignorado. */
  v: number;
  rows: GpInputRow[];
}

/**
 * Estado enxuto de um carro para o desenho: [vaga, x, z, direção, velocidade, volante, progresso, marcha, flags, pneu,
 * escorregão, vácuo, nível do turbo, barra]. Flags: 1 = no box, 2 = DRS aberto, 4 = drift à esquerda, 8 = drift à
 * direita, 16 = pulinho do drift (spec 081: os outros veem as faíscas e as chamas da cor certa).
 */
export type GpLeanRow = number[];
export const GP_LEAN_LEN = 14;

/** O estado do líder. */
export interface GpSnapshot {
  v: number;
  t: number;
  /** 'q' classificação, 'r' corrida: estado de outra fase é ignorado. */
  ph: 'q' | 'r';
  /** Todos os carros, enxutos. */
  cars: GpLeanRow[];
  /** Estado físico completo de quem precisa refazer a previsão: [vaga, última entrada aplicada, ...`pack`]. */
  full: number[][];
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
  pitStops: number,
  bestSectors: (number | null)[],
  sectorT: number[],
];

const r = (v: number, k: number) => Math.round(v * k) / k;
const packInput = (seq: number, i: GpInput): GpInputRow => [
  seq,
  r(i.throttle, 100),
  r(i.brake, 100),
  r(i.steer, 1000),
  i.drs ? 1 : 0,
  i.lap ? 1 : 0,
  i.drift ? 1 : 0,
  i.turbo ? 1 : 0,
];
const unpackInput = (row: GpInputRow): GpInput => ({
  throttle: row[1],
  brake: row[2],
  steer: row[3],
  drs: row[4] === 1,
  lap: row[5] === 1,
  drift: row[6] === 1,
  turbo: row[7] === 1,
});

/** O estado enxuto de um carro. */
export function gpLean(c: GpCar): GpLeanRow {
  return [
    c.slot,
    r(c.x, 100),
    r(c.z, 100),
    r(c.h, 1000),
    r(c.speed, 100),
    r(c.steer, 100),
    r(c.prog, 10),
    c.gear,
    (c.pitHold > 0 || c.surface === 'pit' ? 1 : 0) |
      (c.drsOpen ? 2 : 0) |
      (c.driftDir < 0 ? 4 : 0) |
      (c.driftDir > 0 ? 8 : 0) |
      (c.hop > 0 ? 16 : 0),
    r(c.wear, 1000),
    r(c.skid, 10),
    r(c.slip, 100),
    c.boostT > 0 ? c.boostLevel : 0,
    r(c.bar, 100),
  ];
}

/** O mesmo estado, só com o estado completo das vagas dadas (o que vai para cada aparelho). */
export function gpSnapshotFor(s: GpSnapshot, slots: readonly number[]): GpSnapshot {
  return { ...s, full: s.full.filter((row) => slots.includes(row[0]!)) };
}

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

  /** Chegou um pacote de entrada de alguém: entra na fila só o que é novo (e da mesma versão). */
  receive(id: string, p: GpInputPacket) {
    if (!p || p.v !== GP_NET_VERSION || !Array.isArray(p.rows)) return;
    const q = this.queues.get(id) ?? [];
    const top = Math.max(this.acks.get(id) ?? -1, q.length ? q[q.length - 1]![0] : -1);
    for (const row of p.rows) {
      if (!Array.isArray(row) || row.length !== 8 || !row.every((v) => typeof v === 'number' && Number.isFinite(v)))
        continue;
      if (row[0] > top) q.push(row);
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
        // repete pedal, volante, DRS e drift (segurar); "iniciar volta" e turbo (toque) só valem uma vez
        this.last.set(c.id, [row[0], row[1], row[2], row[3], row[4], 0, row[6], 0]);
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

  /** O estado de agora, com o estado completo de todos os outros (o app filtra por aparelho com `gpSnapshotFor`). */
  snapshot(): GpSnapshot {
    const w = this.world;
    this.snaps += 1;
    const live = w.cars.filter((c) => !c.gone);
    const snap: GpSnapshot = {
      v: GP_NET_VERSION,
      t: r(w.t, 1000),
      ph: w.phase === 'race' ? 'r' : 'q',
      cars: live.map(gpLean),
      full: live
        .filter((c) => c.id !== this.meId && !c.bot)
        .map((c) => [c.slot, this.acks.get(c.id) ?? -1, ...w.pack(c).map((v) => r(v, 1000))]),
    };
    if (this.snaps % META_EVERY === 1) snap.meta = w.cars.map((c) => gpCarMeta(c));
    return snap;
  }
}

export function gpCarMeta(c: GpCar): GpCarMeta {
  return [c.slot, [...c.laps], c.qualiMs, c.qualiStartT, c.finishMs, c.pitStops, [...c.bestSectors], [...c.sectorT]];
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
  c.pitStops = m[5];
  c.bestSectors = m[6];
  c.sectorT = m[7];
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
  /** Fase do último estado: na troca (classificação para corrida) o relógio do líder recomeça do zero. */
  private ph: GpSnapshot['ph'] | null = null;
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
    return { v: GP_NET_VERSION, rows: this.history.slice(-4) };
  }

  /** Relógio do jogo agora (s), pelo do líder. */
  hostClock(now: number): number {
    return this.hostT + Math.max(0, now - this.hostAt) / 1000;
  }

  /** Chegou um estado do líder (`now` em ms, relógio deste aparelho). */
  receive(s: GpSnapshot, now: number) {
    const w = this.world;
    if (!s || s.v !== GP_NET_VERSION || !Array.isArray(s.cars)) return;
    if ((s.ph === 'r') !== (w.phase === 'race')) return;
    if (s.ph !== this.ph) {
      // fase nova: a hora volta a zero (sem isto, todo estado da corrida pareceria mais velho que o da classificação)
      this.ph = s.ph;
      this.hostT = -Infinity;
      this.buffers.clear();
      this.shown.clear();
    }
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
    const mine = w.car(this.meId);
    for (const row of s.full ?? []) {
      if (mine && row[0] === mine.slot) this.reconcile(mine, row[1]!, row.slice(2));
    }
    for (const row of s.cars) {
      if (!Array.isArray(row) || row.length < GP_LEAN_LEN) continue;
      const slot = row[0]!;
      if (mine && slot === mine.slot) continue;
      const buf = this.buffers.get(slot) ?? [];
      buf.push({ at: now, state: row.slice(1) });
      while (buf.length > 30) buf.shift();
      this.buffers.set(slot, buf);
    }
  }

  /** Refaz a previsão do próprio carro a partir do estado do líder e guarda a diferença para sumir aos poucos. */
  private reconcile(car: GpCar, ack: number, state: number[]) {
    const w = this.world;
    const before = { x: car.x, z: car.z, h: car.h };
    w.unpack(car, state);
    this.history = this.history.filter((row) => row[0] > ack);
    for (const row of this.history) w.step(GP_DT, { [this.meId]: unpackInput(row) }, this.meId);
    // eventos da reprevisão não valem (os de verdade vêm do líder)
    w.drainEvents();
    const dx = before.x - car.x;
    const dz = before.z - car.z;
    const dh = Math.atan2(Math.sin(before.h - car.h), Math.cos(before.h - car.h));
    const jump = Math.hypot(dx, dz);
    this.corrections += 1;
    this.maxCorrection = Math.max(this.maxCorrection, jump);
    // erro grande demais (batida de verdade, corte, ida para a largada): aceita na hora
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
      const h = a.state[2]! + dh * f;
      const speed = f < 1 ? lerp(3) : b.state[3]!;
      const vx = Math.sin(h) * speed;
      const vz = -Math.cos(h) * speed;
      // passou do último estado (estado atrasado/perdido): anda um pouco pela velocidade, no máximo 150 ms
      const late = Math.min(0.15, Math.max(0, when - b.at) / 1000);
      const x = (f < 1 ? lerp(0) : b.state[0]!) + (f >= 1 ? vx * late : 0);
      const z = (f < 1 ? lerp(1) : b.state[1]!) + (f >= 1 ? vz * late : 0);
      // segue o alvo: anda pela velocidade e corrige a diferença aos poucos (longe demais, vai direto)
      let sh = this.shown.get(slot);
      if (!sh || Math.hypot(sh.x - x, sh.z - z) > 8) sh = { x, z, h };
      else {
        const kk = 1 - Math.exp(-dt * 18);
        sh.x += vx * dt;
        sh.z += vz * dt;
        sh.x += (x - sh.x) * kk;
        sh.z += (z - sh.z) * kk;
        sh.h += Math.atan2(Math.sin(h - sh.h), Math.cos(h - sh.h)) * Math.min(1, kk * 1.5);
      }
      this.shown.set(slot, sh);
      const flags = s[7]!;
      w.setRemote(car.id, {
        x: sh.x,
        z: sh.z,
        h: sh.h,
        vx,
        vz,
        speed,
        spin: 0,
        prog: f < 1 ? lerp(5) : b.state[5]!,
        steer: s[4]!,
        gear: s[6]!,
        pit: (flags & 1) === 1,
        drs: (flags & 2) === 2,
        wear: s[8]!,
        skid: s[9]!,
        slip: s[10]!,
        driftDir: (flags & 4) === 4 ? -1 : (flags & 8) === 8 ? 1 : 0,
        hop: (flags & 16) === 16 ? 0.1 : 0,
        boostLevel: s[11]!,
        bar: s[12]!,
      });
      // estados velhos demais saem do buffer
      while (buf.length > 2 && buf[1]!.at < when - 200) buf.shift();
    }
  }
}

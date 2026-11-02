import { PP_STROKES, type PpStroke } from './paddle';
import {
  PP_PAD_R,
  PP_PAD_X,
  PP_REACH_MAX,
  PP_CATCH,
  PP_SERVE_AUTO,
  PP_SPIN_MAX,
  PP_TICK,
  PP_V_MAX,
  PP_SMASH_V,
} from './constants';
import {
  PpMatch,
  ppIdleInput,
  type PpEvent,
  type PpHitRecord,
  type PpInput,
  type PpSnapshot,
} from './match';

/** O que viaja pela rede: o lançamento do saque e a batida resolvida por quem bateu. `t` é o tick da partida. */
export type PpNetEvent =
  | { k: 'toss'; t: number; p: number; x: number; v?: number }
  | ({ k: 'hit'; t: number } & PpHitRecord);

const RING = 96;
/** Bateu atrasado até isto (ticks) ainda vale; mais velho que isso a sala recusa. */
export const PP_LATE_TICKS = 24;

const idle: [PpInput, PpInput] = [ppIdleInput(), ppIdleInput()];
const key = (e: PpNetEvent) => `${e.k}:${e.t}:${e.p}`;

/** Um evento de jogo da partida com o tick em que aconteceu (já sem repetidos). */
export interface PpTimedEvent {
  tick: number;
  e: PpEvent;
}

/**
 * A partida em rede (spec 055, fase 3): a bola é determinística, então todo aparelho (e a sala) roda a mesma
 * `PpMatch` e só os eventos de batida e de lançamento viajam. Evento que chega atrasado faz a partida voltar ao
 * tick dele (foto guardada) e refazer o caminho até agora, e a bola do aparelho de quem recebeu "alcança" a de quem
 * bateu. Só `localPlayer` detecta a própria batida (na hora, sem esperar a rede); quem tem `authority` (a sala) também
 * lança sozinho o saque de quem não faz nada.
 */
export class PpNetSim {
  readonly match: PpMatch;
  private ring: (PpSnapshot | null)[] = new Array<PpSnapshot | null>(RING).fill(null);
  private log: PpNetEvent[] = [];
  private native = new Set<string>();
  private seen = new Map<string, number>();
  private out: PpNetEvent[] = [];

  constructor(
    firstServer: number,
    readonly localPlayer: number,
    private readonly authority = false,
  ) {
    this.match = new PpMatch(firstServer);
    this.match.net = true;
    this.match.localPlayer = localPlayer;
    this.save();
  }

  get tick(): number {
    return this.match.tick;
  }

  private save() {
    const s = this.match.snapshot();
    this.ring[s.tick % RING] = s;
  }

  private snapAt(tick: number): PpSnapshot | null {
    const s = this.ring[tick % RING];
    return s && s.tick === tick ? s : null;
  }

  /** Onde a bola estava ao fim do tick `tick` (da foto guardada, já refeita se a partida voltou no tempo). */
  ballAt(tick: number): { x: number; y: number; z: number } | null {
    const s = this.snapAt(Math.floor(tick));
    return s ? { x: s.b[0] ?? 0, y: s.b[1] ?? 0, z: s.b[2] ?? 0 } : null;
  }

  private tossAt(n: number): PpNetEvent | undefined {
    return this.log.find((e) => e.k === 'toss' && e.t === n);
  }

  /** Um tick adiante (com os eventos do registro deste tick). `emit` recebe os eventos de jogo novos. */
  private stepOne(input: PpInput | null, emit: ((t: PpTimedEvent) => void) | null) {
    const m = this.match;
    const n = m.tick + 1;
    if (m.phase === 'serve') {
      const te = this.tossAt(n);
      if (te && te.k === 'toss') {
        m.tossReq = te.x;
        m.tossReqV = te.v ?? 0.5;
      } else if (this.authority && !m.replay && m.t + PP_TICK >= PP_SERVE_AUTO) {
        // quem não saca a tempo tem o lançamento feito pela sala (e a bola cai: falta)
        const ev: PpNetEvent = { k: 'toss', t: n, p: m.server, x: m.pad(m.server).x, v: 0.5 };
        this.log.push(ev);
        this.out.push(ev);
        m.tossReq = ev.x;
        m.tossReqV = 0.5;
      }
    }
    const inputs: [PpInput, PpInput] =
      input && !m.replay ? (this.localPlayer === 0 ? [input, idle[1]] : [idle[0], input]) : idle;
    m.step(inputs);
    // o que o próprio aparelho detectou: entra no registro (já aplicado) e sai para a rede
    for (const h of m.hitOut) {
      const ev: PpNetEvent = { k: 'hit', ...h };
      this.native.add(key(ev));
      this.log.push(ev);
      this.out.push(ev);
    }
    for (const t of m.tossOut) {
      const ev: PpNetEvent = { k: 'toss', t: t.t, p: m.server, x: t.x, v: t.v };
      this.native.add(key(ev));
      this.log.push(ev);
      this.out.push(ev);
    }
    m.hitOut = [];
    m.tossOut = [];
    // as batidas dos outros (ou todas, se estamos refazendo o passado) entram no fim do tick
    for (const e of this.log) {
      if (e.k !== 'hit' || e.t !== n) continue;
      if (!m.replay && this.native.has(key(e))) continue;
      m.applyHit(e);
    }
    this.save();
    for (const e of m.drain()) {
      const id = `${n}|${e.type}|${'p' in e ? e.p : 'side' in e ? e.side : ''}`;
      if (this.seen.has(id)) continue;
      this.seen.set(id, n);
      emit?.({ tick: n, e });
    }
  }

  /** Anda até o tick `target` (nunca para trás); `input` é a entrada de quem joga aqui. */
  advanceTo(target: number, input: PpInput | null = null): PpTimedEvent[] {
    const evs: PpTimedEvent[] = [];
    let guard = 0;
    while (this.match.tick < target && guard++ < 600) this.stepOne(input, (t) => evs.push(t));
    if (this.match.tick % 240 === 0) {
      for (const [k, t] of this.seen) if (t < this.match.tick - RING * 2) this.seen.delete(k);
      // a sala guarda tudo (quem entra no meio ou volta refaz a partida pelo histórico); os aparelhos só o que cabe na volta no tempo
      if (!this.authority) this.log = this.log.filter((e) => e.t >= this.match.tick - RING);
    }
    return evs;
  }

  /** Aceita um evento (da rede). Se for do passado, volta no tempo e refaz até agora. */
  add(ev: PpNetEvent): { ok: boolean; events: PpTimedEvent[] } {
    const dup = this.log.some((e) => key(e) === key(ev));
    if (dup) return { ok: false, events: [] };
    const m = this.match;
    if (ev.t > m.tick) {
      this.log.push(ev);
      return { ok: true, events: [] };
    }
    const base = this.snapAt(ev.t - 1);
    if (!base) return { ok: false, events: [] };
    this.log.push(ev);
    return { ok: true, events: this.rewind(base, m.tick) };
  }

  /** Tira um evento do registro (a sala o recusou): refaz a partida sem ele. */
  remove(ev: Pick<PpNetEvent, 'k' | 't' | 'p'>): PpTimedEvent[] {
    const id = `${ev.k}:${ev.t}:${ev.p}`;
    const i = this.log.findIndex((e) => key(e) === id);
    if (i < 0) return [];
    this.log.splice(i, 1);
    this.native.delete(id);
    const base = this.snapAt(ev.t - 1);
    if (!base) return [];
    return this.rewind(base, this.match.tick);
  }

  private rewind(base: PpSnapshot, until: number): PpTimedEvent[] {
    const m = this.match;
    const evs: PpTimedEvent[] = [];
    m.restore(base);
    m.replay = true;
    while (m.tick < until) this.stepOne(null, (t) => evs.push(t));
    m.replay = false;
    return evs;
  }

  /** Eventos criados aqui (batida detectada, saque lançado) que a rede ainda não recebeu. */
  outgoing(): PpNetEvent[] {
    const o = this.out;
    this.out = [];
    return o;
  }

  /** Todos os eventos do registro (para quem entra no meio da partida). */
  history(): PpNetEvent[] {
    return [...this.log].sort((a, b) => a.t - b.t);
  }

  /**
   * A sala confere um evento antes de aceitar: refaz o tick dele numa partida de rascunho e vê se a batida (ou o
   * lançamento) faz sentido ali: era a vez da pessoa, a bola estava perto, a velocidade e o efeito são possíveis.
   */
  validate(ev: PpNetEvent, sender: number): boolean {
    if (ev.p !== sender || (ev.p !== 0 && ev.p !== 1)) return false;
    if (!Number.isInteger(ev.t) || ev.t > this.match.tick + 6) return false;
    if (ev.t < this.match.tick - PP_LATE_TICKS) return false;
    // ponto de partida: a foto mais perto antes do tick do evento (o evento pode estar um pouco no futuro)
    const base = this.snapAt(Math.min(ev.t - 1, this.match.tick));
    if (!base) return false;
    const s = new PpMatch(base.firstServer);
    s.net = true;
    s.replay = true;
    s.restore(base);
    const others = this.log.filter((e) => key(e) !== key(ev));
    const stepTo = (target: number) => {
      while (s.tick < target) {
        const n = s.tick + 1;
        const tossAt = others.find((e) => e.k === 'toss' && e.t === n);
        if (tossAt && tossAt.k === 'toss') {
          s.tossReq = tossAt.x;
          s.tossReqV = tossAt.v ?? 0.5;
        }
        s.step(idle);
        for (const e of others) if (e.k === 'hit' && e.t === n) s.applyHit(e);
        s.drain();
      }
    };
    stepTo(ev.t - 1);
    const toss = others.find((e) => e.k === 'toss' && e.t === ev.t);
    if (toss && toss.k === 'toss') {
      s.tossReq = toss.x;
      s.tossReqV = toss.v ?? 0.5;
    }
    if (ev.k === 'toss') {
      if (s.phase !== 'serve' || s.server !== ev.p) return false;
      if (!Number.isFinite(ev.x) || Math.abs(ev.x) > PP_PAD_X + 0.01) return false;
      return true;
    }
    s.step(idle);
    for (const e of others) if (e.k === 'hit' && e.t === ev.t) s.applyHit(e);
    // a batida chega com a bola do fim do tick: aqui a bola já andou o mesmo tanto
    if (ev.b.length !== 9 || !ev.b.every(Number.isFinite)) return false;
    if (s.phase !== 'toss' && s.phase !== 'rally') return false;
    if (ev.serve !== (s.phase === 'toss')) return false;
    if (s.expect !== ev.p) return false;
    if (!ev.serve && (s.bounces[ev.p] ?? 0) < 1) return false;
    const d = Math.hypot(ev.b[0]! - s.ball.x, ev.b[1]! - s.ball.y, ev.b[2]! - s.ball.z);
    // a raquete avança até PP_REACH_MAX do plano de espera: o contato pode estar um pouco mais perto da rede
    if (d > PP_PAD_R + PP_REACH_MAX + PP_CATCH + 0.5) return false;
    if (Math.hypot(ev.b[3]!, ev.b[4]!, ev.b[5]!) > Math.max(PP_V_MAX * 1.1, PP_SMASH_V[3] * 1.4))
      return false;
    if (Math.hypot(ev.b[6]!, ev.b[7]!, ev.b[8]!) > PP_SPIN_MAX * 1.1) return false;
    return true;
  }
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Lê um evento que veio da rede (de qualquer um): devolve `null` se o formato não bate. */
export function ppParseNetEvent(v: unknown): PpNetEvent | null {
  if (!v || typeof v !== 'object') return null;
  const e = v as Record<string, unknown>;
  if (!Number.isInteger(e.t) || (e.p !== 0 && e.p !== 1)) return null;
  const t = e.t as number;
  const p = e.p as number;
  if (e.k === 'toss')
    return finite(e.x)
      ? { k: 'toss', t, p, x: e.x, v: finite(e.v) ? Math.max(0, Math.min(1, e.v)) : 0.5 }
      : null;
  if (e.k !== 'hit') return null;
  const q = e.quality;
  if (q !== 'edge' && q !== 'normal' && q !== 'sweet') return null;
  if (!Array.isArray(e.b) || e.b.length !== 9 || !e.b.every(finite)) return null;
  if (!finite(e.kmh) || !finite(e.spin)) return null;
  return {
    k: 'hit',
    t,
    p,
    serve: e.serve === true,
    smash: e.smash === true,
    kmh: Math.round(e.kmh),
    quality: q,
    spin: e.spin,
    stroke: PP_STROKES.includes(e.stroke as PpStroke) ? (e.stroke as PpStroke) : 'normal',
    tier: finite(e.tier) ? Math.max(0, Math.min(3, Math.round(e.tier))) : 0,
    b: e.b as number[],
  };
}

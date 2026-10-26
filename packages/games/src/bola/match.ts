import { createRng } from '../core/rng';
import { bolBotInput, newBolBotMemory, type BolBotMemory } from './bots';
import { BOL_DT, BOL_TEAM_COLORS, BOL_TEAM_NAMES } from './constants';
import { BolWorld, type BolEvent, type BolInfo, type BolInput } from './world';

const BOT_NAMES = [
  'Faísca',
  'Pipoca',
  'Trufa',
  'Ruivo',
  'Brisa',
  'Nuvem',
  'Cacau',
  'Fumaça',
  'Jujuba',
  'Mingau',
  'Biscoito',
  'Pimenta',
];
/** Quanto tempo de jogo se aceita recuperar de uma vez (s): se ficar para trás além disto, pula. */
const MAX_CATCHUP = 0.1;
/** De quanto em quanto tempo as estatísticas vão junto com o fluxo (s). */
const STATS_EVERY = 1;

/** Entrada de uma pessoa: direção, pulos pendentes e o último número de sequência recebido. */
interface Pilot {
  mx: number;
  mz: number;
  /** Contador de pulos do cliente; a partida vê quando sobe. */
  seen: number | null;
  pending: number;
  ack: number;
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Pedido que a partida não pode atender (time cheio, bot que já saiu...); a sala mostra o texto. */
export class BolaMatchError extends Error {}

export interface BolaMatchOptions {
  teams: number;
  perTeam: number;
  durationSec: number;
  /** Semente dos bots (a mesma para todos os aparelhos que repetirem a partida). */
  seed: string;
  /** Quem joga (sem bots), na ordem de chegada. */
  humans: readonly BolInfo[];
  /** Bots por time. */
  bots: readonly number[];
  /** Pessoas sem conexão: o corpo fica em campo, controlado por bot. */
  away?: Iterable<string>;
  /** Relógio em ms (o do servidor ou o do aparelho do líder). */
  now: () => number;
}

/**
 * A partida do Fut Fox sem rede: o mundo, as entradas das pessoas, os bots, as vagas numéricas do fluxo e o quadro
 * (`drainFrame`) que vai para os aparelhos. O servidor da sala usa esta classe, e o aparelho do líder também (partida
 * "ponto a ponto"): os dois caminhos geram exatamente o mesmo fluxo, então o cliente é um só.
 */
export class BolaMatch {
  readonly world: BolWorld;
  /** Vaga numérica de cada corpo no fluxo (id do corpo → vaga). Estável mesmo quando o dono do corpo muda. */
  readonly slots = new Map<string, number>();
  readonly away = new Set<string>();
  private nextSlot = 0;
  private pilots = new Map<string, Pilot>();
  private brains = new Map<string, BolBotMemory>();
  private rng: () => number;
  private last: number;
  private acc = 0;
  private botSeq = 0;
  private out: Record<string, unknown>[] = [];
  private statsAt = 0;
  private sendStats = true;
  private dirty = true;
  private evSeq = 0;
  private readonly teams: number;
  private readonly now: () => number;

  constructor(o: BolaMatchOptions) {
    this.teams = o.teams;
    this.now = o.now;
    this.rng = createRng(`${o.seed}:bola`);
    for (const id of o.away ?? []) this.away.add(id);
    const infos: BolInfo[] = [];
    for (let t = 0; t < o.teams; t++) {
      for (const h of o.humans) if (h.team === t) infos.push(h);
      for (let i = 0; i < (o.bots[t] ?? 0); i++) {
        infos.push({
          id: this.botId(),
          name: this.botName(),
          color: BOL_TEAM_COLORS[t] as number,
          team: t,
          bot: true,
        });
      }
    }
    this.world = new BolWorld(infos, {
      teams: o.teams,
      perTeam: o.perTeam,
      durationSec: o.durationSec,
    });
    for (const p of this.world.players) {
      this.slots.set(p.id, this.nextSlot++);
      if (!p.bot) this.pilots.set(p.id, this.newPilot());
      else this.brains.set(p.id, this.newBrain(p.team, this.slots.get(p.id) ?? 0));
    }
    this.last = this.now();
  }

  private botId() {
    return `bot${this.botSeq++}`;
  }

  private botName() {
    return BOT_NAMES[this.botSeq % BOT_NAMES.length] as string;
  }

  private newPilot(): Pilot {
    return { mx: 0, mz: 0, seen: null, pending: 0, ack: 0 };
  }

  private newBrain(team: number, i: number): BolBotMemory {
    return newBolBotMemory(
      (team + 1 + (i % Math.max(1, this.teams - 1))) % this.teams,
      0.2 + (i % 3) * 0.05,
    );
  }

  /** Algo que pede um estado completo para todos mudou (gol, fim...): vale uma vez e zera. */
  takeDirty(): boolean {
    const d = this.dirty;
    this.dirty = false;
    return d;
  }

  markDirty() {
    this.dirty = true;
    this.sendStats = true;
  }

  get over(): boolean {
    return this.world.phase === 'over';
  }

  slotOf(id: string | null): number {
    return id === null ? -1 : (this.slots.get(id) ?? -1);
  }

  /** A entrada da própria raposa: [mx, mz, contador de pulos, número de sequência]. Inválido é ignorado. */
  input(id: string, v: unknown): void {
    const pilot = this.pilots.get(id);
    if (!pilot || !Array.isArray(v) || v.length !== 4 || !v.every(finite)) return;
    const [mx, mz, jumps, seq] = v as number[];
    const mag = Math.hypot(mx!, mz!);
    const k = mag > 1 ? 1 / mag : 1;
    pilot.mx = mx! * k;
    pilot.mz = mz! * k;
    const j = Math.trunc(jumps!);
    // o primeiro relato só combina o contador; depois, cada aumento é um aperto (no máximo 3 por vez)
    if (pilot.seen === null || j < pilot.seen) pilot.seen = j;
    else if (j > pilot.seen) {
      pilot.pending = Math.min(3, pilot.pending + (j - pilot.seen));
      pilot.seen = j;
    }
    pilot.ack = Math.max(pilot.ack, Math.trunc(seq!));
  }

  /** Troca de time no meio da partida: o corpo antigo vira bot; no time novo, assume um bot ou ocupa uma vaga livre. */
  switchTeam(id: string, name: string, to: number, botId: string | null) {
    const w = this.world;
    const perTeam = w.field.perTeam;
    if (to >= 0) {
      const humans = w.players.filter((p) => !p.bot && p.team === to && p.id !== id).length;
      if (humans >= perTeam) throw new BolaMatchError(`O time ${BOL_TEAM_NAMES[to]} está cheio`);
      if (botId) {
        if (!w.players.some((p) => p.bot && p.team === to && p.id === botId)) {
          throw new BolaMatchError('Esse bot já saiu do lugar: escolha outro');
        }
      } else if (w.players.filter((p) => p.team === to && p.id !== id).length >= perTeam) {
        throw new BolaMatchError(
          `O time ${BOL_TEAM_NAMES[to]} não tem vaga livre: entre no lugar de um bot`,
        );
      }
    }
    if (w.player(id)) this.toBot(id);
    this.away.delete(id);
    if (to < 0) return;
    const info: BolInfo = { id, name, color: BOL_TEAM_COLORS[to] as number, team: to };
    if (botId) {
      const slot = this.slots.get(botId) ?? this.nextSlot++;
      this.brains.delete(botId);
      this.slots.delete(botId);
      w.takeOver(botId, info);
      this.slots.set(id, slot);
    } else {
      w.addPlayer(info);
      this.slots.set(id, this.nextSlot++);
    }
    this.pilots.set(id, this.newPilot());
  }

  /** O corpo de uma pessoa passa a ser de um bot (ela saiu, mudou de time ou virou espectadora). */
  toBot(id: string) {
    const w = this.world;
    const p = w.player(id);
    if (!p) return;
    const slot = this.slots.get(id) ?? this.nextSlot++;
    const newId = this.botId();
    w.becomeBot(id, newId, this.botName());
    this.slots.delete(id);
    this.slots.set(newId, slot);
    this.pilots.delete(id);
    this.brains.set(newId, this.newBrain(p.team, slot));
  }

  /** Sem rede, a pessoa continua em campo (bot controla) até voltar. */
  setAway(id: string, away: boolean) {
    if (!this.world.player(id)) return;
    if (away) this.away.add(id);
    else this.away.delete(id);
  }

  endNow() {
    this.world.endNow();
    this.dirty = true;
  }

  private stepOnce() {
    const w = this.world;
    const inputs: Record<string, BolInput> = {};
    for (const p of w.players) {
      const pilot = this.pilots.get(p.id);
      if (pilot && !p.bot && !this.away.has(p.id)) {
        const jump = pilot.pending > 0;
        if (jump) pilot.pending -= 1;
        inputs[p.id] = { mx: pilot.mx, mz: pilot.mz, jump };
      } else {
        let brain = this.brains.get(p.id);
        if (!brain) {
          brain = this.newBrain(p.team, this.slots.get(p.id) ?? 0);
          this.brains.set(p.id, brain);
        }
        inputs[p.id] = bolBotInput(w, p, brain, this.rng);
      }
    }
    w.step(BOL_DT, inputs);
    for (const e of w.drainEvents()) this.collect(e);
  }

  /** Avança a partida até o relógio de agora (no máximo 8 passos por chamada). Devolve quantos passos andou. */
  tick(): number {
    const t = this.now();
    this.acc += Math.min(MAX_CATCHUP, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    let steps = 0;
    while (this.acc >= BOL_DT && steps < 8) {
      this.stepOnce();
      this.acc -= BOL_DT;
      steps++;
    }
    return steps;
  }

  private push(e: Record<string, unknown>) {
    // cada evento tem um número: o fluxo pode repetir eventos (canal sem garantia) e o aparelho descarta os já vistos
    this.out.push({ ...e, n: ++this.evSeq });
  }

  /** Eventos para o fluxo (com vagas no lugar de ids) e quais pedem um estado completo para todos. */
  private collect(e: BolEvent) {
    switch (e.type) {
      case 'goal':
        this.push({
          t: 'goal',
          gt: e.goalTeam,
          sc: this.slotOf(e.scorerId),
          st: e.scorerTeam,
          own: e.own,
          ow: this.slotOf(e.ownerId),
          nt: e.noTouch,
          as: this.slotOf(e.assistId),
        });
        this.markDirty();
        break;
      case 'nogoal':
        this.push({ t: 'nogoal', gt: e.goalTeam, ow: this.slotOf(e.ownerId) });
        this.markDirty();
        break;
      case 'touch':
        if (e.power > 3) this.push({ t: 'touch', s: this.slotOf(e.id), p: Math.round(e.power) });
        break;
      case 'kick':
        this.push({ t: 'kick', s: this.slotOf(e.id) });
        break;
      case 'bounce':
      case 'wall':
        this.push({ t: e.type, p: Math.round(e.power) });
        break;
      case 'jump':
        this.push({ t: 'jump', s: this.slotOf(e.id) });
        break;
      case 'airjump':
        this.push({ t: 'airjump', s: this.slotOf(e.id), f: e.flip });
        break;
      case 'warn':
        this.push({ t: 'warn', l: e.left });
        break;
      case 'start':
      case 'golden':
      case 'ballreset':
        this.push({ t: e.type });
        this.dirty = true;
        break;
      case 'over':
        this.push({ t: 'over', w: e.winner });
        this.markDirty();
        break;
      default:
        break;
    }
  }

  /** Pede estatísticas no próximo quadro (fim da partida, mudança de elenco). */
  wantStats() {
    this.sendStats = true;
  }

  /**
   * O quadro do fluxo: bola, corpos, placar, relógio e os eventos desde o último.
   * `running`: a partida está valendo; fora dela só sai quadro se sobrou evento ou estatística a entregar.
   */
  drainFrame(running: boolean): Record<string, unknown> | null {
    const w = this.world;
    if (!running && this.out.length === 0 && !this.sendStats) return null;
    const codes = { countdown: 'c', play: 'p', goal: 'g', over: 'o' } as const;
    const b = w.ball;
    const t = this.now();
    const frame: Record<string, unknown> = {
      /** Hora de quem simula (ms) deste estado: o aparelho interpola pela hora, não pela chegada. */
      t,
      ph: codes[w.phase],
      tm: r2(w.timer),
      ck: Math.round(w.clock * 10) / 10,
      sc: w.scores,
      gd: w.golden ? 1 : 0,
      gs: Math.round(w.goldenStart * 10) / 10,
      b: [r2(b.x), r2(b.y), r2(b.z), r2(b.vx), r2(b.vy), r2(b.vz)],
      p: w.players.map((p) => [
        this.slots.get(p.id) ?? -1,
        r2(p.x),
        r2(p.y),
        r2(p.z),
        r2(p.vx),
        r2(p.vy),
        r2(p.vz),
        r2(p.heading),
        (p.grounded ? 1 : 0) + (p.flipT > 0 ? 2 : 0) + (p.airJumped ? 4 : 0),
        this.pilots.get(p.id)?.ack ?? 0,
      ]),
      ev: this.out,
    };
    this.out = [];
    if (this.sendStats || t - this.statsAt >= STATS_EVERY * 1000) {
      this.sendStats = false;
      this.statsAt = t;
      frame.st = {
        r: w.players.map((p) => [
          this.slots.get(p.id) ?? -1,
          p.stats.goals,
          p.stats.assists,
          p.stats.ownGoals,
          p.stats.touches,
          p.stats.kicks,
        ]),
        po: w.possession.map(r2),
        ce: w.celebrating,
      };
    }
    return frame;
  }

  /** A lista de corpos com a vaga de cada um (o aparelho a usa para saber quem é quem no fluxo). */
  roster(): {
    slot: number;
    id: string;
    name: string;
    team: number;
    bot: boolean;
    away: boolean;
  }[] {
    return this.world.players.map((p) => ({
      slot: this.slots.get(p.id) ?? -1,
      id: p.id,
      name: p.name,
      team: p.team,
      bot: !!p.bot,
      away: this.away.has(p.id),
    }));
  }

  /** Colocação por time (empate divide a posição). */
  placements(): Map<number, number> {
    return bolPlacements(this.world.scores);
  }
}

/** Colocação por time a partir do placar (empate divide a posição). */
export function bolPlacements(scores: readonly number[]): Map<number, number> {
  const order = scores.map((s, t) => ({ s, t })).sort((a, b) => b.s - a.s);
  const place = new Map<number, number>();
  order.forEach((o, i) =>
    place.set(
      o.t,
      i > 0 && order[i - 1]!.s === o.s ? (place.get(order[i - 1]!.t) as number) : i + 1,
    ),
  );
  return place;
}

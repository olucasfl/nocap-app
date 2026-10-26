import {
  BOL_DT,
  BOL_DURATION,
  BOL_MAX_PLAYERS,
  BOL_ROOM_MAX,
  BOL_TEAM_COLORS,
  BOL_TEAM_NAMES,
  BolWorld,
  bolBotInput,
  bolSuggestFormat,
  createRng,
  newBolBotMemory,
  type BolBotMemory,
  type BolEvent,
  type BolInfo,
  type BolInput,
} from '@nocap/games';
import { ColorRoomEngine, RoomError, type EngineOptions, type FinalRow } from './color-room.engine';

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
/** Quanto tempo de jogo o servidor aceita recuperar de uma vez (s): se ficar para trás além disto, pula. */
const MAX_CATCHUP = 0.1;
/** De quanto em quanto tempo as estatísticas vão junto com o fluxo (s). */
const STATS_EVERY = 1;

/** Entrada de uma pessoa: direção, pulos pendentes e o último número de sequência recebido. */
interface Pilot {
  mx: number;
  mz: number;
  /** Contador de pulos do cliente; o servidor vê quando sobe. */
  seen: number | null;
  pending: number;
  ack: number;
}

export interface BolaFormatState {
  teams: number;
  perTeam: number;
  /** O formato acompanha a quantidade de pessoas até o líder escolher um. */
  auto: boolean;
  /** Duração da partida (min). */
  minutes: number;
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * O Fut Fox em sala (spec 046, fase 2). Diferente do Desmorona!, aqui o SERVIDOR simula tudo (bola, raposas e
 * gols) a 60 passos por segundo e manda o estado a cada tick: cada aparelho só envia a entrada (direção e pulos) e
 * desenha o que recebe. Sem ranking nem histórico. A sala aceita até 15 pessoas; até 12 jogam (3x3x3x3) e o resto
 * assiste. Times vazios podem ser completados com bots, e quem sai no meio deixa um bot no lugar.
 */
export class BolaRoomEngine extends ColorRoomEngine {
  override readonly game = 'bola' as const;
  override readonly persistable = false;
  protected override readonly minPlayers = 1;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ['classico'];

  private format: BolaFormatState = {
    teams: 2,
    perTeam: 1,
    auto: true,
    minutes: BOL_DURATION / 60,
  };
  /** Time de cada pessoa; quem não está aqui é espectador. */
  private teamOf = new Map<string, number>();
  /** Quem escolheu ser espectador (não entra em time sozinho). */
  private chose = new Set<string>();
  /** Bots pedidos pelo líder por time (só vale no lobby). */
  private bots: number[] = [0, 0, 0, 0];
  private world: BolWorld | null = null;
  /** Vaga numérica de cada corpo no fluxo (id do corpo → vaga). Estável mesmo quando o dono do corpo muda. */
  private slots = new Map<string, number>();
  private nextSlot = 0;
  private pilots = new Map<string, Pilot>();
  private brains = new Map<string, BolBotMemory>();
  /** Gente sem conexão: o corpo continua em campo, controlado por bot. */
  private away = new Set<string>();
  private rng: () => number = createRng('bola');
  private last = 0;
  private acc = 0;
  private botSeq = 0;
  private dirty = false;
  private out: Record<string, unknown>[] = [];
  private statsAt = 0;
  private sendStats = false;

  constructor(opts: EngineOptions) {
    super({ ...opts, maxPlayers: BOL_ROOM_MAX });
    this.mode = 'classico';
    this.settings = { rounds: 1 };
  }

  protected override validSettings(_merged: Record<string, unknown>, mode: string): boolean {
    return mode === 'classico';
  }

  /** Durante a partida o celular é todo do jogo. */
  protected override chatOpen(): boolean {
    return this.phase !== 'play';
  }

  protected override maybeAdvanceFromPick() {}

  protected override toReveal() {
    this.finalize();
  }

  // ---- pessoas ----

  override join(id: string, username: string) {
    const existing = this.members.get(id);
    if (existing) {
      existing.connected = true;
      existing.username = username;
      this.away.delete(id);
      this.ensureHost();
      this.dirty = true;
      return;
    }
    // Entrar no meio da partida é permitido: a pessoa chega como espectador e pode pedir um lugar.
    if (this.members.size >= this.maxPlayers) throw new RoomError('A sala está cheia');
    this.members.set(id, { id, username, connected: true, ready: false, joinedAt: this.now() });
    this.ensureHost();
    if (this.phase === 'lobby') this.refresh();
    this.dirty = true;
  }

  override disconnect(id: string) {
    super.disconnect(id);
    if (this.world?.player(id)) this.away.add(id);
    if (this.phase === 'lobby') this.refresh();
    this.dirty = true;
  }

  override leave(id: string) {
    if (this.world?.player(id)) this.toBot(id);
    this.pilots.delete(id);
    this.teamOf.delete(id);
    this.chose.delete(id);
    this.away.delete(id);
    super.leave(id);
    if (this.phase === 'lobby') this.refresh();
    this.dirty = true;
  }

  // ---- times e formato (lobby) ----

  private humansIn(team: number): number {
    let n = 0;
    for (const t of this.teamOf.values()) if (t === team) n++;
    return n;
  }

  private connectedHumans(): number {
    return [...this.members.values()].filter((m) => m.connected).length;
  }

  /** Ajusta times e bots ao formato: quem não cabe vira espectador (os últimos a entrar saem primeiro). */
  private fit() {
    const { teams, perTeam } = this.format;
    const order = [...this.members.values()].sort((a, b) => b.joinedAt - a.joinedAt);
    for (const m of order) {
      const t = this.teamOf.get(m.id);
      if (t !== undefined && t >= teams) this.teamOf.delete(m.id);
    }
    for (let t = 0; t < teams; t++) {
      let over = this.humansIn(t) - perTeam;
      for (const m of order) {
        if (over <= 0) break;
        if (this.teamOf.get(m.id) === t) {
          this.teamOf.delete(m.id);
          over--;
        }
      }
    }
    for (let t = 0; t < this.bots.length; t++) {
      this.bots[t] =
        t < teams ? Math.max(0, Math.min(this.bots[t] ?? 0, perTeam - this.humansIn(t))) : 0;
    }
  }

  /** Quem ainda não tem time (e não escolheu assistir) entra no time com mais vaga. */
  private autoPlace() {
    const { teams, perTeam } = this.format;
    const order = [...this.members.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    for (const m of order) {
      if (this.teamOf.has(m.id) || this.chose.has(m.id)) continue;
      let best = -1;
      for (let t = 0; t < teams; t++) {
        if (this.humansIn(t) >= perTeam) continue;
        if (best < 0 || this.humansIn(t) < this.humansIn(best)) best = t;
      }
      if (best >= 0) {
        this.teamOf.set(m.id, best);
        this.bots[best] = Math.max(
          0,
          Math.min(this.bots[best] ?? 0, perTeam - this.humansIn(best)),
        );
      }
    }
  }

  /** Recalcula o formato sugerido (se automático), os times e os bots. */
  private refresh() {
    if (this.format.auto) {
      const f = bolSuggestFormat(Math.min(this.connectedHumans(), BOL_MAX_PLAYERS));
      this.format.teams = f.teams;
      this.format.perTeam = f.perTeam;
    }
    this.fit();
    this.autoPlace();
  }

  get suggestedFormat() {
    return bolSuggestFormat(Math.min(this.connectedHumans(), BOL_MAX_PLAYERS));
  }

  /** O líder escolhe o formato (ou volta ao automático) e a duração. */
  setFormat(
    id: string,
    v: { teams?: unknown; perTeam?: unknown; auto?: unknown; minutes?: unknown },
  ) {
    this.requireHost(id);
    this.requirePhase('lobby');
    if (v.minutes !== undefined) {
      if (!Number.isInteger(v.minutes) || (v.minutes as number) < 1 || (v.minutes as number) > 30) {
        throw new RoomError('A duração vai de 1 a 30 minutos');
      }
      this.format.minutes = v.minutes as number;
    }
    if (v.auto === true) this.format.auto = true;
    if (v.teams !== undefined || v.perTeam !== undefined) {
      const teams = v.teams === undefined ? this.format.teams : v.teams;
      const perTeam = v.perTeam === undefined ? this.format.perTeam : v.perTeam;
      if (!Number.isInteger(teams) || (teams as number) < 2 || (teams as number) > 4)
        throw new RoomError('São de 2 a 4 times');
      if (!Number.isInteger(perTeam) || (perTeam as number) < 1 || (perTeam as number) > 3)
        throw new RoomError('São de 1 a 3 raposas por time');
      if ((teams as number) * (perTeam as number) > BOL_MAX_PLAYERS)
        throw new RoomError('Esse formato passa de 12 jogadores');
      this.format.teams = teams as number;
      this.format.perTeam = perTeam as number;
      this.format.auto = false;
    }
    // quem estava em time por causa do formato antigo é redistribuído; as escolhas de espectador ficam
    this.refresh();
    for (const m of this.members.values()) m.ready = false;
    this.dirty = true;
  }

  /** O líder completa um time com bots (ou tira). */
  setBots(id: string, team: unknown, delta: unknown) {
    this.requireHost(id);
    this.requirePhase('lobby');
    if (!Number.isInteger(team) || (team as number) < 0 || (team as number) >= this.format.teams) {
      throw new RoomError('Esse time não existe neste formato');
    }
    if (delta !== 1 && delta !== -1) throw new RoomError('Pedido inválido');
    const t = team as number;
    const next = (this.bots[t] ?? 0) + (delta as number);
    if (next < 0) return;
    if (next + this.humansIn(t) > this.format.perTeam)
      throw new RoomError(`O time ${BOL_TEAM_NAMES[t]} já está cheio`);
    this.bots[t] = next;
    this.dirty = true;
  }

  /** Entra num time (ou vira espectador com -1). No meio da partida assume o lugar de um bot ou ocupa uma vaga livre. */
  setTeam(id: string, team: unknown, botId?: unknown) {
    this.requirePhase('lobby', 'play');
    const m = this.members.get(id);
    if (!m) throw new RoomError('Você não está na sala');
    if (!Number.isInteger(team) || (team as number) < -1 || (team as number) >= this.format.teams) {
      throw new RoomError('Esse time não existe neste formato');
    }
    const to = team as number;
    const cur = this.teamOf.get(id) ?? -1;
    if (cur === to) {
      // quem já está de fora e pede para assistir não volta a ser colocado num time sozinho
      if (to < 0) this.chose.add(id);
      return;
    }
    if (this.world) {
      this.moveLive(id, to, typeof botId === 'string' ? botId : null);
    } else {
      if (to >= 0 && this.humansIn(to) >= this.format.perTeam) {
        throw new RoomError(`O time ${BOL_TEAM_NAMES[to]} está cheio`);
      }
      if (to >= 0) {
        this.teamOf.set(id, to);
        this.chose.delete(id);
        this.bots[to] = Math.max(
          0,
          Math.min(this.bots[to] ?? 0, this.format.perTeam - this.humansIn(to)),
        );
      } else {
        this.teamOf.delete(id);
        this.chose.add(id);
      }
      m.ready = false;
    }
    this.dirty = true;
  }

  // ---- começar ----

  override start(id: string) {
    this.requireHost(id);
    this.requirePhase('lobby');
    const { teams } = this.format;
    for (let t = 0; t < teams; t++) {
      const present =
        [...this.teamOf].filter(([uid, tt]) => tt === t && this.members.get(uid)?.connected)
          .length + (this.bots[t] ?? 0);
      if (present === 0) throw new RoomError(`Falta jogador no time ${BOL_TEAM_NAMES[t]}`);
    }
    const waiting = [...this.teamOf.keys()].filter((uid) => {
      const m = this.members.get(uid);
      return m?.connected && uid !== this.hostId && !m.ready && !this.committed.has(uid);
    });
    if (waiting.length > 0) throw new RoomError('Falta gente marcar "pronto"');
    this.committed.clear();
    this.rematchVotes.clear();
    this.seed = this.newSeed();
    this.rounds = [];
    this.roundIndex = -1;
    this.beginRound();
  }

  protected override beginRound() {
    const { teams, perTeam, minutes } = this.format;
    this.roundIndex = 0;
    this.rounds[0] = {};
    this.slots.clear();
    this.pilots.clear();
    this.brains.clear();
    this.away.clear();
    this.nextSlot = 0;
    this.botSeq = 0;
    this.out = [];
    this.rng = createRng(`${this.seed}:bola`);
    const infos: BolInfo[] = [];
    const ordered = [...this.members.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    for (let t = 0; t < teams; t++) {
      for (const m of ordered) {
        if (this.teamOf.get(m.id) !== t) continue;
        infos.push({ id: m.id, name: m.username, color: BOL_TEAM_COLORS[t] as number, team: t });
        if (!m.connected) this.away.add(m.id);
      }
      for (let i = 0; i < (this.bots[t] ?? 0); i++) {
        infos.push({
          id: this.botId(),
          name: this.botName(),
          color: BOL_TEAM_COLORS[t] as number,
          team: t,
          bot: true,
        });
      }
    }
    this.world = new BolWorld(infos, { teams, perTeam, durationSec: minutes * 60 });
    for (const p of this.world.players) {
      this.slots.set(p.id, this.nextSlot++);
      if (!p.bot) this.pilots.set(p.id, this.newPilot());
      else this.brains.set(p.id, this.newBrain(p.team, this.slots.get(p.id) ?? 0));
    }
    this.phase = 'play';
    this.phaseEndsAt = null;
    this.last = this.now();
    this.acc = 0;
    this.statsAt = 0;
    this.sendStats = true;
    this.dirty = true;
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
    const teams = this.format.teams;
    return newBolBotMemory((team + 1 + (i % Math.max(1, teams - 1))) % teams, 0.2 + (i % 3) * 0.05);
  }

  // ---- durante a partida ----

  /** A entrada da própria raposa: [mx, mz, contador de pulos, número de sequência]. Inválido é ignorado. */
  input(id: string, v: unknown): void {
    const pilot = this.pilots.get(id);
    if (!this.world || !pilot || !Array.isArray(v) || v.length !== 4 || !v.every(finite)) return;
    const [mx, mz, jumps, seq] = v as number[];
    const mag = Math.hypot(mx!, mz!);
    const k = mag > 1 ? 1 / mag : 1;
    pilot.mx = mx! * k;
    pilot.mz = mz! * k;
    const j = Math.trunc(jumps!);
    // o primeiro relato só combina o contador; depois, cada aumento é um aperto (no máximo 3 por vez)
    if (pilot.seen === null) pilot.seen = j;
    else if (j > pilot.seen) {
      pilot.pending = Math.min(3, pilot.pending + (j - pilot.seen));
      pilot.seen = j;
    }
    pilot.ack = Math.max(pilot.ack, Math.trunc(seq!));
  }

  /** Troca de time no meio da partida: o corpo antigo vira bot; no time novo, assume um bot ou ocupa uma vaga livre. */
  private moveLive(id: string, to: number, botId: string | null) {
    const w = this.world as BolWorld;
    const m = this.members.get(id) as { username: string };
    const perTeam = this.format.perTeam;
    if (to >= 0) {
      if (this.humansIn(to) >= perTeam)
        throw new RoomError(`O time ${BOL_TEAM_NAMES[to]} está cheio`);
      if (botId) {
        if (!w.players.some((p) => p.bot && p.team === to && p.id === botId)) {
          throw new RoomError('Esse bot já saiu do lugar: escolha outro');
        }
      } else if (w.players.filter((p) => p.team === to).length >= perTeam) {
        throw new RoomError(
          `O time ${BOL_TEAM_NAMES[to]} não tem vaga livre: entre no lugar de um bot`,
        );
      }
    }
    if (w.player(id)) this.toBot(id);
    this.away.delete(id);
    if (to < 0) {
      this.teamOf.delete(id);
      this.chose.add(id);
      return;
    }
    const info: BolInfo = { id, name: m.username, color: BOL_TEAM_COLORS[to] as number, team: to };
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
    this.teamOf.set(id, to);
    this.chose.delete(id);
  }

  /** O corpo de uma pessoa passa a ser de um bot (ela saiu, mudou de time ou virou espectadora). */
  private toBot(id: string) {
    const w = this.world;
    const p = w?.player(id);
    if (!w || !p) return;
    const slot = this.slots.get(id) ?? this.nextSlot++;
    const newId = this.botId();
    w.becomeBot(id, newId, this.botName());
    this.slots.delete(id);
    this.slots.set(newId, slot);
    this.pilots.delete(id);
    this.brains.set(newId, this.newBrain(p.team, slot));
  }

  /** O líder encerra a partida com o placar de agora. */
  endNow(id: string) {
    this.requireHost(id);
    this.requirePhase('play');
    this.world?.endNow();
    this.dirty = true;
  }

  private stepOnce() {
    const w = this.world as BolWorld;
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

  private slotOf(id: string | null): number {
    return id === null ? -1 : (this.slots.get(id) ?? -1);
  }

  /** Eventos para o fluxo (com vagas no lugar de ids) e quais pedem um estado completo para todos. */
  private collect(e: BolEvent) {
    switch (e.type) {
      case 'goal':
        this.out.push({
          t: 'goal',
          gt: e.goalTeam,
          sc: this.slotOf(e.scorerId),
          st: e.scorerTeam,
          own: e.own,
          ow: this.slotOf(e.ownerId),
          nt: e.noTouch,
          as: this.slotOf(e.assistId),
        });
        this.dirty = true;
        this.sendStats = true;
        break;
      case 'nogoal':
        this.out.push({ t: 'nogoal', gt: e.goalTeam, ow: this.slotOf(e.ownerId) });
        this.sendStats = true;
        this.dirty = true;
        break;
      case 'touch':
        if (e.power > 3)
          this.out.push({ t: 'touch', s: this.slotOf(e.id), p: Math.round(e.power) });
        break;
      case 'kick':
        this.out.push({ t: 'kick', s: this.slotOf(e.id) });
        break;
      case 'bounce':
      case 'wall':
        this.out.push({ t: e.type, p: Math.round(e.power) });
        break;
      case 'jump':
        this.out.push({ t: 'jump', s: this.slotOf(e.id) });
        break;
      case 'airjump':
        this.out.push({ t: 'airjump', s: this.slotOf(e.id), f: e.flip });
        break;
      case 'warn':
        this.out.push({ t: 'warn', l: e.left });
        break;
      case 'start':
      case 'golden':
      case 'ballreset':
        this.out.push({ t: e.type });
        this.dirty = true;
        break;
      case 'over':
        this.out.push({ t: 'over', w: e.winner });
        this.dirty = true;
        break;
      default:
        break;
    }
  }

  override tick(): boolean {
    const w = this.world;
    if (this.phase === 'play' && w) {
      const t = this.now();
      this.acc += Math.min(MAX_CATCHUP, Math.max(0, (t - this.last) / 1000));
      this.last = t;
      let steps = 0;
      while (this.acc >= BOL_DT && steps < 8) {
        this.stepOnce();
        this.acc -= BOL_DT;
        steps++;
      }
      if (w.phase === 'over') this.finalize();
    }
    const changed = this.dirty;
    this.dirty = false;
    return changed;
  }

  private finalize() {
    if (this.phase === 'final') return;
    this.phase = 'final';
    this.phaseEndsAt = null;
    this.sendStats = true;
    this.dirty = true;
  }

  protected override reset() {
    super.reset();
    this.world = null;
    this.slots.clear();
    this.pilots.clear();
    this.brains.clear();
    this.away.clear();
    this.out = [];
    // os times ficam como estavam, mas quem saiu da sala já foi tirado em `leave`
    this.refresh();
  }

  // ---- o que vai para os aparelhos ----

  /** O quadro do fluxo (10 a 30 vezes por segundo): bola, corpos, placar, relógio e os eventos desde o último. */
  drainFrame(): Record<string, unknown> | null {
    const w = this.world;
    if (!w || (this.phase !== 'play' && this.out.length === 0 && !this.sendStats)) return null;
    const codes = { countdown: 'c', play: 'p', goal: 'g', over: 'o' } as const;
    const b = w.ball;
    const frame: Record<string, unknown> = {
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
    const t = this.now();
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

  /** Colocação por time (empate divide a posição). Só vale em `final`. */
  override finalRows(): FinalRow[] {
    const w = this.world;
    if (!w) return [];
    const order = w.scores.map((s, t) => ({ s, t })).sort((a, b) => b.s - a.s);
    const place = new Map<number, number>();
    order.forEach((o, i) =>
      place.set(
        o.t,
        i > 0 && order[i - 1]!.s === o.s ? (place.get(order[i - 1]!.t) as number) : i + 1,
      ),
    );
    return w.players
      .filter((p) => !p.bot)
      .map((p) => ({
        userId: p.id,
        username: p.name,
        totalTenths: (w.scores[p.team] ?? 0) * 10,
        placement: place.get(p.team) ?? 1,
        answers: [],
      }));
  }

  protected override extraSnapshot(viewerId?: string): Record<string, unknown> {
    const w = this.world;
    const members = Object.fromEntries(this.teamOf);
    return {
      bola: {
        me: viewerId ?? null,
        format: { ...this.format },
        suggested: this.suggestedFormat,
        teamOf: members,
        bots: this.bots.slice(0, this.format.teams),
        roster: w
          ? w.players.map((p) => ({
              slot: this.slots.get(p.id) ?? -1,
              id: p.id,
              name: p.name,
              team: p.team,
              bot: !!p.bot,
              away: this.away.has(p.id),
            }))
          : [],
        scores: w ? w.scores : [],
        winner: this.phase === 'final' && w ? w.winner : null,
        durationSec: this.format.minutes * 60,
      },
    };
  }
}

export { RoomError };

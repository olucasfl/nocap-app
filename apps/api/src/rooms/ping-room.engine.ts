import {
  PP_PAD_X,
  PP_PAD_Y_MAX,
  PP_PAD_Y_MIN,
  PP_REACH_NET,
  PP_REACH_BACK,
  PP_ROOM_AWAY_MS,
  PP_ROOM_COUNTDOWN_MS,
  PP_ROOM_OVER_MS,
  PP_ROOM_MAX,
  PP_TICK,
  PpBot,
  PP_BOT_LEVELS,
  PpNetSim,
  ppParseNetEvent,
  type PpBotName,
  type PpNetEvent,
  type PpTimedEvent,
} from '@nocap/games';
import { ColorRoomEngine, RoomError, type EngineOptions, type FinalRow } from './color-room.engine';

const BOT_ID = 'bot';
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** O que a sala devolve ao receber o evento de um jogador. */
export interface PingReceive {
  /** A sala aceitou: repasse a todos (o jogador já aplicou por conta própria). */
  accepted: PpNetEvent | null;
  /** A sala recusou: o jogador precisa desfazer. */
  rejected: PpNetEvent | null;
}

/**
 * O Ping Fox! em sala (spec 055, fase 3). A sala roda a mesma `PpNetSim` dos aparelhos como árbitro: só os eventos de
 * batida e de lançamento viajam (a bola entre dois eventos é uma trajetória que todos calculam igual). Cada jogador
 * decide a própria batida na hora; a sala confere, repassa ao outro e, se for absurda, manda desfazer. Os 2 primeiros
 * da sala jogam; o resto assiste. Sem ranking nem histórico.
 */
export class PingRoomEngine extends ColorRoomEngine {
  override readonly game = 'pingpong' as const;
  override readonly persistable = false;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ['classico'];
  protected override readonly minPlayers = 1;

  /** Quem ocupa cada lado da mesa no lobby (null = vaga livre ou do bot). Quem não está aqui assiste. */
  private slots: [string | null, string | null] = [null, null];
  /** Quem escolheu assistir (não é posto numa vaga sozinho). */
  private watchers = new Set<string>();
  /** O bot do outro lado (o líder põe no lobby): vaga e nível. */
  private bot: { slot: 0 | 1; level: PpBotName } | null = null;
  private botBrain: PpBot | null = null;

  private startAt = 0;
  private firstServer = 0;
  private players: [string, string] | null = null;
  private sim: PpNetSim | null = null;
  /** Eventos que a sala criou (saque lançado sozinho) e ainda não transmitiu. */
  private outbox: PpNetEvent[] = [];
  /** Última posição da raquete de cada jogador: [x, y, smash, hora]. */
  private pads: [number[] | null, number[] | null] = [null, null];
  private away = new Map<string, number>();
  private forfeiter: string | null = null;
  private dirty = false;
  /** Quando a partida acabou (o pódio espera um pouco para o último ponto ser visto). */
  private overAt = 0;
  private stats = { longest: 0, fastest: 0, smashes: [0, 0], hits: [0, 0] };

  constructor(opts: EngineOptions) {
    super({ ...opts, maxPlayers: PP_ROOM_MAX });
    this.mode = 'classico';
    this.settings = { rounds: 1 };
  }

  protected override validSettings(_merged: Record<string, unknown>, mode: string): boolean {
    return mode === 'classico';
  }

  // ---- pessoas ----

  override join(id: string, username: string) {
    super.join(id, username);
    this.away.delete(id);
    if (this.phase === 'lobby') this.seat(id);
  }

  /** Põe a pessoa na primeira vaga livre (sem bot); se não houver, ela assiste. */
  private seat(id: string) {
    if (this.slots.includes(id) || this.watchers.has(id)) return;
    const i = [0, 1].find((k) => this.slots[k] === null && this.bot?.slot !== k);
    if (i !== undefined) this.slots[i] = id;
  }

  /** Quem já estava na sala quando o jogo foi escolhido também ganha a sua vaga. */
  private ensureSeats() {
    for (const k of [0, 1] as const) {
      const id = this.slots[k];
      if (id && !this.members.has(id)) this.slots[k] = null;
    }
    const ordered = [...this.members.values()]
      .filter((m) => m.connected)
      .sort((a, b) => a.joinedAt - b.joinedAt);
    for (const m of ordered) this.seat(m.id);
  }

  /** Entra numa vaga livre (0 ou 1), troca por um bot dela, ou vira espectador (-1). */
  setSlot(id: string, slot: unknown) {
    this.requirePhase('lobby');
    if (!this.members.has(id)) throw new RoomError('Você não está na sala');
    if (slot !== -1 && slot !== 0 && slot !== 1) throw new RoomError('Esse lado não existe');
    this.ensureSeats();
    for (const k of [0, 1] as const) if (this.slots[k] === id) this.slots[k] = null;
    if (slot === -1) {
      this.watchers.add(id);
    } else {
      if (this.slots[slot] && this.slots[slot] !== id)
        throw new RoomError('Esse lado já tem alguém');
      // entrar no lugar do bot tira o bot
      if (this.bot?.slot === slot) this.bot = null;
      this.watchers.delete(id);
      this.slots[slot] = id;
    }
    this.dirty = true;
  }

  /** O líder põe um bot numa vaga livre (com nível) ou tira o bot (`slot` nulo). */
  setBot(id: string, slot: unknown, level: unknown) {
    this.requireHost(id);
    this.requirePhase('lobby');
    this.ensureSeats();
    if (slot === null || slot === undefined) {
      this.bot = null;
    } else {
      if (slot !== 0 && slot !== 1) throw new RoomError('Esse lado não existe');
      if (this.slots[slot]) throw new RoomError('Esse lado já tem uma pessoa');
      const lv =
        typeof level === 'string' && level in PP_BOT_LEVELS ? (level as PpBotName) : 'medio';
      this.bot = { slot, level: lv };
      // só há um bot: o do outro lado
    }
    this.dirty = true;
  }

  override start(id: string) {
    this.requireHost(id);
    this.requirePhase('lobby');
    this.ensureSeats();
    const filled = ([0, 1] as const).every((k) => this.slots[k] || this.bot?.slot === k);
    if (!filled) throw new RoomError('Falta alguém (ou um bot) do outro lado da mesa');
    const waiting = this.slots.some((sid) => {
      if (!sid || sid === this.hostId) return false;
      const m = this.members.get(sid);
      return !!m && m.connected && !m.ready && !this.committed.has(sid);
    });
    if (waiting) throw new RoomError('Falta gente marcar "pronto"');
    this.committed.clear();
    this.rematchVotes.clear();
    this.seed = this.newSeed();
    this.rounds = [];
    this.roundIndex = -1;
    this.beginRound();
  }

  override disconnect(id: string) {
    super.disconnect(id);
    if (this.isPlayer(id) && this.live) this.away.set(id, this.gnow());
  }

  override leave(id: string) {
    if (this.isPlayer(id) && this.live) this.forfeit(id);
    this.away.delete(id);
    super.leave(id);
  }

  private get live(): boolean {
    return this.phase === 'show' || this.phase === 'play';
  }

  private slotOf(id: string): number {
    if (!this.players) return -1;
    return this.players[0] === id ? 0 : this.players[1] === id ? 1 : -1;
  }
  private isPlayer(id: string): boolean {
    return this.slotOf(id) >= 0;
  }

  /** Quem joga (os 2 primeiros conectados, na ordem de chegada). */
  private pickPlayers(): [string, string] {
    this.ensureSeats();
    const at = (k: 0 | 1) => this.slots[k] ?? (this.bot?.slot === k ? BOT_ID : null);
    const a = at(0);
    const b = at(1);
    if (!a || !b) throw new RoomError('Falta alguém (ou um bot) do outro lado da mesa');
    return [a, b];
  }

  // ---- partida ----

  protected override publicSeed(): string {
    return this.seed;
  }

  protected override beginRound() {
    this.roundIndex = 0;
    this.rounds[0] = {};
    this.players = this.pickPlayers();
    // quem saca primeiro vem da seed (os dois aparelhos e a sala chegam ao mesmo)
    let h = 0;
    for (const ch of this.seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
    this.firstServer = h & 1;
    this.resetPause();
    this.startAt = this.now() + PP_ROOM_COUNTDOWN_MS;
    // com bot, a sala é quem joga o lado dele: detecta as batidas do bot e as transmite como as de uma pessoa
    const botSlot = this.players[0] === BOT_ID ? 0 : this.players[1] === BOT_ID ? 1 : -1;
    this.sim = new PpNetSim(this.firstServer, botSlot, true);
    this.botBrain =
      botSlot >= 0 && this.bot ? new PpBot(PP_BOT_LEVELS[this.bot.level], Math.random) : null;
    this.outbox = [];
    this.pads = [null, null];
    this.away.clear();
    this.forfeiter = null;
    this.overAt = 0;
    this.stats = { longest: 0, fastest: 0, smashes: [0, 0], hits: [0, 0] };
    this.phase = 'show';
    this.phaseEndsAt = this.startAt;
  }

  /** Tick da partida agora (o relógio da sala; negativo na contagem vira 0). */
  currentTick(): number {
    return Math.max(0, Math.floor((this.gnow() - this.startAt) / (PP_TICK * 1000)));
  }

  /** Anda a partida da sala até agora e guarda os números do pódio. */
  private advance(): void {
    if (!this.sim) return;
    const target = this.currentTick();
    const brain = this.botBrain;
    const slot = this.sim.localPlayer;
    if (brain && slot >= 0) {
      // o bot decide a cada tick, como faria uma pessoa mexendo o mouse
      while (this.sim.tick < target) {
        this.collect(this.sim.advanceTo(this.sim.tick + 1, brain.input(this.sim.match, slot)));
      }
    } else this.collect(this.sim.advanceTo(target));
    this.outbox.push(...this.sim.outgoing());
  }

  private collect(events: PpTimedEvent[]): void {
    for (const { e } of events) {
      if (e.type === 'hit') {
        const i = e.p === 0 ? 0 : 1;
        this.stats.hits[i] = (this.stats.hits[i] ?? 0) + 1;
        if (e.smash) this.stats.smashes[i] = (this.stats.smashes[i] ?? 0) + 1;
        if (e.kmh > this.stats.fastest) this.stats.fastest = e.kmh;
      } else if (e.type === 'point' && e.rally > this.stats.longest) this.stats.longest = e.rally;
    }
  }

  /** O evento de um jogador (batida ou lançamento): confere e manda repassar ou desfazer. */
  receive(id: string, raw: unknown): PingReceive {
    const none: PingReceive = { accepted: null, rejected: null };
    if (this.phase !== 'play' || !this.sim) return none;
    const slot = this.slotOf(id);
    const ev = ppParseNetEvent(raw);
    if (slot < 0 || !ev) return none;
    this.advance();
    if (!this.sim.validate(ev, slot)) return { accepted: null, rejected: ev };
    const res = this.sim.add(ev);
    if (!res.ok) return { accepted: null, rejected: ev };
    this.collect(res.events);
    this.dirty = true;
    return { accepted: ev, rejected: null };
  }

  /** Posição da raquete de um jogador (cerca de 30 por segundo): só serve para o outro desenhar. */
  report(id: string, v: unknown): void {
    const slot = this.slotOf(id);
    if (slot < 0 || !this.live || !Array.isArray(v) || (v.length !== 3 && v.length !== 4)) return;
    if (!v.every(finite)) return;
    const [x, y, reach, at] = v as number[];
    const now = this.now();
    // a hora em que a pessoa mexeu (relógio da sala): sem ela, vale a hora que chegou
    const sent = at !== undefined && Math.abs(at - now) < 5000 ? at : now;
    this.pads[slot === 0 ? 0 : 1] = [
      r2(clamp(x!, -PP_PAD_X, PP_PAD_X)),
      r2(clamp(y!, PP_PAD_Y_MIN, PP_PAD_Y_MAX)),
      r2(clamp(reach!, -PP_REACH_BACK, PP_REACH_NET)),
      sent,
    ];
  }

  /** As raquetes para o fluxo "ppads": [vaga, x, y, alcance]. */
  padsFrame(): number[][] {
    const out: number[][] = [];
    this.pads.forEach((p, i) => {
      if (p) out.push([i, p[0]!, p[1]!, p[2]!, p[3]!]);
    });
    // a raquete do bot sai da própria partida da sala
    const sim = this.sim;
    if (sim && this.botBrain && sim.localPlayer >= 0) {
      const pad = sim.match.pad(sim.localPlayer);
      out.push([sim.localPlayer, r2(pad.x), r2(pad.y), r2(pad.reach), this.now()]);
    }
    return out;
  }

  /** Eventos da sala a transmitir (saque lançado sozinho). */
  drainOutbox(): PpNetEvent[] {
    const o = this.outbox;
    this.outbox = [];
    return o;
  }

  /** Tudo que já aconteceu na partida (quem entra no meio ou volta). */
  history(): PpNetEvent[] {
    return this.sim?.history() ?? [];
  }

  /** O líder encerra a partida com o placar de agora (empate = os dois em primeiro). */
  endNow(id: string) {
    this.requireHost(id);
    if (this.phase !== 'show' && this.phase !== 'play')
      throw new RoomError('Não há partida para encerrar');
    this.phase = 'final';
    this.phaseEndsAt = null;
    this.dirty = true;
  }

  private forfeit(id: string) {
    if (!this.live || this.forfeiter) return;
    this.forfeiter = id;
    this.phase = 'final';
    this.phaseEndsAt = null;
    this.dirty = true;
  }

  protected override maybeAdvanceFromPick() {}

  protected override toReveal() {
    this.phase = 'final';
    this.phaseEndsAt = null;
  }

  protected override reset() {
    super.reset();
    this.sim = null;
    this.botBrain = null;
    this.players = null;
    this.outbox = [];
    this.forfeiter = null;
  }

  protected override pausable(): boolean {
    return true;
  }

  override tick(): boolean {
    const t = this.gnow();
    if (this.phase === 'show') {
      if (t < this.startAt) return false;
      this.phase = 'play';
      this.phaseEndsAt = null;
      return true;
    }
    if (this.phase !== 'play' || !this.sim) return false;
    for (const [id, at] of this.away) {
      if (t - at > PP_ROOM_AWAY_MS) {
        this.forfeit(id);
        return true;
      }
    }
    const before = this.sim.match.score[0] + this.sim.match.score[1];
    this.advance();
    const after = this.sim.match.score[0] + this.sim.match.score[1];
    if (this.sim.match.phase === 'over') {
      if (this.overAt === 0) this.overAt = t;
      if (t - this.overAt >= PP_ROOM_OVER_MS) {
        this.phase = 'final';
        this.phaseEndsAt = null;
        return true;
      }
    }
    const changed = this.dirty || after !== before;
    this.dirty = false;
    return changed;
  }

  private botName(): string {
    const lv = this.bot?.level ?? 'medio';
    return `Raposa ${lv === 'facil' ? 'Fácil' : lv === 'dificil' ? 'Difícil' : 'Média'}`;
  }

  // ---- resultado ----

  override finalRows(): FinalRow[] {
    if (!this.players || !this.sim) return [];
    const [a, b] = this.sim.match.score;
    const names = (id: string) =>
      id === BOT_ID ? this.botName() : (this.members.get(id)?.username ?? 'Jogador');
    let winner = a === b ? -1 : a > b ? 0 : 1;
    if (this.forfeiter) winner = this.slotOf(this.forfeiter) === 0 ? 1 : 0;
    const rows = this.players.map((id, i) => ({
      userId: id,
      username: names(id),
      totalTenths: (i === 0 ? a : b) * 10,
      placement: winner < 0 ? 1 : winner === i ? 1 : 2,
      answers: [],
    }));
    return rows.filter((r) => r.userId !== BOT_ID).sort((x, y) => x.placement - y.placement);
  }

  protected override extraSnapshot(viewerId?: string): Record<string, unknown> {
    if (this.phase === 'lobby') this.ensureSeats();
    const started = this.phase !== 'lobby' && !!this.players;
    return {
      pingpong: {
        me: viewerId ?? null,
        startAt: started ? this.startAt : null,
        firstServer: this.firstServer,
        players: started ? this.players : null,
        lobby: {
          slots: this.slots,
          bot: this.bot,
          botName: this.botName(),
        },
        score: this.sim ? [this.sim.match.score[0], this.sim.match.score[1]] : [0, 0],
        forfeit: this.forfeiter,
        stats: this.sim
          ? {
              seconds: Math.round(this.sim.tick / 60),
              longest: this.stats.longest,
              fastest: this.stats.fastest,
              smashes: this.stats.smashes,
              hits: this.stats.hits,
            }
          : null,
      },
    };
  }
}

export { RoomError };

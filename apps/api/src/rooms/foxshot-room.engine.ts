import {
  FS_MATCH_BOTS,
  FS_MATCH_MINUTES,
  FS_NET_HZ,
  FsNetSim,
  fsNetParseInput,
  fsMatchConfig,
  type FsNetEvent,
} from '@nocap/games';
import { ColorRoomEngine, RoomError, type AnySettings, type EngineOptions, type FinalRow } from './color-room.engine';

/** Contagem antes de começar (ms). */
export const FOXSHOT_COUNTDOWN_MS = 5000;
/** Contagem quando os aparelhos tentam a conexão direta (WebRTC). */
export const FOXSHOT_P2P_COUNTDOWN_MS = Number(process.env.COUNTER_FOX_P2P_WINDOW_MS) || 7000;
/** Quantas pessoas cabem na sala (quem passa dos 10 jogadores só espectaram). */
export const FOXSHOT_ROOM_MAX = 15;
/** Jogadores humanos + bots numa partida. */
const PLAYERS_MAX = 10;
/** O pódio espera um pouco para o último abate ser visto (ms). */
const OVER_MS = 2500;
/** No máximo estes passos por chamada: se a sala atrasou, anda um pouco mais rápido sem travar tudo. */
const MAX_CATCHUP = 6;
const STEP_MS = 1000 / FS_NET_HZ;

export interface FoxShotSettings {
  rounds: 1;
  minutes: number;
  /** Bots que completam a partida (0 a 9; no máximo 10 jogadores no total). */
  bots: number;
  /** 'dm' mata-mata; 'bomb' modo Bomba (spec 059). */
  /** 'none' = o líder ainda não escolheu o modo (a sala só começa depois). */
  kind: 'none' | 'dm' | 'bomb';
  /** Modo Bomba: bots por time (só entram se o líder pedir). */
  botsCt: number;
  botsTr: number;
  winRounds: number;
  roundSec: number;
  /** Mapa: a Duna, ou a arena de blocos no PvP. */
  map: 'duna' | 'pvp';
  /** Modo PvP (variante do Bomba sem bomba, com dinheiro infinito e mapa próprio); só vale com `kind: 'bomb'`. */
  pvp: boolean;
}

/**
 * A sala do Counter Fox (spec 057): o mata-mata do Duna online. A sala é quem manda: roda a `FsNetSim` (movimento, armas, tiros
 * com compensação de atraso, pontos, renascer, bots) e transmite o quadro cerca de 20 vezes por segundo. Quem sai no meio vira bot.
 * Sem ranking e sem histórico (regra 2 do RULES.md).
 */
export class FoxShotRoomEngine extends ColorRoomEngine {
  override readonly game = 'foxshot' as const;
  override readonly persistable = false;
  protected override readonly answerPhase = 'play' as const;
  protected override readonly modes: readonly string[] = ['mata'];
  protected override readonly minPlayers = 1;

  sim: FsNetSim | null = null;
  /**
   * Quem simula a partida (spec 060): `pending` = os aparelhos tentam conectar ao do líder por WebRTC; `p2p` = o aparelho do
   * líder simula e manda o estado direto aos outros; `server` = esta sala simula (reserva, ou WebRTC desligado).
   */
  p2pEnabled = false;
  private net: 'server' | 'pending' | 'p2p' = 'server';
  private p2pHost = '';
  private p2pDeadline = 0;
  private readonly p2pOk = new Set<string>();
  private p2pBomb: { tr: number; ct: number; winner: 'tr' | 'ct' | null; sides: Record<string, 'tr' | 'ct'> } | null = null;
  private p2pRows: { id: string; name: string; points: number; kills: number; assists: number; deaths: number; place: number }[] | null = null;
  private p2pOver = false;
  private p2pOverAt = 0;
  private simOpts: ConstructorParameters<typeof FsNetSim>[0] | null = null;
  private startAt = 0;
  private overAt = 0;
  private dirty = false;
  /** Time escolhido na sala no modo Bomba (0 contra-terrorista, 1 terrorista, 2 espectar); sem escolha o jogo equilibra. */
  readonly teamPref = new Map<string, 0 | 1 | 2>();

  constructor(opts: EngineOptions) {
    super({ ...opts, maxPlayers: FOXSHOT_ROOM_MAX });
    this.mode = 'mata';
    this.settings = { rounds: 1, minutes: 5, bots: 0, kind: 'none', botsCt: 0, botsTr: 0, winRounds: 8, roundSec: 115, map: 'duna', pvp: false } as unknown as AnySettings;
  }

  /** Bots da partida: no modo Bomba são os dois times somados; no mata-mata, o número escolhido. */
  private botTotal(): number {
    return this.cfg.kind === 'bomb' ? this.cfg.botsCt + this.cfg.botsTr : this.cfg.bots;
  }

  private get cfg(): FoxShotSettings {
    return this.settings as unknown as FoxShotSettings;
  }

  protected override validSettings(merged: Record<string, unknown>, mode: string): boolean {
    const m = merged as unknown as FoxShotSettings;
    return (
      mode === 'mata' &&
      (FS_MATCH_MINUTES as readonly number[]).includes(m.minutes) &&
      Number.isInteger(m.bots) &&
      m.bots >= 0 &&
      m.bots <= FS_MATCH_BOTS.max &&
      (m.kind === 'none' || m.kind === 'dm' || m.kind === 'bomb') &&
      Number.isInteger(m.botsCt) &&
      m.botsCt >= 0 &&
      m.botsCt <= 5 &&
      Number.isInteger(m.botsTr) &&
      m.botsTr >= 0 &&
      m.botsTr <= 5 &&
      Number.isInteger(m.winRounds) &&
      m.winRounds >= (m.pvp ? 1 : 2) &&
      m.winRounds <= (m.pvp ? 30 : 13) &&
      Number.isInteger(m.roundSec) &&
      m.roundSec >= (m.pvp ? 30 : 60) &&
      m.roundSec <= (m.pvp ? 300 : 180) &&
      typeof m.pvp === 'boolean' &&
      (!m.pvp || m.kind === 'bomb') &&
      (m.map === 'duna' || m.map === 'pvp')
    );
  }

  /** Dá para entrar (e ser convidado) com a partida rolando: a pessoa chega espectando e escolhe se joga. */
  override get joinableInPlay(): boolean {
    // na conexão direta quem chega no meio não recebe o jogo (ainda): só entra com o servidor simulando
    return this.net === 'server';
  }

  override join(id: string, username: string) {
    const existing = this.members.get(id);
    if (existing) {
      existing.connected = true;
      existing.username = username;
      this.ensureHost();
      this.dirty = true;
      return;
    }
    if (this.phase === 'lobby' && this.members.size >= PLAYERS_MAX) throw new RoomError('A sala está cheia');
    if (this.members.size >= FOXSHOT_ROOM_MAX) throw new RoomError('A sala está cheia');
    this.members.set(id, { id, username, connected: true, ready: false, joinedAt: this.now() });
    this.ensureHost();
    this.dirty = true;
  }

  /** Troca de time no lobby do modo Bomba: cada um troca o seu; o líder troca o de qualquer um. */
  setTeam(by: string, id: string, team: number): void {
    if (this.phase !== 'lobby') throw new RoomError('Só dá para trocar de time no lobby');
    if (by !== id) this.requireHost(by);
    if (!this.members.has(id)) return;
    if (team !== 0 && team !== 1 && team !== 2) return;
    // cada time tem no máximo 5 (pessoas e bots juntos); espectar não tem limite
    if (team !== 2 && this.teamPref.get(id) !== team) {
      const people = [...this.members.values()].filter((m) => m.id !== id && this.teamPref.get(m.id) === team).length;
      const bots = team === 0 ? this.cfg.botsCt : this.cfg.botsTr;
      if (people + bots >= 5) throw new RoomError('Esse time está cheio');
    }
    this.teamPref.set(id, team);
    this.dirty = true;
  }

  /** Quem está espectando pede para jogar (toma o lugar de um bot ou ganha uma raposa nova). */
  joinPlay(id: string): void {
    const m = this.members.get(id);
    if (!m || !this.sim || (this.phase !== 'play' && this.phase !== 'show')) return;
    if (this.net !== 'server') throw new RoomError('Nesta partida a conexão é direta com o líder: dá para entrar na próxima.');
    if (!this.sim.joinAs(id, m.username)) throw new RoomError('A partida já tem 10 jogadores. Siga espectando.');
    this.dirty = true;
  }

  /** O líder pausa para todo mundo (na sala o relógio da partida para; no ponto a ponto o aparelho do líder também para). */
  protected override pausable(): boolean {
    return true;
  }

  override start(id: string) {
    this.requireHost(id);
    this.requirePhase('lobby');
    const humans = [...this.members.values()].filter((m) => m.connected && !(this.cfg.kind === 'bomb' && this.teamPref.get(m.id) === 2));
    if (humans.length < 1) throw new RoomError('Falta gente jogando: escolha um time');
    if (this.cfg.kind === 'none') throw new RoomError('Escolha o modo de jogo na aba Modo');
    if (humans.length + this.botTotal() < 2) throw new RoomError('Coloque ao menos 1 bot ou chame um amigo');
    if (humans.some((m) => m.id !== this.hostId && !m.ready && !this.committed.has(m.id))) throw new RoomError('Falta gente marcar "pronto"');
    this.committed.clear();
    this.rematchVotes.clear();
    this.seed = this.newSeed();
    this.rounds = [];
    this.roundIndex = -1;
    this.beginRound();
  }

  protected override beginRound() {
    this.roundIndex = 0;
    this.rounds[0] = {};
    const bomb = this.cfg.kind === 'bomb';
    // quem escolheu espectar no modo Bomba não entra na partida (assiste)
    const humans = [...this.members.values()].filter((m) => m.connected && !(bomb && this.teamPref.get(m.id) === 2)).sort((a, b) => a.joinedAt - b.joinedAt);
    const cfg = fsMatchConfig(this.cfg.minutes, 1);
    // sem escolha, equilibra: quem ainda não escolheu entra no time com menos gente
    const count: [number, number] = [0, 0];
    for (const m of humans) {
      const t = this.teamPref.get(m.id);
      if (t === 0 || t === 1) count[t]++;
    }
    const teamOf = (id: string): 0 | 1 => {
      const t = this.teamPref.get(id);
      if (t === 0 || t === 1) return t;
      const pick = count[0] <= count[1] ? 0 : 1;
      count[pick]++;
      return pick;
    };
    const humanTeams = humans.map((m) => ({ id: m.id, name: m.username, team: bomb ? teamOf(m.id) : undefined }));
    // cada time tem no máximo 5: os bots só completam o que sobra do lado de cada um
    const humansIn: [number, number] = [0, 0];
    for (const h of humanTeams) if (h.team !== undefined) humansIn[h.team]++;
    const botTeams: [number, number] = [Math.max(0, Math.min(this.cfg.botsCt, 5 - humansIn[0])), Math.max(0, Math.min(this.cfg.botsTr, 5 - humansIn[1]))];
    this.simOpts = {
      minutes: cfg.minutes,
      humans: humanTeams,
      bots: bomb ? botTeams[0] + botTeams[1] : Math.min(this.botTotal(), 10 - humans.length),
      botTeams: bomb ? botTeams : undefined,
      bomb: bomb ? { winRounds: this.cfg.winRounds, roundSec: this.cfg.roundSec, pvp: this.cfg.pvp || undefined } : undefined,
      map: this.cfg.pvp ? 'pvp' : 'duna',
    };
    this.sim = new FsNetSim(this.simOpts);
    // conexão direta: a contagem é um pouco maior para dar tempo de os aparelhos conectarem ao do líder
    this.p2pOk.clear();
    this.p2pRows = null;
    this.p2pBomb = null;
    this.p2pOver = false;
    this.p2pOverAt = 0;
    this.p2pHost = this.hostId ?? '';
    const hostM = this.members.get(this.p2pHost);
    this.net = this.p2pEnabled && hostM?.connected ? 'pending' : 'server';
    this.startAt = this.gnow() + (this.net === 'pending' ? FOXSHOT_P2P_COUNTDOWN_MS : FOXSHOT_COUNTDOWN_MS);
    this.p2pDeadline = this.startAt - 400;
    this.overAt = 0;
    this.phase = 'show';
    this.phaseEndsAt = this.startAt;
  }

  protected override maybeAdvanceFromPick() {}

  protected override toReveal() {
    this.phase = 'final';
    this.phaseEndsAt = null;
  }

  protected override reset() {
    super.reset();
    this.sim = null;
    this.net = 'server';
    this.p2pOk.clear();
    this.p2pRows = null;
    this.p2pBomb = null;
    this.p2pOver = false;
  }

  override disconnect(id: string) {
    super.disconnect(id);
    if (this.phase === 'play' && this.net === 'server') this.sim?.takeOver(id);
  }

  override leave(id: string) {
    if ((this.phase === 'play' || this.phase === 'show') && this.net === 'server') this.sim?.takeOver(id);
    super.leave(id);
  }

  /** Entradas de uma pessoa (um pacote traz as últimas). Só vale com a partida rolando. */
  receive(id: string, raw: unknown): void {
    if (this.phase !== 'play' || !this.sim || this.net !== 'server') return;
    const list = Array.isArray(raw) ? raw.slice(0, 8) : [raw];
    for (const r of list) {
      const inp = fsNetParseInput(r);
      if (inp) this.sim.pushInput(id, inp);
    }
  }

  /** O líder encerra a partida com o placar de agora (sala ou aparelho do líder, tanto faz). */
  endMatch(id: string): void {
    this.requireHost(id);
    if (this.phase !== 'play') throw new RoomError('A partida não está rolando');
    if (this.net === 'p2p') {
      // vale o último placar que o líder mandou
      this.p2pOver = true;
      this.p2pOverAt = this.now() - OVER_MS;
    } else this.sim?.endNow();
    this.dirty = true;
  }

  /** Quem precisa conectar ao aparelho do líder: todo mundo que está na sala agora. */
  private p2pPeers(): string[] {
    return [...this.members.values()].filter((m) => m.connected).map((m) => m.id);
  }

  /** Um aparelho avisa que conectou ao do líder (`ok`) ou que não conseguiu (a partida vai para o servidor). */
  p2pReport(id: string, ok: unknown): void {
    if (this.net !== 'pending' || !this.members.has(id)) return;
    if (ok === true) this.p2pOk.add(id);
    else this.toServerMode();
    this.dirty = true;
  }

  /** O líder manda o placar (de tempos em tempos e no fim): é o que vale se ele sair ou a partida acabar. */
  p2pStatus(from: string, rows: unknown, over: boolean, bomb?: unknown): void {
    const b = bomb as { tr?: unknown; ct?: unknown; winner?: unknown; sides?: Record<string, unknown> } | null | undefined;
    if (this.net === 'p2p' && from === this.p2pHost && b && typeof b === 'object' && typeof b.tr === 'number' && typeof b.ct === 'number') {
      const sides: Record<string, 'tr' | 'ct'> = {};
      for (const [k, v] of Object.entries(b.sides ?? {}).slice(0, 12)) if (v === 'tr' || v === 'ct') sides[k.slice(0, 40)] = v;
      this.p2pBomb = { tr: Math.max(0, Math.min(99, Math.round(b.tr))), ct: Math.max(0, Math.min(99, Math.round(b.ct))), winner: b.winner === 'tr' || b.winner === 'ct' ? b.winner : null, sides };
    }
    if (this.net !== 'p2p' || from !== this.p2pHost || !Array.isArray(rows)) return;
    const clean = rows.slice(0, 10).flatMap((r) => {
      const o = r as Record<string, unknown>;
      const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1e6, Math.min(1e6, Math.round(v))) : 0);
      return typeof o?.id === 'string' && typeof o.name === 'string' ? [{ id: o.id.slice(0, 40), name: o.name.slice(0, 24), points: n(o.points), kills: n(o.kills), assists: n(o.assists), deaths: n(o.deaths), place: n(o.place) }] : [];
    });
    if (clean.length === 0) return;
    this.p2pRows = clean;
    if (over && !this.p2pOver) {
      this.p2pOver = true;
      this.p2pOverAt = this.now();
    }
    this.dirty = true;
  }

  /** Volta ao jeito de sempre: esta sala simula (alguém não conseguiu conectar, ou o prazo acabou). */
  private toServerMode(): void {
    if (this.net === 'server') return;
    this.net = 'server';
    this.dirty = true;
  }

  /** A sala está simulando (o quadro `fss` sai daqui). */
  get serverSimulates(): boolean {
    return this.net === 'server';
  }

  override tick(): boolean {
    if (this.phase === 'show' && this.net === 'pending') {
      const ready = this.p2pPeers().every((id) => this.p2pOk.has(id));
      if (ready) {
        this.net = 'p2p';
        this.dirty = true;
      } else if (this.gnow() >= this.p2pDeadline) this.toServerMode();
    }
    if (this.phase === 'play' && this.net === 'p2p') {
      // o líder simula; aqui só se espera o fim (ou o líder sumir: fica o último placar dele)
      const t = this.now();
      const host = this.members.get(this.p2pHost);
      if (!host?.connected && !this.p2pOver) {
        this.p2pOver = true;
        this.p2pOverAt = t - OVER_MS;
      }
      if (this.p2pOver && t - this.p2pOverAt >= OVER_MS) {
        this.phase = 'final';
        this.phaseEndsAt = null;
        return true;
      }
      const d = this.dirty;
      this.dirty = false;
      return d;
    }
    return this.tickServer();
  }

  private tickServer(): boolean {
    const t = this.gnow();
    if (this.phase === 'show') {
      if (t < this.startAt) return false;
      this.phase = 'play';
      this.phaseEndsAt = null;
      this.startAt = t;
      return true;
    }
    if (this.phase !== 'play' || !this.sim) return false;
    const want = Math.floor((t - this.startAt) / STEP_MS);
    let n = 0;
    while (this.sim.tick < want && n++ < MAX_CATCHUP && !this.sim.over) this.sim.step();
    // se atrasou demais, descarta o atraso (não corre atrás do tempo perdido)
    if (this.sim.tick < want - 30) this.startAt = t - this.sim.tick * STEP_MS;
    if (this.sim.over) {
      if (this.overAt === 0) this.overAt = t;
      if (t - this.overAt >= OVER_MS) {
        this.phase = 'final';
        this.phaseEndsAt = null;
        return true;
      }
    }
    const d = this.dirty;
    this.dirty = false;
    return d;
  }

  /** Eventos acumulados e quadros (o `FoxShotRoom` transmite). */
  drainEvents(): FsNetEvent[] {
    return this.net === 'server' ? (this.sim?.drainEvents() ?? []) : [];
  }
  frameFor(id: string) {
    if (!this.sim || this.net !== 'server') return null;
    return { f: this.sim.frame(), s: this.sim.selfState(id) };
  }

  override finalRows(): FinalRow[] {
    if (this.p2pRows) {
      return this.p2pRows.map((r) => ({ userId: r.id, username: r.name, totalTenths: r.points * 10, placement: r.place || 1, answers: [] }));
    }
    if (!this.sim) return [];
    return this.sim.results().map((r) => ({
      userId: r.id,
      username: r.name,
      totalTenths: r.points * 10,
      placement: r.place,
      answers: [],
    }));
  }

  protected override extraSnapshot(): Record<string, unknown> {
    const s = this.sim;
    return {
      foxshot: {
        minutes: this.cfg.minutes,
        bots: this.cfg.bots,
        botsCt: this.cfg.botsCt,
        botsTr: this.cfg.botsTr,
        kind: this.cfg.kind,
        winRounds: this.cfg.winRounds,
        roundSec: this.cfg.roundSec,
        map: this.cfg.pvp ? 'pvp' : 'duna',
        pvp: this.cfg.pvp,
        teams: Object.fromEntries(this.teamPref),
        startAt: this.phase === 'lobby' ? null : this.startAt,
        roster: s ? s.roster : null,
        hz: FS_NET_HZ,
        net: this.phase === 'lobby' ? 'server' : this.net,
        p2pHost: this.net === 'server' ? null : this.p2pHost,
        setup: this.net === 'server' ? null : this.simOpts,
        over: this.net === 'p2p' ? this.p2pOver : (s?.over ?? false),
        bomb: this.net === 'p2p' ? this.p2pBomb : (s?.bombResult() ?? null),
        score: this.p2pRows ? this.p2pRows : s ? s.results().map((r) => ({ id: r.id, name: r.name, points: r.points, kills: r.kills, assists: r.assists, deaths: r.deaths })) : null,
      },
    };
  }
}

export { RoomError };
